"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import {
  SONOSIG_OPEN_LOGIN_EVENT,
  type OpenLoginEventDetail,
} from "@/lib/auth-modal-events";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

export function HomeStartButton() {
  const { user, isLoading } = useAuthUser();

  return (
    <Link
      className="mt-9 inline-flex min-w-40 items-center justify-center rounded-md bg-cyan-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-[#0e1116]"
      href="/create"
      onClick={(event) => {
        trackEvent("home_start_click", {
          authenticated: Boolean(user),
        });

        if (user) {
          return;
        }

        event.preventDefault();

        if (!isLoading) {
          window.dispatchEvent(
            new CustomEvent<OpenLoginEventDetail>(SONOSIG_OPEN_LOGIN_EVENT, {
              detail: { location: "home_start" },
            }),
          );
        }
      }}
    >
      Start
    </Link>
  );
}
