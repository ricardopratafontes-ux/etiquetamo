"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ProductionOrder } from "@/types/database";
import Link from "next/link";

const ORG_SLUG = "gelateria";

const STATUS_CONFIG = {
  planejado: { label: "Planejado", cor: "bg-blue-100 text-blue-700 border-blue-200", icon: "📋", borderColor: "border-l-blue-400" },
  em_producao: { label: "Em Produção", cor: "bg-amber-100 text-amber-700 border-amber-200", icon: "🔥", borderColor: "border-l-amber-400" },
  concluido: { label: "Concluído", cor: "bg-green-100 text-green-700 border-green-200", icon: "✅", borderColor: "border-l-green-400" },
  cancelado: { label: "Cancelado", cor: "bg-gray-100 text-gray-500 border-gray-200", icon: "❌", borderColor: "border-l-gray-300" },
} as const;

interface OrdemComItens extends ProductionOrder {
  total_items?: number;
  total_quantity?: number;
  items_printed?: number;
}

export default function ListaProducao() {
  const [ordens, setOrdens] = useState<OrdemComItens[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "planejado" | "em_producao" | "concluido">("em_producao");
  const [orgId, setOrgId] = useState("");

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (!org) { setLoading(false); return; }
    setOrgId(org.id);

    let query = supabase
      .from("production_orders")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (filtroStatus !== "todos") {
      query = query.eq("status", filtroStatus);
    } else {
      query = query.neq("status", "cancelado");
    }

    const { data: ordensData } = await query;
    if (!ordensData) { setLoading(false); return; }

    // Buscar contagens de itens por ordem
    const ordensComContagem: OrdemComItens[] = await Promise.all(
      ordensData.map(async (ordem) => {
        const { data: items } = await supabase
          .from("production_order_items")
          .select("quantity, printed")
          .eq("order_id", ordem.id);

        const totalItems = items?.length || 0;
        const totalQuantity = items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
        const itemsPrinted = items?.filter((i) => i.printed).length || 0;

        return { ...ordem, total_items: totalItems, total_quantity: totalQuantity, items_printed: itemsPrinted };
      })
    );

    setOrdens(ordensComContagem);
    setLoading(false);
  }, [filtroStatus]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  async function moverStatus(ordem: OrdemComItens, novoStatus: "em_producao" | "concluido" | "cancelado") {
    const updates: Record<string, unknown> = { status: novoStatus };
    if (novoStatus === "em_producao") updates.started_at = new Date().toISOString();
    if (novoStatus === "concluido") updates.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("production_orders")
      .update(updates)
      .eq("id", ordem.id);

    if (!error) carregarDados();
  }

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#d41636] text-white px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏭</span>
                <div>
                  <h1 className="text-2xl font-extrabold">Ordens de Produção</h1>
                  <p className="text-sm opacity-70">
                    {loading ? "Carregando..." : `${ordens.length} ${ordens.length === 1 ? "ordem" : "ordens"}`}
                  </p>
                </div>
              </div>
              <Link
                href="/producao/nova"
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--vermelho)] hover:bg-red-600 rounded-xl text-sm font-bold shadow-lg transition-all"
              >
                <span className="text-lg">+</span> Nova Ordem
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 -mt-4">
          {/* Filtros de status */}
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {([
                { value: "em_producao", label: "🔥 Em Produção" },
                { value: "planejado", label: "📋 Planejado" },
                { value: "concluido", label: "✅ Concluídos" },
                { value: "todos", label: "📊 Todos" },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFiltroStatus(f.value)}
                  className={
                    "px-4 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer " +
                    (filtroStatus === f.value
                      ? "bg-[var(--vermelho)] text-white shadow-md"
                      : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-white")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          {loading ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3 animate-pulse">⏳</span>
              <p className="text-[var(--marrom)] font-medium">Carregando ordens...</p>
            </div>
          ) : ordens.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-[var(--verde)]">
              <span className="text-6xl block mb-4">🏭</span>
              <h2 className="text-xl font-bold text-[var(--marrom)] mb-2">
                Nenhuma ordem de produção
              </h2>
              <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                Crie uma ordem de produção para começar a imprimir etiquetas dos itens do dia.
              </p>
              <Link
                href="/producao/nova"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--vermelho)] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
              >
                <span className="text-lg">+</span> Criar Primeira Ordem
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pb-8">
              {ordens.map((ordem) => {
                const cfg = STATUS_CONFIG[ordem.status];
                const progresso = ordem.total_items
                  ? Math.round((ordem.items_printed! / ordem.total_items) * 100)
                  : 0;

                return (
                  <div
                    key={ordem.id}
                    className={
                      "bg-white rounded-2xl shadow-md border-l-4 overflow-hidden transition-all hover:shadow-lg " +
                      cfg.borderColor
                    }
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-[var(--marrom)] text-lg truncate">
                              {ordem.title}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${cfg.cor}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            Criada por <span className="font-medium">{ordem.created_by}</span> em {formatarData(ordem.created_at)}
                          </p>
                        </div>

                        {/* Contadores */}
                        <div className="flex gap-4 text-center shrink-0">
                          <div>
                            <p className="text-2xl font-extrabold text-[var(--marrom)]">{ordem.total_items}</p>
                            <p className="text-xs text-gray-400">{ordem.total_items === 1 ? "item" : "itens"}</p>
                          </div>
                          <div>
                            <p className="text-2xl font-extrabold text-[var(--vermelho)]">{ordem.total_quantity}</p>
                            <p className="text-xs text-gray-400">etiquetas</p>
                          </div>
                        </div>
                      </div>

                      {/* Barra de progresso (só em produção) */}
                      {ordem.status === "em_producao" && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500">Progresso de impressão</span>
                            <span className="text-xs font-bold text-[var(--marrom)]">{progresso}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-green-400 rounded-full transition-all"
                              style={{ width: `${progresso}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Notas */}
                      {ordem.notes && (
                        <p className="mt-3 text-sm text-gray-500 italic">💬 {ordem.notes}</p>
                      )}
                    </div>

                    {/* Footer com ações */}
                    <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
                      <div className="flex gap-2">
                        {ordem.status === "planejado" && (
                          <button
                            onClick={() => moverStatus(ordem, "em_producao")}
                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-all cursor-pointer"
                          >
                            🔥 Iniciar Produção
                          </button>
                        )}
                        {ordem.status === "em_producao" && (
                          <>
                            <Link
                              href={`/producao/${ordem.id}/imprimir`}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--vermelho)] text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-all"
                            >
                              🖨️ Imprimir Etiquetas
                            </Link>
                            <button
                              onClick={() => moverStatus(ordem, "concluido")}
                              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-all cursor-pointer"
                            >
                              ✅ Concluir
                            </button>
                          </>
                        )}
                      </div>
                      {(ordem.status === "planejado" || ordem.status === "em_producao") && (
                        <button
                          onClick={() => { if (confirm("Cancelar esta ordem?")) moverStatus(ordem, "cancelado"); }}
                          className="text-xs text-gray-400 hover:text-red-500 transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
