import { Button, Card, Eyebrow, Input, Label } from "@/components/ui/primitives";
import { listUsers } from "@/lib/users";
import { signInAction } from "./actions";

export const dynamic = "force-dynamic";

export default function SignIn({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const users = listUsers();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div>
          <Eyebrow>Augen Studio</Eyebrow>
          <h1 className="serif text-3xl tracking-tight mt-1">Sign in</h1>
          <p className="text-ink-300 mt-2 text-sm">
            Lightweight email sign-in. No password — this is a studio prototype.
          </p>
        </div>

        <form action={signInAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" name="email" placeholder="you@studio.com" required />
          </div>
          <div className="space-y-1.5">
            <Label>Display name (used if new)</Label>
            <Input name="name" placeholder="Varun Saini" />
          </div>
          <Button type="submit" size="lg" className="w-full">Sign in →</Button>
        </form>

        {users.length > 0 && (
          <div className="pt-4 border-t border-white/5 space-y-3">
            <Eyebrow>Quick sign-in</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <form key={u.id} action={signInAction}>
                  <input type="hidden" name="email" value={u.email} />
                  <input type="hidden" name="name" value={u.name} />
                  <button className="flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ring-white/10 text-xs text-ink-200 hover:bg-white/5">
                    <span className="w-4 h-4 rounded-full" style={{ background: u.avatar_color }} />
                    {u.name}
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
