import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consultarProduto } from "@/lib/omie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Usar service_role para bypass de RLS (server-side webhook)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

/**
 * Normaliza string para comparacao: lowercase, trim, remove acentos
 */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Busca recursiva de campo no evento OMIE.
 * O payload pode ter campos no nivel raiz ou dentro de sub-objetos.
 */
function buscarCampo(obj: Record<string, unknown>, campos: string[]): unknown {
  // Primeiro tenta no nivel raiz
  for (const campo of campos) {
    if (obj[campo] !== undefined && obj[campo] !== null) {
      return obj[campo];
    }
  }
  // Depois tenta em sub-objetos (1 nivel de profundidade)
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sub = val as Record<string, unknown>;
      for (const campo of campos) {
        if (sub[campo] !== undefined && sub[campo] !== null) {
          return sub[campo];
        }
      }
    }
  }
  return undefined;
}

/**
 * Extrai quantidade do evento OMIE.
 * Tenta diversas chaves possiveis, inclusive em sub-objetos.
 */
function extrairQuantidade(event: Record<string, unknown>): number {
  const camposQtd = [
    "nQtde", "qtd_prevista", "nQtdPrevista", "nQtdeProduzida",
    "qtde", "quantidade", "qtd", "nQtdProd", "nQtdProduzida",
    "nQtdeSolicitada", "qtd_solicitada",
  ];
  const val = buscarCampo(event, camposQtd);
  if (val !== undefined) {
    const num = typeof val === "number" ? val : parseFloat(String(val));
    if (!isNaN(num) && num > 0) return num;
  }
  return 1;
}

/**
 * Extrai lote do evento OMIE.
 */
function extrairLote(event: Record<string, unknown>): string | null {
  const camposLote = [
    "cLote", "lote", "cNumeroLote", "cNumLote", "numero_lote",
    "cNumLoteOP", "cLoteOP",
  ];
  const val = buscarCampo(event, camposLote);
  if (val !== undefined && String(val).trim()) {
    return String(val).trim();
  }
  return null;
}

/**
 * Verifica se a etapa da OP indica finalizacao.
 * Etapas OMIE: 10=Planejada, 20=Confirmada, 30=Em Producao,
 * 40=Produzida, 50=Encerrada, 60=Cancelada
 */
function isEtapaFinalizada(cEtapa: string): boolean {
  if (!cEtapa) return false;
  const etapaNorm = normalizar(cEtapa);
  const finais = ["40", "50", "60", "produzida", "encerrada", "cancelada"];
  return finais.some((f) => etapaNorm.includes(f));
}

/**
 * POST /api/omie/webhook
 *
 * REGRAS:
 * - Retornar HTTP 2XX em menos de 7 segundos
 * - Deduplicar: se mesma OP (nCodOP) ja existe, atualiza
 * - Auto-encerrar: se etapa = produzida/encerrada/cancelada, marcar como "completed"
 * - Vincular item APENAS por codigo (omie_product_id -> code -> code_numerico)
 * - NUNCA vincular por nome (nomes sao gerenciados localmente)
 * - Extrair quantidade e lote do payload OMIE (multiplas chaves possiveis)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[OMIE Webhook] Payload recebido:", JSON.stringify(payload).slice(0, 1200));

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

    const isProduction = topic.toLowerCase().includes("ordemproducao") ||
                         topic.toLowerCase().includes("ordem_producao") ||
                         topic.toLowerCase().includes("op.");

    if (isProduction) {
      const nCodProd = event.nCodProd || event.nCodProduto || event.codigo_produto || null;
      const nCodOP = event.nCodOP || event.nCodOrdemProducao || event.codigo_op || null;
      const cNumOP = event.cNumOP || event.cNumOrdemProducao || event.numero_op || null;
      const cEtapa = event.cEtapa || event.etapa || event.cEtapaOP || "";
      const cLote = extrairLote(event);
      const quantidade = extrairQuantidade(event);

      console.log("[OMIE Webhook] Dados extraidos:", {
        nCodProd, nCodOP, cNumOP, cEtapa, cLote, quantidade,
        using_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        raw_keys: Object.keys(event).join(", "),
        raw_event: JSON.stringify(event).slice(0, 600),
      });

      // === CANCELAMENTO/EXCLUSÃO: sai da fila ===
      //
      // BUG CORRIGIDO (Ricardo, 14/07): a lógica antiga tratava TODA "etapa finalizada"
      // (40/50/60/produzida/encerrada) como "não precisa mais imprimir" e IGNORAVA a OP.
      // Mas no fluxo da Moderna, "Pronto no Freezer" (= OP concluída) é EXATAMENTE quando
      // o balde acabou de existir e PRECISA de etiqueta. A regra estava invertida: OPs
      // concluídas de balde (ex.: MANGABA 00623) sumiam sem nunca entrar na fila.
      //
      // Agora só o CANCELAMENTO REAL (topic .excluida / .cancelada) tira da fila.
      // Concluída e Alterada seguem para o fluxo de inserir/atualizar como pending.
      const isCancelamento = topic.toLowerCase().includes("excluida") ||
                             topic.toLowerCase().includes("cancelada");

      if (isCancelamento && nCodOP) {
        const { data: existing } = await supabase
          .from("omie_print_queue")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("omie_order_id", nCodOP)
          .single();

        if (existing && existing.status === "pending") {
          await supabase.from("omie_print_queue").update({
            status: "skipped", webhook_payload: payload,
          }).eq("id", existing.id);
          console.log("[OMIE Webhook] OP cancelada — saiu da fila:", nCodOP, topic);
        }
        return NextResponse.json({
          received: true, processed: true, action: "cancelada",
          topic, etapa: cEtapa,
        });
      }

      // Buscar dados do produto via API OMIE para obter o CODIGO
      let productName = "Produto OMIE #" + (nCodProd || "?");
      let produtoCodigo: string | null = null;
      if (nCodProd) {
        try {
          const produto = await consultarProduto(nCodProd);
          productName = produto.descricao || productName;
          produtoCodigo = produto.codigo || produto.codigo_produto_integracao || null;
          console.log("[OMIE Webhook] Produto OMIE:", {
            nome: productName, codigo: produtoCodigo, nCodProd,
          });
        } catch (err) {
          console.error("[OMIE Webhook] Erro ao buscar produto:", err);
        }
      }

      // === VINCULAR ITEM (APENAS POR CODIGO, NUNCA POR NOME) ===
      const { data: allItems } = await supabase
        .from("items")
        .select("id, name, code, omie_product_id")
        .eq("organization_id", orgId)
        .eq("active", true);

      const items = allItems || [];
      let itemId: string | null = null;
      let matchMethod = "none";

      // Tentativa 1: por omie_product_id (vinculo direto ja salvo)
      if (nCodProd) {
        const match = items.find((i) => i.omie_product_id === nCodProd);
        if (match) {
          itemId = match.id;
          matchMethod = "omie_product_id";
        }
      }

      // Tentativa 2: por code = codigo do produto OMIE
      if (!itemId && produtoCodigo) {
        const codNorm = normalizar(produtoCodigo);
        const match = items.find((i) => i.code && normalizar(i.code) === codNorm);
        if (match) {
          itemId = match.id;
          matchMethod = "code_omie";
        }
      }

      // Tentativa 3: por code = nCodProd como string
      if (!itemId && nCodProd) {
        const idStr = String(nCodProd);
        const match = items.find((i) => i.code && i.code.trim() === idStr);
        if (match) {
          itemId = match.id;
          matchMethod = "code_numerico";
        }
      }

      // NAO faz match por nome — nomes sao gerenciados localmente

      console.log("[OMIE Webhook] Match resultado:", {
        itemId, matchMethod, produtoCodigo, nCodProd, quantidade, cLote,
      });

      // Salvar omie_product_id no item para vinculos futuros
      if (itemId && nCodProd) {
        const matchedItem = items.find((i) => i.id === itemId);
        if (matchedItem && !matchedItem.omie_product_id) {
          await supabase
            .from("items")
            .update({ omie_product_id: nCodProd })
            .eq("id", itemId);
        }
      }

      // === DEDUPLICACAO por nCodOP ===
      if (nCodOP) {
        const { data: existing } = await supabase
          .from("omie_print_queue")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("omie_order_id", nCodOP)
          .single();

        if (existing) {
          const { error: updateErr } = await supabase.from("omie_print_queue").update({
            product_name: productName,
            item_id: itemId,
            lot: cLote,
            quantity: quantidade,
            webhook_payload: payload,
          }).eq("id", existing.id);

          console.log("[OMIE Webhook] OP atualizada (dedup):", nCodOP,
            updateErr ? `ERRO: ${updateErr.message}` : "OK");
          return NextResponse.json({
            received: true, processed: true, action: "updated",
            topic, matchMethod, quantidade, lote: cLote,
          });
        }
      }

      // Inserir nova entrada na fila
      const { error: insertErr } = await supabase.from("omie_print_queue").insert({
        organization_id: orgId,
        omie_order_id: nCodOP,
        omie_order_number: cNumOP,
        product_name: productName,
        item_id: itemId,
        quantity: quantidade,
        lot: cLote,
        webhook_payload: payload,
      });

      console.log("[OMIE Webhook] OP inserida:", nCodOP,
        insertErr ? `ERRO: ${insertErr.message}` : "OK");
      return NextResponse.json({
        received: true, processed: true, action: "created",
        topic, matchMethod, quantidade, lote: cLote,
      });
    }

    return NextResponse.json({ received: true, processed: false, topic });
  } catch (error) {
    console.error("[OMIE Webhook] Erro:", error);
    return NextResponse.json({ received: true, error: "internal" });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "EtiquetaMO OMIE Webhook",
    version: "v3",
    using_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    timestamp: new Date().toISOString(),
  });
}
