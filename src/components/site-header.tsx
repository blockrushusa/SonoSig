import Link from "next/link";
import { HeaderAuth } from "@/components/header-auth";
import { WalletConnect } from "@/components/wallet-connect";

const navItems = [
  { href: "/create", label: "Create" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <Link
          className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300"
          href="/"
        >
          Sonosig
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <WalletConnect />
        <HeaderAuth />
      </div>
    </header>
  );
}
