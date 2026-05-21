"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import NavBar from "@/components/NavBar";
import PatternStrip from "@/components/PatternStrip";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ORG_SLUG = "gelateria";

interface QuarantineItem {
  id: string;
  omie_product_id: number;
  omie_code: string | null;
  product_name: string;
  unit: string | null;
  status: string;
  created_at: string;
}

interface PrintQueueItem {
  id: string;
  omie_order_id: number | null;
  omie_order_number: string | null;
  product_name: string;
  item_id: string | null;
  quantity: number;
  lot: string | null;
  status: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  total_omie: number;
  matched: number;
  quarantined: number;
  updated: number;
  errors: number;
  started_at: string;
  completed_at: string | null;
}

type Tab = "sync" | "quarantine" | "queue";

export default function OmiePage() {
  const [tab, setTab] = useState<Tab>("sync");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    summary?: { total_omie: number; matched: number; quarantined: number; updated: number; errors: number };
    error?: string;
  } | null>(null);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineItem[]>([]);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (!org) {
      setLoading(false);
      return;
    }

    // Último sync
    const { data: syncLogs } = await supabase
      .from("omie_sync_log")
      .select("*")
      .eq("organization_id", org.id)
      .order("started_at", { ascending: false })
      .limit(1);

    if (syncLogs && syncLogs.length > 0) {
      setLastSync(syncLogs[0] as SyncLog);
    }

    // Quarentena pendente
    const { data: qData } = await supabase
      .from("omie_quarantine")
      .select("*")
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setQuarantine((qData || []) as QuarantineItem[]);

    // Fila de impressão pendente
    const { data: pData } = await supabase
      .from("omie_print_queue")
      .select("*")
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPrintQueue((pData || []) as PrintQueueItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/omie/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      loadData(); // Recarregar dados
    } catch (err) {
      setSyncResult({
        success: false,
        error: err instanceof Error ? err.message : "Erro de conexão",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleIgnoreQuarantine = async (id: string) => {
    await supabase
      .from("omie_quarantine")
      .update({ status: "ignored", resolved_at: new Date().toISOString() })
      .eq("id", id);
    loadData();
  };

  const handleSkipQueue = async (id: string) => {
    await supabase
      .from("omie_print_queue")
      .update({ status: "skipped" })
      .eq("id", id);
    loadData();
  };

  const handleMarkPrinted = async (id: string) => {
    await supabase
      .from("omie_print_queue")
      .update({ status: "printed", printed_at: new Date().toISOString() })
      .eq("id", id);
    loadData();
  };

  const tabs: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: "sync", label: "Sincronização", icon: "🔄" },
    { key: "quarantine", label: "Quarentena", icon: "⚠️", count: quarantine.length },
    { key: "queue", label: "Fila de Impressão", icon: "🖨️", count: printQueue.length },
  ];

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🔗</span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--marrom)]">Integração OMIE</h1>
              <p className="text-sm text-[var(--marrom)] opacity-60">
                Sincronização de produtos e ordens de produção
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all " +
                  (tab === t.key
                    ? "bg-[var(--marrom)] text-white shadow-md"
                    : "bg-white text-[var(--marrom)] border border-[var(--marrom)]/20 hover:bg-[var(--marrom)]/5")
                }
              >
                <span>{t.icon}</span>
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="bg-[var(--vermelho)] text-white text-xs px-2 py-0.5 rounded-full">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-[var(--marrom)] opacity-60">
              Carregando...
            </div>
          ) : (
            <>
              {/* TAB: Sincronização */}
              {tab === "sync" && (
                <div className="space-y-4">
                  {/* Botão de sync */}
                  <div className="bg-white rounded-2xl p-6 shadow-md">
                    <h2 className="text-lg font-bold text-[var(--marrom)] mb-2">
                      Sincronizar Produtos
                    </h2>
                    <p className="text-sm text-[var(--marrom)] opacity-70 mb-4">
                      Busca todos os produtos do OMIE e compara com os itens cadastrados.
                      Itens desconhecidos vão para a quarentena. Nomes dos itens no EtiquetaMO
                      nunca são alterados.
                    </p>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className={
                        "px-6 py-3 rounded-xl font-bold text-white transition-all " +
                        (syncing
                          ? "bg-gray-400 cursor-wait"
                          : "bg-[var(--vermelho)] hover:bg-[var(--vermelho)]/90 shadow-md hover:shadow-lg")
                      }
                    >
                      {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar Agora"}
                    </button>

                    {/* Resultado da sync */}
                    {syncResult && (
                      <div
                        className={
                          "mt-4 p-4 rounded-xl text-sm " +
                          (syncResult.success
                            ? "bg-green-50 border border-green-200 text-green-800"
                            : "bg-red-50 border border-red-200 text-red-800")
                        }
                      >
                        {syncResult.success && syncResult.summary ? (
                          <div>
                            <p className="font-bold mb-2">Sincronização concluída</p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold">{syncResult.summary.total_omie}</div>
                                <div className="text-xs opacity-70">Total OMIE</div>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-green-600">{syncResult.summary.matched}</div>
                                <div className="text-xs opacity-70">Encontrados</div>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-blue-600">{syncResult.summary.updated}</div>
                                <div className="text-xs opacity-70">Atualizados</div>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-orange-600">{syncResult.summary.quarantined}</div>
                                <div className="text-xs opacity-70">Quarentena</div>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-red-600">{syncResult.summary.errors}</div>
                                <div className="text-xs opacity-70">Erros</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p>Erro: {syncResult.error}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Última sincronização */}
                  {lastSync && (
                    <div className="bg-white rounded-2xl p-6 shadow-md">
                      <h3 className="text-sm font-bold text-[var(--marrom)] mb-2">
                        Última Sincronização
                      </h3>
                      <div className="text-sm text-[var(--marrom)] opacity-70 space-y-1">
                        <p>
                          Data:{" "}
                          {new Date(lastSync.started_at).toLocaleString("pt-BR")}
                          {lastSync.completed_at && (
                            <span className="text-green-600 ml-2">✓ Concluída</span>
                          )}
                        </p>
                        <p>
                          Total OMIE: {lastSync.total_omie} | Encontrados: {lastSync.matched} |
                          Atualizados: {lastSync.updated} | Quarentena: {lastSync.quarantined} |
                          Erros: {lastSync.errors}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Webhook status */}
                  <div className="bg-white rounded-2xl p-6 shadow-md">
                    <h3 className="text-sm font-bold text-[var(--marrom)] mb-2">
                      Webhook OMIE
                    </h3>
                    <p className="text-sm text-[var(--marrom)] opacity-70 mb-2">
                      Configure no painel OMIE para receber notificações quando uma ordem
                      de produção entrar na etapa &quot;Produzindo&quot;.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all">
                      POST https://etiquetamo.vercel.app/api/omie/webhook
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Quarentena */}
              {tab === "quarantine" && (
                <div className="space-y-3">
                  {quarantine.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 shadow-md text-center">
                      <span className="text-4xl block mb-2">✅</span>
                      <p className="text-[var(--marrom)] font-semibold">Quarentena vazia</p>
                      <p className="text-sm text-[var(--marrom)] opacity-60">
                        Todos os produtos do OMIE estão cadastrados no EtiquetaMO
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--marrom)] opacity-70">
                        Estes produtos existem no OMIE mas não foram encontrados no EtiquetaMO.
                        Cadastre-os manualmente em &quot;Meus Itens&quot; ou ignore.
                      </p>
                      {quarantine.map((q) => (
                        <div
                          key={q.id}
                          className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-[var(--marrom)]">
                              {q.product_name}
                            </p>
                            <p className="text-xs text-[var(--marrom)] opacity-60">
                              OMIE #{q.omie_product_id}
                              {q.omie_code && ` · Código: ${q.omie_code}`}
                              {q.unit && ` · ${q.unit}`}
                              {" · "}
                              {new Date(q.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <button
                            onClick={() => handleIgnoreQuarantine(q.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            Ignorar
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TAB: Fila de Impressão */}
              {tab === "queue" && (
                <div className="space-y-3">
                  {printQueue.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 shadow-md text-center">
                      <span className="text-4xl block mb-2">🖨️</span>
                      <p className="text-[var(--marrom)] font-semibold">Fila vazia</p>
                      <p className="text-sm text-[var(--marrom)] opacity-60">
                        Nenhuma ordem de produção aguardando impressão
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--marrom)] opacity-70">
                        Ordens de produção que entraram na etapa &quot;Produzindo&quot; no OMIE.
                        Imprima as etiquetas ou pule.
                      </p>
                      {printQueue.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[var(--vermelho)] flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-[var(--marrom)]">
                              {p.product_name}
                            </p>
                            <p className="text-xs text-[var(--marrom)] opacity-60">
                              {p.omie_order_number && `OP #${p.omie_order_number} · `}
                              Qtd: {p.quantity}
                              {p.lot && ` · Lote: ${p.lot}`}
                              {" · "}
                              {new Date(p.created_at).toLocaleString("pt-BR")}
                            </p>
                            {!p.item_id && (
                              <p className="text-xs text-orange-600 font-medium mt-1">
                                ⚠️ Item não encontrado no EtiquetaMO
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkPrinted(p.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--vermelho)] text-white hover:opacity-90 transition-colors font-semibold"
                            >
                              ✓ Impresso
                            </button>
                            <button
                              onClick={() => handleSkipQueue(p.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              Pular
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <PatternStrip />
    </>
  );
}
