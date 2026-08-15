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

// --- Listagem de produtos (catalogo) ---

export interface OmieListarProdutosResponse {
  pagina: number;
  total_de_paginas: number;
  registros: number;
  total_de_registros: number;
  produto_servico_cadastro?: OmieProduto[];
}

/**
 * Lista uma pagina do cadastro de produtos.
 *
 * ATENCAO AO PAYLOAD — foi exatamente aqui que o sync ficou tres meses quebrado.
 * Sem `filtrar_apenas_omiepdv: "N"` o Omie NAO devolve erro: devolve HTTP 200 com
 * `total_de_registros: 0` e a lista vazia. A varredura entao "conclui com sucesso"
 * sem ter visto um unico produto. Comprovado em 15/08/2026 contra a conta real:
 *   sem o campo  -> total_de_registros = 0
 *   com o campo  -> total_de_registros = 888
 * Os dois campos abaixo sao obrigatorios na pratica. Nao remova nenhum dos dois.
 */
export async function listarProdutos(
  pagina: number = 1,
  registrosPorPagina: number = 100
): Promise<OmieListarProdutosResponse> {
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

export interface VarreduraProdutos {
  produtos: OmieProduto[];
  /** `total_de_registros` que o Omie declarou na primeira pagina. */
  totalDeclarado: number;
  totalDePaginas: number;
  paginasLidas: number;
  /** Paginas que falharam, com a mensagem do Omie (sem credenciais). */
  falhas: { pagina: number; mensagem: string }[];
  /** True quando paramos antes do fim por excesso de erros iguais. */
  abortadaPorErros: boolean;
}

/** Intervalo entre paginas: o Omie limita 240 req/min por metodo. */
const INTERVALO_PAGINA_MS = 250;
/** Erros consecutivos com a MESMA mensagem antes de desistir. */
const MAX_FALHAS_IGUAIS = 3;
/** Teto absoluto de requisicoes, para a varredura sempre terminar. */
const MAX_TENTATIVAS = 200;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Le o cadastro de produtos inteiro, pagina a pagina.
 *
 * Serializado de proposito (o Omie nao gosta de concorrencia) e com freio de mao:
 * tres falhas seguidas com a mesma mensagem abortam a varredura. O bloqueio de 30
 * minutos da app_key conta ERROS, nao retentativas — insistir num payload errado
 * derruba a chave e leva junto o webhook de OP, que e o que mantem a producao viva.
 *
 * Uma pagina que falha e RETENTADA, nunca pulada: pular pagina perde 100 produtos
 * em silencio, que e exatamente a classe de defeito que esta funcao existe pra evitar.
 */
export async function listarTodosProdutos(
  registrosPorPagina: number = 100
): Promise<VarreduraProdutos> {
  const produtos: OmieProduto[] = [];
  const falhas: { pagina: number; mensagem: string }[] = [];

  let totalDeclarado = 0;
  let totalDePaginas = 0;
  let paginasLidas = 0;
  let pagina = 1;
  let tentativas = 0;
  let ultimaMensagem = "";
  let falhasIguais = 0;
  let abortadaPorErros = false;

  while (tentativas < MAX_TENTATIVAS) {
    tentativas++;

    try {
      const resposta = await listarProdutos(pagina, registrosPorPagina);

      if (paginasLidas === 0) {
        totalDeclarado = resposta.total_de_registros ?? 0;
        totalDePaginas = resposta.total_de_paginas ?? 0;
      }

      produtos.push(...(resposta.produto_servico_cadastro ?? []));
      paginasLidas++;
      ultimaMensagem = "";
      falhasIguais = 0;

      if (totalDePaginas <= pagina) break;
      pagina++;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      falhas.push({ pagina, mensagem });

      falhasIguais = mensagem === ultimaMensagem ? falhasIguais + 1 : 1;
      ultimaMensagem = mensagem;

      if (falhasIguais >= MAX_FALHAS_IGUAIS) {
        abortadaPorErros = true;
        break;
      }
      // Mesma pagina de novo — pular perderia os produtos dela sem ninguem notar.
    }

    await dormir(INTERVALO_PAGINA_MS);
  }

  if (tentativas >= MAX_TENTATIVAS) abortadaPorErros = true;

  return { produtos, totalDeclarado, totalDePaginas, paginasLidas, falhas, abortadaPorErros };
}
