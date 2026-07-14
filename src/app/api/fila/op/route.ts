import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function orgId(supabase: ReturnType<typeof admin>) {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .single();
  return data?.id ?? null;
}

/** Lista as OPs pendentes da fila. */
export async function GET() {
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
    return NextResponse.json({ ok: true, fila: data ?? [] });
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
