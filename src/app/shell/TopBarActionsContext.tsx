// ──────────────────────────────────────────────
// TopBarActionsContext — lets any surface inject actions into the mobile TopBar
// ──────────────────────────────────────────────
import { createContext, useContext, useState, type ReactNode } from "react";

interface TopBarActionsContextValue {
  rightSlot: ReactNode;
  setRightSlot: (slot: ReactNode) => void;
}

const TopBarActionsContext = createContext<TopBarActionsContextValue>({
  rightSlot: null,
  setRightSlot: () => {},
});

export function TopBarActionsProvider({ children }: { children: ReactNode }) {
  const [rightSlot, setRightSlot] = useState<ReactNode>(null);
  return (
    <TopBarActionsContext.Provider value={{ rightSlot, setRightSlot }}>
      {children}
    </TopBarActionsContext.Provider>
  );
}

export function useTopBarActions() {
  return useContext(TopBarActionsContext);
}
