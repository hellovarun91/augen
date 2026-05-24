// Brand membership roles (soft — labels + routing, not hard permissions, during
// the beta). Kept out of any "use server" file so the client can import them.
export const TEAM_ROLES = ["manager", "copywriter", "designer", "marketer", "stakeholder"] as const;
export const ASSIGNABLE_ROLES = new Set<string>([...TEAM_ROLES, "owner", "editor"]);
export const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);
