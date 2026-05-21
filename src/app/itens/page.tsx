"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Item, Category } from "@/types/database";
import Link from "next/link";

const ORG_SLUG = "gelateria";

export default function ListaItens() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativos" | "inativos">("ativos");
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

    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .eq("organization_id", org.id)
      .order("name");
    if (cats) setCategories(cats);

    let query = supabase
      .from("items")
      .select("*")
      .eq("organization_id", org.id)
      .order("name");

    if (filtroAtivo === "ativos") query = query.eq("active", true);
    else if (filtroAtivo === "inativos") query = query.eq("active", false);
    if (filtroCategoria) query = query.eq("category_id", filtroCategoria);

    const { data } = await query;
    if (data) setItems(data);
    setLoading(false);
  }, [filtroAtivo, filtroCategoria]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  async function toggleAtivo(item: Item) {
    const { error } = await supabase
      .from("items")
      .update({ active: !item.active })
      .eq("id", item.id);
    if (!error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i))
      );
    }
  }

  const itensFiltrados = items.filter((item) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      item.name.toLowerCase().includes(termo) ||
      (item.code && item.code.toLowerCase().includes(termo)) ||
      (item.barcode && item.barcode.toLowerCase().includes(termo))
    );
  });

  function nomeCategoria(catId: string | null) {
    if (!catId) return null;
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : null;
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-white px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📦</span>
                <div>
                  <h1 className="text-2xl font-extrabold">Meus Itens</h1>
                  <p className="text-sm opacity-70">
                    {loading ? "Carregando..." : `${itensFiltrados.length} ${itensFiltrados.length === 1 ? "produto" : "produtos"}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/itens/importar"
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition-all"
                >
                  <span>📄</span> Importar
                </Link>
                <Link
                  href="/itens/novo"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--vermelho)] hover:bg-red-600 rounded-xl text-sm font-bold shadow-lg transition-all"
                >
                  <span className="text-lg">+</span> Novo Item
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 -mt-4">
          {/* Barra de filtros */}
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Busca */}
              <div className="flex-1 min-w-[220px] relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por descricao, codigo, EAN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                />
              </div>
              {/* Filtro categoria */}
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-4 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm font-medium text-[var(--marrom)] focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)] cursor-pointer"
              >
                <option value="">🏷️ Todas familias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {/* Filtro status */}
              <div className="flex bg-[var(--bege)] rounded-xl overflow-hidden">
                {(["ativos", "inativos", "todos"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroAtivo(f)}
                    className={
                      "px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer " +
                      (filtroAtivo === f
                        ? "bg-[var(--vermelho)] text-white shadow-inner"
                        : "text-[var(--marrom)] hover:bg-white/80")
                    }
                  >
                    {f === "ativos" ? "✅ Ativos" : f === "inativos" ? "⛔ Inativos" : "📋 Todos"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conteudo */}
          {loading ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3 animate-pulse">⏳</span>
              <p className="text-[var(--marrom)] font-medium">Carregando itens...</p>
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-[var(--verde)]">
              <span className="text-6xl block mb-4">
                {items.length === 0 ? "🍦" : "🔍"}
              </span>
              <h2 className="text-xl font-bold text-[var(--marrom)] mb-2">
                {items.length === 0 ? "Nenhum produto cadastrado ainda" : "Nenhum resultado encontrado"}
              </h2>
              <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                {items.length === 0
                  ? "Comece cadastrando seu primeiro produto ou importe uma planilha com todos os itens da sua gelateria."
                  : "Tente ajustar os filtros ou buscar com outros termos."}
              </p>
              {items.length === 0 && (
                <div className="flex justify-center gap-3">
                  <Link
                    href="/itens/novo"
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--vermelho)] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
                  >
                    <span className="text-lg">+</span> Cadastrar Primeiro Item
                  </Link>
                  <Link
                    href="/itens/importar"
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--marrom)] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
                  >
                    <span>📄</span> Importar Planilha
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
              {itensFiltrados.map((item) => {
                const catNome = nomeCategoria(item.category_id);
                return (
                  <div
                    key={item.id}
                    className={
                      "bg-white rounded-2xl shadow-md border-l-4 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 " +
                      (item.active ? "border-l-[var(--verde)]" : "border-l-gray-300 opacity-60")
                    }
                  >
                    {/* Cabecalho do card */}
                    <div className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-[var(--marrom)] text-base truncate">
                            {item.name}
                          </h3>
                          {(item.code || item.barcode) && (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              {item.code}{item.code && item.barcode ? " · " : ""}{item.barcode ? `EAN ${item.barcode}` : ""}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleAtivo(item)}
                          className={
                            "shrink-0 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all " +
                            (item.active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200")
                          }
                        >
                          {item.active ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {catNome && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                          🏷️ {catNome}
                        </span>
                      )}
                      {item.uses_expiry && item.expiry_days && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
                          ⏱️ {item.expiry_days}d
                        </span>
                      )}
                      {item.uses_label && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                          🏷️ Etiqueta
                        </span>
                      )}
                      {item.uses_lot && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200">
                          📋 Lote
                        </span>
                      )}
                      {item.storage_type && item.storage_type !== "ambiente" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs font-medium rounded-full border border-cyan-200">
                          {item.storage_type === "congelado" ? "🧊" : "❄️"} {item.storage_type === "congelado" ? "Congelado" : "Refrigerado"}
                        </span>
                      )}
                      {item.unit && item.unit !== "UN" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
                          ⚖️ {item.unit}{item.net_weight ? ` · ${item.net_weight}` : ""}
                        </span>
                      )}
                    </div>

                    {/* Info adicional */}
                    {item.additional_info && (
                      <div className="px-4 pb-3">
                        <p className="text-xs text-gray-500 italic truncate">
                          💬 {item.additional_info}
                        </p>
                      </div>
                    )}

                    {/* Footer do card */}
                    <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {item.source === "manual" ? "✏️ Manual" : item.source === "spreadsheet" ? "📄 Planilha" : "🔗 OMIE"}
                      </span>
                      <Link
                        href={`/itens/${item.id}/editar`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[var(--vermelho)] text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-all"
                      >
                        ✏️ Editar
                      </Link>
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
