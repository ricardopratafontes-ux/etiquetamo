import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consultarProduto } from "@/lib/omie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

/**
 * POST /api/omie/webhook
 * Recebe webhooks do OMIE (formato omie-connect-2.0).
 *
 * REGRAS:
 * - Retornar HTTP 2XX em menos de 7 segundos
 * - Deduplicar: se mesma OP (nCodOP) já existe, atualiza em vez de criar nova
 * - Vincular item: tenta por omie_product_id, fallback por código do produto
 * - Extrair lote do evento se disponível
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[OMIE Webhook]", JSON.stringify(payload).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (!org) {
      console.error("[OMIE Webhook] Organizacao nao encontrada");
      return NextResponse.json({ received: true, processed: false });
    }

    const orgId = org.id;
    const topic = payload.topic || "";
    const event = payload.event || {};

    // Detectar evento de ordem de producao
    const isProduction = topic.toLowerCase().includes("ordemproducao");

    if (isProduction) {
      const nCodProd = event.nCodProd || event.nCodProduto || null;
      const nCodOP = event.nCodOP || null;
      const cNumOP = event.cNumOP || null;
      const cEtapa = event.cEtapa || "";
      const cLote = event.cLote || event.lote || event.cNumeroLote || null;

      // Buscar dados do produto via API OMIE
      let productName = `Produto OMIE #${nCodProd || "?"}`;
      let produtoCodigo: string | null = null;
      if (nCodProd) {
        try {
          const produto = await consultarProduto(nCodProd);
          productName = produto.descricao || productName;
          produtoCodigo = produto.codigo || null;
        } catch (err) {
          console.error("[OMIE Webhook] Erro ao buscar produto:", err);
        }
      }

      // Tentar vincular ao item do EtiquetaMO
      let itemId: string | null = null;
      if (nCodProd) {
        // Tentativa 1: por omie_product_id (ID numérico OMIE)
        const { data: item } = await supabase
          .from("items")
          .select("id")
          .eq("organization_id", orgId)
          .eq("omie_product_id", nCodProd)
          .single();
        itemId = item?.id || null;

        // Tentativa 2: fallback por código do produto
        if (!itemId && produtoCodigo) {
          const { data: itemByCodigo } = await supabase
            .from("items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("code", produtoCodigo)
            .single();
          itemId = itemByCodigo?.id || null;
        }
      }

      // Deduplicação: se OP com mesmo omie_order_id já existe, atualizar
      if (nCodOP) {
        const { data: existing } = await supabase
          .from("omie_print_queue")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("omie_order_id", nCodOP)
          .single();

        if (existing) {
          // Atualizar entrada existente (não recriar)
          await supabase.from("omie_print_queue").update({
            product_name: productName,
            item_id: itemId,
            lot: cLote,
            webhook_payload: payload,
          }).eq("id", existing.id);

          return NextResponse.json({
            received: true,
            processed: true,
            action: "updated",
            topic,
            etapa: cEtapa,
            product: productName,
          });
        }
      }

      // Inserir nova entrada na fila
      await supabase.from("omie_print_queue").insert({
        organization_id: orgId,
        omie_order_id: nCodOP,
        omie_order_number: cNumOP,
        product_name: productName,
        item_id: itemId,
        quantity: 1,
        lot: cLote,
        webhook_payload: payload,
      });

      return NextResponse.json({
        received: true,
        processed: true,
        action: "created",
        topic,
        etapa: cEtapa,
        product: productName,
      });
    }

    // Evento nao-producao: aceitar sem processar
    return NextResponse.json({ received: true, processed: false, topic });
  } catch (error) {
    console.error("[OMIE Webhook] Erro:", error);
    return NextResponse.json({ received: true, error: "internal" });
  }
}

// GET para teste de conectividade
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "EtiquetaMO OMIE Webhook",
    timestamp: new Date().toISOString(),
  });
}
