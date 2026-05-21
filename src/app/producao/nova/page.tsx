"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Item, Category } from "@/types/database";
import { useRouter } from "next/navigation";

const ORG_SLUG = "gelateria";

interface ItemSelecionado {
  item: Item;
  quantity: number;
  lot: string;
}

export default function NovaOrdemProducao() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [orgId, setOrgId] = useState("");

  // Formulário
  const [titulo, setTitulo] = useState(() => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    return `Produção ${hoje}`;
  });
  const [criadoPor, setCriadoPor] = useState("");
  const [notas, setNotas] = useState("");
  const [selecionados, setSelecionados] = useState<ItemSelecionado[]>([]);

  // Filtro de itens
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  useEffect(() => {
    async function carregar() {
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

      // Só itens que imprimem etiqueta (uses_label = true)
      const { data } = await supabase
        .from("items")
        .select("*")
        .eq("organization_id", org.id)
        .eq("active", true)
        .eq("uses_label", true)
        .order("name");
      if (data) setItems(data);
      setLoading(false);
    }
    carregar();
  }, []);

  const itensFiltrados = items.filter((item) => {
    // Não mostrar itens já selecionados
    if (selecionados.find((s) => s.item.id === item.id)) return false;
    if (!busca.trim() && !filtroCategoria) return true;
    const matchBusca = !busca.trim() || item.name.toLowerCase().includes(busca.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(busca.toLowerCase()));
    const matchCat = !filtroCategoria || item.category_id === filtroCategoria;
    return matchBusca && matchCat;
  });

  function adicionarItem(item: Item) {
    setSelecionados((prev) => [
      ...prev,
      { item, quantity: 1, lot: "" },
    ]);
  }

  function removerItem(itemId: string) {
    setSelecionados((prev) => prev.filter((s) => s.item.id !== itemId));
  }

  function atualizarQuantidade(itemId: string, qty: number) {
    setSelecionados((prev) =>
      prev.map((s) => (s.item.id === itemId ? { ...s, quantity: Math.max(1, qty) } : s))
    );
  }

  function atualizarLote(itemId: string, lot: string) {
    setSelecionados((prev) =>
      prev.map((s) => (s.item.id === itemId ? { ...s, lot } : s))
    );
  }

  async function criarOrdem() {
    if (!titulo.trim()) { alert("Informe o título da ordem"); return; }
    if (!criadoPor.trim()) { alert("Informe quem está criando a ordem"); return; }
    if (selecionados.length === 0) { alert("Adicione pelo menos um item"); return; }

    setSalvando(true);

    // Criar a ordem
    const { data: ordem, error: erroOrdem } = await supabase
      .from("production_orders")
      .insert({
        organization_id: orgId,
        title: titulo.trim(),
        created_by: criadoPor.trim(),
        notes: notas.trim() || null,
      })
      .select("id")
      .single();

    if (erroOrdem || !ordem) {
      alert("Erro ao criar ordem: " + (erroOrdem?.message || "desconhecido"));
      setSalvando(false);
      return;
    }

    // Inserir itens
    const itensInsert = selecionados.map((s) => ({
      order_id: ordem.id,
      item_id: s.item.id,
      quantity: s.quantity,
      lot: s.lot.trim() || null,
    }));

    const { error: erroItens } = await supabase
      .from("production_order_items")
      .insert(itensInsert);

    if (erroItens) {
      alert("Erro ao inserir itens: " + erroItens.message);
      setSalvando(false);
      return;
    }

    router.push("/producao");
  }

  function nomeCategoria(catId: string | null) {
    if (!catId) return null;
    return categories.find((c) => c.id === catId)?.name || null;
  }

  const totalEtiquetas = selecionados.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-white px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📝</span>
              <div>
                <h1 className="text-2xl font-extrabold">Nova Ordem de Produção</h1>
                <p className="text-sm opacity-70">
                  Selecione os itens, defina quantidade e lote
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 -mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Coluna esquerda: dados da ordem + busca de itens */}
            <div className="lg:col-span-3 space-y-4">
              {/* Dados da ordem */}
              <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-5">
                <h2 className="font-bold text-[var(--marrom)] mb-4 flex items-center gap-2">
                  <span>📋</span> Dados da Ordem
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Título *</label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Produção 21/05/2026 - Manhã"
                      className="w-full px-4 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Criado por *</label>
                    <input
                      type="text"
                      value={criadoPor}
                      onChange={(e) => setCriadoPor(e.target.value)}
                      placeholder="Nome do responsável"
                      className="w-full px-4 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                    <input
                      type="text"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-4 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                    />
                  </div>
                </div>
              </div>

              {/* Busca de itens */}
              <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-5">
                <h2 className="font-bold text-[var(--marrom)] mb-4 flex items-center gap-2">
                  <span>🔍</span> Adicionar Itens
                </h2>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar item por nome ou código..."
                    className="flex-1 px-4 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                  />
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--bege)] border-none rounded-xl text-sm font-medium text-[var(--marrom)] focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)] cursor-pointer"
                  >
                    <option value="">Todas famílias</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <p className="text-sm text-gray-400 text-center py-4">Carregando itens...</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                    {itensFiltrados.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        {items.length === 0 ? "Nenhum item cadastrado" : "Nenhum item encontrado"}
                      </p>
                    ) : (
                      itensFiltrados.slice(0, 50).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => adicionarItem(item)}
                          className="w-full text-left px-4 py-3 bg-[var(--bege)] hover:bg-green-50 rounded-xl transition-all cursor-pointer group flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[var(--marrom)] truncate">{item.name}</p>
                            <p className="text-xs text-gray-400">
                              {item.code && <span>{item.code} · </span>}
                              {nomeCategoria(item.category_id) && <span>{nomeCategoria(item.category_id)} · </span>}
                              {item.expiry_days && <span>{item.expiry_days}d validade</span>}
                            </p>
                          </div>
                          <span className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg font-bold">+</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Coluna direita: itens selecionados */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg border border-[var(--vermelho)] p-5 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-[var(--marrom)] flex items-center gap-2">
                    <span>🛒</span> Itens da Ordem
                  </h2>
                  <span className="text-xs font-bold text-[var(--vermelho)] bg-red-50 px-2 py-1 rounded-full">
                    {selecionados.length} {selecionados.length === 1 ? "item" : "itens"} · {totalEtiquetas} etiquetas
                  </span>
                </div>

                {selecionados.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-3xl block mb-2 opacity-30">📦</span>
                    <p className="text-sm text-gray-400">Clique nos itens à esquerda para adicionar</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {selecionados.map((sel) => (
                      <div
                        key={sel.item.id}
                        className="bg-[var(--bege)] rounded-xl p-3 relative"
                      >
                        <button
                          type="button"
                          onClick={() => removerItem(sel.item.id)}
                          className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                        >
                          ✕
                        </button>
                        <p className="font-semibold text-sm text-[var(--marrom)] pr-6 truncate mb-2">
                          {sel.item.name}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-400 mb-0.5">Qtd etiquetas</label>
                            <input
                              type="number"
                              min={1}
                              value={sel.quantity}
                              onChange={(e) => atualizarQuantidade(sel.item.id, parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-400 mb-0.5">
                              Lote {sel.item.uses_lot ? "*" : "(opc)"}
                            </label>
                            <input
                              type="text"
                              value={sel.lot}
                              onChange={(e) => atualizarLote(sel.item.id, e.target.value)}
                              placeholder="Ex: L001"
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botão criar */}
                <button
                  type="button"
                  onClick={criarOrdem}
                  disabled={salvando || selecionados.length === 0}
                  className={
                    "w-full mt-5 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all " +
                    (selecionados.length === 0
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[var(--vermelho)] text-white shadow-lg hover:bg-red-600 cursor-pointer")
                  }
                >
                  {salvando ? (
                    <>⏳ Criando...</>
                  ) : (
                    <>🏭 Criar Ordem ({totalEtiquetas} etiquetas)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="h-8" />
      </main>
    </>
  );
}
