import { Card, Eyebrow } from "@/components/ui/primitives";
import { getSession } from "@/lib/session";
import { getDeviceCode } from "@/lib/repo";
import { ConnectApprove } from "./approve";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const code = (await searchParams)?.code || "";
  const { user } = await getSession();
  const row = code ? getDeviceCode(code) : null;
  const validish = !!row && row.status === "pending" && row.expires_at > Date.now();

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div>
          <Eyebrow>Augen · connect</Eyebrow>
          <h1 className="serif text-3xl tracking-tight mt-1">Figma plugin</h1>
        </div>

        {!code || !row ? (
          <p className="text-sm text-ink-300">This connection link is invalid or already used. Start again from the plugin in Figma.</p>
        ) : !validish ? (
          <p className="text-sm text-ink-300">This link has expired. Click <b>Connect Augen account</b> again in the Figma plugin to get a fresh one.</p>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-300">Sign in to approve this connection.</p>
            <Link href={`/signin?next=${encodeURIComponent(`/connect?code=${code}`)}`} className="inline-block rounded-lg bg-ink-50 text-ink-950 px-4 py-2 text-sm font-medium">Sign in →</Link>
          </div>
        ) : (
          <ConnectApprove code={code} email={user.email} />
        )}
      </Card>
    </div>
  );
}
