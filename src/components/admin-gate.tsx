"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdminAccess } from "@/lib/firebase/use-admin-access";

type AdminGateProps = {
  children: React.ReactNode;
};

export function AdminGate({ children }: AdminGateProps) {
  const router = useRouter();
  const { isAdmin, isLoading, user } = useAdminAccess();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/about");
    }
  }, [isLoading, router, user]);

  if (isLoading) {
    return (
      <section className="flex flex-1 items-center px-6 py-16 lg:px-16">
        <div className="h-28 w-full max-w-2xl animate-pulse rounded-lg bg-white/10" />
      </section>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <section className="px-6 py-12 lg:px-16">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Admin
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Admin access required
          </h1>
        </div>
      </section>
    );
  }

  return children;
}
