// ──────────────────────────────────────────────
// Browse on a Connection's card (the recommended blend): "Browse 164" opens the rest of the catalog right under the
// card's own models, in place (no window). Recent tries first, then the whole list with family chips and "new" marks
// from the last change to the list. A star adds a model to the card; the dropdown never edits a saved Model.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Star } from "lucide-react";
import { readChatModelOverride, readChatRecentModels } from "@marinara-engine/shared";
import { useChats } from "../../hooks/use-chats";
import { useConnectionModels, type ConnectionModelList } from "../../hooks/use-connections";
import { useModelStar } from "../../hooks/use-model-star";
import { FamilyChips, familyFilterOf } from "./FamilyChips";
import { SearchInput } from "../ui/SearchInput";
import { cn } from "../../lib/utils";
import { groupModelVariants, variantLabel } from "../../lib/model-variants";

/** Rows shown before "Show more": a 164-model proxy opens fast and stays one scroll long. */
const BROWSE_ROWS = 40;
/** A change to the list is news for a week. */
const CHANGES_FRESH_MS = 7 * 24 * 60 * 60_000;

type Changes = NonNullable<ConnectionModelList["changes"]>;

/** The changes still worth saying, or null once they are a week old (or there are none). */
export function freshChanges(changes: Changes | undefined, now = Date.now()): Changes | null {
  if (!changes || (!changes.added.length && !changes.removed.length)) return null;
  const at = Date.parse(changes.at);
  return Number.isFinite(at) && now - at < CHANGES_FRESH_MS ? changes : null;
}

/** "Monday" within the last week, else a short date. */
function sinceLabel(iso: string, language: string | undefined) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = (Date.now() - date.getTime()) / 86_400_000;
  try {
    return days < 6.5
      ? new Intl.DateTimeFormat(language || "en", { weekday: "long" }).format(date)
      : new Intl.DateTimeFormat(language || "en", { day: "numeric", month: "short" }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** "yesterday", "3 days ago". */
function agoLabel(iso: string, language: string | undefined) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const days = Math.round((Date.now() - time) / 86_400_000);
  try {
    const format = new Intl.RelativeTimeFormat(language || "en", { numeric: "auto" });
    return days < 1 ? format.format(0, "day") : format.format(-days, "day");
  } catch {
    return "";
  }
}

/** "+3 new, 1 gone since Monday" for a card's header; null when the list has not changed lately. */
export function changesLine(
  changes: Changes | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string | undefined,
) {
  const fresh = freshChanges(changes);
  if (!fresh) return null;
  const when = sinceLabel(fresh.since, language);
  const text =
    fresh.added.length && fresh.removed.length
      ? t("connections.home.changesBoth", { added: fresh.added.length, removed: fresh.removed.length, when })
      : fresh.added.length
        ? t("connections.home.changesAdded", { count: fresh.added.length, when })
        : t("connections.home.changesRemoved", { count: fresh.removed.length, when });
  const title = [
    fresh.added.length ? `${t("connections.browse.new")}: ${fresh.added.join(", ")}` : "",
    fresh.removed.length ? `${t("connections.browse.gone")}: ${fresh.removed.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { text, title };
}

type RowLike = { id: string; accountId?: string | null; model?: string | null };

export function CardBrowse({
  accountId,
  accountName,
  catalogId,
  anchorId,
  saved,
  rows,
}: {
  accountId: string;
  accountName: string;
  /** The Model whose saved list is this Connection's catalog. */
  catalogId: string;
  /** The row that holds stars for models with no saved Model yet. */
  anchorId: string;
  /** Model ids that already have a saved Model on this Connection (they are on the card). */
  saved: ReadonlySet<string>;
  /** Every saved Model, to tell which Connection a chat's pick ran on. */
  rows: readonly RowLike[];
}) {
  const { t, i18n } = useTranslation();
  const list = useConnectionModels(catalogId);
  const { data: chats } = useChats();
  const modelStar = useModelStar();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string | null>(null);
  const [shown, setShown] = useState(BROWSE_ROWS);
  const [busy, setBusy] = useState<string | null>(null);
  // Base models whose variants are open ("[free]…", "[SP]…-thinking" under "claude-fable-5-1").
  const [openBases, setOpenBases] = useState<ReadonlySet<string>>(() => new Set());

  const models = useMemo(() => (list.data?.models ?? []).filter((model) => !saved.has(model.id)), [list.data, saved]);
  const fresh = freshChanges(list.data?.changes);
  const isNew = useMemo(() => new Set(fresh?.added ?? []), [fresh]);

  // Models this Connection ran in a chat without saving them (a try), newest chat first.
  const recent = useMemo(() => {
    const onAccount = new Set(rows.filter((row) => row.accountId === accountId).map((row) => row.id));
    const known = new Set(models.map((model) => model.id));
    const found = new Map<string, string>();
    const sorted = [...(chats ?? [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    for (const chat of sorted) {
      const picks = [readChatModelOverride(chat), ...readChatRecentModels(chat)];
      for (const pick of picks) {
        const model = pick?.model;
        if (!model || !onAccount.has(pick.connectionId) || !known.has(model) || found.has(model)) continue;
        found.set(model, String(chat.updatedAt ?? ""));
      }
      if (found.size >= 5) break;
    }
    return [...found].map(([id, at]) => ({ id, at }));
  }, [accountId, chats, models, rows]);

  const needle = query.trim().toLowerCase();
  const chips = familyFilterOf(
    models.map((model) => model.id),
    family,
  );
  const matching = models.filter((model) =>
    needle
      ? model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle)
      : chips.matches(model.id),
  );
  // New models lead the list while they are news.
  const ordered = fresh ? [...matching].sort((a, b) => Number(isNew.has(b.id)) - Number(isNew.has(a.id))) : matching;
  const byId = new Map(models.map((model) => [model.id, model]));

  const add = (id: string) => {
    if (busy) return;
    const model = byId.get(id);
    setBusy(id);
    void modelStar
      .star({
        accountId,
        model: id,
        name: model?.name !== id ? model?.name : undefined,
        maxContext: model?.context,
        anchorId,
      })
      .finally(() => setBusy(null));
  };

  // One line per base model while browsing; a search lists every match as it is.
  const groups = needle
    ? ordered.map((model) => ({ key: model.id, base: model.id, items: [model] }))
    : groupModelVariants(ordered, (model) => model.id);

  const row = (id: string, extra?: string, variant = false) => {
    const model = byId.get(id);
    const label = variant ? variantLabel(id) : model?.name && model.name !== id ? model.name : id;
    return (
      <button
        key={id}
        type="button"
        className={cn("ov-conn-browse__row", variant && "is-variant")}
        disabled={busy === id}
        onClick={() => add(id)}
        title={t("connections.browse.starHint")}
        data-conn-browse-model={id}
      >
        <Star size={13} aria-hidden="true" className="ov-conn-browse__star" />
        <span className="ov-conn-browse__name">
          <b>{label}</b>
          {label !== id ? <span className="ov-conn__dim">{id}</span> : null}
        </span>
        {isNew.has(id) ? <span className="ov-conn-browse__new">{t("connections.browse.new")}</span> : null}
        {extra ? <span className="ov-conn__dim">{extra}</span> : null}
      </button>
    );
  };

  if (list.isLoading) return <p className="ov-conn-browse__status">{t("connections.modelPicker.loading")}</p>;
  if (list.isError) return <p className="ov-conn-browse__status">{t("connections.picker.loadFailed")}</p>;

  return (
    <div className="ov-conn-browse" data-conn-browse-panel>
      <SearchInput
        className="ov-conn-browse__search"
        value={query}
        onChange={(value) => {
          setQuery(value);
          setShown(BROWSE_ROWS);
        }}
        label={t("connections.browse.search", { count: models.length, account: accountName })}
        placeholder={t("connections.browse.search", { count: models.length, account: accountName })}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {!needle && recent.length ? (
        <section className="ov-conn-browse__group" aria-label={t("connections.browse.recent")}>
          <h3>{t("connections.browse.recent")}</h3>
          {recent.map((entry) => row(entry.id, agoLabel(entry.at, i18n.language)))}
        </section>
      ) : null}
      <section className="ov-conn-browse__group" aria-label={t("connections.browse.all")}>
        {!needle ? (
          <FamilyChips
            className="ov-conn-browse__chips"
            families={chips.families}
            active={chips.active}
            total={models.length}
            onChange={(next) => {
              setFamily(next);
              setShown(BROWSE_ROWS);
            }}
          />
        ) : null}
        {groups.length ? (
          groups.slice(0, shown).map((group) => {
            if (group.items.length === 1) return row(group.items[0]!.id);
            const open = openBases.has(group.key);
            return (
              <div key={`base:${group.key}`} className="ov-conn-browse__base">
                <button
                  type="button"
                  className="ov-conn-browse__row is-base"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenBases((current) => {
                      const next = new Set(current);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    })
                  }
                  data-conn-browse-base={group.key}
                >
                  <ChevronDown
                    size={13}
                    aria-hidden="true"
                    className={cn("ov-conn-browse__star", open && "rotate-180")}
                  />
                  <span className="ov-conn-browse__name">
                    <b>{group.base}</b>
                  </span>
                  {group.items.some((model) => isNew.has(model.id)) ? (
                    <span className="ov-conn-browse__new">{t("connections.browse.new")}</span>
                  ) : null}
                  <span className="ov-conn__dim">{t("connections.variants.count", { count: group.items.length })}</span>
                </button>
                {open ? group.items.map((model) => row(model.id, undefined, true)) : null}
              </div>
            );
          })
        ) : (
          <p className="ov-conn-browse__status">{t("connections.browse.empty")}</p>
        )}
        {groups.length > shown ? (
          <button
            type="button"
            className="ov-conn-card__more"
            onClick={() => setShown((value) => value + BROWSE_ROWS * 2)}
          >
            {t("connections.home.showMore", { count: groups.length - shown })}
          </button>
        ) : null}
      </section>
      <p className="ov-conn-browse__hint">{t("connections.browse.starHint")}</p>
    </div>
  );
}
