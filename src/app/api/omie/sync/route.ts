import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listarTodosProdutos, OmieProduto } from "@/lib/omie";
import { SUPABASE_SCHEMA } from "@/lib/supabaseSchema";
import { verificarSessaoAPI } from "@/lib/api-auth";

export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

const criarSupabase = () =>
  createClient(supabaseUrl, supabaseKey, { db: { schema: SUPABASE_SCHEMA } });

type Supabase = ReturnType<typeof criarSupabase>;

/**
 * Queda percentual no catalogo do Omie que ja e motivo pra desconfiar.
 * Serve pra pegar o PROXIMO defeito silencioso: se hoje vierem 300 produtos onde
 * ontem vieram 888, quase certamente foi filtro/paginacao quebrada, e nao o dono
 * da gelateria excluindo 588 produtos numa tarde.
 */
const QUEDA_SUSPEITA = 0.2;

type Item = {
  id: string;
  name: string;
  code: string | null;
  barcode: string | null;
  unit: string | null;
  omie_product_id: number | null;
  manual_override: boolean;
};

const chaveCodigo = (c: string | null | undefined) => (c ?? "").trim().toUpperCase();

/**
 * SINCRONIZACAO DE PRODUTOS OMIE -> ETIQUETAMO (somente atualizacao)
 *
 * DESENHO (DEC-038): quem CRIA item no EtiquetaMO e o Painel de Controle, via
 * trigger em `moderna.omie_produtos` — o item nasce segundos depois do cadastro no
 * Omie, e o que nao casa com padrao conhecido vai pra `moderna.etiqueta_pendencias`,
 * que TEM tela. Esta rota e o cinto de seguranca do outro lado, e ela nunca faz
 * INSERT em `items`. Se ela tambem criasse, os dois escritores gerariam o mesmo
 * item e o catalogo duplicaria.
 *
 * O QUE ELA ESCREVE, e so isso:
 *   - `code` e `barcode` de item ja existente (DEC-032)
 *   - `unit` quando esta NULO (preenche lacuna, nunca sobrescreve)
 *   - `omie_product_id` quando esta NULO, casando por `code` sem ambiguidade
 *
 * O QUE ELA NUNCA TOCA: `name` (DEC-032), `expiry_days`, `uses_*`, `active`,
 * `additional_info`, `category_id`. Validade errada em etiqueta e problema
 * sanitario, nao bug de tela — `expiry_days` nao aparece em nenhum UPDATE aqui.
 */
export async function POST(request: NextRequest) {
  const autorizado = autorizar(request);
  if (!autorizado.ok) return NextResponse.json({ erro: autorizado.motivo }, { status: 401 });
  return executarSync(autorizado.gatilho);
}

/**
 * O cron da Vercel chama por GET — por isso este handler existe. Ele aceita SO o
 * CRON_SECRET: sync e operacao de escrita, e nao pode disparar porque alguem logado
 * digitou a URL no navegador. Clique de gestor entra pelo POST, da tela /omie.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "GET aqui e so pro cron (Bearer CRON_SECRET)." }, { status: 401 });
  }
  return executarSync("cron");
}

async function executarSync(gatilho: string) {
  const supabase = criarSupabase();
  const inicio = Date.now();

  const { data: org, error: erroOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .single();

  if (erroOrg || !org) {
    return NextResponse.json({ erro: `Organizacao "${ORG_SLUG}" nao encontrada` }, { status: 500 });
  }
  const orgId = org.id as string;

  const { data: log, error: erroLog } = await supabase
    .from("omie_sync_log")
    .insert({ organization_id: orgId, sync_type: "products" })
    .select("id")
    .single();

  if (erroLog || !log) {
    return NextResponse.json({ erro: "Nao consegui abrir o log de sync" }, { status: 500 });
  }
  const logId = log.id as string;

  /** Fecha o log SEMPRE. Execucao sem `completed_at` e execucao invisivel. */
  const fechar = async (
    status: "ok" | "falha",
    motivo: string | null,
    numeros: { total_omie: number; matched: number; updated: number; errors: number },
    detalhes: Record<string, unknown>
  ) => {
    await supabase
      .from("omie_sync_log")
      .update({
        ...numeros,
        quarantined: 0,
        completed_at: new Date().toISOString(),
        details: {
          status,
          motivo,
          gatilho,
          duracao_ms: Date.now() - inicio,
          ...detalhes,
        },
      })
      .eq("id", logId);
  };

  try {
    const varredura = await listarTodosProdutos();
    const { produtos, totalDeclarado, totalDePaginas, paginasLidas, falhas, abortadaPorErros } = varredura;

    const leitura = {
      total_declarado_omie: totalDeclarado,
      total_de_paginas: totalDePaginas,
      paginas_lidas: paginasLidas,
      produtos_recebidos: produtos.length,
      falhas_por_pagina: falhas,
    };

    // --- Sanidade: uma varredura ruim NAO pode virar UPDATE no catalogo ---
    const anterior = await ultimoTotalBemSucedido(supabase, orgId, logId);
    const motivoFalha = diagnosticar(
      { totalDeclarado, recebidos: produtos.length, abortadaPorErros, falhas: falhas.length },
      anterior
    );

    if (motivoFalha) {
      await fechar(
        "falha",
        motivoFalha,
        { total_omie: totalDeclarado, matched: 0, updated: 0, errors: Math.max(falhas.length, 1) },
        { ...leitura, total_da_ultima_execucao_ok: anterior, nada_foi_gravado: true }
      );
      return NextResponse.json({ ok: false, erro: motivoFalha, leitura }, { status: 500 });
    }

    // --- Indices do lado do Omie ---
    const porOmieId = new Map<number, OmieProduto>();
    const porCodigo = new Map<string, OmieProduto[]>();
    for (const p of produtos) {
      porOmieId.set(p.codigo_produto, p);
      const k = chaveCodigo(p.codigo);
      if (!k) continue;
      const lista = porCodigo.get(k);
      if (lista) lista.push(p);
      else porCodigo.set(k, [p]);
    }

    // --- Itens do EtiquetaMO ---
    const { data: itensRaw, error: erroItens } = await supabase
      .from("items")
      .select("id, name, code, barcode, unit, omie_product_id, manual_override")
      .eq("organization_id", orgId)
      .eq("active", true);

    if (erroItens) throw new Error(`Falha ao ler items: ${erroItens.message}`);
    const itens = (itensRaw ?? []) as Item[];

    const omieIdsUsados = new Set<number>();
    const codesRepetidosNoItems = new Set<string>();
    const codesVistos = new Set<string>();
    for (const it of itens) {
      if (it.omie_product_id != null) omieIdsUsados.add(it.omie_product_id);
      const k = chaveCodigo(it.code);
      if (!k) continue;
      if (codesVistos.has(k)) codesRepetidosNoItems.add(k);
      else codesVistos.add(k);
    }

    let matched = 0;
    let updated = 0;
    let vinculados = 0;
    let errors = 0;
    const ambiguos: { item: string; code: string | null; motivo: string }[] = [];
    const semProdutoNoOmie: { item: string; code: string | null }[] = [];
    /** Item aponta pra um `codigo_produto` que sumiu do Omie. Deriva silenciosa. */
    const vinculosOrfaos: { item: string; omie_product_id: number }[] = [];
    const errosDeEscrita: string[] = [];

    for (const item of itens) {
      let produto = item.omie_product_id != null ? porOmieId.get(item.omie_product_id) : undefined;
      const updates: Record<string, unknown> = {};

      if (item.omie_product_id == null) {
        // (1) Item sem vinculo: casar por `code`, e so quando for 1:1 dos dois lados.
        const k = chaveCodigo(item.code);
        const candidatos = k ? porCodigo.get(k) ?? [] : [];

        if (candidatos.length === 0) {
          semProdutoNoOmie.push({ item: item.name, code: item.code });
        } else if (candidatos.length > 1) {
          ambiguos.push({
            item: item.name,
            code: item.code,
            motivo: `${candidatos.length} produtos no Omie com esse codigo`,
          });
        } else if (codesRepetidosNoItems.has(k)) {
          ambiguos.push({
            item: item.name,
            code: item.code,
            motivo: "codigo repetido em mais de um item do EtiquetaMO",
          });
        } else if (omieIdsUsados.has(candidatos[0].codigo_produto)) {
          ambiguos.push({
            item: item.name,
            code: item.code,
            motivo: "produto do Omie ja vinculado a outro item",
          });
        } else {
          produto = candidatos[0];
          updates.omie_product_id = produto.codigo_produto;
          omieIdsUsados.add(produto.codigo_produto);
        }
      } else if (produto) {
        matched++;
      } else {
        vinculosOrfaos.push({ item: item.name, omie_product_id: item.omie_product_id });
      }

      if (produto && !item.manual_override) {
        // (2) DEC-032: so `code` e `barcode` podem ser sobrescritos. `name` nunca.
        const codigoOmie = produto.codigo?.trim() || null;
        if (codigoOmie && codigoOmie !== item.code) updates.code = codigoOmie;

        const eanOmie = produto.ean?.trim() || null;
        if (eanOmie && eanOmie !== item.barcode) updates.barcode = eanOmie;

        // (3) `unit` so preenche lacuna — nunca sobrescreve o que o operador definiu.
        const unidadeOmie = produto.unidade?.trim() || null;
        if (unidadeOmie && !item.unit) updates.unit = unidadeOmie;
      }

      if (Object.keys(updates).length === 0) continue;

      const { error: erroUpdate } = await supabase.from("items").update(updates).eq("id", item.id);
      if (erroUpdate) {
        errors++;
        // O vinculo nao aconteceu: devolve o id pro bolo, senao o produto sai da
        // lista de "sem item" sem ter item nenhum.
        if (updates.omie_product_id != null) omieIdsUsados.delete(updates.omie_product_id as number);
        if (errosDeEscrita.length < 10) errosDeEscrita.push(`${item.name}: ${erroUpdate.message}`);
      } else {
        updated++;
        // `vinculados` conta escrita confirmada, nunca intencao.
        if (updates.omie_product_id != null) vinculados++;
      }
    }

    // (4) Produto do Omie sem item aqui NAO vira item e NAO vai pra quarentena:
    // criacao e triagem sao do Painel (`moderna.etiqueta_pendencias`, que tem tela).
    // `etiqueta.omie_quarantine` continua vazia de proposito — mandar linha pra la
    // seria mandar pra um buraco negro, porque o EtiquetaMO nao tem tela pra ela.
    const semItem = produtos.filter((p) => !omieIdsUsados.has(p.codigo_produto));

    // (5) Conserta os "Produto OMIE #123456" da fila de impressao.
    // O webhook chama ConsultarProduto pra pegar a descricao; quando essa chamada
    // falha (~7% das OPs, erro transitorio do Omie) sobra o nome generico na tela.
    // Aqui sai de graca: o catalogo inteiro ja esta em `porOmieId`, entao e so
    // reescrever o texto — zero chamada extra ao ERP.
    const nomesCorrigidos = await corrigirNomesGenericos(supabase, orgId, porOmieId);

    await fechar(
      "ok",
      null,
      { total_omie: totalDeclarado, matched, updated, errors },
      {
        ...leitura,
        total_da_ultima_execucao_ok: anterior,
        itens_ativos: itens.length,
        vinculados_agora: vinculados,
        itens_ambiguos: ambiguos.length,
        amostra_ambiguos: ambiguos.slice(0, 20),
        itens_sem_produto_no_omie: semProdutoNoOmie.length,
        amostra_itens_sem_produto: semProdutoNoOmie.slice(0, 20),
        vinculos_orfaos: vinculosOrfaos.length,
        amostra_vinculos_orfaos: vinculosOrfaos.slice(0, 20),
        produtos_omie_sem_item: semItem.length,
        amostra_produtos_sem_item: semItem.slice(0, 20).map((p) => ({
          codigo_produto: p.codigo_produto,
          codigo: p.codigo,
          descricao: p.descricao,
        })),
        criacao_de_item: "responsabilidade do Painel (moderna.etiqueta_pendencias)",
        nomes_genericos_corrigidos: nomesCorrigidos,
        erros_de_escrita: errosDeEscrita,
      }
    );

    return NextResponse.json({
      ok: true,
      resumo: {
        total_omie: totalDeclarado,
        itens_ativos: itens.length,
        ja_vinculados: matched,
        vinculados_agora: vinculados,
        atualizados: updated,
        ambiguos: ambiguos.length,
        produtos_omie_sem_item: semItem.length,
        nomes_genericos_corrigidos: nomesCorrigidos,
        errors,
      },
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    await fechar(
      "falha",
      mensagem,
      { total_omie: 0, matched: 0, updated: 0, errors: 1 },
      { excecao: true, nada_foi_gravado: true }
    );
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}

/**
 * Decide se a varredura merece confianca. Retorna o motivo da recusa, ou null.
 *
 * ESTE E O CONSERTO DO DEFEITO DE FUNDO: por tres meses uma varredura que trouxe
 * zero produto gravou `errors = 0` e passou por sucesso, e ninguem viu. Aqui,
 * catalogo vazio ou incompleto e FALHA — com o motivo escrito em `details` e
 * HTTP 500 na resposta, que e o que faz o cron da Vercel acender alerta.
 */
function diagnosticar(
  v: { totalDeclarado: number; recebidos: number; abortadaPorErros: boolean; falhas: number },
  totalAnterior: number | null
): string | null {
  if (v.abortadaPorErros) {
    return `Varredura abortada apos falhas repetidas do Omie (${v.falhas} falha(s)). Nada foi gravado.`;
  }
  if (v.totalDeclarado === 0 || v.recebidos === 0) {
    return (
      "O Omie respondeu 200 com o catalogo VAZIO (total_de_registros = 0). Isso nao e " +
      '"nao ha produtos": e o sintoma classico de payload errado em ListarProdutos — sem ' +
      'filtrar_apenas_omiepdv: "N" a API devolve lista vazia sem dar erro. Nada foi gravado.'
    );
  }
  if (v.recebidos < v.totalDeclarado) {
    return `Varredura incompleta: o Omie declarou ${v.totalDeclarado} produtos e so ${v.recebidos} chegaram. Nada foi gravado.`;
  }
  if (totalAnterior !== null && totalAnterior > 0) {
    const queda = (totalAnterior - v.totalDeclarado) / totalAnterior;
    if (queda > QUEDA_SUSPEITA) {
      return `Catalogo encolheu ${Math.round(queda * 100)}% desde a ultima execucao boa (${totalAnterior} para ${v.totalDeclarado}). Suspeito de filtro ou paginacao quebrada. Nada foi gravado.`;
    }
  }
  return null;
}

/**
 * Troca "Produto OMIE #123456" pela descricao real na `omie_print_queue`.
 *
 * O codigo do produto mora em `webhook_payload.event.nCodProd`, e a descricao ja
 * veio na varredura — nenhuma chamada nova ao Omie. Mexe SO no texto de referencia
 * da fila: `item_id`, `quantity` e `lot` nao sao tocados aqui, e o que sai impresso
 * na etiqueta vem do nome do ITEM, nunca deste campo.
 */
async function corrigirNomesGenericos(
  supabase: Supabase,
  orgId: string,
  porOmieId: Map<number, OmieProduto>
): Promise<number> {
  const { data } = await supabase
    .from("omie_print_queue")
    .select("id, product_name, webhook_payload")
    .eq("organization_id", orgId)
    .like("product_name", "Produto OMIE #%");

  const linhas = (data ?? []) as { id: string; product_name: string; webhook_payload: unknown }[];
  let corrigidos = 0;

  for (const linha of linhas) {
    const payload = linha.webhook_payload as { event?: { nCodProd?: unknown } } | null;
    const bruto = payload?.event?.nCodProd;
    const codigo = typeof bruto === "number" ? bruto : Number(bruto);
    if (!Number.isFinite(codigo) || codigo <= 0) continue;

    const descricao = porOmieId.get(codigo)?.descricao?.trim();
    if (!descricao || descricao === linha.product_name) continue;

    const { error } = await supabase
      .from("omie_print_queue")
      .update({ product_name: descricao })
      .eq("id", linha.id);

    if (!error) corrigidos++;
  }
  return corrigidos;
}

/** `total_omie` da ultima execucao que terminou saudavel. Null se nao houver. */
async function ultimoTotalBemSucedido(
  supabase: Supabase,
  orgId: string,
  ignorarLogId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("omie_sync_log")
    .select("total_omie, details")
    .eq("organization_id", orgId)
    .eq("sync_type", "products")
    .neq("id", ignorarLogId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(20);

  for (const linha of (data ?? []) as { total_omie: number | null; details: unknown }[]) {
    const detalhes = (linha.details ?? {}) as Record<string, unknown>;
    const total = linha.total_omie;
    if (detalhes.status === "ok" && typeof total === "number" && total > 0) return total;
  }
  return null;
}

/**
 * Duas portas: o cron da Vercel (Bearer CRON_SECRET) e o gestor logado clicando
 * "Sincronizar agora" na tela /omie.
 */
function autorizar(
  request: NextRequest
): { ok: true; gatilho: string } | { ok: false; motivo: string } {
  const segredo = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");

  if (segredo && header === `Bearer ${segredo}`) return { ok: true, gatilho: "cron" };
  if (verificarSessaoAPI(request)) return { ok: true, gatilho: "manual" };

  return { ok: false, motivo: "Nao autenticado. Faca login ou use o CRON_SECRET." };
}
