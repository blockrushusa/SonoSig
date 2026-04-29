"use client";

import Link from "next/link";
import { HeaderAuth } from "@/components/header-auth";
import { WalletConnect } from "@/components/wallet-connect";
import { trackEvent } from "@/lib/analytics";
import { useAdminAccess } from "@/lib/firebase/use-admin-access";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

const navItems = [
  { href: "/create", label: "Create" },
  { href: "/verify", label: "Verify" },
  { href: "/post", label: "Post" },
];

const publicMenuItems = [
  { href: "/about", label: "About" },
  { href: "/docs", label: "Docs" },
  { href: "/faq", label: "FAQ" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
];

const userMenuItems = [
  { href: "/profile", label: "Profile" },
  { href: "/tools", label: "Tools" },
];

const developerNavItems = [
  { href: "/developer", label: "Overview" },
  { href: "/developer/mcp", label: "MCP" },
];

const adminNavItems = [
  { href: "/admin/user-management", label: "User management" },
  { href: "/admin/wallet", label: "Wallets" },
  { href: "/admin/site", label: "Site" },
  { href: "/admin/system", label: "System" },
  { href: "/admin/analytics", label: "Analytics" },
];

export function SiteHeader() {
  const { user } = useAuthUser();
  const { isAdmin } = useAdminAccess();
  const menuItems = user ? [...publicMenuItems, ...userMenuItems] : publicMenuItems;

  return (
    <header className="flex flex-col gap-4 border-b border-white/10 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <Link
          className="flex items-center gap-3 text-sm font-medium uppercase tracking-[0.18em] text-cyan-300"
          href="/"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-10 w-auto [filter:brightness(0)_saturate(100%)_invert(86%)_sepia(45%)_saturate(811%)_hue-rotate(151deg)_brightness(101%)_contrast(95%)]"
            height="453"
            src="/sonosig-logo.png"
            width="685"
          />
          <span>Sonosig</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex flex-wrap items-center gap-1">
            {user
              ? navItems.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href}>{item.label}</NavLink>
                  </li>
                ))
              : null}
            <li className={user ? "ml-8" : undefined}>
              <Dropdown label="Menu">
                {menuItems.map((item) => (
                  <DropdownLink href={item.href} key={item.href}>
                    {item.label}
                  </DropdownLink>
                ))}
                {user ? (
                  <NestedDropdown label="Developer">
                    {developerNavItems.map((item) => (
                      <DropdownLink href={item.href} key={item.href}>
                        {item.label}
                      </DropdownLink>
                    ))}
                  </NestedDropdown>
                ) : null}
              </Dropdown>
            </li>
            {isAdmin ? (
              <li>
                <Dropdown label="Admin">
                  {adminNavItems.map((item) => (
                    <DropdownLink href={item.href} key={item.href}>
                      {item.label}
                    </DropdownLink>
                  ))}
                </Dropdown>
              </li>
            ) : null}
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

function NavLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
      href={href}
      onClick={() => trackEvent("nav_click", { href, label: String(children) })}
    >
      {children}
    </Link>
  );
}

function Dropdown({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <details className="group relative">
      <summary className="list-none rounded-md px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          {label}
          <span aria-hidden="true" className="text-[10px] text-zinc-500">
            v
          </span>
        </span>
      </summary>
      <div className="absolute left-0 top-full z-50 mt-2 grid min-w-56 gap-1 rounded-lg border border-white/10 bg-[#11161d] p-2 shadow-2xl shadow-black/40">
        {children}
      </div>
    </details>
  );
}

function NestedDropdown({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <details className="group/nested relative">
      <summary className="list-none rounded-md px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-4">
          {label}
          <span aria-hidden="true" className="text-[10px] text-zinc-500">
            v
          </span>
        </span>
      </summary>
      <div className="mt-1 grid gap-1 border-l border-white/10 pl-3">
        {children}
      </div>
    </details>
  );
}

function DropdownLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
      href={href}
      onClick={() => trackEvent("nav_click", { href, label: String(children) })}
    >
      {children}
    </Link>
  );
}
