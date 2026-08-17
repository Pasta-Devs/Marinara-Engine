import { createContext, useContext, type ReactNode } from "react";

type TrackerWindow = Window & typeof globalThis;

const TrackerWindowContext = createContext<TrackerWindow | null>(null);

export function TrackerWindowProvider({ children, host }: { children: ReactNode; host: TrackerWindow }) {
  return <TrackerWindowContext.Provider value={host}>{children}</TrackerWindowContext.Provider>;
}

export function useTrackerWindow() {
  const host = useContext(TrackerWindowContext);
  return host ?? window;
}
