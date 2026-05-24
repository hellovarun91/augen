import { AppHeader } from "@/components/app-header";
import { getAppNav } from "@/lib/nav";

// Lives in a template (not the layout) so it re-renders on every client-side
// navigation — the breadcrumb + active tab stay in sync with the current page.
// The root layout persists across navigations and would otherwise go stale.
export default async function Template({ children }: { children: React.ReactNode }) {
  const nav = await getAppNav();
  return (
    <>
      <AppHeader nav={nav} />
      {children}
    </>
  );
}
