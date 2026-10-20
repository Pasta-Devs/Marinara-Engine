// VRM setup on the 3D Avatars agent page (lane: 3D): import a `.vrm` (and an optional `.vrma`), show the
// author's terms from the file, and check or change which expression shows each face and mouth shape. "Get a 3D
// model" points to VRoid Studio and the import, with the guide link and a prompt copied from the owner's look.
// One-click Tripo models were withdrawn (maintainer decision, 2026-10-19); one made earlier, like any model
// without expressions, is shown as body only, with no faces to pick.
import { useId, useRef, useState, type ReactNode } from "react";
import { BookOpen, Copy, ExternalLink, Info, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AVATAR_EXPRESSION_SLOTS,
  type AvatarExpressionBindingSource,
  type AvatarExpressionMap,
  type AvatarExpressionSlot,
  type AvatarOwnerRef,
  type VrmAvatarData,
  type VrmModelMeta,
} from "@marinara-engine/shared";
import { useAvatarModelActions } from "../../../../hooks/use-avatar-models";
import { useCharacter, usePersona } from "../../../../hooks/use-characters";
import { showConfirmDialog } from "../../../../lib/app-dialogs";
import { copyToClipboard } from "../../../../lib/utils";
import { useUIStore } from "../../../../stores/ui.store";
import type { AvatarKindSetupPanelProps } from "../../contract";
import { vrmModelPrompt } from "./vrm-model-prompt";

/** Plain words for the values VRM 1.0 and 0.x files use in their terms; anything else shows as written. */
const TERM_KEYS: ReadonlyMap<string, string> = new Map([
  ["onlyAuthor", "avatars.vrm.terms.onlyAuthor"],
  ["OnlyAuthor", "avatars.vrm.terms.onlyAuthor"],
  ["onlySeparatelyLicensedPerson", "avatars.vrm.terms.licensedPeople"],
  ["ExplicitlyLicensedPerson", "avatars.vrm.terms.licensedPeople"],
  ["everyone", "avatars.vrm.terms.everyone"],
  ["Everyone", "avatars.vrm.terms.everyone"],
  ["personalNonProfit", "avatars.vrm.terms.personalNonProfit"],
  ["personalProfit", "avatars.vrm.terms.personalProfit"],
  ["corporation", "avatars.vrm.terms.corporation"],
  ["Allow", "avatars.vrm.terms.allowed"],
  ["Disallow", "avatars.vrm.terms.notAllowed"],
  ["prohibited", "avatars.vrm.terms.notAllowed"],
  ["allowModification", "avatars.vrm.terms.modifyNoSharing"],
  ["allowModificationRedistribution", "avatars.vrm.terms.modifyAndShare"],
  ["Redistribution_Prohibited", "avatars.vrm.terms.noRedistribution"],
  ["required", "avatars.vrm.terms.creditRequired"],
  ["unnecessary", "avatars.vrm.terms.creditUnnecessary"],
]);

/** `.vroid` is listed only so file pickers let a VRoid Studio project be chosen and explain how to export it. */
const MODEL_ACCEPT = ".vrm,.vroid";

const LINK_CLASS =
  "inline-flex min-h-11 items-center gap-1 text-[0.6875rem] font-medium text-[var(--primary)] underline-offset-2 hover:underline";

function isWebLink(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//iu.test(url);
}

const SOURCE_KEYS: Readonly<Record<AvatarExpressionBindingSource, string>> = {
  preset: "avatars.vrm.source.preset",
  "name-match": "avatars.vrm.source.nameMatch",
  "sprite-label": "avatars.vrm.source.nameMatch",
  user: "avatars.vrm.source.user",
  missing: "avatars.vrm.source.missing",
};

const BUTTON_CLASS =
  "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--background)] px-3 py-2 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="min-w-0 max-w-full space-y-3 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]">
      <div className="min-w-0">
        <h4 className="text-xs font-semibold text-[var(--foreground)]">{title}</h4>
        <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function FileButton({
  accept,
  label,
  busy,
  disabled,
  onFile,
}: {
  accept: string;
  label: string;
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} className={BUTTON_CLASS}>
        {busy ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
        {label}
      </button>
    </>
  );
}

function ModelTerms({ meta }: { meta: VrmModelMeta }) {
  const { t } = useTranslation();
  const term = (value: string | null) => {
    if (!value) return t("avatars.vrm.terms.notStated");
    const key = TERM_KEYS.get(value);
    return key ? t(key) : value.replaceAll("_", " ");
  };
  const rows: Array<[label: string, value: string]> = [
    [t("avatars.vrm.terms.avatarPermission"), term(meta.avatarPermission)],
    [t("avatars.vrm.terms.commercialUsage"), term(meta.commercialUsage)],
  ];
  if (meta.modification || !meta.licenseName) rows.push([t("avatars.vrm.terms.modification"), term(meta.modification)]);
  const flags: Array<[labelKey: string, value: boolean | null | undefined]> = [
    ["avatars.vrm.terms.redistribution", meta.allowRedistribution],
    ["avatars.vrm.terms.sexualUse", meta.allowSexualUse],
    ["avatars.vrm.terms.violentUse", meta.allowViolentUse],
    ["avatars.vrm.terms.politicalOrReligiousUse", meta.allowPoliticalOrReligiousUse],
    ["avatars.vrm.terms.antisocialOrHateUse", meta.allowAntisocialOrHateUse],
  ];
  for (const [labelKey, allowed] of flags) {
    if (typeof allowed !== "boolean") continue;
    rows.push([t(labelKey), t(allowed ? "avatars.vrm.terms.allowed" : "avatars.vrm.terms.notAllowed")]);
  }
  if (meta.creditNotation) rows.push([t("avatars.vrm.terms.credit"), term(meta.creditNotation)]);
  if (meta.licenseName) rows.push([t("avatars.vrm.terms.license"), term(meta.licenseName)]);
  const links: Array<[url: string, label: string]> = [];
  if (isWebLink(meta.licenseUrl)) links.push([meta.licenseUrl, t("avatars.vrm.terms.openLicense")]);
  if (isWebLink(meta.termsUrl) && meta.termsUrl !== meta.licenseUrl) {
    links.push([meta.termsUrl, t("avatars.vrm.terms.openAuthorTerms")]);
  }
  return (
    <div className="space-y-2 rounded-lg bg-[var(--background)]/70 p-3 ring-1 ring-[var(--border)]">
      <div>
        <p className="text-[0.6875rem] font-semibold text-[var(--foreground)]">{t("avatars.vrm.terms.title")}</p>
        <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {t("avatars.vrm.terms.description")}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-[0.6875rem] sm:grid-cols-[auto_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[var(--muted-foreground)]">{label}</dt>
            <dd className="mb-1 break-words text-[var(--foreground)] sm:mb-0">{value}</dd>
          </div>
        ))}
      </dl>
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-x-4">
          {links.map(([url, label]) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              {label}
              <ExternalLink size="0.6875rem" aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExpressionBindings({
  data,
  saving,
  onChange,
}: {
  data: VrmAvatarData;
  saving: boolean;
  onChange: (map: AvatarExpressionMap) => void;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const names = data.expressionNames ?? [];
  return (
    <div className="grid grid-cols-2 gap-2">
      {AVATAR_EXPRESSION_SLOTS.map((slot: AvatarExpressionSlot) => {
        const binding = data.expressionMap[slot];
        const target = binding?.target ?? "";
        const id = `${idPrefix}-${slot}`;
        return (
          <div key={slot} className="min-w-0 rounded-lg bg-[var(--background)]/70 p-2 ring-1 ring-[var(--border)]">
            <label htmlFor={id} className="block text-[0.6875rem] font-medium text-[var(--foreground)]">
              {t(`avatars.vrm.slot.${slot}`)}
            </label>
            <select
              id={id}
              value={target}
              disabled={saving}
              onChange={(event) =>
                onChange({
                  ...data.expressionMap,
                  [slot]: { target: event.target.value || null, source: "user", confidence: 1 },
                })
              }
              className="mt-1 min-h-11 w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60 pointer-coarse:text-base"
            >
              <option value="">{t("avatars.vrm.expressions.none")}</option>
              {target && !names.includes(target) ? <option value={target}>{target}</option> : null}
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {t(SOURCE_KEYS[binding?.source ?? "missing"])}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Where to get a model: VRoid Studio and the import above, the guide in docs/agents/avatars.md, and a prompt
 *  from the owner's look. */
function GetModelSection({ owner, hasModel }: { owner: AvatarOwnerRef; hasModel: boolean }) {
  const { t } = useTranslation();
  const character = useCharacter(owner.ownerType === "character" ? owner.ownerId : null);
  const persona = usePersona(owner.ownerType === "persona" ? owner.ownerId : null);
  const card = owner.ownerType === "character" ? character.data : persona.data;
  const copyPrompt = async () => {
    if (!card) return;
    if (await copyToClipboard(vrmModelPrompt(owner, card))) toast.success(t("avatars.vrm.getModel.copied"));
    else toast.error(t("avatars.vrm.getModel.copyFailed"));
  };
  return (
    <Section
      title={t("avatars.vrm.getModel.title")}
      description={t("avatars.vrm.getModel.vroid", {
        button: t(hasModel ? "avatars.vrm.replace" : "avatars.vrm.import"),
      })}
    >
      <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
        {t("avatars.vrm.getModel.description")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          // The guide's heading, which the docs viewer finds and scrolls to.
          onClick={() =>
            useUIStore
              .getState()
              .openModal("docs-viewer", { initialDoc: "agents/avatars.md", initialSearchTerm: "Get a 3D model" })
          }
          className={BUTTON_CLASS}
        >
          <BookOpen size="0.75rem" />
          {t("avatars.vrm.getModel.guide")}
        </button>
        <button type="button" disabled={!card} onClick={() => void copyPrompt()} className={BUTTON_CLASS}>
          <Copy size="0.75rem" />
          {t("avatars.vrm.getModel.copyPrompt")}
        </button>
      </div>
    </Section>
  );
}

export function VrmSetupPanel({ owner, config, onChanged }: AvatarKindSetupPanelProps) {
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState<string[]>([]);
  // A change shows at once; it is dropped when the saved config arrives (a new data object) or the save fails.
  const [pending, setPending] = useState<{ base: VrmAvatarData; data: VrmAvatarData } | null>(null);
  // Toasts are given to the hook, so a result still shows after the user switches owner or leaves the page.
  const {
    save: saveData,
    importFile,
    remove: removeModel,
  } = useAvatarModelActions(owner, onChanged, {
    importFile: {
      onSuccess: (result, { file }) => {
        setWarnings(result.warnings);
        toast.success(t(/\.vrma$/iu.test(file.name) ? "avatars.vrm.idle.added" : "avatars.vrm.imported"));
      },
      onError: (error) => toast.error(errorMessage(error, t("avatars.vrm.importFailed"))),
    },
    save: {
      onError: (error) => {
        setPending(null);
        toast.error(errorMessage(error, t("avatars.vrm.saveFailed")));
      },
    },
    remove: {
      onSuccess: () => {
        setWarnings([]);
        toast.success(t("avatars.vrm.removed"));
      },
      onError: (error) => toast.error(errorMessage(error, t("avatars.vrm.removeFailed"))),
    },
  });
  const stored = config?.kinds.vrm ?? null;
  const data = pending && pending.base === stored ? pending.data : stored;

  const importVrmFile = (file: File) => {
    // VRoid Studio saves its projects as .vroid; only the .vrm it exports can be imported.
    if (/\.vroid$/iu.test(file.name)) {
      toast.error(t("avatars.vrm.vroidProject"));
      return;
    }
    importFile.mutate({ kind: "vrm", file });
  };

  const busy = importFile.isPending || saveData.isPending || removeModel.isPending;
  const save = (next: VrmAvatarData) => {
    if (stored) setPending({ base: stored, data: next });
    saveData.mutate({ kinds: { vrm: next } });
  };
  const confirmRemove = async () => {
    const confirmed = await showConfirmDialog({
      title: t("avatars.vrm.removeConfirm.title"),
      message: t("avatars.vrm.removeConfirm.message"),
      confirmLabel: t("avatars.vrm.remove"),
      tone: "destructive",
    });
    if (confirmed) removeModel.mutate("vrm");
  };

  const warningList =
    warnings.length > 0 ? (
      <ul className="space-y-1">
        {warnings.map((warning) => (
          <li
            key={warning}
            className="flex items-start gap-1.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]"
          >
            <Info
              size="0.75rem"
              className="mt-px shrink-0 text-[var(--marinara-app-accent-static)]"
              aria-hidden="true"
            />
            <span>{warning}</span>
          </li>
        ))}
      </ul>
    ) : null;

  if (!data) {
    return (
      <div className="min-w-0 max-w-full space-y-3">
        <Section title={t("avatars.vrm.title")} description={t("avatars.vrm.description")}>
          <div className="flex flex-wrap gap-2">
            <FileButton
              accept={MODEL_ACCEPT}
              label={t("avatars.vrm.import")}
              busy={importFile.isPending}
              disabled={busy}
              onFile={importVrmFile}
            />
          </div>
          {warningList}
        </Section>
        <GetModelSection owner={owner} hasModel={!!data} />
      </div>
    );
  }

  const meta = data.meta ?? null;
  const authors = meta?.authors.join(", ");
  return (
    <div className="min-w-0 max-w-full space-y-3">
      <Section title={t("avatars.vrm.title")} description={t("avatars.vrm.description")}>
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-[var(--foreground)]">
            {meta?.title ?? t("avatars.vrm.untitled")}
          </p>
          <p className="break-words text-[0.6875rem] text-[var(--muted-foreground)]">
            {authors
              ? t("avatars.vrm.versionBy", { version: data.specVersion, authors })
              : t("avatars.vrm.version", { version: data.specVersion })}
          </p>
        </div>
        {meta ? <ModelTerms meta={meta} /> : null}
        <div className="flex flex-wrap gap-2">
          <FileButton
            accept={MODEL_ACCEPT}
            label={t("avatars.vrm.replace")}
            busy={importFile.isPending}
            disabled={busy}
            onFile={importVrmFile}
          />
          <button type="button" disabled={busy} onClick={() => void confirmRemove()} className={BUTTON_CLASS}>
            {removeModel.isPending ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
            )}
            {t("avatars.vrm.remove")}
          </button>
        </div>
        {warningList}
      </Section>
      <GetModelSection owner={owner} hasModel={!!data} />

      {data.expressionNames?.length === 0 ? (
        // Nothing to pick: the model has no face expressions at all.
        <Section title={t("avatars.vrm.expressions.title")} description={t("avatars.vrm.bodyOnlyHelp")}>
          <p className="text-xs font-medium text-[var(--foreground)]" data-vrm-body-only>
            {t("avatars.vrm.bodyOnly")}
          </p>
        </Section>
      ) : data.expressionNames ? (
        <Section title={t("avatars.vrm.expressions.title")} description={t("avatars.vrm.expressions.description")}>
          <ExpressionBindings
            data={data}
            saving={busy}
            onChange={(expressionMap) => save({ ...data, expressionMap })}
          />
        </Section>
      ) : null}

      <Section title={t("avatars.vrm.idle.title")} description={t("avatars.vrm.idle.description")}>
        <p className="text-[0.6875rem] text-[var(--foreground)]">
          {t(data.idleAnimation ? "avatars.vrm.idle.custom" : "avatars.vrm.idle.builtIn")}
        </p>
        <div className="flex flex-wrap gap-2">
          <FileButton
            accept=".vrma"
            label={t(data.idleAnimation ? "avatars.vrm.idle.replace" : "avatars.vrm.idle.add")}
            busy={importFile.isPending}
            disabled={busy}
            // The server tells a model from an animation by content, so a .vrm picked here would replace the
            // model; some phone pickers ignore `accept` and show every file.
            onFile={(file) =>
              /\.vrma$/iu.test(file.name) ? importVrmFile(file) : toast.error(t("avatars.vrm.idle.notAnimation"))
            }
          />
          {data.idleAnimation ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ ...data, idleAnimation: null })}
              className={BUTTON_CLASS}
            >
              <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
              {t("avatars.vrm.idle.remove")}
            </button>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
