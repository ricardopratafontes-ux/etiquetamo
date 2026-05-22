import { NextResponse } from "next/server";

/**
 * GET /api/omie/test
 * Diagnóstico: testa conexão com API OMIE e retorna resultado bruto.
 * TEMPORÁRIO — remover depois que sync estiver funcionando.
 */
export async function GET() {
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  if (!appKey || !appSecret) {
    return NextResponse.json({
      error: "Variáveis OMIE não encontradas",
      OMIE_APP_KEY_present: !!appKey,
      OMIE_APP_SECRET_present: !!appSecret,
    });
  }

  try {
    const body = {
      call: "ListarProdutos",
      app_key: appKey,
      app_secret: appSecret,
      param: [{ pagina: 1, registros_por_pagina: 5, apenas_importado_api: "N" }],
    };

    const response = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const status = response.status;
    const text = await response.text();

    // Tentar parsear como JSON
    let json = null;
    try { json = JSON.parse(text); } catch { /* não é JSON */ }

    return NextResponse.json({
      omie_http_status: status,
      omie_response: json || text.slice(0, 2000),
      keys: {
        app_key_length: appKey.length,
        app_secret_length: appSecret.length,
        app_key_preview: appKey.slice(0, 4) + "...",
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
