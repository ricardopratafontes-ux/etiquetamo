import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listarProdutos, OmieProduto } from "@/lib/omie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    const orgId = org.id;

    const { data: syncLog, error: syncLogError } = await supabase
      .from("omie_sync_log")
      .insert({ organization_id: orgId, sync_type: "products" as const })
      .select()
      .single();

    if (syncLogError) {
      return NextResponse.json({ error: "Erro ao criar log de sync" }, { status: 500 });
    }

    const { data: existingItems } = await supabase
      .from("items")
      .select("id, omie_product_id, name, code, barcode, manual_override")
      .eq("organization_id", orgId)
      .not("omie_product_id", "is", null);

    const existingMap = new Map<number, typeof existingItems extends (infer T)[] | null ? T : never>();
    if (existingItems) {
      for (const item of existingItems) {
        if (item.omie_product_id) {
          existingMap.set(item.omie_product_id, item);
        }
      }
    }

    const { data: existingQuarantine } = await supabase
      .from("omie_quarantine")
      .select("omie_product_id")
      .eq("organization_id", orgId)
      .eq("status", "pending");

    const quarantineSet = new Set<number>();
    if (existingQuarantine) {
      for (const q of existingQuarantine) {
        quarantineSet.add(q.omie_product_id);
      }
    }

    let pagina = 1;
    let totalOmie = 0;
    let matched = 0;
    let quarantined = 0;
    let updated = 0;
    let errors = 0;
    const allProducts: OmieProduto[] = [];

    while (true) {
      try {
        const response = await listarProdutos(pagina, 50);
        allProducts.push(...response.produto_servico_cadastro);
        totalOmie = response.total_de_registros;
        if (pagina >= response.total_de_paginas) break;
        pagina++;
      } catch (err) {
        errors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("omie_sync_log")
          .update({ details: { error_page: pagina, error_message: errMsg } })
          .eq("id", syncLog.id);
        break;
      }
    }

    for (const produto of allProducts) {
      const existing = existingMap.get(produto.codigo_produto);

      if (existing) {
        matched++;
        if (!existing.manual_override) {
          const updates: Record<string, unknown> = {};
          if (produto.codigo && produto.codigo !== existing.code) {
            updates.code = produto.codigo;
          }
          if (produto.ean && produto.ean !== existing.barcode) {
            updates.barcode = produto.ean;
          }
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from("items")
              .update(updates)
              .eq("id", existing.id);
            if (updateError) {
              errors++;
            } else {
              updated++;
            }
          }
        }
      } else {
        if (!quarantineSet.has(produto.codigo_produto)) {
          const { error: qError } = await supabase
            .from("omie_quarantine")
            .insert({
              organization_id: orgId,
              omie_product_id: produto.codigo_produto,
              omie_code: produto.codigo || null,
              product_name: produto.descricao,
              unit: produto.unidade || null,
              ean: produto.ean || null,
              raw_data: produto as unknown as Record<string, unknown>,
            });
          if (qError) {
            errors++;
          } else {
            quarantined++;
            quarantineSet.add(produto.codigo_produto);
          }
        }
      }
    }

    await supabase
      .from("omie_sync_log")
      .update({
        total_omie: totalOmie,
        matched,
        quarantined,
        updated,
        errors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLog.id);

    return NextResponse.json({
      success: true,
      summary: { total_omie: totalOmie, matched, quarantined, updated, errors },
      debug: {
        pages_fetched: pagina,
        products_received: allProducts.length,
        omie_key_present: !!process.env.OMIE_APP_KEY,
        omie_secret_present: !!process.env.OMIE_APP_SECRET,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
