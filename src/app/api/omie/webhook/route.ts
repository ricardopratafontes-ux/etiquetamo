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
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * POST /api/omie/webhook
 *
 * REGRAS:
 * - Retornar HTTP 2XX em menos de 7 segundos
 * - Deduplicar: se mesma OP (nCodOP) já existe, atualiza
 * - Vincular item com 4 tentativas:
 *   1. omie_product_id (ID numérico OMIE)
 *   2. code = codigo do produto OMIE (case-insensitive)
 *   3. code = nCodProd como string (caso o código cadastrado seja o ID numérico)
 *   4. Match por nome normalizado (OMIE descricao contém item.name)
 * - Quando encontrar match, gravar omie_product_id no item para futuras buscas instantâneas
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
          produtoCodigo = produto.codigo || produto.codigo_produto_integracao || null;
          console.log("[OMIE Webhook] Produto encontrado:", {
            nome: productName,
            codigo: produtoCodigo,
            codigo_produto: produto.codigo_produto,
            nCodProd,
          });
        } catch (err) {
          console.error("[OMIE Webhook] Erro ao buscar produto:", err);
        }
      }

      // === VINCULAR ITEM ===
      // Carregar todos os itens ativos da org para matching robusto
      const { data: allItems } = await supabase
        .from("items")
        .select("id, name, code, omie_product_id")
        .eq("organization_id", orgId)
        .eq("active", true);

      const items = allItems || [];
      let itemId: string | null = null;
      let matchMethod = "none";

      // Tentativa 1: por omie_product_id (ID numérico OMIE já salvo)
      if (nCodProd) {
        const match = items.find((i) => i.omie_product_id === nCodProd);
        if (match) {
          itemId = match.id;
          matchMethod = "omie_product_id";
        }
      }

      // Tentativa 2: por code = codigo do produto OMIE (case-insensitive, trimmed)
      if (!itemId && produtoCodigo) {
        const codNorm = normalizar(produtoCodigo);
        const match = items.find((i) => i.code && normalizar(i.code) === codNorm);
        if (match) {
          itemId = match.id;
          matchMethod = "code_omie";
        }
      }

      // Tentativa 3: por code = nCodProd como string (caso código cadastrado = ID numérico)
      if (!itemId && nCodProd) {
        const idStr = String(nCodProd);
        const match = items.find((i) => i.code && i.code.trim() === idStr);
        if (match) {
          itemId = match.id;
          matchMethod = "code_numerico";
        }
      }

      // Tentativa 4: match por nome normalizado
      // O nome OMIE geralmente contém o nome local (ex: "GELATO 500ML COCO VERDE" contém "500ml coco verde")
      if (!itemId && productName) {
        const nomeOmieNorm = normalizar(productName);
        // Buscar itens cujo nome normalizado está contido no nome OMIE
        const matches = items.filter((i) => {
          const nomeItemNorm = normalizar(i.name);
          return nomeOmieNorm.includes(nomeItemNorm) || nomeItemNorm.includes(nomeOmieNorm);
        });
        if (matches.length === 1) {
          // Match único — seguro usar
          itemId = matches[0].id;
          matchMethod = "nome_unico";
        } else if (matches.length > 1) {
          // Múltiplos matches — pegar o mais específico (nome mais longo)
          const best = matches.sort((a, b) => b.name.length - a.name.length)[0];
          itemId = best.id;
          matchMethod = "nome_melhor";
        }
      }

      console.log("[OMIE Webhook] Match resultado:", {
        itemId,
        matchMethod,
        produtoCodigo,
        nCodProd,
        productName,
      });

      // Se encontrou match e o item não tem omie_product_id salvo, gravar para futuro
      if (itemId && nCodProd) {
        const matchedItem = items.find((i) => i.id === itemId);
        if (matchedItem && !matchedItem.omie_product_id) {
          await supabase
            .from("items")
            .update({ omie_product_id: nCodProd })
            .eq("id", itemId);
          console.log("[OMIE Webhook] omie_product_id salvo no item:", itemId, "->", nCodProd);
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
            webhook_payload: payload,
          }).eq("id", existing.id);

          return NextResponse.json({
            received: true, processed: true, action: "updated",
            topic, etapa: cEtapa, product: productName, matchMethod,
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
        received: true, processed: true, action: "created",
        topic, etapa: cEtapa, product: productName, matchMethod,
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
