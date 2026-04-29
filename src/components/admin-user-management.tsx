"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "firebase/auth";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type AdminUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  isAdmin: boolean;
  isBootstrapAdmin: boolean;
  role: UserRole;
};

type UserRole = "admin" | "new" | "verified";

type UsersResponse = {
  users: AdminUser[];
};

type UserResponse = {
  user: AdminUser;
};

async function readJsonResponse<T>(response: Response, fallbackError: string) {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(fallbackError);
    }

    throw new Error("Server returned an empty response.");
  }

  try {
    return JSON.parse(text) as T | { error?: string };
  } catch {
    throw new Error(fallbackError);
  }
}

function getUserLabel(user: AdminUser) {
  return user.email || user.displayName || user.uid;
}

export function AdminUserManagement() {
  const { user } = useAuthUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("verified");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        getUserLabel(a).localeCompare(getUserLabel(b)),
      ),
    [users],
  );

  async function getAuthorizationHeader() {
    if (!user) {
      throw new Error("Sign in before managing users.");
    }

    const token = await getIdToken(user);

    return { Authorization: `Bearer ${token}` };
  }

  async function loadUsers() {
    setIsLoading(true);
    setError("");

    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/admin/users", { headers });
      const payload = await readJsonResponse<UsersResponse>(
        response,
        "Unable to load users.",
      );

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load users.");
      }

      setUsers((payload as UsersResponse).users);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load users.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function setUserRole(target: AdminUser | string, role: UserRole) {
    setError("");
    setStatus("");
    setUpdatingUid(typeof target === "string" ? target : target.uid);

    try {
      const headers = await getAuthorizationHeader();
      const body =
        typeof target === "string"
          ? { email: target, role }
          : { role, uid: target.uid };
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify(body),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = await readJsonResponse<UserResponse>(
        response,
        "Unable to update access.",
      );

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Unable to update access.",
        );
      }

      const updatedUser = (payload as UserResponse).user;

      setUsers((current) => {
        const nextUsers = current.filter((item) => item.uid !== updatedUser.uid);

        return [...nextUsers, updatedUser];
      });
      setEmail("");
      setNewUserRole("verified");
      setStatus(`${getUserLabel(updatedUser)} role updated to ${formatRole(updatedUser.role)}.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update access.",
      );
    } finally {
      setUpdatingUid(null);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialUsers() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken(user);
        const response = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonResponse<UsersResponse>(
          response,
          "Unable to load users.",
        );

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Unable to load users.",
          );
        }

        if (isActive) {
          setUsers((payload as UsersResponse).users);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load users.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialUsers();

    return () => {
      isActive = false;
    };
  }, [user]);

  return (
    <section className="px-6 py-10 lg:px-16">
      <div className="mx-auto grid max-w-6xl gap-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Admin
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            User Management
          </h1>
        </div>

        <form
          className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const targetEmail = email.trim();

            if (targetEmail) {
              void setUserRole(targetEmail, newUserRole);
            }
          }}
        >
          <input
            className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            type="email"
            value={email}
          />
          <select
            className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300"
            onChange={(event) => setNewUserRole(event.target.value as UserRole)}
            value={newUserRole}
          >
            <option value="new">New user</option>
            <option value="verified">Verified user</option>
            <option value="admin">Admin</option>
          </select>
          <button
            className="rounded-md bg-cyan-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
            disabled={!email.trim() || updatingUid !== null}
            type="submit"
          >
            Set role
          </button>
        </form>

        {status ? <p className="text-sm text-cyan-200">{status}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-white">Site users</h2>
            <button
              className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
              disabled={isLoading}
              onClick={() => void loadUsers()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="p-5">
              <div className="h-20 animate-pulse rounded-md bg-white/10" />
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {sortedUsers.map((siteUser) => (
                <div
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center"
                  key={siteUser.uid}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {getUserLabel(siteUser)}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {siteUser.uid}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <RoleBadge role={siteUser.role} />
                      {siteUser.isBootstrapAdmin ? (
                        <span className="rounded border border-amber-300/30 px-2 py-1 text-xs font-semibold text-amber-200">
                          Bootstrap
                        </span>
                      ) : null}
                      {siteUser.disabled ? (
                        <span className="rounded border border-red-300/30 px-2 py-1 text-xs font-semibold text-red-200">
                          Disabled
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <select
                    className="rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      updatingUid !== null ||
                      siteUser.isBootstrapAdmin
                    }
                    onChange={(event) =>
                      void setUserRole(siteUser, event.target.value as UserRole)
                    }
                    value={siteUser.role}
                  >
                    <option value="new">New user</option>
                    <option value="verified">Verified user</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function formatRole(role: UserRole) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "verified") {
    return "Verified user";
  }

  return "New user";
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "admin") {
    return (
      <span className="rounded border border-cyan-300/30 px-2 py-1 text-xs font-semibold text-cyan-200">
        Admin
      </span>
    );
  }

  if (role === "verified") {
    return (
      <span className="rounded border border-emerald-300/30 px-2 py-1 text-xs font-semibold text-emerald-200">
        Verified user
      </span>
    );
  }

  return (
    <span className="rounded border border-white/10 px-2 py-1 text-xs font-semibold text-zinc-400">
      New user
    </span>
  );
}
