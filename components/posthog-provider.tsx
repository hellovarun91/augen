"use client";
import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogProvider({ userId, userEmail }: { userId?: string; userEmail?: string }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (typeof window === "undefined") return;
    if (!(window as any).__augen_posthog_inited) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        session_recording: { maskAllInputs: false },
        autocapture: true,
      });
      (window as any).__augen_posthog_inited = true;
    }
    if (userId) {
      posthog.identify(userId, { email: userEmail });
    }
  }, [userId, userEmail]);
  return null;
}
