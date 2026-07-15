import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * REIMPRESSÃO DE ETIQUETA (fluxo à parte da catalogação).
 *
 * POR QUE EXISTE: uma etiqueta física se perde/rasga/é descartada por engano, mas o
 * balde EXISTE. Aqui o painel reenvia UMA etiqueta pra fila de impressão — com o LOTE
 * e a DATA que já existem (sai idêntica, não cunha nada novo).
 *
 * Diferente de /api/fila/catalogo (idempotente por lote — nunca ressuscita um lote já
 * na fila): reimpressão é INTENCIONAL. Insere mesmo que o lote já tenha sido impresso;
 * só não empilha se já houver uma etiqueta PENDING do mesmo lote (evita duplo clique).
 *
 * Body: { lot, product_name, fabricacao (YYYY-MM-DD), omie_produto_id }
 * Auth: x-mo-token (MO_BRIDGE_TOKEN). service_role do próprio EtiquetaMO.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ORG_SLUG = "gelateria";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-mo-token");
  if (!process.env.MO_BRIDGE_TOKEN || token !== process.env.MO_BRIDGE_TOKEN) {
    return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  }

  let body: { lot?: string; product_name?: string; fabricacao?: string; omie_produto_id?: number };
  try { body = await request.json(); } catch { body = {}; }
  const lot = body.lot?.trim();
  if (!lot) return NextResponse.json({ ok: false, erro: "informe o código do balde (lot)" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
  if (!org) return NextResponse.json({ ok: false, erro: "organização não encontrada" }, { status: 500 });

  // De/para fiel: resolve o item pelo CÓDIGO do Omie, nunca por nome.
  let itemId: string | null = null;
  if (typeof body.omie_produto_id === "number" && body.omie_produto_id > 0) {
    const { data: it } = await supabase.from("items").select("id")
      .eq("organization_id", org.id).eq("omie_product_id", body.omie_produto_id).maybeSingle();
    itemId = it?.id ?? null;
  }

  // Já há uma etiqueta PENDING desse lote? Então já está na fila — não duplica.
  const { data: pend } = await supabase.from("omie_print_queue").select("id")
    .eq("organization_id", org.id).eq("lot", lot).eq("status", "pending").maybeSingle();
  if (pend) return NextResponse.json({ ok: true, ja_pendente: true, id: pend.id });

  // origem 'catalogo_moderna' (herda o comportamento de balde catalogado no /imprimir:
  // usa o lote existente no QR e a data de fabricação real). reimpressao:true só marca
  // a intenção. Balde COM lote → não re-cunha; sai idêntico ao original.
  const { data, error } = await supabase.from("omie_print_queue").insert({
    organization_id: org.id,
    product_name: body.product_name ?? lot,
    quantity: 1,
    lot,
    item_id: itemId,
    status: "pending",
    webhook_payload: {
      origem: "catalogo_moderna",
      fabricacao: body.fabricacao ?? null,
      lote: lot,
      omie_produto_id: body.omie_produto_id ?? null,
      reimpressao: true,
    },
  }).select("id").single();
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "reimprimir-etiqueta", tem_token: !!process.env.MO_BRIDGE_TOKEN });
}
