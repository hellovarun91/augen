import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { PostHogProvider } from "@/components/posthog-provider";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Augen — AI Ad Studio",
  description: "Plug in a brand. Plan a quarter. Approve great ads. End-to-end.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 text-ink-100">
        <PostHogProvider userId={user?.id} userEmail={user?.email} />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
