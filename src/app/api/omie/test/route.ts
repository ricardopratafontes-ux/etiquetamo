import { NextResponse } from "next/server";

/**
 * GET /api/omie/test
 * Diagnóstico: testa múltiplas combinações de parâmetros na API OMIE.
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

  const results: Record<string, unknown> = {};

  // Teste 1: ListarProdutos SEM apenas_importado_api
  try {
    const body1 = {
      call: "ListarProdutos",
      app_key: appKey,
      app_secret: appSecret,
      param: [{ pagina: 1, registros_por_pagina: 5 }],
    };
    const r1 = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body1),
    });
    results["teste1_sem_filtro"] = {
      status: r1.status,
      body: await r1.json().catch(() => "parse error"),
    };
  } catch (e) {
    results["teste1_sem_filtro"] = { error: String(e) };
  }

  // Teste 2: ListarProdutos com filtrar_apenas_omiepdv = "N"
  try {
    const body2 = {
      call: "ListarProdutos",
      app_key: appKey,
      app_secret: appSecret,
      param: [{ pagina: 1, registros_por_pagina: 5, filtrar_apenas_omiepdv: "N" }],
    };
    const r2 = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body2),
    });
    results["teste2_omiepdv_N"] = {
      status: r2.status,
      body: await r2.json().catch(() => "parse error"),
    };
  } catch (e) {
    results["teste2_omiepdv_N"] = { error: String(e) };
  }

  // Teste 3: ListarProdutosResumido (endpoint alternativo)
  try {
    const body3 = {
      call: "ListarProdutosResumido",
      app_key: appKey,
      app_secret: appSecret,
      param: [{ pagina: 1, registros_por_pagina: 5 }],
    };
    const r3 = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body3),
    });
    results["teste3_resumido"] = {
      status: r3.status,
      body: await r3.json().catch(() => "parse error"),
    };
  } catch (e) {
    results["teste3_resumido"] = { error: String(e) };
  }

  // Teste 4: PesquisarProdutos (busca textual)
  try {
    const body4 = {
      call: "PesquisarProdutos",
      app_key: appKey,
      app_secret: appSecret,
      param: [{ pagina: 1, registros_por_pagina: 5 }],
    };
    const r4 = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body4),
    });
    results["teste4_pesquisar"] = {
      status: r4.status,
      body: await r4.json().catch(() => "parse error"),
    };
  } catch (e) {
    results["teste4_pesquisar"] = { error: String(e) };
  }

  // Teste 5: ListarProdutos com inativo = "N"
  try {
    const body5 = {
      call: "ListarProdutos",
      app_key: appKey,
      app_secret: appSecret,
      param: [{ pagina: 1, registros_por_pagina: 5, inativo: "N" }],
    };
    const r5 = await fetch("https://app.omie.com.br/api/v1/geral/produtos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body5),
    });
    results["teste5_inativo_N"] = {
      status: r5.status,
      body: await r5.json().catch(() => "parse error"),
    };
  } catch (e) {
    results["teste5_inativo_N"] = { error: String(e) };
  }

  return NextResponse.json({
    keys: {
      app_key_length: appKey.length,
      app_key_preview: appKey.slice(0, 4) + "...",
    },
    results,
  });
}
