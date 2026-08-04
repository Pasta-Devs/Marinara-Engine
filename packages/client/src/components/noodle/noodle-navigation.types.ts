export type NoodleProfileConnection = "followers" | "following";

export type NoodlePublicNavigationState =
  | { mode: "public"; view: "home" }
  | { mode: "public"; view: "search" }
  | { mode: "public"; view: "notifications" }
  | {
      mode: "public";
      view: "profile";
      accountId: string | null;
      connection: NoodleProfileConnection | null;
      edit?: boolean;
      returnToSettings?: NoodleSettingsNavigationState;
    };

export type NoodleSettingsReturnState =
  | NoodlePublicNavigationState
  | { mode: "noodler"; view: "hub" }
  | { mode: "noodler"; view: "profiles" }
  | { mode: "noodler"; view: "profile"; accountId: string }
  | { mode: "noodler"; view: "create-profile"; noodleAccountId: string };

export type NoodleSettingsNavigationState = {
  mode: "settings";
  tab?: "noodle" | "noodler";
  section?: "general" | "timeline" | "participants" | "creators" | "advanced";
  returnTo?: NoodleSettingsReturnState;
};

export type NoodlerNavigationState =
  /** `onboarding` is set by the opt-in gate so the hub opens the first-run wizard on arrival. */
  | { mode: "noodler"; view: "hub"; onboarding?: boolean }
  | { mode: "noodler"; view: "profiles"; returnToSettings?: NoodleSettingsNavigationState }
  | { mode: "noodler"; view: "profile"; accountId: string; returnToSettings?: NoodleSettingsNavigationState }
  | { mode: "noodler"; view: "create-profile"; noodleAccountId: string };

export type NoodleNavigationState =
  | NoodlePublicNavigationState
  | NoodlerNavigationState
  | NoodleSettingsNavigationState;
