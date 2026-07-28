import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * CONFIRMA QUE A ETIQUETA SAIU NO PAPEL.
 *
 * POR QUE EXISTE
 * A cunhagem grava o lote no painel ANTES de imprimir, e um gatilho do painel já
 * reserva uma vaga na câmara pra ele no mesmo instante. Se a impressão morre no
 * meio (rede, aba fechada, impressora), sobra uma vaga ocupada por um balde que
 * nunca existiu — e a retentativa gastava códigos novos, criando mais fantasmas.
 *
 * Esta rota marca `moderna.lotes.impresso_em`. É o que separa "código que virou
 * etiqueta física" (intocável — o papel está colado num balde real) de "código que
 * ficou pra trás" (reaproveitável na próxima tentativa).
 *
 * Chamada de /imprimir logo depois que o HTML final vai pra janela de impressão.
 * Não é crítica: se falhar, o código apenas não fica reaproveitável — que é
 * exatamente o comportamento antigo. Nunca desfaz nem bloqueia a impressão.
 *
 * Fala DIRETO com o schema `moderna` do mesmo banco. Antes da consolidação de
 * 07/2026 isso exigiria uma ponte HTTP + Edge Function; hoje é uma chamada só.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, erro: "SUPABASE_SERVICE_ROLE_KEY ausente no servidor." },
      { status: 500 },
    );
  }

  let body: { codigos?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const codigos = Array.isArray(body.codigos)
    ? body.codigos.map((c) => String(c).trim()).filter(Boolean)
    : [];

  if (codigos.length === 0) {
    return NextResponse.json({ ok: false, erro: "Nenhum código informado." }, { status: 400 });
  }

  // schema `moderna`: o lote é do painel, não do EtiquetaMO.
  const painel = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: "moderna" },
  });

  const { data, error } = await painel.rpc("confirmar_impressao_lotes", {
    p_codigos: codigos,
    p_usuario: "etiquetamo",
  });

  if (error) {
    console.error("[confirmar-impressao] falhou:", error.message, { codigos });
    return NextResponse.json({ ok: false, erro: error.message }, { status: 502 });
  }

  return NextResponse.json(data ?? { ok: true });
}
