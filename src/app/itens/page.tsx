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
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-4 mb-5">
            <div className="flex flex-col gap-3">
              {/* Linha 1: Família (destaque) */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🏷️</span>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[var(--bege)] border-2 border-[var(--verde)] rounded-xl text-base font-semibold text-[var(--marrom)] focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)] cursor-pointer"
                >
                  <option value="">Todas as famílias</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* Linha 2: Busca + Status */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[180px] relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por descrição, código, EAN..."
                    className="w-full pl-9 pr-4 py-2 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                  />
                </div>
                <div className="flex bg-[var(--bege)] rounded-xl overflow-hidden">
                  {(["ativos", "inativos", "todos"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFiltroAtivo(f)}
                      className={
                        "px-3 py-2 text-xs font-semibold transition-all cursor-pointer " +
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-8">
              {itensFiltrados.map((item) => {
                const catNome = nomeCategoria(item.category_id);
                return (
                  <div
                    key={item.id}
                    className={
                      "bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 " +
                      (item.active ? "border-l-[var(--verde)]" : "border-l-gray-300 opacity-60")
                    }
                  >
                    {/* Cabeçalho compacto */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-bold text-[var(--marrom)] text-sm leading-tight truncate flex-1 min-w-0">
                          {item.name}
                        </h3>
                        <button
                          onClick={() => toggleAtivo(item)}
                          className={
                            "shrink-0 w-2 h-2 rounded-full mt-1.5 cursor-pointer " +
                            (item.active ? "bg-green-500" : "bg-gray-300")
                          }
                          title={item.active ? "Ativo" : "Inativo"}
                        />
                      </div>
                      {item.code && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{item.code}</p>
                      )}
                    </div>

                    {/* Badges compactos */}
                    <div className="px-3 pb-2 flex flex-wrap gap-1">
                      {catNome && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-medium rounded-full border border-amber-200 truncate max-w-[120px]">
                          {catNome}
                        </span>
                      )}
                      {item.uses_expiry && item.expiry_days && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded-full border border-blue-200">
                          {item.expiry_days}d
                        </span>
                      )}
                      {item.storage_type && item.storage_type !== "ambiente" && (
                        <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-medium rounded-full border border-cyan-200">
                          {item.storage_type === "congelado" ? "🧊" : "❄️"}
                        </span>
                      )}
                      {item.uses_lot && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-medium rounded-full border border-purple-200">
                          Lote
                        </span>
                      )}
                    </div>

                    {/* Footer compacto com Editar + Imprimir */}
                    <div className="bg-gray-50 px-3 py-2 flex items-center justify-end gap-1.5 border-t border-gray-100">
                      <Link
                        href={`/itens/${item.id}/editar`}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[var(--marrom)] text-white text-[11px] font-bold rounded-lg hover:opacity-90 transition-all"
                      >
                        ✏️ Editar
                      </Link>
                      <Link
                        href={`/producao/${item.id}/imprimir`}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[var(--vermelho)] text-white text-[11px] font-bold rounded-lg hover:bg-red-600 transition-all"
                      >
                        🖨️ Imprimir
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
