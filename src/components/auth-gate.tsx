"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type AuthGateProps = {
  children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const { user, isLoading } = useAuthUser();

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

  return children;
}
