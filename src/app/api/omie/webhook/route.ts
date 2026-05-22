import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consultarProduto } from "@/lib/omie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

/**
 * Normaliza string para comparação: lowercase, trim, remove acentos
 */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Extrai quantidade do evento OMIE.
 * O payload pode trazer o campo em diversas chaves dependendo da versão/tipo de evento.
 * Retorna o primeiro valor numérico > 0 encontrado, ou 1 como fallback.
 */
function extrairQuantidade(event: Record<string, unknown>): number {
  const camposQtd = [
    "nQtde", "qtd_prevista", "nQtdPrevista", "nQtdeProduzida",
    "qtde", "quantidade", "qtd", "nQtdProd",
  ];
  for (const campo of camposQtd) {
    const val = event[campo];
    if (val !== undefined && val !== null) {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 1;
}

/**
 * Extrai lote do evento OMIE — tenta diversas chaves possíveis.
 */
function extrairLote(event: Record<string, unknown>): string | null {
  const camposLote = [
    "cLote", "lote", "cNumeroLote", "cNumLote", "numero_lote",
  ];
  for (const campo of camposLote) {
    const val = event[campo];
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return null;
}

/**
 * Verifica se a etapa da OP indica finalização (produzido/encerrada).
 * Etapas OMIE típicas:
 *   "10" / "Planejada"
 *   "20" / "Confirmada"
 *   "30" / "Em Produção" / "EmProducao"
 *   "40" / "Produzida"
 *   "50" / "Encerrada"
 *   "60" / "Cancelada"
 * Quando a OP chega nessas etapas finais, não precisa mais aparecer na fila.
 */
function isEtapaFinalizada(cEtapa: string): boolean {
  const etapaNorm = normalizar(cEtapa);
  const finais = ["40", "50", "60", "produzida", "encerrada", "cancelada"];
  return finais.some((f) => etapaNorm.includes(f));
}

/**
 * POST /api/omie/webhook
 *
 * REGRAS:
 * - Retornar HTTP 2XX em menos de 7 segundos
 * - Deduplicar: se mesma OP (nCodOP) já existe, atualiza
 * - Auto-encerrar: se etapa = produzida/encerrada/cancelada, marcar como "completed"
 * - Vincular item com 4 tentativas (omie_product_id → code → code_numerico → nome)
 * - Extrair quantidade e lote do payload OMIE (múltiplas chaves possíveis)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log("[OMIE Webhook]", JSON.stringify(payload).slice(0, 800));

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

    const isProduction = topic.toLowerCase().includes("ordemproducao");

    if (isProduction) {
      const nCodProd = event.nCodProd || event.nCodProduto || null;
      const nCodOP = event.nCodOP || null;
      const cNumOP = event.cNumOP || null;
      const cEtapa = event.cEtapa || "";
      const cLote = extrairLote(event);
      const quantidade = extrairQuantidade(event);

      console.log("[OMIE Webhook] Dados extraidos:", {
        nCodProd, nCodOP, cNumOP, cEtapa, cLote, quantidade,
        raw_keys: Object.keys(event).join(", "),
      });

      // === AUTO-ENCERRAR OP FINALIZADA ===
      // Se a etapa indica que a OP já foi produzida/encerrada/cancelada,
      // e já existe no banco, marcar como "completed" para não acumular
      if (isEtapaFinalizada(cEtapa) && nCodOP) {
        const { data: existing } = await supabase
          .from("omie_print_queue")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("omie_order_id", nCodOP)
          .single();

        if (existing && existing.status === "pending") {
          await supabase.from("omie_print_queue").update({
            status: "completed",
            webhook_payload: payload,
          }).eq("id", existing.id);

          console.log("[OMIE Webhook] OP auto-encerrada (etapa finalizada):", nCodOP, cEtapa);
          return NextResponse.json({
            received: true, processed: true, action: "auto_completed",
            topic, etapa: cEtapa, reason: "etapa_finalizada",
          });
        }

        // Se não existe, não inserir — OP já finalizada não entra na fila
        if (!existing) {
          console.log("[OMIE Webhook] OP finalizada ignorada (não existia na fila):", nCodOP, cEtapa);
          return NextResponse.json({
            received: true, processed: false, action: "ignored",
            topic, etapa: cEtapa, reason: "etapa_finalizada_sem_fila",
          });
        }
      }

      // Buscar dados do produto via API OMIE
      let productName = `Produto OMIE #${nCodProd || "?"}`;
      let produtoCodigo: string | null = null;
      if (nCodProd) {
        try {
          const produto = await consultarProduto(nCodProd);
          productName = produto.descricao || productName;
          produtoCodigo = produto.codigo || produto.codigo_produto_integracao || null;
          console.log("[OMIE Webhook] Produto encontrado:", {
            nome: productName,
            codigo: produtoCodigo,
            nCodProd,
          });
        } catch (err) {
          console.error("[OMIE Webhook] Erro ao buscar produto:", err);
        }
      }

      // === VINCULAR ITEM ===
      const { data: allItems } = await supabase
        .from("items")
        .select("id, name, code, omie_product_id")
        .eq("organization_id", orgId)
        .eq("active", true);

      const items = allItems || [];
      let itemId: string | null = null;
      let matchMethod = "none";

      // Tentativa 1: por omie_product_id
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

      // Tentativa 4: match por nome normalizado
      if (!itemId && productName) {
        const nomeOmieNorm = normalizar(productName);
        const matches = items.filter((i) => {
          const nomeItemNorm = normalizar(i.name);
          return nomeOmieNorm.includes(nomeItemNorm) || nomeItemNorm.includes(nomeOmieNorm);
        });
        if (matches.length === 1) {
          itemId = matches[0].id;
          matchMethod = "nome_unico";
        } else if (matches.length > 1) {
          const best = matches.sort((a, b) => b.name.length - a.name.length)[0];
          itemId = best.id;
          matchMethod = "nome_melhor";
        }
      }

      console.log("[OMIE Webhook] Match resultado:", {
        itemId, matchMethod, produtoCodigo, nCodProd, productName, quantidade, cLote,
      });

      // Salvar omie_product_id no item para futuro
      if (itemId && nCodProd) {
        const matchedItem = items.find((i) => i.id === itemId);
        if (matchedItem && !matchedItem.omie_product_id) {
          await supabase
            .from("items")
            .update({ omie_product_id: nCodProd })
            .eq("id", itemId);
        }
      }

      // === DEDUPLICAÇÃO ===
      if (nCodOP) {
        const { data: existing } = await supabase
          .from("omie_print_queue")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("omie_order_id", nCodOP)
          .single();

        if (existing) {
          await supabase.from("omie_print_queue").update({
            product_name: productName,
            item_id: itemId,
            lot: cLote,
            quantity: quantidade,
            webhook_payload: payload,
          }).eq("id", existing.id);

          return NextResponse.json({
            received: true, processed: true, action: "updated",
            topic, etapa: cEtapa, product: productName, matchMethod, quantidade, lote: cLote,
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
        quantity: quantidade,
        lot: cLote,
        webhook_payload: payload,
      });

      return NextResponse.json({
        received: true, processed: true, action: "created",
        topic, etapa: cEtapa, product: productName, matchMethod, quantidade, lote: cLote,
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
    timestamp: new Date().toISOString(),
  });
}
