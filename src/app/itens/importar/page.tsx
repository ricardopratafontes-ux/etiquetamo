"use client";

import NavBar from "@/components/NavBar";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface LinhaImportada {
  codigo: string;
  nome: string;
  familia: string;
  codigoEan: string;
  unidade: string;
  pesoLiquido: string;
  validadeDias: string;
  possuiLote: string;
  imprimeEtiqueta: string;
  etiquetaComplementar: string;
  tipoArmazenagem: string;
  responsavel: string;
  etiquetaContagem: string;
}

interface ResultadoImportacao {
  total: number;
  sucesso: number;
  erros: string[];
}

const ORG_SLUG = "gelateria";

const MODELO_CSV = `Codigo;Descricao;Familia de Produto;Codigo EAN;Unidade;Peso Liquido;Dias de Validade;Possui Lote;Imprime Etiqueta;Etiqueta Complementar;Tipo de Armazenagem;Responsavel;Etiqueta de Contagem
SORV-001;Sorvete de Chocolate Belga;Sorvetes;7891234567890;KG;1kg;7;Sim;Sim;Nao;Congelado;Ricardo;Nao
PIC-001;Picole de Morango;Picoles;7891234567891;UN;80g;30;Nao;Sim;Nao;Congelado;Ricardo;Nao
EMB-001;Embalagem Kraft 500ml;Embalagens;7891234567893;UN;;;Nao;Nao;Nao;Ambiente;Ricardo;Sim
TORTA-001;Torta de Limao;Tortas;7891234567892;UN;1.2kg;NAO PERECIVEL;Sim;Sim;Sim;Refrigerado;Ricardo;Nao`;

// Mapeamento de colunas: aceita variacoes comuns
const MAPA_COLUNAS: Record<string, keyof LinhaImportada> = {
  codigo: "codigo",
  code: "codigo",
  "codigo interno": "codigo",
  nome: "nome",
  name: "nome",
  descricao: "nome",
  produto: "nome",
  "nome do produto": "nome",
  familia: "familia",
  "familia de produto": "familia",
  categoria: "familia",
  category: "familia",
  "codigo ean": "codigoEan",
  "codigo ean (gtin)": "codigoEan",
  ean: "codigoEan",
  gtin: "codigoEan",
  barcode: "codigoEan",
  "codigo de barras": "codigoEan",
  unidade: "unidade",
  unit: "unidade",
  "peso liquido": "pesoLiquido",
  "peso_liquido": "pesoLiquido",
  net_weight: "pesoLiquido",
  validade: "validadeDias",
  "dias de validade": "validadeDias",
  "validade dias": "validadeDias",
  "validade (dias)": "validadeDias",
  expiry_days: "validadeDias",
  "possui lote": "possuiLote",
  lote: "possuiLote",
  "usa lote": "possuiLote",
  "imprime etiqueta": "imprimeEtiqueta",
  etiqueta: "imprimeEtiqueta",
  "usa etiqueta": "imprimeEtiqueta",
  "etiqueta complementar": "etiquetaComplementar",
  complementar: "etiquetaComplementar",
  "tipo de armazenagem": "tipoArmazenagem",
  armazenagem: "tipoArmazenagem",
  storage: "tipoArmazenagem",
  responsavel: "responsavel",
  "responsável": "responsavel",
  responsible: "responsavel",
  "etiqueta de contagem": "etiquetaContagem",
  "etiqueta contagem": "etiquetaContagem",
  contagem: "etiquetaContagem",
  counting: "etiquetaContagem",
};

function parseCSV(text: string): string[][] {
  const linhas: string[][] = [];
  const rows = text.split(/\r?\n/);
  for (const row of rows) {
    if (row.trim() === "") continue;
    const sep = row.includes(";") ? ";" : ",";
    linhas.push(row.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
  }
  return linhas;
}

function normBool(val: string): boolean {
  const v = val.toLowerCase().trim();
  return ["sim", "yes", "true", "1", "s", "x"].includes(v);
}

function normArmazenagem(val: string): "refrigerado" | "congelado" | "ambiente" {
  const v = val.toLowerCase().trim();
  if (v.includes("refrig")) return "refrigerado";
  if (v.includes("congel")) return "congelado";
  return "ambiente";
}

export default function ImportarItens() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaImportada[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState("");

  function downloadModelo() {
    const blob = new Blob([MODELO_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_etiquetamo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setErro("");
    setResultado(null);
    setLinhas([]);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "txt") {
      const reader = new FileReader();
      reader.onload = (ev) => processarCSV(ev.target?.result as string);
      reader.readAsText(file, "UTF-8");
    } else {
      setErro("Formato nao suportado. Salve como .csv (separado por ; ou ,) antes de importar.");
    }
  }

  function processarCSV(text: string) {
    const dados = parseCSV(text);
    if (dados.length < 2) { setErro("Arquivo vazio ou sem dados alem do cabecalho."); return; }

    const header = dados[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
    const mapa: Record<number, keyof LinhaImportada> = {};
    header.forEach((h, idx) => { const campo = MAPA_COLUNAS[h]; if (campo) mapa[idx] = campo; });

    if (!Object.values(mapa).includes("nome")) {
      setErro('Coluna "Descricao" ou "Nome" nao encontrada no cabecalho.');
      return;
    }

    const linhasMapeadas: LinhaImportada[] = [];
    for (let i = 1; i < dados.length; i++) {
      const row = dados[i];
      const linha: LinhaImportada = { codigo: "", nome: "", familia: "", codigoEan: "", unidade: "UN", pesoLiquido: "", validadeDias: "", possuiLote: "", imprimeEtiqueta: "sim", etiquetaComplementar: "", tipoArmazenagem: "ambiente", responsavel: "", etiquetaContagem: "" };
      for (const [idxStr, campo] of Object.entries(mapa)) {
        const idx = parseInt(idxStr);
        if (row[idx] !== undefined) linha[campo] = row[idx];
      }
      if (linha.nome.trim()) linhasMapeadas.push(linha);
    }

    if (linhasMapeadas.length === 0) { setErro("Nenhuma linha valida encontrada."); return; }
    setLinhas(linhasMapeadas);
  }

  async function handleImportar() {
    if (linhas.length === 0) return;
    setImportando(true);
    setResultado(null);

    const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
    if (!org) { setErro("Organizacao nao encontrada."); setImportando(false); return; }

    const { data: catsExistentes } = await supabase.from("categories").select("*").eq("organization_id", org.id);
    const mapaCats = new Map<string, string>();
    catsExistentes?.forEach((c: { name: string; id: string }) => mapaCats.set(c.name.toLowerCase(), c.id));

    const erros: string[] = [];
    let sucesso = 0;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const numLinha = i + 2;

      let categoryId: string | null = null;
      if (linha.familia.trim()) {
        const catKey = linha.familia.trim().toLowerCase();
        if (mapaCats.has(catKey)) {
          categoryId = mapaCats.get(catKey)!;
        } else {
          const { data: novaCat, error: errCat } = await supabase
            .from("categories").insert({ organization_id: org.id, name: linha.familia.trim() }).select().single();
          if (errCat) { erros.push(`Linha ${numLinha}: erro ao criar familia "${linha.familia}"`); }
          else if (novaCat) { categoryId = novaCat.id; mapaCats.set(catKey, novaCat.id); }
        }
      }

      // Tratar "NÃO PERECÍVEL" / "NAO PERECIVEL" na coluna dias de validade
      const validadeRaw = linha.validadeDias.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const isNaoPerecivel = validadeRaw.includes("nao perec") || validadeRaw.includes("não perec") || validadeRaw === "np" || validadeRaw === "n/a";
      const expiryDays = isNaoPerecivel ? null : (parseInt(linha.validadeDias) || null);
      const usesExpiry = !isNaoPerecivel && !!expiryDays;

      const { error } = await supabase.from("items").insert({
        organization_id: org.id,
        name: linha.nome.trim(),
        code: linha.codigo.trim() || null,
        barcode: linha.codigoEan.trim() || null,
        category_id: categoryId,
        source: "spreadsheet" as const,
        unit: linha.unidade.trim().toUpperCase() || "UN",
        net_weight: linha.pesoLiquido.trim() || null,
        storage_type: normArmazenagem(linha.tipoArmazenagem),
        uses_label: linha.imprimeEtiqueta ? normBool(linha.imprimeEtiqueta) : true,
        uses_lot: linha.possuiLote ? normBool(linha.possuiLote) : false,
        uses_expiry: usesExpiry,
        uses_complementary_label: linha.etiquetaComplementar ? normBool(linha.etiquetaComplementar) : false,
        expiry_days: expiryDays,
        uses_counting_label: linha.etiquetaContagem ? normBool(linha.etiquetaContagem) : false,
        additional_info: null, // Responsável agora é preenchido na hora da impressão
      });

      if (error) { erros.push(`Linha ${numLinha} ("${linha.nome}"): ${error.message}`); }
      else { sucesso++; }
    }

    setResultado({ total: linhas.length, sucesso, erros });
    setImportando(false);
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-white px-6 py-8">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <span className="text-3xl">&#x1F4C4;</span>
            <div>
              <h1 className="text-2xl font-extrabold">Importar Itens</h1>
              <p className="text-sm opacity-70">Importe produtos a partir de uma planilha CSV</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 -mt-4 pb-8 space-y-4">

          {/* Card: Modelo */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-[var(--verde)] px-5 py-3 flex items-center gap-2">
              <span className="text-lg">&#x1F4E5;</span>
              <h2 className="font-bold text-[var(--marrom)] text-sm uppercase tracking-wide">1. Baixe o modelo</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 mb-4">
                Use nosso modelo pronto com todas as colunas corretas. Preencha, salve como CSV e depois faca o upload abaixo.
              </p>
              <button type="button" onClick={downloadModelo} className="flex items-center gap-2 px-6 py-3 bg-[var(--marrom)] text-white rounded-xl font-bold text-sm hover:opacity-90 cursor-pointer shadow-lg transition-all">
                <span>&#x2B07;&#xFE0F;</span> Baixar Modelo CSV
              </button>
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 font-mono leading-relaxed">
                  Colunas: Codigo ; Descricao ; Familia de Produto ; Codigo EAN ; Unidade ; Peso Liquido ; Dias de Validade ; Possui Lote ; Imprime Etiqueta ; Etiqueta Complementar ; Tipo de Armazenagem ; Responsavel
                </p>
              </div>
            </div>
          </div>

          {/* Card: Upload */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-[var(--vermelho)] px-5 py-3 flex items-center gap-2">
              <span className="text-lg">&#x1F4C2;</span>
              <h2 className="font-bold text-white text-sm uppercase tracking-wide">2. Envie seu arquivo</h2>
            </div>
            <div className="p-5">
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleArquivo} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-10 border-2 border-dashed border-gray-300 rounded-2xl text-center hover:border-[var(--vermelho)] hover:bg-red-50 transition-all cursor-pointer group">
                <span className="text-4xl block mb-2 group-hover:scale-110 transition-transform">&#x1F4C4;</span>
                <p className="text-lg font-bold text-[var(--marrom)]">
                  {nomeArquivo || "Clique para selecionar arquivo"}
                </p>
                <p className="text-sm text-gray-500 mt-1">CSV ou TXT (separado por ; ou ,)</p>
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <p className="text-sm text-red-700 font-medium">&#x26A0;&#xFE0F; {erro}</p>
            </div>
          )}

          {/* Preview */}
          {linhas.length > 0 && !resultado && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[var(--marrom)] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">&#x1F440;</span>
                  <h2 className="font-bold text-white text-sm uppercase tracking-wide">
                    3. Confira o preview — {linhas.length} {linhas.length === 1 ? "item" : "itens"}
                  </h2>
                </div>
                <button type="button" onClick={handleImportar} disabled={importando} className={"px-6 py-2 rounded-xl font-bold text-sm cursor-pointer transition-all " + (importando ? "bg-gray-400 text-gray-200" : "bg-[var(--vermelho)] text-white hover:opacity-90 shadow-lg")}>
                  {importando ? "Importando..." : "Confirmar Importacao"}
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bege)]">
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">#</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">Descricao</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">Codigo</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">EAN</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">Familia</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">Unid.</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">Val.(d)</th>
                      <th className="text-left px-3 py-2 font-bold text-[var(--marrom)]">Armaz.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, 20).map((l, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{l.nome}</td>
                        <td className="px-3 py-2">{l.codigo || "—"}</td>
                        <td className="px-3 py-2">{l.codigoEan || "—"}</td>
                        <td className="px-3 py-2">{l.familia || "—"}</td>
                        <td className="px-3 py-2">{l.unidade || "UN"}</td>
                        <td className="px-3 py-2">{l.validadeDias || "—"}</td>
                        <td className="px-3 py-2">{l.tipoArmazenagem || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {linhas.length > 20 && (
                  <p className="text-xs text-gray-500 mt-2 px-3">Mostrando 20 de {linhas.length} linhas...</p>
                )}
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[var(--verde)] px-5 py-3 flex items-center gap-2">
                <span className="text-lg">&#x2705;</span>
                <h2 className="font-bold text-[var(--marrom)] text-sm uppercase tracking-wide">Resultado da Importacao</h2>
              </div>
              <div className="p-5">
                <div className="flex gap-6 mb-4">
                  <div className="text-center bg-green-50 rounded-xl p-4 flex-1">
                    <p className="text-3xl font-extrabold text-green-600">{resultado.sucesso}</p>
                    <p className="text-xs font-bold text-green-700 mt-1">Importados</p>
                  </div>
                  {resultado.erros.length > 0 && (
                    <div className="text-center bg-red-50 rounded-xl p-4 flex-1">
                      <p className="text-3xl font-extrabold text-red-600">{resultado.erros.length}</p>
                      <p className="text-xs font-bold text-red-700 mt-1">Erros</p>
                    </div>
                  )}
                  <div className="text-center bg-gray-50 rounded-xl p-4 flex-1">
                    <p className="text-3xl font-extrabold text-gray-600">{resultado.total}</p>
                    <p className="text-xs font-bold text-gray-500 mt-1">Total</p>
                  </div>
                </div>
                {resultado.erros.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3 max-h-40 overflow-y-auto border border-red-200">
                    {resultado.erros.map((e, i) => (<p key={i} className="text-xs text-red-700">{e}</p>))}
                  </div>
                )}
                <button type="button" onClick={() => router.push("/itens")} className="mt-4 w-full py-3 bg-[var(--vermelho)] text-white rounded-xl font-bold text-sm hover:opacity-90 cursor-pointer shadow-lg transition-all">
                  Ver Itens Cadastrados
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
