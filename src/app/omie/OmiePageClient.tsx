"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import type { PerfilEtiquetaMO } from "@/lib/perfil";

export interface ExecucaoSync {
  id: string;
  total_omie: number;
  matched: number;
  updated: number;
  errors: number;
  started_at: string;
  completed_at: string | null;
  details: Record<string, unknown> | null;
}

function quando(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function diasAtras(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Estado de uma execução. `pendente` é execução que abriu o log e nunca fechou —
 * também é falha, só que de um jeito mais feio (o processo morreu no meio).
 */
function estado(e: ExecucaoSync): "ok" | "falha" | "pendente" {
  if (!e.completed_at) return "pendente";
  const status = (e.details ?? {})["status"];
  if (status === "ok") return "ok";
  if (status === "falha") return "falha";
  // Execuções antigas (antes do DEC-038) gravavam details = {}. Zero produto
  // nunca foi sucesso — é assim que essa tela conta a história dos 11 runs de maio.
  return e.total_omie > 0 ? "ok" : "falha";
}

const CORES = {
  ok: { chip: "bg-[var(--verde)] text-[#1d4416]", rotulo: "OK" },
  falha: { chip: "bg-[var(--vermelho)] text-white", rotulo: "FALHOU" },
  pendente: { chip: "bg-amber-200 text-amber-900", rotulo: "NÃO TERMINOU" },
} as const;

export default function OmiePageClient({
  perfil,
  execucoes,
}: {
  perfil: PerfilEtiquetaMO;
  execucoes: ExecucaoSync[];
}) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [deuErro, setDeuErro] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const ultima = execucoes[0] ?? null;
  const ultimaOk = execucoes.find((e) => estado(e) === "ok") ?? null;
  const podeSincronizar = ["master", "gerente", "supervisor"].includes(
    perfil.perfil_intranet?.toLowerCase()
  );

  async function sincronizar() {
    setRodando(true);
    setResultado(null);
    setDeuErro(false);
    try {
      const res = await fetch("/api/omie/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.ok) {
        const r = json.resumo;
        setResultado(
          `${r.total_omie} produtos lidos do OMIE · ${r.vinculados_agora} item(ns) vinculado(s) agora · ` +
            `${r.atualizados} atualizado(s) · ${r.produtos_omie_sem_item} produto(s) do OMIE ainda sem item aqui`
        );
      } else {
        setDeuErro(true);
        setResultado(json.erro || `Falhou com HTTP ${res.status}`);
      }
    } catch (err) {
      setDeuErro(true);
      setResultado(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setRodando(false);
      router.refresh();
    }
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)] pb-16">
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#d41636] text-white px-6 py-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h1 className="text-2xl font-extrabold">Sincronização OMIE</h1>
                <p className="text-sm text-white/70">
                  Confere o catálogo do OMIE contra os itens do EtiquetaMO
                </p>
              </div>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-2xl font-extrabold">{ultimaOk ? ultimaOk.total_omie : "—"}</p>
              <p className="text-[10px] text-white/80">produtos na última leitura boa</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 mt-6 space-y-6">
          {/* O alerta que faltou por três meses */}
          {ultima && estado(ultima) !== "ok" && (
            <div className="rounded-2xl border-2 border-[var(--vermelho)] bg-white p-5">
              <p className="font-extrabold text-[var(--vermelho)] text-lg">
                A última sincronização não funcionou
              </p>
              <p className="text-sm text-[var(--marrom)] mt-1">{quando(ultima.started_at)}</p>
              <p className="text-sm text-[var(--marrom)] mt-3">
                {String((ultima.details ?? {})["motivo"] ?? "") ||
                  "Execução antiga, sem motivo registrado. Trouxe zero produtos do OMIE."}
              </p>
            </div>
          )}

          {ultimaOk && diasAtras(ultimaOk.started_at) >= 2 && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
              <p className="font-bold text-amber-900">
                A última leitura boa foi há {diasAtras(ultimaOk.started_at)} dias
              </p>
              <p className="text-sm text-amber-900/80 mt-1">
                A varredura roda todo dia às 6h. Se está parada há dias, alguma coisa a
                impede de rodar.
              </p>
            </div>
          )}

          {/* Quem cria item */}
          <div className="rounded-2xl bg-white border border-[var(--marrom)]/15 p-5">
            <p className="font-bold text-[var(--marrom)]">Quem cria item novo</p>
            <p className="text-sm text-[var(--marrom)]/80 mt-2 leading-relaxed">
              Item novo nasce pelo <strong>Painel de Controle</strong>, segundos depois do
              cadastro no OMIE. Produto que não casa com um padrão conhecido vira pendência
              no /painel, pra escolher categoria e validade. Esta varredura aqui{" "}
              <strong>nunca cria item</strong> — ela só religa vínculos e corrige código e
              código de barras. Nome e validade ela não toca.
            </p>
          </div>

          {podeSincronizar && (
            <div>
              <button
                onClick={sincronizar}
                disabled={rodando}
                className="bg-[var(--marrom)] text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50 hover:brightness-110 transition"
              >
                {rodando ? "Sincronizando..." : "Sincronizar agora"}
              </button>
              {resultado && (
                <p
                  className={`mt-3 text-sm rounded-xl px-4 py-3 ${
                    deuErro
                      ? "bg-[var(--vermelho)]/10 text-[var(--vermelho)] font-medium"
                      : "bg-[var(--verde)]/40 text-[#1d4416]"
                  }`}
                >
                  {resultado}
                </p>
              )}
            </div>
          )}

          {/* Histórico */}
          <div className="rounded-2xl bg-white border border-[var(--marrom)]/15 overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--marrom)]/10">
              <p className="font-bold text-[var(--marrom)]">Últimas execuções</p>
            </div>

            {execucoes.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--marrom)]/70">
                Nenhuma execução registrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bege)] text-[var(--marrom)]/70 text-xs uppercase">
                    <tr>
                      <th className="text-left px-5 py-2 font-semibold">Quando</th>
                      <th className="text-left px-3 py-2 font-semibold">Estado</th>
                      <th className="text-right px-3 py-2 font-semibold">Produtos</th>
                      <th className="text-right px-3 py-2 font-semibold">Vinculados</th>
                      <th className="text-right px-3 py-2 font-semibold">Atualizados</th>
                      <th className="text-right px-3 py-2 font-semibold">Erros</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {execucoes.map((e) => {
                      const st = estado(e);
                      const d = (e.details ?? {}) as Record<string, unknown>;
                      return (
                        <tr key={e.id} className="border-t border-[var(--marrom)]/10 align-top">
                          <td className="px-5 py-3 whitespace-nowrap text-[var(--marrom)]">
                            {quando(e.started_at)}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-1 rounded-lg ${CORES[st].chip}`}
                            >
                              {CORES[st].rotulo}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{e.total_omie}</td>
                          <td className="px-3 py-3 text-right font-mono">
                            {String(d["vinculados_agora"] ?? "—")}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">{e.updated}</td>
                          <td className="px-3 py-3 text-right font-mono">{e.errors}</td>
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => setAberta(aberta === e.id ? null : e.id)}
                              className="text-xs text-[var(--marrom)] underline"
                            >
                              {aberta === e.id ? "fechar" : "detalhes"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {aberta && (
              <pre className="bg-[var(--bege)] border-t border-[var(--marrom)]/10 px-5 py-4 text-[11px] text-[var(--marrom)] overflow-x-auto">
                {JSON.stringify(execucoes.find((e) => e.id === aberta)?.details ?? {}, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
