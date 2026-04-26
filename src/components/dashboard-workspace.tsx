"use client";

import Link from "next/link";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

const stats = [
  { label: "Proofs", value: "0" },
  { label: "Verified", value: "0" },
  { label: "Exports", value: "0" },
];

const actions = [
  {
    href: "/create",
    title: "Create",
    description: "Encode a wallet-linked proof into an audio file.",
    action: "New proof",
  },
  {
    href: "/verify",
    title: "Verify",
    description: "Read a Sonosig watermark from a local audio file.",
    action: "Verify file",
  },
];

export function DashboardWorkspace() {
  const { user } = useAuthUser();
  const accountLabel = user?.displayName || user?.email || "Signed in";

  return (
    <section className="px-6 py-10 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Dashboard
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Workspace
            </h1>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
            <span className="text-zinc-500">Account</span>
            <span className="ml-3 font-medium text-white">{accountLabel}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
              key={stat.label}
            >
              <p className="text-sm font-medium text-zinc-400">{stat.label}</p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {actions.map((item) => (
            <Link
              className="group rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/40 hover:bg-cyan-300/5"
              href={item.href}
              key={item.href}
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {item.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                    {item.description}
                  </p>
                </div>
                <span className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition group-hover:bg-cyan-200">
                  {item.action}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-white">Recent proofs</h2>
            <span className="text-sm text-zinc-500">0 items</span>
          </div>
          <div className="grid min-h-48 place-items-center px-5 py-12 text-center">
            <div>
              <p className="text-sm font-medium text-zinc-300">
                No proofs yet.
              </p>
              <Link
                className="mt-5 inline-flex rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                href="/create"
              >
                Create proof
              </Link>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
