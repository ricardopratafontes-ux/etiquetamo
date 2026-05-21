"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio", icon: "\u{1F3E0}" },
  { href: "/producao", label: "Produção", icon: "\u{1F3ED}" },
  { href: "/itens", label: "Itens", icon: "\u{1F4E6}" },
  { href: "/itens/importar", label: "Importar", icon: "\u{1F4C4}" },
  { href: "/teste-impressao", label: "Etiqueta", icon: "\u{1F5A8}️" },
  { href: "/etiqueta-caixa", label: "Caixa", icon: "\u{1F4E6}" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-[var(--branco)] px-6 py-0 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 py-2 group">
          <Image
            src="/logomarca.png"
            alt="Gelateria Moderna - mo!"
            width={100}
            height={60}
            className="drop-shadow-md"
          />
          <div>
            <span className="text-xl font-extrabold tracking-tight block">
              Etiqueta<span className="text-[var(--vermelho)]">MO</span>
            </span>
            <span className="text-[10px] text-white/60 font-medium block leading-tight">
              Sistema de Etiquetas da Gelateria Moderna
            </span>
          </div>
        </Link>

        {/* Links */}
        <div className="flex gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href) && link.href === "/itens" && pathname === "/itens") ||
              (pathname === link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "flex items-center gap-1.5 px-3 py-3 text-sm font-semibold transition-all border-b-3 " +
                  (isActive
                    ? "border-[var(--vermelho)] bg-white/10 text-white"
                    : "border-transparent text-white/75 hover:text-white hover:bg-white/5")
                }
              >
                <span className="text-base">{link.icon}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
