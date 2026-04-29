"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export function HomeStartButton() {
  return (
    <Link
      className="mt-9 inline-flex min-w-40 items-center justify-center rounded-md bg-cyan-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-[#0e1116]"
      href="/create"
      onClick={() => trackEvent("home_start_click")}
    >
      Start
    </Link>
  );
}
