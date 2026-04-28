"use client";

import Link from "next/link";
import { HeaderAuth } from "@/components/header-auth";
import { WalletConnect } from "@/components/wallet-connect";
import { useAdminAccess } from "@/lib/firebase/use-admin-access";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

const navItems = [
  { href: "/create", label: "Create" },
  { href: "/verify", label: "Verify" },
  { href: "/post", label: "Post" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
  { href: "/dashboard", label: "Dashboard" },
];

const adminNavItem = { href: "/admin/user-management", label: "Admin" };

export function SiteHeader() {
  const { user } = useAuthUser();
  const { isAdmin } = useAdminAccess();
  const visibleNavItems = user
    ? isAdmin
      ? [...navItems, adminNavItem]
      : navItems
    : navItems.filter((item) =>
        ["/about", "/faq", "/help"].includes(item.href),
      );

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
            {visibleNavItems.map((item) => (
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
