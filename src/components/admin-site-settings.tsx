"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "firebase/auth";
import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "@/lib/site-settings";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type SiteSettingsResponse = {
  generatedAt: string;
  settings: SiteSettings;
};

export function AdminSiteSettings() {
  const { user } = useAuthUser();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function getAuthorizationHeader() {
    if (!user) {
      throw new Error("Sign in before editing site settings.");
    }

    const token = await getIdToken(user);

    return { Authorization: `Bearer ${token}` };
  }

  async function loadSettings() {
    setIsLoading(true);
    setError("");
    setStatus("");

    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/admin/site", {
        cache: "no-store",
        headers,
      });
      const payload = (await response.json()) as
        | SiteSettingsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load settings.");
      }

      setSettings((payload as SiteSettingsResponse).settings);
      setGeneratedAt((payload as SiteSettingsResponse).generatedAt);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSettings() {
    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/admin/site", {
        body: JSON.stringify(settings),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = (await response.json()) as
        | SiteSettingsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to save settings.");
      }

      setSettings((payload as SiteSettingsResponse).settings);
      setGeneratedAt((payload as SiteSettingsResponse).generatedAt);
      setStatus("Site settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialSettings() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken(user);
        const response = await fetch("/api/admin/site", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as
          | SiteSettingsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Unable to load settings.",
          );
        }

        if (isActive) {
          setSettings((payload as SiteSettingsResponse).settings);
          setGeneratedAt((payload as SiteSettingsResponse).generatedAt);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load settings.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialSettings();

    return () => {
      isActive = false;
    };
  }, [user]);

  const logo = settings.homeLogo;

  return (
    <section className="px-6 py-10 lg:px-16">
      <div className="mx-auto grid max-w-6xl gap-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Admin
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Site settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Control the homepage SonoSig logo physics and interaction behavior.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading || isSaving}
              onClick={() => void loadSettings()}
              type="button"
            >
              Refresh
            </button>
            <button
              className="rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading || isSaving}
              onClick={() => void saveSettings()}
              type="button"
            >
              {isSaving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>

        {generatedAt ? (
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Loaded {new Date(generatedAt).toLocaleString()}
          </p>
        ) : null}

        {status ? (
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Home logo
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Initial motion and hold behavior
              </h2>
            </div>
            {isLoading ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                Loading
              </span>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ToggleField
              checked={logo.initialMotionEnabled}
              label="Start in motion"
              onChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  homeLogo: {
                    ...current.homeLogo,
                    initialMotionEnabled: checked,
                  },
                }))
              }
            />
            <ToggleField
              checked={logo.strobeOnHold}
              label="Strobe colors on click-hold"
              onChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  homeLogo: {
                    ...current.homeLogo,
                    strobeOnHold: checked,
                  },
                }))
              }
            />
            <ToggleField
              checked={logo.haloFadeEnabled}
              label="Fade blue shadow after load"
              onChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  homeLogo: {
                    ...current.homeLogo,
                    haloFadeEnabled: checked,
                  },
                }))
              }
            />
            <ToggleField
              checked={logo.autoResetEnabled}
              label="Auto-reset logo"
              onChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  homeLogo: {
                    ...current.homeLogo,
                    autoResetEnabled: checked,
                  },
                }))
              }
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <RangeField
              label="Initial horizontal velocity"
              max={4}
              min={-4}
              onChange={(value) => updateLogoNumber("initialVelocityX", value)}
              step={0.05}
              value={logo.initialVelocityX}
            />
            <RangeField
              label="Initial vertical velocity"
              max={4}
              min={-4}
              onChange={(value) => updateLogoNumber("initialVelocityY", value)}
              step={0.05}
              value={logo.initialVelocityY}
            />
            <RangeField
              label="Initial scatter"
              max={80}
              min={0}
              onChange={(value) => updateLogoNumber("initialScatter", value)}
              step={1}
              value={logo.initialScatter}
            />
            <RangeField
              label="Inertia"
              max={0.98}
              min={0.75}
              onChange={(value) => updateLogoNumber("inertia", value)}
              step={0.01}
              value={logo.inertia}
            />
            <RangeField
              label="Return force"
              max={0.06}
              min={0.008}
              onChange={(value) => updateLogoNumber("returnForce", value)}
              step={0.001}
              value={logo.returnForce}
            />
            <RangeField
              label="Shadow fade duration"
              max={60}
              min={1}
              onChange={(value) => updateLogoNumber("haloFadeDurationSeconds", value)}
              step={1}
              value={logo.haloFadeDurationSeconds}
            />
            <RangeField
              label="Auto-reset interval"
              max={120}
              min={5}
              onChange={(value) => updateLogoNumber("autoResetIntervalSeconds", value)}
              step={1}
              value={logo.autoResetIntervalSeconds}
            />
          </div>
        </section>
      </div>
    </section>
  );

  function updateLogoNumber(
    key:
      | "autoResetIntervalSeconds"
      | "initialScatter"
      | "initialVelocityX"
      | "initialVelocityY"
      | "inertia"
      | "haloFadeDurationSeconds"
      | "returnForce",
    value: number,
  ) {
    setSettings((current) => ({
      ...current,
      homeLogo: {
        ...current.homeLogo,
        [key]: value,
      },
    }));
  }
}

function ToggleField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-zinc-950/70 p-4">
      <span className="text-sm font-medium text-zinc-200">{label}</span>
      <input
        checked={checked}
        className="h-5 w-5 accent-cyan-300"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function RangeField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className="grid gap-3 rounded-md border border-white/10 bg-zinc-950/70 p-4">
      <span className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-200">
        {label}
        <span className="font-mono text-xs text-cyan-200">{value}</span>
      </span>
      <input
        className="accent-cyan-300"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}
