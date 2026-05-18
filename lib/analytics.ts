// Server-side PostHog event capture. The browser-side init lives in components/posthog-provider.tsx.
import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

export function posthog(): PostHog | null {
  if (_client) return _client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  _client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

export async function track(userId: string | null, event: string, properties: Record<string, any> = {}) {
  const client = posthog();
  if (!client) return;
  try {
    client.capture({
      distinctId: userId || "anonymous",
      event,
      properties: { ...properties, source: "server" },
    });
  } catch (e) {
    console.warn("[analytics] capture failed:", e);
  }
}

export function analyticsStatus(): { enabled: boolean; provider: string; key?: string } {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return { enabled: false, provider: "posthog" };
  return { enabled: true, provider: "posthog", key: "***" };
}
