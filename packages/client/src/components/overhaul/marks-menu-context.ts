import { createContext } from "react";

/**
 * Set by a desktop message "More" menu. When present, the bookmark / pin / note action renders as a menu row
 * that swaps the menu for the marks form instead of opening its own popover.
 */
export const OvMarksMenuContext = createContext<null | (() => void)>(null);
