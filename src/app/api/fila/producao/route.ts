import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SCHEMA } from "@/lib/supabaseSchema";

/**
 * Ponte PCP (pcp-moderna) → EtiquetaMO.
 *
 * O PCP conclui uma OP, a RPC pcp_concluir_op cunha o lote de produto acabado
 * (código YYMMDD-NNNN) e o PCP empurra UMA entrada pra fila de impressão daqui.
 * O EtiquetaMO continua sendo o ÚNICO lugar que compõe e imprime etiqueta
 * (regras de validade, layout 110mm, trava de lote) — o PCP nunca renderiza.
 *
 * Auth por token compartilhado (MO_BRIDGE_TOKEN), mesmo padrão do /api/fila/catalogo.
 * Usa a service_role do PRÓPRIO EtiquetaMO — nenhuma chave cruza de app.
 *
 * Body: {
 *   op_numero,             // ordens_producao.numero do PCP (vira o "OP #" da fila)
 *   omie_op_codigo?,       // nCodOP se a OP foi espelhada no Omie (casa com o webhook)
 *   product_name,          // nome do produto no PCP (exibição; o vínculo é por código)
 *   lot,                   // código do lote do PCP — identidade do lote físico, vai no QR
 *   fabricacao?,           // YYYY-MM-DD real do lote (a VAL é calculada AQUI: fab + expiry_days)
 *   quantity?,             // qtd BRUTA produzida (mesma semântica do nQtde do webhook)
 *   omie_produto_id?,      // produtos.omie_codigo_produto — resolve items.omie_product_id
 *   reimpressao?           // true = etiqueta perdida/rasgada; insere mesmo com lote já impresso
 * }
 *
 * COMPETIÇÃO COM O WEBHOOK DO OMIE (a razão desta rota não ser um insert cego):
 * uma OP do PCP enviada ao Omie dispara o webhook quando muda de etapa lá. Pra mesma
 * produção nunca virar duas linhas: (1) se o webhook chegou primeiro, esta rota ACHA a
 * linha por omie_order_id e a completa (lote, item, fabricação) em vez de inserir;
 * (2) se o PCP chegou primeiro, o webhook detecta origem 'pcp_moderna' e não sobrescreve.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ORG_SLUG = "gelateria";

interface BodyPCP {
  op_numero?: number | string;
  omie_op_codigo?: number | null;
  product_name?: string;
  lot?: string;
  fabricacao?: string | null;
  quantity?: number;
  omie_produto_id?: number | null;
  reimpressao?: boolean;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-mo-token");
  if (!process.env.MO_BRIDGE_TOKEN || token !== process.env.MO_BRIDGE_TOKEN) {
    return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  }

  let body: BodyPCP;
  try { body = await request.json(); } catch { body = {}; }
  const lot = body.lot?.trim();
  const productName = body.product_name?.trim();
  if (!lot) return NextResponse.json({ ok: false, erro: "informe o código do lote (lot)" }, { status: 400 });
  if (!productName) return NextResponse.json({ ok: false, erro: "informe o nome do produto (product_name)" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: SUPABASE_SCHEMA } });
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
  if (!org) return NextResponse.json({ ok: false, erro: "organização não encontrada" }, { status: 500 });

  // De/para fiel: resolve o item pelo CÓDIGO do Omie, nunca por nome (regra da casa —
  // "COCO SECO" já virou "COCO SECO RALADO" no passado). Sem código ou sem item
  // correspondente => item_id null, fica pendente pra vínculo manual no /imprimir.
  let itemId: string | null = null;
  if (typeof body.omie_produto_id === "number" && body.omie_produto_id > 0) {
    const { data: it } = await supabase.from("items").select("id")
      .eq("organization_id", org.id).eq("omie_product_id", body.omie_produto_id).maybeSingle();
    itemId = it?.id ?? null;
  }

  const quantity = Number(body.quantity) > 0 ? Math.round(Number(body.quantity)) : 1;
  const payloadPCP = {
    origem: "pcp_moderna",
    fabricacao: body.fabricacao ?? null,
    lote: lot,
    omie_produto_id: body.omie_produto_id ?? null,
    pcp_op_numero: body.op_numero ?? null,
    ...(body.reimpressao ? { reimpressao: true } : {}),
  };

  // REIMPRESSÃO (etiqueta perdida/rasgada, lote físico existe): intencional, insere
  // mesmo que o lote já tenha sido impresso. Só não empilha se já há PENDING do mesmo
  // lote (duplo clique). Sem omie_order_id de propósito: uma linha de reimpressão com
  // nCodOP quebraria o .single() do dedupe do webhook e abriria porta pra duplicata.
  if (body.reimpressao) {
    const { data: pend } = await supabase.from("omie_print_queue").select("id")
      .eq("organization_id", org.id).eq("lot", lot).eq("status", "pending").maybeSingle();
    if (pend) return NextResponse.json({ ok: true, ja_pendente: true, id: pend.id });

    const { data, error } = await supabase.from("omie_print_queue").insert({
      organization_id: org.id,
      product_name: productName,
      quantity: 1,
      lot,
      item_id: itemId,
      status: "pending",
      webhook_payload: payloadPCP,
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reimpressao: true, id: data?.id });
  }

  // PRIMEIRA VIA — idempotente por LOTE (qualquer status, qualquer origem): reenviar a
  // mesma conclusão de OP não ressuscita nem duplica. Formatos não colidem (PCP usa
  // YYMMDD-NNNN; cunhagem do Painel usa B####/M####), então lote igual = mesma produção.
  const { data: existenteLote } = await supabase.from("omie_print_queue")
    .select("id, status, omie_order_id")
    .eq("organization_id", org.id).eq("lot", lot).limit(1).maybeSingle();
  if (existenteLote) {
    // Backfill do nCodOP: a OP pode ter sido enviada ao Omie DEPOIS de concluída e
    // etiquetada — a linha daqui nasceu sem omie_order_id e o webhook não a acharia,
    // inserindo uma duplicata no próximo evento. O PCP reinforma a ponte após o envio
    // ao ERP e o vínculo fecha aqui, em qualquer status (linha impressa também: o
    // webhook precisa achá-la pra cair no kept_pcp em vez de criar linha nova).
    if (!existenteLote.omie_order_id && typeof body.omie_op_codigo === "number" && body.omie_op_codigo > 0) {
      await supabase.from("omie_print_queue").update({
        omie_order_id: body.omie_op_codigo,
      }).eq("id", existenteLote.id);
      return NextResponse.json({ ok: true, ja_na_fila: true, omie_vinculado: true, id: existenteLote.id, status: existenteLote.status });
    }
    return NextResponse.json({ ok: true, ja_na_fila: true, id: existenteLote.id, status: existenteLote.status });
  }

  // A OP foi espelhada no Omie? Então o webhook pode já ter criado a linha (etapa
  // movida no kanban do Omie antes da conclusão aqui). Completa em vez de inserir.
  if (typeof body.omie_op_codigo === "number" && body.omie_op_codigo > 0) {
    const { data: existenteOP } = await supabase.from("omie_print_queue")
      .select("id, status, lot, item_id, quantity, webhook_payload")
      .eq("organization_id", org.id).eq("omie_order_id", body.omie_op_codigo)
      .limit(1).maybeSingle();

    if (existenteOP) {
      if (existenteOP.status !== "pending") {
        // Já impressa ou pulada pelo operador — não ressuscita (reimpressão é fluxo à parte).
        return NextResponse.json({ ok: true, ja_processada: true, id: existenteOP.id, status: existenteOP.status });
      }
      // Linha do webhook ainda pendente: o PCP é quem sabe o lote real, a fabricação e a
      // quantidade PRODUZIDA (o webhook só tem a planejada). Merge preserva o event do Omie.
      const payloadAntigo = (existenteOP.webhook_payload ?? {}) as Record<string, unknown>;
      const { error: errUpd } = await supabase.from("omie_print_queue").update({
        lot: existenteOP.lot ?? lot,
        item_id: existenteOP.item_id ?? itemId,
        quantity,
        webhook_payload: { ...payloadAntigo, ...payloadPCP },
      }).eq("id", existenteOP.id);
      if (errUpd) return NextResponse.json({ ok: false, erro: errUpd.message }, { status: 500 });
      return NextResponse.json({ ok: true, atualizado: true, id: existenteOP.id });
    }
  }

  const { data, error } = await supabase.from("omie_print_queue").insert({
    organization_id: org.id,
    omie_order_id: body.omie_op_codigo ?? null,
    omie_order_number: body.op_numero != null ? String(body.op_numero) : null,
    product_name: productName,
    quantity,
    lot,
    item_id: itemId,
    status: "pending",
    webhook_payload: payloadPCP,
  }).select("id").single();
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserido: true, id: data?.id, item_vinculado: !!itemId });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "ponte-pcp-moderna", tem_token: !!process.env.MO_BRIDGE_TOKEN });
}
