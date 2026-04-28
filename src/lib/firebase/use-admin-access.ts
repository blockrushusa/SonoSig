"use client";

import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { isBootstrapAdminEmail } from "@/lib/admin-access";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

export function useAdminAccess() {
  const { user, isLoading: isAuthLoading } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadAdminAccess() {
      if (isAuthLoading) {
        return;
      }

      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      if (isBootstrapAdminEmail(user.email)) {
        setIsAdmin(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const token = await getIdTokenResult(user);

        if (isActive) {
          setIsAdmin(token.claims.admin === true);
        }
      } catch {
        if (isActive) {
          setIsAdmin(false);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAdminAccess();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, user]);

  return { isAdmin, isLoading: isAuthLoading || isLoading, user };
}
