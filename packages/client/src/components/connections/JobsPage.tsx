// ──────────────────────────────────────────────
// Jobs: which model does what, in place of the 12-cell Defaults grid. Main (with its "if it fails" model) first,
// then only the jobs that have a model of their own, then the jobs that follow another job and the ones that are
// off as short chip rows. Every job still opens its picker. The Connections page sums this up in one sentence.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { OvEditorHead } from "../overhaul/EditorChrome";
import { openLibraryPane, openLibrarySection } from "../overhaul/library-navigation";
import { JOB, type JobKey } from "../../lib/connection-jobs";
import { openAddConnection } from "../../lib/add-connection";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { useConnections } from "../../hooks/use-connections";
import { useHiddenModelIds } from "../../hooks/use-model-star";
import { JobPickerWindow, useConnectionDefaults, type DefaultsTile } from "./ConnectionDefaults";
import type { ConnectionRowData } from "./ConnectionRow";

/** The viewer id of the Jobs page (Library › Connections › Jobs). */
export const JOBS_PAGE_ID = "jobs";

/** Opening a job: its set-up screen when its engine is missing, its settings page for Dictation, else its picker. */
export function useJobTileClick() {
  const [picking, setPicking] = useState<JobKey | null>(null);
  const click = (tile: DefaultsTile) => {
    if (tile.setup?.item) return openAddConnection({ category: "device", item: tile.setup.item });
    if (tile.device) return openAddConnection({ category: "device", item: tile.device });
    if (JOB[tile.key].device) return useUIStore.getState().openModal("job-settings", { job: tile.key });
    setPicking(tile.key);
  };
  const picker = picking ? <JobPickerWindow job={JOB[picking]} onClose={() => setPicking(null)} /> : null;
  return { click, picker };
}

export type JobGroups = {
  main: DefaultsTile | undefined;
  /** Jobs with a model of their own (not Main). */
  own: DefaultsTile[];
  /** Jobs that use another job's model ("Follows Main"). */
  following: DefaultsTile[];
  /** Jobs that are off or not set. */
  off: DefaultsTile[];
  /** Jobs that need the user (not counting quiet notes such as "Not downloaded"). */
  problems: number;
};

export function groupJobs(tiles: readonly DefaultsTile[]): JobGroups {
  const main = tiles.find((tile) => tile.key === "main");
  const rest = tiles.filter((tile) => tile.key !== "main");
  return {
    main,
    own: rest.filter((tile) => !tile.follows && !tile.muted),
    following: rest.filter((tile) => !!tile.follows),
    off: rest.filter((tile) => !tile.follows && !!tile.muted),
    problems: tiles.filter((tile) => tile.warning && !tile.warning.quiet).length,
  };
}

/** "Images and Quick answers" in the reader's language. */
export function listOfJobs(titles: string[], language: string | undefined) {
  try {
    return new Intl.ListFormat(language || "en", { style: "long", type: "conjunction" }).format(titles);
  } catch {
    return titles.join(", ");
  }
}

function JobRowButton({ tile, onClick, big }: { tile: DefaultsTile; onClick: () => void; big?: boolean }) {
  const { t } = useTranslation();
  const warn = tile.warning && !tile.warning.quiet ? tile.warning : null;
  const quiet = tile.warning?.quiet ? tile.warning : null;
  return (
    <button
      type="button"
      className={cn("ov-jobs__row", big && "ov-jobs__row--main")}
      onClick={onClick}
      title={t(`connections.defaults.purpose.${tile.key}`)}
    >
      <span className="ov-jobs__job">
        <b>{tile.title}</b>
        <span className="ov-jobs__purpose">{t(`connections.defaults.purpose.${tile.key}`)}</span>
      </span>
      <span className={cn("ov-jobs__value", tile.muted && "is-unset", warn && "is-warn")}>
        <span className="ov-jobs__model">{tile.value}</span>
        {tile.hint ? <span className="ov-jobs__dim">{tile.hint}</span> : null}
        {tile.fallback ? (
          <span className="ov-jobs__dim">{t("connections.home.ifFails", { model: tile.fallback })}</span>
        ) : null}
        {warn ? <span className="ov-jobs__warn">{warn.short ?? warn.text}</span> : null}
        {quiet?.short ? <span className="ov-jobs__dim">{quiet.short}</span> : null}
      </span>
      <ChevronRight size={14} className="ov-jobs__chev" aria-hidden="true" />
    </button>
  );
}

export function JobsPage({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: connections } = useConnections();
  const hiddenIds = useHiddenModelIds();
  const rows = ((connections as ConnectionRowData[] | undefined) ?? []).filter((row) => !hiddenIds.has(row.id));
  const tiles = useConnectionDefaults(rows);
  const { main, own, following, off } = groupJobs(tiles);
  const { click, picker } = useJobTileClick();
  const chip = (tile: DefaultsTile) => (
    <button
      key={tile.key}
      type="button"
      className={cn("ov-jobs__chip", tile.warning && !tile.warning.quiet && "is-warn")}
      onClick={() => click(tile)}
      title={[t(`connections.defaults.purpose.${tile.key}`), tile.follows ?? tile.value].filter(Boolean).join("\n")}
    >
      {tile.title}
    </button>
  );
  return (
    <div className="ov-jobpage mari-connection-scope" data-component="ConnectionJobsPage">
      <OvEditorHead
        section="connections"
        sectionLabel="Connections"
        onBack={onClose}
        crumbs={[
          { label: t("ui.overhaul.oveditorhead.library"), onClick: openLibraryPane },
          { label: t("connections.home.backToConnections"), onClick: () => openLibrarySection("connections") },
          { label: t("connections.home.jobs") },
        ]}
        title={t("connections.home.jobs")}
      />
      <div className="ov-jobs">
        <p className="ov-jobs__intro">{t("connections.home.jobsIntro")}</p>
        {main ? (
          <section className="ov-jobs__group" aria-labelledby="ov-jobs-main">
            <h2 id="ov-jobs-main">{t("connections.home.mainModel")}</h2>
            <div className="ov-jobs__card">
              <JobRowButton tile={main} big onClick={() => click(main)} />
            </div>
          </section>
        ) : null}
        {own.length ? (
          <section className="ov-jobs__group" aria-labelledby="ov-jobs-own">
            <h2 id="ov-jobs-own">
              {t("connections.home.ownModel")} <span className="ov-jobs__count">{own.length}</span>
            </h2>
            <div className="ov-jobs__card">
              {own.map((tile) => (
                <JobRowButton key={tile.key} tile={tile} onClick={() => click(tile)} />
              ))}
            </div>
          </section>
        ) : null}
        {following.length ? (
          <section className="ov-jobs__group" aria-labelledby="ov-jobs-follow">
            <h2 id="ov-jobs-follow">
              {t("connections.home.following")} <span className="ov-jobs__count">{following.length}</span>
            </h2>
            <div className="ov-jobs__chips">{following.map(chip)}</div>
          </section>
        ) : null}
        {off.length ? (
          <section className="ov-jobs__group" aria-labelledby="ov-jobs-off">
            <h2 id="ov-jobs-off">
              {t("connections.home.off")} <span className="ov-jobs__count">{off.length}</span>
            </h2>
            <div className="ov-jobs__chips">{off.map(chip)}</div>
          </section>
        ) : null}
        <p className="ov-jobs__hint">{t("connections.home.chipHint")}</p>
      </div>
      {picker}
    </div>
  );
}
