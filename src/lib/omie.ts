/**
 * OMIE API Client — EtiquetaMO
 *
 * Todas as chamadas OMIE sao POST com JSON-RPC.
 * Auth via app_key + app_secret no body (nunca em headers).
 *
 * Ref: https://ajuda.omie.com.br/pt-BR/collections/3045828-apis-e-webhooks
 */

const OMIE_BASE_URL = "https://app.omie.com.br/api/v1";

interface OmieRequestParams {
  endpoint: string; // ex: "/geral/produtos/"
  method: string;   // ex: "ConsultarProduto"
  params: Record<string, unknown>[];
}

interface OmieError {
  faultstring: string;
  faultcode: string;
}

/**
 * Chamada generica a API OMIE (JSON-RPC over POST)
 */
export async function omieCall<T>(req: OmieRequestParams): Promise<T> {
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("OMIE_APP_KEY e OMIE_APP_SECRET nao configurados");
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

// --- Tipos de resposta OMIE ---

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

// --- Funcoes especificas ---

/**
 * Busca um produto especifico por codigo OMIE
 */
export async function consultarProduto(codigoProduto: number): Promise<OmieProduto> {
  const result = await omieCall<OmieProduto>({
    endpoint: "/geral/produtos/",
    method: "ConsultarProduto",
    params: [{
      codigo_produto: codigoProduto,
    }],
  });
  return result;
}

// --- Ordem de Producao ---

/**
 * Retorno do ConsultarOrdemProducao. A quantidade a produzir mora em
 * `identificacao.nQtde` (confirmado na doc oficial da API produtos/op).
 */
export interface OmieOrdemProducao {
  identificacao?: {
    nCodOP?: number;
    cCodIntOP?: string;
    cNumOP?: string;
    nCodProduto?: number;
    dDtPrevisao?: string;
    nQtde?: number;
  };
  [k: string]: unknown;
}

/**
 * Consulta uma Ordem de Producao pelo codigo interno do Omie (nCodOP).
 *
 * POR QUE ISSO EXISTE: o webhook do Omie (OrdemProducao.*) NAO manda a quantidade
 * de baldes no payload — so nCodOP/nCodProd/cEtapa. Sem isso, toda OP de N baldes
 * virava 1 etiqueta. Aqui buscamos a quantidade REAL (identificacao.nQtde) direto
 * na OP pra enfileirar as N etiquetas certas.
 */
export async function consultarOrdemProducao(nCodOP: number): Promise<OmieOrdemProducao> {
  return omieCall<OmieOrdemProducao>({
    endpoint: "/produtos/op/",
    method: "ConsultarOrdemProducao",
    params: [{ nCodOP }],
  });
}
