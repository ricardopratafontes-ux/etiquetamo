import Link from "next/link";
import Image from "next/image";
import NavBar from "@/components/NavBar";

const acoes = [
  {
    href: "/itens/novo",
    icon: "\u{2795}",
    titulo: "Novo Item",
    descricao: "Cadastre um produto manualmente",
    cor: "bg-[var(--vermelho)]",
    corTexto: "text-white",
  },
  {
    href: "/itens",
    icon: "\u{1F4E6}",
    titulo: "Meus Itens",
    descricao: "Veja e gerencie seus produtos",
    cor: "bg-[var(--marrom)]",
    corTexto: "text-white",
  },
  {
    href: "/itens/importar",
    icon: "\u{1F4C4}",
    titulo: "Importar Planilha",
    descricao: "Importe itens via arquivo CSV",
    cor: "bg-[var(--verde)]",
    corTexto: "text-[var(--marrom)]",
  },
  {
    href: "/teste-impressao",
    icon: "\u{1F5A8}️",
    titulo: "Etiqueta de Produto",
    descricao: "Imprimir etiquetas na Elgin L42",
    cor: "bg-white border-2 border-[var(--marrom)]",
    corTexto: "text-[var(--marrom)]",
  },
  {
    href: "/etiqueta-caixa",
    icon: "\u{1F4E6}",
    titulo: "Etiqueta de Caixa",
    descricao: "Identificar caixas com nome e quantidade",
    cor: "bg-white border-2 border-[var(--vermelho)]",
    corTexto: "text-[var(--vermelho)]",
  },
];

export default function Home() {
  return (
    <>
      {/* Faixa de triangulos — TOPO */}
      <div
        className="w-full h-[40px]"
        style={{
          backgroundImage: "url(/pattern-strip.jpg)",
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
        }}
      />

      <NavBar />

      <main className="min-h-screen bg-[var(--bege)]">
        {/* Hero — logomarca grande a esquerda */}
        <div className="bg-gradient-to-br from-[var(--marrom)] to-[#7a3520] text-white px-6 py-10">
          <div className="max-w-4xl mx-auto flex items-center gap-8">
            <Image
              src="/logomarca.png"
              alt="Gelateria Moderna - mo!"
              width={280}
              height={170}
              className="drop-shadow-lg shrink-0"
              priority
            />
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight mb-1">
                Etiqueta<span className="text-[var(--vermelho)]">MO</span>
              </h1>
              <p className="text-base opacity-80 font-medium">
                Sistema de etiquetas da Gelateria Moderna
              </p>
            </div>
          </div>
        </div>

        {/* Cards de acao */}
        <div className="max-w-4xl mx-auto px-6 -mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {acoes.map((acao) => (
              <Link
                key={acao.href}
                href={acao.href}
                className={
                  "group rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 " +
                  acao.cor + " " + acao.corTexto
                }
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{acao.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold mb-1 group-hover:underline">
                      {acao.titulo}
                    </h2>
                    <p className="text-sm opacity-80">{acao.descricao}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="max-w-4xl mx-auto px-6 mt-8 pb-6">
          <div className="bg-white rounded-2xl shadow-md border border-[var(--verde)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">📊</span>
              <h2 className="font-bold text-[var(--marrom)] text-lg">Status do Sistema</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[var(--bege)] rounded-xl p-4 text-center">
                <span className="text-2xl block mb-1">✅</span>
                <p className="text-xs font-semibold text-[var(--marrom)]">App Online</p>
              </div>
              <div className="bg-[var(--bege)] rounded-xl p-4 text-center">
                <span className="text-2xl block mb-1">🗄️</span>
                <p className="text-xs font-semibold text-[var(--marrom)]">Banco Conectado</p>
              </div>
              <div className="bg-[var(--bege)] rounded-xl p-4 text-center">
                <span className="text-2xl block mb-1">🏷️</span>
                <p className="text-xs font-semibold text-[var(--marrom)]">Sprint 2</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-200">
                <span className="text-2xl block mb-1">🖨️</span>
                <p className="text-xs font-semibold text-orange-700">Impressora Pendente</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mt-6 mb-4">
            <Image
              src="/logo-mo.png"
              alt="mo!"
              width={20}
              height={20}
              className="opacity-40"
            />
            <p className="text-xs text-[var(--marrom)] opacity-40">
              EtiquetaMO v0.3.0 — Gelateria Moderna desde 1959
            </p>
          </div>
        </div>
      </main>

      {/* Faixa de triangulos — RODAPE */}
      <div
        className="w-full h-[40px]"
        style={{
          backgroundImage: "url(/pattern-strip.jpg)",
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
        }}
      />
    </>
  );
}
