import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

/**
 * POST /api/omie/webhook
 * Recebe webhooks do OMIE.
 *
 * REGRAS CRÍTICAS:
 * - Deve retornar HTTP 2XX em menos de 7 segundos (fila principal)
 * - Padrão accept-and-store: salva o payload e processa depois
 * - Se não retornar 2XX, OMIE retenta 3x com intervalo de 1-4s
 * - DLQ: até 5 dias, timeout 20s, retry cada 10min
 *
 * GATILHO: quando ordem de produção entra na etapa "Produzindo" (4ª no kanban)
 * → salva na fila de impressão para o operador decidir quando imprimir
 */
export async function POST(request: NextRequest) {
  try {
    // Parse do payload — responder rápido
    const payload = await request.json();

    // Log do webhook para debug
    console.log("[OMIE Webhook]", JSON.stringify(payload).slice(0, 500));

    // Verificar se é evento relevante (produção em "Produzindo")
    // Formato do webhook OMIE varia por tipo de evento
    // Campos comuns: topic, event, payload/data
    const topic = payload.topic || payload.messageType || "";
    const event = payload.event || payload.action || "";

    // Accept-and-store: salvar no banco independente do tipo
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar org
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (!org) {
      // Retornar 200 mesmo assim para não entrar em retry
      console.error("[OMIE Webhook] Organização não encontrada");
      return NextResponse.json({ received: true, processed: false });
    }

    const orgId = org.id;

    // Detectar se é um evento de produção
    // OMIE pode enviar diferentes formatos dependendo do webhook configurado
    // Vamos tratar os formatos mais comuns
    const isProduction =
      topic.toLowerCase().includes("produc") ||
      topic.toLowerCase().includes("ordem") ||
      event.toLowerCase().includes("produzindo") ||
      payload.etapa?.toLowerCase() === "produzindo" ||
      payload.fase?.toLowerCase() === "produzindo" ||
      payload.status?.toLowerCase() === "produzindo";

    if (isProduction) {
      // Extrair dados do produto/ordem
      const orderData = extractOrderData(payload);

      if (orderData.productName) {
        // Tentar encontrar o item no EtiquetaMO
        let itemId: string | null = null;

        if (orderData.omieProductId) {
          const { data: item } = await supabase
            .from("items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("omie_product_id", orderData.omieProductId)
            .single();

          itemId = item?.id || null;
        }

        // Inserir na fila de impressão
        await supabase.from("omie_print_queue").insert({
          organization_id: orgId,
          omie_order_id: orderData.orderId || null,
          omie_order_number: orderData.orderNumber || null,
          product_name: orderData.productName,
          item_id: itemId,
          quantity: orderData.quantity || 1,
          lot: orderData.lot || null,
          webhook_payload: payload,
        });
      }
    }

    // Sempre retornar 200 para OMIE não retentar
    return NextResponse.json({
      received: true,
      processed: isProduction,
      topic,
      event,
    });
  } catch (error) {
    console.error("[OMIE Webhook] Erro:", error);
    // Mesmo com erro, retornar 200 para evitar loop de retries
    // O payload já foi logado acima
    return NextResponse.json({ received: true, error: "internal" });
  }
}

/**
 * Extrai dados relevantes do payload do webhook OMIE
 * Como o formato pode variar, tentamos vários caminhos
 */
function extractOrderData(payload: Record<string, unknown>): {
  orderId: number | null;
  orderNumber: string | null;
  productName: string;
  omieProductId: number | null;
  quantity: number;
  lot: string | null;
} {
  // Tentar diferentes estruturas de payload OMIE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any;

  return {
    orderId:
      p.nCodOP || p.codigo_op || p.nCodOrdem || p.id || null,
    orderNumber:
      p.cNumeroOP || p.numero_op || p.cNumeroOrdem || String(p.numero || "") || null,
    productName:
      p.descricao_produto || p.cDescricao || p.produto?.descricao ||
      p.nome_produto || p.descricao || "Produto OMIE (sem nome)",
    omieProductId:
      p.nCodProduto || p.codigo_produto || p.produto?.codigo_produto || null,
    quantity:
      p.nQtde || p.quantidade || p.qtde || 1,
    lot:
      p.cLote || p.lote || null,
  };
}

// GET para teste de conectividade
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "EtiquetaMO OMIE Webhook",
    timestamp: new Date().toISOString(),
  });
}
