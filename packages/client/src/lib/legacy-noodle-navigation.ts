/** Browser-local state kept only so the optional Noodle package can import an existing user's last view. */
export type LegacyNoodleNavigationState =
  | { mode: "public"; view: "home" | "search" | "notifications" }
  | { mode: "public"; view: "profile"; accountId: string | null; connection: "followers" | "following" | null }
  | { mode: "settings"; tab?: "noodle" | "noodler"; section?: string; returnTo?: unknown }
  | { mode: "noodler"; view: "hub" | "profiles"; onboarding?: boolean }
  | { mode: "noodler"; view: "profile"; accountId: string }
  | { mode: "noodler"; view: "create-profile"; noodleAccountId: string };
