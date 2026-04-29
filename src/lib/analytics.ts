export const GA_MEASUREMENT_ID = "G-B9HBX0GPYL";

type AnalyticsValue = boolean | number | string | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      command: "config" | "event" | "js",
      target: Date | string,
      params?: AnalyticsParams,
    ) => void;
  }
}

export function trackPageView(path: string) {
  if (typeof window === "undefined" || !window.gtag) {
    return;
  }

  window.gtag("config", GA_MEASUREMENT_ID, {
    page_location: window.location.href,
    page_path: path,
  });
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || !window.gtag) {
    return;
  }

  window.gtag("event", name, sanitizeAnalyticsParams(params));
}

function sanitizeAnalyticsParams(params: AnalyticsParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as AnalyticsParams;
}
