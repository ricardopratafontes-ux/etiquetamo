"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const ORG_SLUG = "gelateria";

interface Colaborador {
  id: string;
  name: string;
  active: boolean;
  organization_id: string;
  created_at: string;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: org } = await supabase
      .from("organizations").select("id").eq("slug", ORG_SLUG).single();
    if (!org) { setLoading(false); return; }
    setOrgId(org.id);

    const { data } = await supabase
      .from("operators").select("*").eq("organization_id", org.id).order("name");
    if (data) setColaboradores(data);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() {
    setEditingId(null);
    setNome("");
    setShowForm(true);
    setMessage("");
  }

  function abrirEditar(c: Colaborador) {
    setEditingId(c.id);
    setNome(c.name);
    setShowForm(true);
    setMessage("");
  }

  async function salvar() {
    if (!nome.trim()) { setMessage("Nome é obrigatório."); return; }
    setSaving(true);
    setMessage("");

    if (editingId) {
      const { error } = await supabase.from("operators").update({ name: nome.trim() }).eq("id", editingId);
      if (error) { setMessage("Erro: " + error.message); setSaving(false); return; }
      setMessage("Colaborador atualizado!");
    } else {
      const { error } = await supabase.from("operators").insert({ organization_id: orgId, name: nome.trim() });
      if (error) { setMessage("Erro: " + error.message); setSaving(false); return; }
      setMessage("Colaborador adicionado!");
    }

    setSaving(false);
    setShowForm(false);
    setNome("");
    setEditingId(null);
    carregar();
  }

  async function toggleAtivo(c: Colaborador) {
    await supabase.from("operators").update({ active: !c.active }).eq("id", c.id);
    setColaboradores((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !x.active } : x));
  }

  const ativos = colaboradores.filter((c) => c.active);
  const inativos = colaboradores.filter((c) => !c.active);

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-white px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👥</span>
                <div>
                  <h1 className="text-2xl font-extrabold">Equipe</h1>
                  <p className="text-sm opacity-70">
                    {loading ? "Carregando..." : `${ativos.length} colaborador${ativos.length !== 1 ? "es" : ""} ativo${ativos.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <button
                onClick={abrirNovo}
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--vermelho)] hover:bg-red-600 rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer"
              >
                <span className="text-lg">+</span> Novo Colaborador
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 -mt-4 pb-8">
          {/* Mensagem */}
          {message && (
            <div className={"text-center py-3 px-4 rounded-xl font-semibold text-sm mb-4 " + (message.includes("Erro") ? "bg-red-100 text-red-700 border border-red-200" : "bg-green-100 text-green-700 border border-green-200")}>
              {message}
            </div>
          )}

          {/* Formulário inline */}
          {showForm && (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[var(--vermelho)] p-5 mb-5 animate-in">
              <h3 className="font-bold text-[var(--marrom)] text-lg mb-4">
                {editingId ? "Editar Colaborador" : "Novo Colaborador"}
              </h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block">Nome completo</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Ricardo Fontes"
                    className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && salvar()}
                  />
                </div>
                {nome.trim() && (
                  <div className="flex flex-col items-center gap-1 pb-0.5">
                    <span className="text-[10px] text-gray-400">Iniciais</span>
                    <span className="w-10 h-10 flex items-center justify-center bg-[var(--vermelho)] text-white font-extrabold text-sm rounded-lg">
                      {iniciais(nome)}
                    </span>
                  </div>
                )}
                <button
                  onClick={salvar}
                  disabled={saving}
                  className={"px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all " + (saving ? "bg-gray-300 text-gray-500" : "bg-[var(--vermelho)] text-white hover:bg-red-600 shadow-lg")}
                >
                  {saving ? "..." : editingId ? "Salvar" : "Adicionar"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setNome(""); }}
                  className="px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3 animate-pulse">⏳</span>
              <p className="text-[var(--marrom)] font-medium">Carregando equipe...</p>
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
              <span className="text-6xl block mb-4">👥</span>
              <h2 className="text-xl font-bold text-[var(--marrom)] mb-2">Nenhum colaborador cadastrado</h2>
              <p className="text-gray-500 text-sm mb-6">Cadastre a equipe para usar o sistema de impressão de etiquetas.</p>
              <button onClick={abrirNovo} className="px-6 py-3 bg-[var(--vermelho)] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all cursor-pointer">
                + Cadastrar Primeiro Colaborador
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Ativos */}
              {ativos.map((c) => (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-[var(--verde)] p-4 flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="w-12 h-12 flex items-center justify-center bg-[var(--vermelho)] text-white font-extrabold text-base rounded-xl shadow-sm">
                    {iniciais(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--marrom)] text-base">{c.name}</h3>
                    <p className="text-xs text-gray-400">Iniciais na etiqueta: <span className="font-bold text-[var(--marrom)]">{iniciais(c.name)}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirEditar(c)}
                      className="px-3 py-1.5 bg-[var(--marrom)] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all cursor-pointer"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => toggleAtivo(c)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      Desativar
                    </button>
                  </div>
                </div>
              ))}

              {/* Inativos */}
              {inativos.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide pt-4 pb-1">Inativos</p>
                  {inativos.map((c) => (
                    <div key={c.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-gray-300 p-4 flex items-center gap-4 opacity-60 hover:opacity-80 transition-all">
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-300 text-gray-600 font-extrabold text-base rounded-xl">
                        {iniciais(c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-500 text-base">{c.name}</h3>
                      </div>
                      <button
                        onClick={() => toggleAtivo(c)}
                        className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-lg hover:bg-green-200 transition-all cursor-pointer"
                      >
                        Reativar
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
