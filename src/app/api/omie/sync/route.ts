import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listarProdutos, OmieProduto } from "@/lib/omie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

/**
 * POST /api/omie/sync
 * Sincronização manual de produtos OMIE → EtiquetaMO
 *
 * Regras (CLAUDE.md):
 * - NÃO insere itens automaticamente
 * - Itens existentes (por omie_product_id) → atualiza nome, código, EAN (sem sobrescrever campos operacionais)
 * - Itens desconhecidos → quarentena para cadastro manual
 * - Sincronização OMIE nunca sobrescreve campos operacionais definidos manualmente (Rule 10)
 */
export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar org
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    const orgId = org.id;

    // Criar log de sincronização
    const { data: syncLog, error: syncLogError } = await supabase
      .from("omie_sync_log")
      .insert({ organization_id: orgId, sync_type: "products" as const })
      .select()
      .single();

    if (syncLogError) {
      return NextResponse.json({ error: "Erro ao criar log de sync" }, { status: 500 });
    }

    // Buscar todos os itens existentes com omie_product_id
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

    // Buscar quarentena pendente para não duplicar
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

    // Buscar todos os produtos OMIE (paginado)
    let pagina = 1;
    let totalOmie = 0;
    let matched = 0;
    let quarantined = 0;
    let updated = 0;
    let errors = 0;
    const allProducts: OmieProduto[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        console.log(`[OMIE Sync] Buscando página ${pagina}...`);
        const response = await listarProdutos(pagina, 50);
        console.log(`[OMIE Sync] Página ${pagina}: ${response.produto_servico_cadastro?.length || 0} produtos, total_registros=${response.total_de_registros}, total_paginas=${response.total_de_paginas}`);
        allProducts.push(...response.produto_servico_cadastro);
        totalOmie = response.total_de_registros;

        if (pagina >= response.total_de_paginas) break;
        pagina++;
      } catch (err) {
        errors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[OMIE Sync] Erro ao buscar página ${pagina}:`, errMsg);
        // Incluir detalhe do erro no resultado
        await supabase
          .from("omie_sync_log")
          .update({ details: { error_page: pagina, error_message: errMsg } })
          .eq("id", syncLog.id);
        break;
      }
    }

    // Processar cada produto
    for (const produto of allProducts) {
      const existing = existingMap.get(produto.codigo_produto);

      if (existing) {
        // Produto já existe no EtiquetaMO
        matched++;

        // Atualizar APENAS código e EAN (nunca o nome — nomes do EtiquetaMO são definitivos)
        // Rule 10: Sincronização OMIE nunca sobrescreve campos operacionais
        if (!existing.manual_override) {
          const updates: Record<string, unknown> = {};
          // NUNCA atualizar name — os nomes cadastrados no EtiquetaMO são menores e mais convenientes
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
              console.error(`Erro ao atualizar item ${existing.id}:`, updateError);
            } else {
              updated++;
            }
          }
        }
      } else {
        // Produto NÃO existe → quarentena (se ainda não estiver lá)
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
            console.error(`Erro ao quarentenar produto ${produto.codigo_produto}:`, qError);
          } else {
            quarantined++;
            quarantineSet.add(produto.codigo_produto);
          }
        }
      }
    }

    // Atualizar log de sincronização
    await supabase
      .from("omie_sync_log")
      .update({
        total_omie: total