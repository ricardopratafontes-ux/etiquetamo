"use client";

import { useState, useEffect, useMemo } from "react";
import NavBar from "@/components/NavBar";
import PatternStrip from "@/components/PatternStrip";
import { supabase } from "@/lib/supabase";

interface PrintRecord {
  id: string;
  product_name: string;
  operator_id: string;
  quantity: number;
  printed_at: string;
  reprint_of: string | null;
  lot: string | null;
}

interface AvulsaRecord {
  id: string;
  organization_id: string;
  nome: string;
  quantidade: number;
  printed_at: string;
  operator_id: string | null;
}

interface Operador {
  id: string;
  name: string;
}

type Periodo = "hoje" | "7dias" | "30dias" | "todos";

const ORG_SLUG = "gelateria";

export default function RelatoriosPage() {
  const [prints, setPrints] = useState<PrintRecord[]>([]);
  const [avulsas, setAvulsas] = useState<AvulsaRecord[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("30dias");

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);

    // Resolver org_id real pelo slug (mesmo padrão de /imprimir)
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (!org) {
      console.error("[Relatórios] Organização não encontrada para slug:", ORG_SLUG);
      setLoading(false);
      return;
    }

    const orgId = org.id;

    const [printsRes, avulsasRes, opsRes] = await Promise.all([
      supabase
        .from("print_history")
        .select("id, product_name, operator_id, quantity, printed_at, reprint_of, lot")
        .eq("organization_id", orgId)
        .order("printed_at", { ascending: false }),
      supabase
        .from("avulsa_history")
        .select("id, organization_id, nome, quantidade, printed_at, operator_id")
        .eq("organization_id", orgId)
        .order("printed_at", { ascending: false }),
      supabase
        .from("operators")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("active", true),
    ]);
    setPrints((printsRes.data as PrintRecord[]) || []);
    setAvulsas((avulsasRes.data as AvulsaRecord[]) || []);
    setOperadores((opsRes.data as Operador[]) || []);
    setLoading(false);
  }

  function getDataLimite(): Date | null {
    const agora = new Date();
    if (periodo === "hoje") {
      return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    }
    if (periodo === "7dias") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (periodo === "30dias") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 30);
      return d;
    }
    return null;
  }

  const printsFiltrados = useMemo(() => {
    const limite = getDataLimite();
    if (!limite) return prints;
    return prints.filter((p) => new Date(p.printed_at) >= limite);
  }, [prints, periodo]);

  const avulsasFiltradas = useMemo(() => {
    const limite = getDataLimite();
    if (!limite) return avulsas;
    return avulsas.filter((a) => new Date(a.printed_at) >= limite);
  }, [avulsas, periodo]);

  // — KPIs
  const totalImpressoes = printsFiltrados.length + avulsasFiltradas.length;
  const totalEtiquetas =
    printsFiltrados.reduce((s, p) => s + p.quantity, 0) +
    avulsasFiltradas.reduce((s, a) => s + a.quantidade, 0);
  const totalReimpressoes = printsFiltrados.filter((p) => p.reprint_of).length;

  // — Produção diária (últimos 7 ou 30 dias em barras)
  const producaoPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    printsFiltrados.forEach((p) => {
      const dia = new Date(p.printed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      mapa[dia] = (mapa[dia] || 0) + p.quantity;
    });
    avulsasFiltradas.forEach((a) => {
      const dia = new Date(a.printed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      mapa[dia] = (mapa[dia] || 0) + a.quantidade;
    });
    return Object.entries(mapa)
      .sort(([a], [b]) => {
        const [dA, mA] = a.split("/").map(Number);
        const [dB, mB] = b.split("/").map(Number);
        return mA !== mB ? mA - mB : dA - dB;
      })
      .slice(-15);
  }, [printsFiltrados, avulsasFiltradas]);

  const maxDia = Math.max(...producaoPorDia.map(([, v]) => v), 1);

  // — Ranking de produtos
  const rankingProdutos = useMemo(() => {
    const mapa: Record<string, number> = {};
    printsFiltrados.forEach((p) => {
      mapa[p.product_name] = (mapa[p.product_name] || 0) + p.quantity;
    });
    return Object.entries(mapa)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [printsFiltrados]);

  const maxProduto = rankingProdutos.length > 0 ? rankingProdutos[0][1] : 1;

  // — Emissão por funcionário (quem imprimiu = operator_id)
  const emissaoPorFuncionario = useMemo(() => {
    const mapa: Record<string, number> = {};
    printsFiltrados.forEach((p) => {
      const nome = operadores.find((o) => o.id === p.operator_id)?.name || "Desconhecido";
      mapa[nome] = (mapa[nome] || 0) + p.quantity;
    });
    avulsasFiltradas.forEach((a) => {
      if (a.operator_id) {
        const nome = operadores.find((o) => o.id === a.operator_id)?.name || "Desconhecido";
        mapa[nome] = (mapa[nome] || 0) + a.quantidade;
      }
    });
    return Object.entries(mapa).sort(([, a], [, b]) => b - a);
  }, [printsFiltrados, avulsasFiltradas, operadores]);

  const maxEmissao = emissaoPorFuncionario.length > 0 ? emissaoPorFuncionario[0][1] : 1;

  // — Consumo de bobina (estimativa: cada etiqueta = 1 unidade na bobina de ~1000)
  const BOBINA_CAPACIDADE = 1000;
  const etiquetasUltimos30 = useMemo(() => {
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const qtdPrints = prints
      .filter((p) => new Date(p.printed_at) >= d30)
      .reduce((s, p) => s + p.quantity, 0);
    const qtdAvulsas = avulsas
      .filter((a) => new Date(a.printed_at) >= d30)
      .reduce((s, a) => s + a.quantidade, 0);
    return qtdPrints + qtdAvulsas;
  }, [prints, avulsas]);

  const consumoDiario = etiquetasUltimos30 / 30;
  const diasRestantes = consumoDiario > 0 ? Math.round(BOBINA_CAPACIDADE / consumoDiario) : 999;
  const percentUsado = Math.min(100, Math.round((etiquetasUltimos30 / BOBINA_CAPACIDADE) * 100));

  const nomeOperador = (id: string) => operadores.find((o) => o.id === id)?.name || "—";

  const periodos: { valor: Periodo; label: string }[] = [
    { valor: "hoje", label: "Hoje" },
    { valor: "7dias", label: "7 dias" },
    { valor: "30dias", label: "30 dias" },
    { valor: "todos", label: "Todos" },
  ];

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)] pb-8">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--marrom)]">Relatórios</h1>
                <p className="text-sm text-[var(--marrom)]/60">Dashboard de produção e indicadores</p>
              </div>
            </div>
            {/* Período */}
            <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
              {periodos.map((p) => (
                <button
                  key={p.valor}
                  onClick={() => setPeriodo(p.valor)}
                  className={
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all " +
                    (periodo === p.valor
                      ? "bg-[var(--vermelho)] text-white shadow-sm"
                      : "text-[var(--marrom)] hover:bg-gray-100")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin text-4xl mb-3">⏳</div>
              <p className="text-[var(--marrom)]/60">Carregando dados...</p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Impressões</p>
                  <p className="text-2xl font-black text-[var(--marrom)]">{totalImpressoes}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Etiquetas</p>
                  <p className="text-2xl font-black text-[var(--vermelho)]">{totalEtiquetas}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Reimpressões</p>
                  <p className="text-2xl font-black text-orange-500">{totalReimpressoes}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Média/dia</p>
                  <p className="text-2xl font-black text-[var(--marrom)]">
                    {consumoDiario > 0 ? Math.round(consumoDiario) : 0}
                  </p>
                </div>
              </div>

              {/* Grid 2 colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Produção diária */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-[var(--marrom)] text-sm mb-3 flex items-center gap-2">
                    <span>📅</span> Produção Diária (etiquetas)
                  </h3>
                  {producaoPorDia.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sem dados no período</p>
                  ) : (
                    <div className="space-y-1.5">
                      {producaoPorDia.map(([dia, qtd]) => (
                        <div key={dia} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-12 text-right font-mono">{dia}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--vermelho)] to-[#ff6b6b] rounded-full transition-all"
                              style={{ width: `${(qtd / maxDia) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-[var(--marrom)] w-8">{qtd}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ranking de produtos */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-[var(--marrom)] text-sm mb-3 flex items-center gap-2">
                    <span>🏆</span> Top 10 Produtos
                  </h3>
                  {rankingProdutos.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sem dados no período</p>
                  ) : (
                    <div className="space-y-1.5">
                      {rankingProdutos.map(([nome, qtd], i) => (
                        <div key={nome} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[var(--marrom)] to-[#c4724a] rounded-full"
                                  style={{ width: `${(qtd / maxProduto) * 100}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-600 truncate mt-0.5">{nome}</p>
                          </div>
                          <span className="text-xs font-bold text-[var(--marrom)] w-8 text-right">{qtd}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid 2 colunas - funcionários + bobina */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Emissão por funcionário */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-[var(--marrom)] text-sm mb-3 flex items-center gap-2">
                    <span>👤</span> Emissão por Funcionário
                  </h3>
                  {emissaoPorFuncionario.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sem dados no período</p>
                  ) : (
                    <div className="space-y-2">
                      {emissaoPorFuncionario.map(([nome, qtd]) => (
                        <div key={nome} className="flex items-center gap-2">
                          <span className="text-xs text-gray-700 w-28 truncate font-medium">{nome}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                              style={{ width: `${(qtd / maxEmissao) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-[var(--marrom)] w-8 text-right">{qtd}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Consumo de bobina */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-[var(--marrom)] text-sm mb-3 flex items-center gap-2">
                    <span>🧻</span> Consumo de Bobina (estimativa)
                  </h3>
                  <div className="flex flex-col items-center py-4">
                    {/* Gauge visual */}
                    <div className="relative w-40 h-40 mb-4">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none" stroke="#f3f4f6" strokeWidth="12"
                        />
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke={percentUsado > 80 ? "#ef4444" : percentUsado > 50 ? "#f59e0b" : "#22c55e"}
                          strokeWidth="12"
                          strokeDasharray={`${percentUsado * 2.64} 264`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-[var(--marrom)]">{percentUsado}%</span>
                        <span className="text-[10px] text-gray-500">da bobina</span>
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm text-gray-600">
                        <strong>{etiquetasUltimos30}</strong> etiquetas nos últimos 30 dias
                      </p>
                      <p className="text-sm text-gray-600">
                        Média: <strong>{Math.round(consumoDiario)}</strong>/dia
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Bobina nova (~{BOBINA_CAPACIDADE} etiquetas) dura <strong>~{diasRestantes} dias</strong>
                      </p>
                      {percentUsado > 80 && (
                        <p className="text-xs text-red-600 font-bold mt-2 bg-red-50 px-3 py-1 rounded-full inline-block">
                          ⚠️ Considere trocar a bobina em breve
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela detalhada - últimas impressões */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-[var(--marrom)] text-sm mb-3 flex items-center gap-2">
                  <span>🕐</span> Últimas Impressões
                </h3>
                {printsFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sem impressões no período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-gray-500 font-semibold">Produto</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-semibold">Emitente</th>
                          <th className="text-center py-2 px-2 text-gray-500 font-semibold">Qtd</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-semibold">Data/Hora</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-semibold">Lote</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printsFiltrados.slice(0, 20).map((p) => (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 px-2 font-medium text-[var(--marrom)] max-w-[180px] truncate">
                              {p.product_name}
                              {p.reprint_of && (
                                <span className="ml-1 text-[9px] bg-orange-100 text-orange-700 px-1 rounded">RE</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-gray-600">{nomeOperador(p.operator_id)}</td>
                            <td className="py-1.5 px-2 text-center font-bold">{p.quantity}</td>
                            <td className="py-1.5 px-2 text-gray-500">
                              {new Date(p.printed_at).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                              })}
                            </td>
                            <td className="py-1.5 px-2 text-gray-500 font-mono">{p.lot || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {printsFiltrados.length > 20 && (
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Mostrando 20 de {printsFiltrados.length} registros
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <PatternStrip />
    </>
  );
}
