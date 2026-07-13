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

  let body: { itens?: Array<{ product_name?: string; lot?: string; fabricacao?: string; quantity?: number }> };
  try { body = await request.json(); } catch { body = {}; }
  const itens = Array.isArray(body.itens) ? body.itens : [];
  if (itens.length === 0) return NextResponse.json({ ok: false, erro: "sem itens" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
  if (!org) return NextResponse.json({ ok: false, erro: "organização não encontrada" }, { status: 500 });

  const linhas = itens
    .filter((i) => i.product_name)
    .map((i) => ({
      organization_id: org.id,
      product_name: String(i.product_name),
      quantity: Number(i.quantity) > 0 ? Math.round(Number(i.quantity)) : 1,
      lot: i.lot ?? null,
      status: "pending" as const,
      webhook_payload: { origem: "catalogo_moderna", fabricacao: i.fabricacao ?? null, lote: i.lot ?? null },
    }));

  // Substitui a remessa: apaga os pendentes de origem catálogo ainda não impressos
  // e insere a lista atual. Torna o reenvio idempotente (sem duplicar, sem código antigo).
  await supabase.from("omie_print_queue").delete()
    .eq("organization_id", org.id)
    .eq("status", "pending")
    .filter("webhook_payload->>origem", "eq", "catalogo_moderna");

  const { data, error } = await supabase.from("omie_print_queue").insert(linhas).select("id");
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inseridos: data?.length ?? 0 });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "ponte-catalogo-moderna", tem_token: !!process.env.MO_BRIDGE_TOKEN });
}
