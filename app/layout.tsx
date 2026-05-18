import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { PostHogProvider } from "@/components/posthog-provider";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Augen — AI Ad Studio",
  description: "Plug in a brand. Plan a quarter. Approve great ads. End-to-end.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A0B",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, brands, activeBrand } = await getSession();
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 text-ink-100">
        <PostHogProvider userId={user?.id} userEmail={user?.email} />
        <MobileNav
          user={user ? { id: user.id, name: user.name, email: user.email, color: user.avatar_color } : null}
          brands={brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, tokens: { palette: { primary: b.tokens.palette.primary, accent: b.tokens.palette.accent } } }))}
          activeBrand={activeBrand ? { id: activeBrand.id, slug: activeBrand.slug, name: activeBrand.name } : null}
          isAdmin={isAdmin(user)}
        />
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
