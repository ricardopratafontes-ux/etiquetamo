import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SCHEMA } from "@/lib/supabaseSchema";
import { verificarSessaoAPI, responderNaoAutenticado } from "@/lib/api-auth";

/**
 * FILA DE OP — acesso server-side com service role.
 *
 * POR QUE ESTA ROTA EXISTE
 * A página /imprimir falava DIRETO com o banco usando a chave anon. Essa chave é
 * pública por natureza: ela viaja no bundle do navegador e qualquer pessoa a lê no
 * DevTools. Com a omie_print_queue sem RLS, qualquer um com a URL do projeto podia
 * ler, editar e apagar a fila de impressão inteira.
 *
 * Escrever policies pra chave anon seria fechar a porta com fechadura de papel: o
 * "usuário" continua sendo qualquer visitante da internet. A solução definitiva é
 * tirar o navegador do banco — o service role mora aqui no servidor, e a tabela
 * fica com RLS SEM POLICY nenhuma para anon (acesso zero pelo REST público).
 *
 * Operações (as mesmas que a tela já fazia, nada a mais):
 *   GET                      → lista as OPs pendentes
 *   PATCH { id, item_id }    → vincula a OP a um item do catálogo
 *   PATCH { id, status }     → marca a OP (skipped)
 *   PATCH { ids, status }    → marca várias (printed, ao imprimir de fato)
 *
 * insert e delete NÃO existem aqui: quem cria a fila é o webhook do Omie e o
 * endpoint de catalogação, ambos server-side. A tela nunca precisou disso.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_SLUG = "gelateria";

/** Status válidos — bate com o CHECK da tabela. */
const STATUS_VALIDOS = ["pending", "printed", "skipped"] as const;
type Status = (typeof STATUS_VALIDOS)[number];

function admin() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no servidor.");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: SUPABASE_SCHEMA },
  });
}

async function orgId(supabase: ReturnType<typeof admin>) {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .single();
  return data?.id ?? null;
}

/** Linha da fila, no que interessa pra religação. */
type LinhaFila = {
  id: string;
  item_id: string | null;
  webhook_payload: unknown;
  [k: string]: unknown;
};

function numeroValido(bruto: unknown): number | null {
  const n = typeof bruto === "number" ? bruto : Number(bruto);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Código do produto no Omie, de dentro do payload cru da linha.
 *
 * A fila tem TRÊS emissores e cada um guarda o código num lugar diferente:
 *   - webhook do Omie  → `event.nCodProd`
 *   - PCP (DEC-042)    → `omie_produto_id`, na raiz
 *   - catalogação      → sem código; cai fora e fica pro vínculo manual
 *
 * Ler só o formato do webhook deixava toda linha vinda do PCP de fora — e como o
 * /imprimir (com razão) não passa `pcp_moderna` pelo auto-vínculo por nome, um lote
 * do PCP que chegasse antes do item existir ficaria órfão pra sempre. É o mesmo
 * buraco do GELATO 5L SNICKERS, entrando pela porta nova.
 *
 * Quando o PCP completa uma linha que o webhook já criou, os dois campos convivem no
 * payload mesclado — aí vale o do Omie, que é a fonte da verdade do ERP.
 */
function codigoOmieDaLinha(linha: LinhaFila): number | null {
  const payload = linha.webhook_payload as
    | { event?: { nCodProd?: unknown }; omie_produto_id?: unknown }
    | null;

  return numeroValido(payload?.event?.nCodProd) ?? numeroValido(payload?.omie_produto_id);
}

/**
 * Religa OPs que chegaram antes do item existir.
 *
 * POR QUE ISSO EXISTE: a fila é um retrato do momento. O webhook grava `item_id`
 * quando a OP chega; se o item ainda não existia, fica nulo — e nunca mais ninguém
 * voltava pra religar. Foi o que travou a produção do GELATO 5L SNICKERS em
 * 15/08/2026: a OP chegou 14:03, o item nasceu 14:12, e a linha ficou órfã na tela
 * com "Item não vinculado".
 *
 * O casamento é por `nCodProd` do payload contra `items.omie_product_id` — IDENTIDADE
 * EXATA, a mesma primeira tentativa que o webhook usa. Nada de adivinhar por nome:
 * nome parecido faz gelato virar barra, e etiqueta errada é problema sanitário.
 *
 * Falha aqui nunca derruba a listagem: sem religar, a linha aparece como antes e o
 * operador vincula na mão. Melhor uma fila crua do que uma fila que não abre.
 */
async function religarPorCodigoOmie(
  supabase: ReturnType<typeof admin>,
  org: string,
  linhas: LinhaFila[]
): Promise<number> {
  const orfas = linhas.filter((l) => !l.item_id && codigoOmieDaLinha(l) !== null);
  if (orfas.length === 0) return 0;

  const codigos = [...new Set(orfas.map((l) => codigoOmieDaLinha(l) as number))];

  const { data: itens } = await supabase
    .from("items")
    .select("id, omie_product_id")
    .eq("organization_id", org)
    .eq("active", true)
    .in("omie_product_id", codigos);

  if (!itens?.length) return 0;

  const porCodigo = new Map<number, string>();
  for (const it of itens as { id: string; omie_product_id: number | null }[]) {
    if (it.omie_product_id != null) porCodigo.set(it.omie_product_id, it.id);
  }

  let religadas = 0;
  for (const linha of orfas) {
    const itemId = porCodigo.get(codigoOmieDaLinha(linha) as number);
    if (!itemId) continue;

    const { error } = await supabase
      .from("omie_print_queue")
      .update({ item_id: itemId })
      .eq("id", linha.id)
      .is("item_id", null); // não pisa em vínculo que alguém acabou de fazer na mão

    if (!error) {
      linha.item_id = itemId; // a tela já recebe a linha vinculada nesta mesma resposta
      religadas++;
    }
  }
  return religadas;
}

/** Lista as OPs pendentes da fila. */
export async function GET(request: NextRequest) {
  if (!verificarSessaoAPI(request)) return responderNaoAutenticado();

  try {
    const supabase = admin();
    const org = await orgId(supabase);
    if (!org) return NextResponse.json({ erro: "Organização não encontrada." }, { status: 500 });

    const { data, error } = await supabase
      .from("omie_print_queue")
      .select("*")
      .eq("organization_id", org)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

    const fila = (data ?? []) as LinhaFila[];

    let religadas = 0;
    try {
      religadas = await religarPorCodigoOmie(supabase, org, fila);
    } catch (e) {
      console.error("[fila/op] religação por código Omie falhou:", e);
    }

    return NextResponse.json({ ok: true, fila, religadas });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}

/**
 * Atualiza a fila: vincula item OU muda status.
 *
 * O status é validado contra a lista da CHECK constraint. Isto não é paranoia:
 * a tela mandava `status: "queued"` — que NÃO existe na constraint — e o update
 * falhava EM SILÊNCIO (sem await, sem tratamento de erro). A OP sumia da tela mas
 * continuava 'pending' no banco, e voltava a aparecer no próximo carregamento.
 * Aqui um status inválido devolve erro, em vez de fingir que deu certo.
 */
export async function PATCH(request: NextRequest) {
  if (!verificarSessaoAPI(request)) return responderNaoAutenticado();

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = admin();
    const org = await orgId(supabase);
    if (!org) return NextResponse.json({ erro: "Organização não encontrada." }, { status: 500 });

    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown) => typeof x === "string")
      : body.id
        ? [String(body.id)]
        : [];

    if (ids.length === 0) {
      return NextResponse.json({ erro: "Informe id ou ids." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};

    if (body.item_id !== undefined) patch.item_id = body.item_id;

    if (body.status !== undefined) {
      const s = String(body.status) as Status;
      if (!STATUS_VALIDOS.includes(s)) {
        return NextResponse.json(
          { erro: `Status inválido: "${s}". Válidos: ${STATUS_VALIDOS.join(", ")}.` },
          { status: 400 },
        );
      }
      patch.status = s;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ erro: "Nada pra atualizar (item_id ou status)." }, { status: 400 });
    }

    // organization_id no filtro: a rota nunca mexe na fila de outra organização,
    // mesmo que alguém mande um id de fora.
    const { data, error } = await supabase
      .from("omie_print_queue")
      .update(patch)
      .in("id", ids)
      .eq("organization_id", org)
      .select("id");

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, atualizados: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
