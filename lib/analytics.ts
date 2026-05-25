// Analytics event tracking — structured for easy GA4 / GTM integration.
// Wire up window.gtag or window.dataLayer in a future analytics provider component.

export type TrackingEvent =
  | "cta_click"
  | "branch_click"
  | "booking_start"
  | "booking_complete"
  | "blog_view"
  | "faq_expand"
  | "trial_button_click"
  | "nav_click";

interface EventData {
  label?:   string;
  section?: string;
  slug?:    string;
  branch?:  string;
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(event: TrackingEvent, data?: EventData): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[Analytics]", event, data);
  }

  if (typeof window === "undefined") return;

  // GA4
  if (typeof window.gtag === "function") {
    window.gtag("event", event, data);
  }

  // GTM dataLayer
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event, ...data });
  }
}
