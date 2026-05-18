import { LinkButton } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="px-8 py-20 max-w-2xl mx-auto text-center space-y-4">
      <div className="serif text-display-lg">Not here.</div>
      <p className="text-ink-300">The page or record you're looking for doesn't exist (or was deleted).</p>
      <LinkButton href="/" className="mt-4">Back to dashboard →</LinkButton>
    </div>
  );
}
