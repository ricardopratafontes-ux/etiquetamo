import { NextRequest, NextResponse } from "next/server";

/**
 * CUNHAR LOTE ÚNICO na hora de imprimir um balde.
 *
 * O painel é a AUTORIDADE da identidade do balde. Esta rota é a ponte: recebe o
 * código Omie do produto e a quantidade, chama a Edge Function do painel
 * (cunhar-lote-etiqueta), e devolve N códigos B#### DISTINTOS — um por balde.
 *
 * Por que server-side: a chave que autentica no painel (PAINEL_CUNHAGEM_KEY) NÃO pode
 * ir pro navegador. Fica aqui, no servidor. O browser chama /api/fila/cunhar sem ver
 * segredo nenhum.
 *
 * Só balde tem lote individual. Insumo/base/casquinha/pote: o painel devolve
 * `e_balde:false` e o EtiquetaMO imprime com o código do produto, como sempre.
 */
const PAINEL_URL = process.env.PAINEL_CUNHAGEM_URL;
const PAINEL_KEY = process.env.PAINEL_CUNHAGEM_KEY;

export async function POST(request: NextRequest) {
  if (!PAINEL_URL || !PAINEL_KEY) {
    return NextResponse.json(
      { ok: false, erro: "Ponte com o painel não configurada (PAINEL_CUNHAGEM_URL/KEY)." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const codigoOmie = Number(body?.omie_codigo_produto);
    const quantidade = Number(body?.quantidade ?? 1);
    const omieOp = body?.omie_op ? String(body.omie_op) : null;

    if (!Number.isFinite(codigoOmie) || codigoOmie <= 0) {
      return NextResponse.json({ ok: false, erro: "omie_codigo_produto obrigatório." }, { status: 400 });
    }

    const resp = await fetch(PAINEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAINEL_KEY}`,
      },
      body: JSON.stringify({ omie_codigo_produto: codigoOmie, quantidade, omie_op: omieOp }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      return NextResponse.json(
        { ok: false, erro: data?.erro || `Painel recusou (HTTP ${resp.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
