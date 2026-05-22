/**
 * OMIE API Client — EtiquetaMO
 *
 * Todas as chamadas OMIE são POST com JSON-RPC.
 * Auth via app_key + app_secret no body (nunca em headers).
 *
 * Ref: https://ajuda.omie.com.br/pt-BR/collections/3045828-apis-e-webhooks
 */

const OMIE_BASE_URL = "https://app.omie.com.br/api/v1";

interface OmieRequestParams {
  endpoint: string; // ex: "/geral/produtos/"
  method: string;   // ex: "ListarProdutos"
  params: Record<string, unknown>[];
}

interface OmieError {
  faultstring: string;
  faultcode: string;
}

/**
 * Chamada genérica à API OMIE (JSON-RPC over POST)
 */
export async function omieCall<T>(req: OmieRequestParams): Promise<T> {
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("OMIE_APP_KEY e OMIE_APP_SECRET não configurados");
  }

  const body = {
    call: req.method,
    app_key: appKey,
    app_secret: appSecret,
    param: req.params,
  };

  const response = await fetch(`${OMIE_BASE_URL}${req.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OMIE API HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();

  // OMIE retorna erros no campo faultstring
  if (data.faultstring) {
    const err = data as OmieError;
    throw new Error(`OMIE API Error [${err.faultcode}]: ${err.faultstring}`);
  }

  return data as T;
}

// ─── Tipos de resposta OMIE ───────────────────────────────────────

export interface OmieProduto {
  codigo_produto: number;
  codigo_produto_integracao?: string;
  codigo?: string;
  descricao: string;
  unidade?: string;
  ncm?: string;
  ean?: string;
  valor_unitario?: number;
  peso_liq?: number;
  peso_bruto?: number;
  marca?: string;
  descr_detalhada?: string;
  obs_internas?: string;
  tipoItem?: string;
  inativo?: string; // "S" ou "N"
}

export interface OmieListarProdutosResponse {
  pagina: number;
  total_de_paginas: number;
  registros: number;
  total_de_registros: number;
  produto_servico_cadastro: OmieProduto[];
}

// ─── Funções específicas ──────────────────────────────────────────

/**
 * Lista produtos do OMIE com paginação
 */
export async function listarProdutos(pagina: number = 1, registrosPorPagina: number = 50): Promise<OmieListarProdutosResponse> {
  return omieCall<OmieListarProdutosResponse>({
    endpoint: "/geral/produtos/",
    method: "ListarProdutos",
    params: [{
      pagina,
      registros_por_pagina: registrosPorPagina,
      apenas_importado_api: "N",
      filtrar_apenas_omiepdv: "N",
    }],
  });
}

/**
 * Busca um produto específico por código OMIE
 */
export async function consultarProduto(codigoProduto: number): Promise<OmieProduto> {
  const result = await omieCall<OmieProduto>({
    endpoint: "/geral/produtos/",
    method: "ConsultarProduto",
    params: [{
      codigo_produto: codigoProduto