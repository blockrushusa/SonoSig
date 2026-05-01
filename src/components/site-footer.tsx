import Link from "next/link";

const footerLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
  {
    href: "https://x.com/blockrushusa/",
    isExternal: true,
    label: "X",
  },
  { href: "/about", label: "Team" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0e1116] px-6 py-6 text-zinc-400 lg:px-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">
          SonoSig
        </p>
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.href}>
                {link.isExternal ? (
                  <a
                    className="text-sm font-medium transition hover:text-white"
                    href={link.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    className="text-sm font-medium transition hover:text-white"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
