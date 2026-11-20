import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";

import { findMariOutputLimitNote } from "../../../lib/mari-output-limit-note";
import { MariNote } from "../mari-primitives";

/**
 * Opens the connection Professor Mari is using at its Max output tokens field, or null when there is no such field
 * (no connection yet, or the built-in model). HomeProfessorMariChat provides it.
 */
export const MariOpenOutputLimitContext = createContext<(() => void) | null>(null);

/** Her "kept hitting the output limit" note, on its own line, with a button to the field that raises the limit. */
export function MariOutputLimitNote({ content }: { content: string }) {
  const { t } = useTranslation();
  const openOutputLimit = useContext(MariOpenOutputLimitContext);
  const found = findMariOutputLimitNote(content);
  if (!found) return null;
  return (
    <div className="mari-limit-note" data-component="MariOutputLimitNote">
      <MariNote tone="accent" role="status">
        {found.note}
      </MariNote>
      {found.raisable && openOutputLimit ? (
        <button type="button" className="mari-btn" onClick={openOutputLimit}>
          <SlidersHorizontal size="0.8rem" aria-hidden="true" />
          {t("mari.reply.outputLimitButton")}
        </button>
      ) : null}
    </div>
  );
}
