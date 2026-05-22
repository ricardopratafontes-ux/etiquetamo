import Link from "next/link";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import PatternStrip from "@/components/PatternStrip";

const acoes = [
  {
    href: "/imprimir",
    icon: "\u{1F5A8}️",
    titulo: "Imprimir Etiquetas",
    descricao: "Produção ou contagem — escolha o tipo, a equipe e os produtos",
    cor: "bg-[var(--vermelho)]",
    corTexto: "text-white",
  },
  {
    href: "/itens",
    icon: "\u{1F4E6}",
    titulo: "Meus Itens",
    descricao: "Veja e gerencie seus 538 produtos cadastrados",
    cor: "bg-[var(--marrom)]",
    corTexto: "text-white",
  },
  {
    href: "/colaboradores",
    icon: "\u{1F465}",
    titulo: "Equipe",
    descricao: "Cadastre quem emite e quem produz",
    cor: "bg-[var(--verde)]",
    corTexto: "text-[var(--marrom)]",
  },
  {
    href: "/itens/importar",
    icon: "\u{1F4C4}",
    titulo: "Importar Planilha",
    descricao: "Importe itens via arquivo CSV",
    cor: "bg-white border-2 border-[var(--marrom)]",
    corTexto: "text-[var(--marrom)]",
  },
  {
    href: "/etiqueta-caixa",
    icon: "\u{1F3F7}️",
    titulo: "Etiquetas Avulsas",
    descricao: "Caixas, volumes, identificação livre com modelos salvos",
    cor: "bg-white border-2 border-[var(--vermelho)]",
    corTexto: "text-[var(--vermelho)]",
  },
  {
    href: "/historico",
    icon: "\u{1F4CB}",
    titulo: "Histórico",
    descricao: "Consulte impressões anteriores e reimprima etiquetas",
    cor: "bg-white border-2 border-[var(--marrom)]",
    corTexto: "text-[var(--marrom)]",
  },
  {
    href: "/relatorios",
    icon: "\u{1F4CA}",
    titulo: "Relatórios",
    descricao: "Dashboard de produção, ranking, consumo e equipe",
    cor: "bg-gradient-to-br from-[var(--vermelho)] to-[var(--marrom)]",
    corTexto: "text-white",
  },
];

export default function Home() {
  return (
    <>
      <NavBar />

      <main className="min-h-screen bg-[var(--bege)]">
        {/* Cards de acao */}
        <div className="max-w-4xl mx-auto px-6 mt-6">
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

        <div className="max-w-4xl mx-auto px-6 mt-8 pb-6">
          <div className="flex items-center justify-center gap-3 mt-2 mb-4">
            <Image
              src="/logo-mo.png"
              alt="mo!"
              width={20}
              height={20}
              className="opacity-40"
            />
            <p className="text-xs text-[var(--marrom)] opacity-40">
              EtiquetaMO v0.8.0 — Gelateria Moderna desde 1959
            </p>
          </div>
        </div>
      </main>

      {/* Faixa de triangulos — RODAPE */}
      <PatternStrip />
    </>
  );
}
