import { createContext, useContext } from "react";

/**
 * True inside a Modal's content. A picker there opens as a popover next to its field, also on a phone,
 * because S.O.U.P. never stacks two sheets.
 */
export const InsideModalContext = createContext(false);

export const useInsideModal = () => useContext(InsideModalContext);
