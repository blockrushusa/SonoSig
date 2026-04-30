export type HomeLogoSettings = {
  autoResetEnabled: boolean;
  autoResetIntervalSeconds: number;
  haloFadeDurationSeconds: number;
  haloFadeEnabled: boolean;
  initialMotionEnabled: boolean;
  initialScatter: number;
  initialVelocityX: number;
  initialVelocityY: number;
  inertia: number;
  returnForce: number;
  strobeOnHold: boolean;
};

export const DEFAULT_HOME_LOGO_SETTINGS: HomeLogoSettings = {
  autoResetEnabled: true,
  autoResetIntervalSeconds: 20,
  haloFadeDurationSeconds: 10,
  haloFadeEnabled: true,
  initialMotionEnabled: true,
  initialScatter: 18,
  initialVelocityX: 0.7,
  initialVelocityY: -0.28,
  inertia: 0.9,
  returnForce: 0.024,
  strobeOnHold: true,
};

export type SiteSettings = {
  homeLogo: HomeLogoSettings;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  homeLogo: DEFAULT_HOME_LOGO_SETTINGS,
};

export function coerceSiteSettings(value: unknown): SiteSettings {
  const input =
    value && typeof value === "object"
      ? (value as Partial<SiteSettings>)
      : {};
  const homeLogo =
    input.homeLogo && typeof input.homeLogo === "object"
      ? (input.homeLogo as Partial<HomeLogoSettings>)
      : {};

  return {
    homeLogo: {
      autoResetEnabled:
        typeof homeLogo.autoResetEnabled === "boolean"
          ? homeLogo.autoResetEnabled
          : DEFAULT_HOME_LOGO_SETTINGS.autoResetEnabled,
      autoResetIntervalSeconds: clampNumber(
        homeLogo.autoResetIntervalSeconds,
        5,
        120,
        DEFAULT_HOME_LOGO_SETTINGS.autoResetIntervalSeconds,
      ),
      haloFadeDurationSeconds: clampNumber(
        homeLogo.haloFadeDurationSeconds,
        1,
        60,
        DEFAULT_HOME_LOGO_SETTINGS.haloFadeDurationSeconds,
      ),
      haloFadeEnabled:
        typeof homeLogo.haloFadeEnabled === "boolean"
          ? homeLogo.haloFadeEnabled
          : DEFAULT_HOME_LOGO_SETTINGS.haloFadeEnabled,
      initialMotionEnabled:
        typeof homeLogo.initialMotionEnabled === "boolean"
          ? homeLogo.initialMotionEnabled
          : DEFAULT_HOME_LOGO_SETTINGS.initialMotionEnabled,
      initialScatter: clampNumber(
        homeLogo.initialScatter,
        0,
        80,
        DEFAULT_HOME_LOGO_SETTINGS.initialScatter,
      ),
      initialVelocityX: clampNumber(
        homeLogo.initialVelocityX,
        -4,
        4,
        DEFAULT_HOME_LOGO_SETTINGS.initialVelocityX,
      ),
      initialVelocityY: clampNumber(
        homeLogo.initialVelocityY,
        -4,
        4,
        DEFAULT_HOME_LOGO_SETTINGS.initialVelocityY,
      ),
      inertia: clampNumber(
        homeLogo.inertia,
        0.75,
        0.98,
        DEFAULT_HOME_LOGO_SETTINGS.inertia,
      ),
      returnForce: clampNumber(
        homeLogo.returnForce,
        0.008,
        0.06,
        DEFAULT_HOME_LOGO_SETTINGS.returnForce,
      ),
      strobeOnHold:
        typeof homeLogo.strobeOnHold === "boolean"
          ? homeLogo.strobeOnHold
          : DEFAULT_HOME_LOGO_SETTINGS.strobeOnHold,
    },
  };
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, numericValue));
}
