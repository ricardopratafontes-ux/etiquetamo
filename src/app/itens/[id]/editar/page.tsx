"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/database";
import { useRouter, useParams } from "next/navigation";

const PRESETS_VALIDADE = [2, 5, 7, 10, 15, 30, 60, 90, 180, 365];
const UNIDADES = ["UN", "KG", "G", "L", "ML"];
const LIMITE_INFO = 80;

export default function EditarItem() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [descricao, setDescricao] = useState("");
  const [codigo, setCódigo] = useState("");
  const [codigoEan, setCódigoEan] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [pesoLiquido, setPesoLiquido] = useState("");
  const [tipoArmazenagem, setTipoArmazenagem] = useState("ambiente");
  const [usaEtiqueta, setUsaEtiqueta] = useState(true);
  const [usaLote, setUsaLote] = useState(false);
  const [usaValidade, setUsaValidade] = useState(true);
  const [usaEtiquetaComplementar, setUsaEtiquetaComplementar] = useState(false);
  const [textoComplementar, setTextoComplementar] = useState("");
  const [validadeDias, setValidadeDias] = useState<number | "">("");
  const [validadeCustom, setValidadeCustom] = useState(false);
  const [infoAdicional, setInfoAdicional] = useState("");
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    async function load() {
      const { data: item, error } = await supabase
        .from("items").select("*").eq("id", itemId).single();
      if (error || !item) { setMessage("Item não encontrado."); setLoading(false); return; }

      setDescricao(item.name);
      setCódigo(item.code || "");
      setCódigoEan(item.barcode || "");
      setCategoriaId(item.category_id || "");
      setUnidade(item.unit || "UN");
      setPesoLiquido(item.net_weight || "");
      setTipoArmazenagem(item.storage_type || "ambiente");
      setUsaEtiqueta(item.uses_label ?? true);
      setUsaLote(item.uses_lot ?? false);
      setUsaValidade(item.uses_expiry ?? true);
      setUsaEtiquetaComplementar(item.uses_complementary_label ?? false);
      setTextoComplementar(item.complementary_label_text || "");
      setValidadeDias(item.expiry_days || "");
      setInfoAdicional(item.additional_info || "");
      setOrgId(item.organization_id);

      if (item.expiry_days && !PRESETS_VALIDADE.includes(item.expiry_days)) setValidadeCustom(true);

      const { data: cats } = await supabase
        .from("categories").select("*").eq("organization_id", item.organization_id).order("name");
      if (cats) setCategories(cats);
      setLoading(false);
    }
    load();
  }, [itemId]);

  async function handleCreateCategory() {
    if (!newCategoryName.trim() || !orgId) return;
    const { data, error } = await supabase
      .from("categories").insert({ organization_id: orgId, name: newCategoryName.trim() }).select().single();
    if (error) { setMessage("Erro ao criar: " + error.message); return; }
    if (data) {
      setCategories((prev) => [...prev, data].sort((a: Category, b: Category) => a.name.localeCompare(b.name)));
      setCategoriaId(data.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descricao.trim()) { setMessage("Descrição é obrigatória."); return; }
    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("items").update({
      name: descricao.trim(),
      code: codigo.trim() || null,
      barcode: codigoEan.trim() || null,
      category_id: categoriaId || null,
      unit: unidade,
      net_weight: pesoLiquido.trim() || null,
      storage_type: tipoArmazenagem,
      uses_label: usaEtiqueta,
      uses_lot: usaLote,
      uses_expiry: usaValidade,
      uses_complementary_label: usaEtiquetaComplementar,
      complementary_label_text: textoComplementar.trim() || null,
      expiry_days: validadeDias || null,
      additional_info: infoAdicional.trim() || null,
      manual_override: true,
    }).eq("id", itemId);

    setSaving(false);
    if (error) { setMessage("Erro ao salvar: " + error.message); }
    else { setMessage("Item atualizado com sucesso!"); setTimeout(() => router.push("/itens"), 1000); }
  }

  if (loading) {
    return (<><NavBar /><main className="min-h-screen bg-[var(--bege)] flex items-center justify-center"><p className="text-[var(--marrom)] font-medium">Carregando...</p></main></>);
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#d41636] text-white px-6 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <span className="text-3xl block mb-1">&#x270F;&#xFE0F;</span>
            <h1 className="text-2xl font-extrabold">Editar Produto</h1>
            <p className="text-sm opacity-70 mt-1">{descricao}</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 -mt-4 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Card 1: Identificacao */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[var(--marrom)] px-5 py-3 text-center">
                <h2 className="font-bold text-white text-sm uppercase tracking-wide">&#x1F3F7;&#xFE0F; Identificação do Produto</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* Descricao */}
                <div>
                  <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">
                    Descrição <span className="text-[var(--vermelho)]">*</span>
                  </label>
                  <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Sorvete de Chocolate Belga" className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm font-medium text-center focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all" required />
                </div>

                {/* Código + EAN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">Código</label>
                    <input type="text" value={codigo} onChange={(e) => setCódigo(e.target.value)} placeholder="Ex: SORV-001" className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">Código EAN (GTIN)</label>
                    <input type="text" value={codigoEan} onChange={(e) => setCódigoEan(e.target.value)} placeholder="EAN / GTIN" className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all" />
                  </div>
                </div>

                {/* Família de Produto */}
                <div>
                  <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">Família de Produto</label>
                  <div className="flex gap-2">
                    <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="flex-1 px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all cursor-pointer">
                      <option value="">Sem família</option>
                      {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                    <button type="button" onClick={() => setShowNewCategory(!showNewCategory)} className="px-4 py-3 bg-[var(--verde)] text-[var(--marrom)] rounded-xl text-sm font-bold hover:opacity-90 cursor-pointer transition-all shadow-sm">+ Nova</button>
                  </div>
                  {showNewCategory && (
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome da nova família" className="flex-1 px-4 py-2.5 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-sm focus:outline-none focus:border-[var(--vermelho)]" autoFocus />
                      <button type="button" onClick={handleCreateCategory} className="px-4 py-2.5 bg-[var(--marrom)] text-white rounded-xl text-sm font-bold cursor-pointer hover:opacity-90">Criar</button>
                    </div>
                  )}
                </div>

                {/* Peso Líquido (esquerda) + Unidade (direita) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">Peso Líquido</label>
                    <input type="text" value={pesoLiquido} onChange={(e) => setPesoLiquido(e.target.value)} placeholder="Ex: 500g, 1.5kg" className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">Unidade</label>
                    <div className="flex gap-1.5">
                      {UNIDADES.map((u) => (
                        <button key={u} type="button" onClick={() => setUnidade(u)} className={"flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all " + (unidade === u ? "bg-[var(--vermelho)] text-white shadow-md" : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")}>{u}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tipo de Armazenagem */}
                <div>
                  <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block text-center">Tipo de Armazenagem</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setTipoArmazenagem("ambiente")} className={"flex flex-col items-center gap-1 py-3 rounded-xl cursor-pointer transition-all " + (tipoArmazenagem === "ambiente" ? "bg-[var(--vermelho)] text-white shadow-md" : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="2"/><path d="M14 3v3M14 22v3M3 14h3M22 14h3M6.3 6.3l2.1 2.1M19.6 19.6l2.1 2.1M6.3 21.7l2.1-2.1M19.6 8.4l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      <span className="text-sm font-bold">Ambiente</span>
                      <span className={"text-[10px] " + (tipoArmazenagem === "ambiente" ? "text-white/80" : "text-gray-500")}>Temp. natural</span>
                    </button>
                    <button type="button" onClick={() => setTipoArmazenagem("refrigerado")} className={"flex flex-col items-center gap-1 py-3 rounded-xl cursor-pointer transition-all " + (tipoArmazenagem === "refrigerado" ? "bg-[var(--vermelho)] text-white shadow-md" : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2v24M14 2l-4 4M14 2l4 4M14 26l-4-4M14 26l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.4 8l18.2 10.5M3.4 8l1.4 5.2M3.4 8l5.2 1.4M24.6 20l-1.4-5.2M24.6 20l-5.2-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.4 20l18.2-10.5M3.4 20l5.2-1.4M3.4 20l1.4-5.2M24.6 8l-5.2 1.4M24.6 8l-1.4 5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="text-sm font-bold">Refrigerado</span>
                      <span className={"text-[10px] " + (tipoArmazenagem === "refrigerado" ? "text-white/80" : "text-gray-500")}>Manter em 5°C</span>
                    </button>
                    <button type="button" onClick={() => setTipoArmazenagem("congelado")} className={"flex flex-col items-center gap-1 py-3 rounded-xl cursor-pointer transition-all " + (tipoArmazenagem === "congelado" ? "bg-[var(--vermelho)] text-white shadow-md" : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2v24M14 2l-4 4M14 2l4 4M14 26l-4-4M14 26l4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.4 8l18.2 10.5M3.4 8l1.4 5.2M3.4 8l5.2 1.4M24.6 20l-1.4-5.2M24.6 20l-5.2-1.4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.4 20l18.2-10.5M3.4 20l5.2-1.4M3.4 20l1.4-5.2M24.6 8l-5.2 1.4M24.6 8l-1.4 5.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="14" r="3" fill="currentColor"/></svg>
                      <span className="text-sm font-bold">Congelado</span>
                      <span className={"text-[10px] " + (tipoArmazenagem === "congelado" ? "text-white/80" : "text-gray-500")}>-14 a -22°C</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Perfil de Etiqueta */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[var(--vermelho)] px-5 py-3 text-center">
                <h2 className="font-bold text-white text-sm uppercase tracking-wide">&#x1F5A8;&#xFE0F; Perfil de Etiqueta</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <button type="button" onClick={() => setUsaEtiqueta(!usaEtiqueta)} className={"flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer " + (usaEtiqueta ? "border-[var(--vermelho)] bg-red-50 shadow-md" : "border-gray-200 bg-gray-50 opacity-60 hover:opacity-80")}>
                    <span className="text-xl">&#x1F3F7;&#xFE0F;</span>
                    <span className="text-xs font-bold text-[var(--marrom)]">Etiqueta</span>
                    <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (usaEtiqueta ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>{usaEtiqueta ? "SIM" : "NAO"}</span>
                  </button>
                  <button type="button" onClick={() => setUsaLote(!usaLote)} className={"flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer " + (usaLote ? "border-[var(--vermelho)] bg-red-50 shadow-md" : "border-gray-200 bg-gray-50 opacity-60 hover:opacity-80")}>
                    <span className="text-xl">&#x1F4CB;</span>
                    <span className="text-xs font-bold text-[var(--marrom)]">Lote</span>
                    <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (usaLote ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>{usaLote ? "SIM" : "NAO"}</span>
                  </button>
                  <button type="button" onClick={() => setUsaValidade(!usaValidade)} className={"flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer " + (usaValidade ? "border-[var(--vermelho)] bg-red-50 shadow-md" : "border-gray-200 bg-gray-50 opacity-60 hover:opacity-80")}>
                    <span className="text-xl">&#x23F1;&#xFE0F;</span>
                    <span className="text-xs font-bold text-[var(--marrom)]">Validade</span>
                    <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (usaValidade ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>{usaValidade ? "SIM" : "NAO"}</span>
                  </button>
                  <button type="button" onClick={() => setUsaEtiquetaComplementar(!usaEtiquetaComplementar)} className={"flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer " + (usaEtiquetaComplementar ? "border-[var(--vermelho)] bg-red-50 shadow-md" : "border-gray-200 bg-gray-50 opacity-60 hover:opacity-80")}>
                    <span className="text-xl">&#x1F4C4;</span>
                    <span className="text-xs font-bold text-[var(--marrom)] text-center leading-tight">Etiq. Compl.</span>
                    <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (usaEtiquetaComplementar ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>{usaEtiquetaComplementar ? "SIM" : "NAO"}</span>
                  </button>
                </div>

                {usaValidade && (
                  <div className="bg-[var(--bege)] rounded-xl p-4 mb-3">
                    <p className="text-sm font-semibold text-[var(--marrom)] mb-3 text-center">Validade padrão (em dias)</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {PRESETS_VALIDADE.map((d) => (
                        <button key={d} type="button" onClick={() => { setValidadeDias(d); setValidadeCustom(false); }} className={"px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all shadow-sm " + (validadeDias === d && !validadeCustom ? "bg-[var(--vermelho)] text-white shadow-md scale-105" : "bg-white text-[var(--marrom)] hover:bg-gray-100 border border-gray-200")}>{d}d</button>
                      ))}
                      <button type="button" onClick={() => { setValidadeCustom(true); setValidadeDias(""); }} className={"px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all shadow-sm " + (validadeCustom ? "bg-[var(--vermelho)] text-white shadow-md scale-105" : "bg-white text-[var(--marrom)] hover:bg-gray-100 border border-gray-200")}>Outro...</button>
                    </div>
                    {validadeCustom && (
                      <div className="flex justify-center mt-3">
                        <input type="number" min={1} value={validadeDias} onChange={(e) => setValidadeDias(e.target.value ? parseInt(e.target.value) : "")} placeholder="Quantos dias?" className="w-40 px-4 py-2.5 bg-white border-2 border-[var(--vermelho)] rounded-xl text-sm font-medium focus:outline-none text-center" autoFocus />
                      </div>
                    )}
                  </div>
                )}

                {usaEtiquetaComplementar && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm font-semibold text-blue-800 mb-2 text-center">Texto padrão da etiqueta complementar</p>
                    <input type="text" value={textoComplementar} onChange={(e) => setTextoComplementar(e.target.value)} placeholder="Ex: Cliente VIP / Evento Casamento / Produto em teste" className="w-full px-4 py-2.5 bg-white border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:border-[var(--vermelho)]" />
                    <p className="text-xs text-blue-600 mt-2 text-center">A 2ª etiqueta da linha será usada para esta informação. Pode ser alterado na impressão.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Info adicional */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[var(--verde)] px-5 py-3 text-center">
                <h2 className="font-bold text-[var(--marrom)] text-sm uppercase tracking-wide">&#x1F4AC; Informação Adicional</h2>
              </div>
              <div className="p-5">
                <textarea
                  value={infoAdicional}
                  onChange={(e) => { if (e.target.value.length <= LIMITE_INFO) setInfoAdicional(e.target.value); }}
                  placeholder='Ex: "Contém glúten" / "Sem lactose"'
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all resize-none"
                />
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-gray-400">Aparece na etiqueta impressa</p>
                  <p className={"text-xs font-bold " + (infoAdicional.length >= LIMITE_INFO ? "text-[var(--vermelho)]" : "text-gray-400")}>
                    {infoAdicional.length}/{LIMITE_INFO}
                  </p>
                </div>
              </div>
            </div>

            {/* Botoes */}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className={"flex-1 py-4 rounded-2xl font-extrabold text-lg shadow-xl transition-all cursor-pointer " + (saving ? "bg-gray-300 text-gray-500" : "bg-[var(--vermelho)] text-white hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0")}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
              <button type="button" onClick={() => router.push("/itens")} className="px-8 py-4 rounded-2xl font-bold text-lg bg-white text-[var(--marrom)] border-2 border-gray-200 hover:bg-gray-50 cursor-pointer transition-all">
                Cancelar
              </button>
            </div>

            {message && (
              <div className={"text-center py-3 px-4 rounded-xl font-semibold text-sm " + (message.includes("sucesso") ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200")}>
                {message}
              </div>
            )}
          </form>
        </div>
      </main>
    </>
  );
}
