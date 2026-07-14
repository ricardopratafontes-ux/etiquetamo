import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Ponte Painel Moderna → EtiquetaMO.
 * O Painel de Controle (catalogação de baldes) empurra itens pra fila de
 * impressão do EtiquetaMO. Auth por token compartilhado (MO_BRIDGE_TOKEN).
 * Usa a service_role do PRÓPRIO EtiquetaMO — nenhuma chave cruza de app.
 *
 * Body: { itens: [{ product_name, lot, fabricacao (YYYY-MM-DD), quantity }] }
 * Insere em omie_print_queue (status 'pending'); o /imprimir casa o item pelo
 * nome, e usa webhook_payload.fabricacao como data de fabricação (balde antigo).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ORG_SLUG = "gelateria";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-mo-token");
  const esperado = process.env.MO_BRIDGE_TOKEN;
  if (!esperado || token !== esperado) {
    return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  }

  let body: { itens?: Array<{ product_name?: string; lot?: string; fabricacao?: string; quantity?: number; omie_produto_id?: number }> };
  try { body = await request.json(); } catch { body = {}; }
  const itens = Array.isArray(body.itens) ? body.itens : [];
  if (itens.length === 0) return NextResponse.json({ ok: false, erro: "sem itens" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
  if (!org) return NextResponse.json({ ok: false, erro: "organização não encontrada" }, { status: 500 });

  // De/para: resolve o item pelo CÓDIGO do Omie (produtos.omie_codigo_produto ==
  // items.omie_product_id). É a chave fiel — casa por identidade, nunca por nome
  // (evita "COCO SECO" virar "COCO SECO RALADO", gelato virar barra, etc.).
  // Sem código ou sem item correspondente => item_id null (fica pendente pra
  // vínculo manual no /imprimir; melhor perguntar do que adivinhar errado).
  const codigos = [...new Set(
    itens.map((i) => i.omie_produto_id).filter((x): x is number => typeof x === "number" && x > 0),
  )];
  const itemPorCodigo = new Map<number, string>();
  if (codigos.length > 0) {
    const { data: its } = await supabase
      .from("items").select("id, omie_product_id")
      .eq("organization_id", org.id).in("omie_product_id", codigos);
    for (const it of (its ?? []) as Array<{ id: string; omie_product_id: number | null }>) {
      if (it.omie_product_id != null) itemPorCodigo.set(Number(it.omie_product_id), it.id);
    }
  }

  const linhas = itens
    .filter((i) => i.product_name)
    .map((i) => ({
      organization_id: org.id,
      product_name: String(i.product_name),
      quantity: Number(i.quantity) > 0 ? Math.round(Number(i.quantity)) : 1,
      lot: i.lot ?? null,
      item_id: typeof i.omie_produto_id === "number" ? (itemPorCodigo.get(i.omie_produto_id) ?? null) : null,
      status: "pending" as const,
      webhook_payload: { origem: "catalogo_moderna", fabricacao: i.fabricacao ?? null, lote: i.lot ?? null, omie_produto_id: i.omie_produto_id ?? null },
    }));

  // Idempotente por LOTE (nunca reimprime): o painel manda o conjunto todo a cada
  // catalogação, mas aqui só INSERIMOS lotes que ainda NÃO existem na fila (em
  // qualquer status). Lote já impresso (status != 'pending') ou já pendente fica
  // como está — reenviar não o ressuscita. Sem delete: nada do que já foi pra
  // impressão é apagado/recriado. (Reimpressão intencional é fluxo à parte.)
  const lotesIn = [...new Set(linhas.map((l) => l.lot).filter((x): x is string => !!x))];
  const jaExiste = new Set<string>();
  if (lotesIn.length > 0) {
    const { data: existentes } = await supabase.from("omie_print_queue")
      .select("lot")
      .eq("organization_id", org.id)
      .filter("webhook_payload->>origem", "eq", "catalogo_moderna")
      .in("lot", lotesIn);
    for (const r of (existentes ?? []) as Array<{ lot: string | null }>) if (r.lot) jaExiste.add(r.lot);
  }
  const novas = linhas.filter((l) => l.lot && !jaExiste.has(l.lot));
  if (novas.length === 0) return NextResponse.json({ ok: true, inseridos: 0, ja_na_fila: jaExiste.size });

  const { data, error } = await supabase.from("omie_print_queue").insert(novas).select("id");
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inseridos: data?.length ?? 0, ja_na_fila: jaExiste.size });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "ponte-catalogo-moderna", tem_token: !!process.env.MO_BRIDGE_TOKEN });
}
