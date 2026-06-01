export const DISCOVERY_APP_EVENT = "marinara:discovery-action";

export type DiscoveryAppEventDetail =
  | {
      type: "open-professor-mari";
    }
  | {
      type: "go-home";
    };
