import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, SlidersHorizontal, Users } from "lucide-react";
import type { NoodleIdentityDisclosure, NoodlerRefreshNowOutcome } from "@marinara-engine/shared";
import { defaultNoodlerOnboardingSelection } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  useBulkCreateNoodlerStageProfiles,
  useNoodle,
  useNoodlerEligibleAccounts,
  useRefreshTargetedNoodlerCreatorsNow,
  useUpdateNoodleSettings,
} from "../../hooks/use-noodle";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "./NoodleShell";
import { NoodlerTeachingPostCard } from "./NoodlerPostCard";

type Step = 1 | 2 | 3 | 4 | 5;
type CompletionKind = "declined" | "generated" | "partial" | "failed" | "zero";

const DISCLOSURES: NoodleIdentityDisclosure[] = ["open", "hinted", "secret"];

interface WizardProps {
  open: boolean;
  selectionOnly?: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

function disclosureLabel(value: NoodleIdentityDisclosure, t: ReturnType<typeof useUiTranslation>["t"]) {
  return t(`ui.noodle.noodlerwizard.disclosure.${value}.title`);
}

export function NoodlerOnboardingWizard({ open, selectionOnly = false, onClose, onComplete }: WizardProps) {
  const { t } = useUiTranslation();
  const { data } = useNoodle(open);
  const eligible = useNoodlerEligibleAccounts("", "character", open);
  const bulkCreate = useBulkCreateNoodlerStageProfiles();
  const updateSettings = useUpdateNoodleSettings();
  const refreshTargeted = useRefreshTargetedNoodlerCreatorsNow();
  const accounts = useMemo(() => eligible.data?.pages.flatMap((page) => page.items) ?? [], [eligible.data?.pages]);
  const [step, setStep] = useState<Step>(1);
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [disclosure, setDisclosure] = useState<NoodleIdentityDisclosure>("hinted");
  const [exceptions, setExceptions] = useState<Record<string, NoodleIdentityDisclosure>>({});
  const [postsPerDay, setPostsPerDay] = useState(4);
  const [nightQuiet, setNightQuiet] = useState(true);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [generateNow, setGenerateNow] = useState(true);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [creationFailures, setCreationFailures] = useState(0);
  const [outcomes, setOutcomes] = useState<NoodlerRefreshNowOutcome[]>([]);
  const [completion, setCompletion] = useState<CompletionKind | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setAdvanced(false);
    setSelected(new Set());
    setSelectionInitialized(false);
    setDisclosure("hinted");
    setExceptions({});
    setImagesEnabled(false);
    setGenerateNow(true);
    setCreatedIds([]);
    setCreationFailures(0);
    setOutcomes([]);
    setCompletion(null);
  }, [open]);

  useEffect(() => {
    if (!open || !data?.settings) return;
    setPostsPerDay(data.settings.postsPerDay);
    setNightQuiet(data.settings.noodlerNightQuiet);
  }, [data?.settings, open]);

  useEffect(() => {
    if (!open || eligible.isFetching || !eligible.hasNextPage) return;
    void eligible.fetchNextPage();
  }, [eligible, open]);

  useEffect(() => {
    if (!open || selectionInitialized || eligible.isLoading || eligible.hasNextPage) return;
    setSelected(new Set(defaultNoodlerOnboardingSelection(accounts.map((account) => account.id))));
    setSelectionInitialized(true);
  }, [accounts, eligible.hasNextPage, eligible.isLoading, open, selectionInitialized]);

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const failedIds = outcomes.filter((outcome) => outcome.status !== "generated").map((outcome) => outcome.accountId);
  const failedCount = creationFailures + failedIds.length;
  const generatedCount = outcomes.filter((outcome) => outcome.status === "generated").length;
  const finalizeOutcomes = (next: NoodlerRefreshNowOutcome[], createFailures = creationFailures) => {
    setOutcomes(next);
    const succeeded = next.filter((outcome) => outcome.status === "generated").length;
    setCompletion(
      succeeded === next.length && createFailures === 0 ? "generated" : succeeded > 0 ? "partial" : "failed",
    );
    setStep(5);
  };
  const runGeneration = async (ids: string[], createFailures = creationFailures) => {
    const result = await refreshTargeted.mutateAsync(ids);
    const retriedIds = new Set(ids);
    const merged = [...outcomes.filter((outcome) => !retriedIds.has(outcome.accountId)), ...result.outcomes];
    finalizeOutcomes(merged, createFailures);
  };
  const finish = async () => {
    let newIds: string[] = [];
    let createFailureCount = 0;
    try {
      if (selected.size > 0) {
        const result = await bulkCreate.mutateAsync({
          noodleAccountIds: [...selected],
          disclosureMode: disclosure,
          disclosureExceptions: exceptions,
          autoPosting: { enabled: true, imagesEnabled },
        });
        newIds = result.created.map((profile) => profile.id);
        setCreatedIds(newIds);
        createFailureCount = result.skipped.length + (result.failed?.length ?? 0);
        setCreationFailures(createFailureCount);
      }
      if (!selectionOnly) {
        await updateSettings.mutateAsync({
          postsPerDay,
          noodlerNightQuiet: nightQuiet,
          noodlerOnboardingComplete: true,
        });
      }
      if (newIds.length === 0) {
        setCompletion(selected.size === 0 ? "zero" : "failed");
        setStep(5);
      } else if (!generateNow || selectionOnly) {
        setCompletion("declined");
        setStep(5);
      } else {
        const result = await refreshTargeted.mutateAsync(newIds);
        finalizeOutcomes(result.outcomes, createFailureCount);
      }
      onComplete?.();
    } catch {
      if (!selectionOnly) await updateSettings.mutateAsync({ noodlerOnboardingComplete: true });
      setCompletion("failed");
      setStep(5);
      onComplete?.();
    }
  };
  const pending = bulkCreate.isPending || updateSettings.isPending || refreshTargeted.isPending;
  const summaries = selectionOnly
    ? [
        {
          step: 1 as Step,
          label: t("ui.noodle.noodlerwizard.characters"),
          value: t("ui.noodle.noodlerwizard.selectedCount", { count: selected.size }),
        },
      ]
    : [
        {
          step: 1 as Step,
          label: t("ui.noodle.noodlerwizard.characters"),
          value: t("ui.noodle.noodlerwizard.selectedCount", { count: selected.size }),
        },
        {
          step: 2 as Step,
          label: t("ui.noodle.noodlerwizard.disclosure.title"),
          value: disclosureLabel(disclosure, t),
        },
        {
          step: 3 as Step,
          label: t("ui.noodle.noodlerwizard.activity"),
          value: t("ui.noodle.noodlerwizard.postsSummary", { count: postsPerDay }),
        },
        {
          step: 4 as Step,
          label: t("ui.noodle.noodlerwizard.images"),
          value: imagesEnabled ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off"),
        },
      ];

  return (
    <Modal
      open={open}
      onClose={selectionOnly || completion ? onClose : () => {}}
      title={selectionOnly ? t("ui.noodle.noodlerwizard.addCreators") : t("ui.noodle.noodlerwizard.title")}
      width="max-w-2xl"
      panelStyle={getNoodleAccentStyle(NOODLE_PINK)}
    >
      <div className="flex max-h-[min(78vh,46rem)] min-h-[30rem] flex-col">
        {step < 5 && (
          <div className="border-b border-[var(--border)] pb-3">
            <div className="grid gap-1 sm:grid-cols-2">
              {summaries.map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setStep(item.step)}
                  className={cn(
                    "flex min-h-10 items-center justify-between rounded-md px-2.5 text-left text-xs",
                    step === item.step
                      ? "bg-[var(--noodle-accent)]/12 ring-1 ring-[var(--noodle-accent)]/35"
                      : "hover:bg-[var(--accent)]",
                  )}
                >
                  <span className="font-semibold">
                    {item.step}. {item.label}
                  </span>
                  <span className="ml-2 truncate text-[var(--muted-foreground)]">{item.value}</span>
                </button>
              ))}
            </div>
            {!selectionOnly && (
              <button
                type="button"
                onClick={() => setAdvanced((value) => !value)}
                className="mt-2 flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[var(--noodle-accent)]"
              >
                <SlidersHorizontal size={14} />
                {advanced ? t("ui.noodle.noodlerwizard.simple") : t("ui.noodle.noodlerwizard.advanced")}
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {step === 1 && (
            <div className="space-y-4">
              {!selectionOnly && (
                <>
                  <div>
                    <h3 className="text-base font-bold">{t("ui.noodle.noodlerwizard.teachingTitle")}</h3>
                    <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--muted-foreground)]">
                      {t("ui.noodle.noodlerwizard.teachingIntro")}
                    </p>
                  </div>
                  <NoodlerTeachingPostCard
                    author={t("ui.noodle.noodlerwizard.mariName")}
                    handle="professor_mari"
                    avatarUrl="/sprites/mari/chibi-professor-mari.png"
                    body={t("ui.noodle.noodlerwizard.mariPost")}
                    lockedLabel={t("ui.noodle.noodlerwizard.locked")}
                    unlockLabel={t("ui.noodle.noodlerwizard.unlockExample")}
                  />
                </>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">{t("ui.noodle.noodlerwizard.chooseCharacters")}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">{t("ui.noodle.noodlerwizard.selectionRule")}</p>
                </div>
                {accounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        new Set(selected.size === accounts.length ? [] : accounts.map((account) => account.id)),
                      )
                    }
                    className="shrink-0 text-xs font-bold text-[var(--noodle-accent)]"
                  >
                    {selected.size === accounts.length
                      ? t("ui.noodle.noodlerwizard.selectNone")
                      : t("ui.noodle.noodlerwizard.selectAll")}
                  </button>
                )}
              </div>
              {eligible.isLoading || eligible.hasNextPage ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin" />
                  <span className="sr-only">{t("ui.noodle.noodlerwizard.loadingCharacters")}</span>
                </div>
              ) : eligible.isError ? (
                <button
                  type="button"
                  onClick={() => void eligible.refetch()}
                  className="text-sm font-semibold text-[var(--noodle-accent)]"
                >
                  {t("capabilities.actions.tryAgain")}
                </button>
              ) : accounts.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                  {t("ui.noodle.noodlerwizard.zeroEligible")}
                </p>
              ) : (
                <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleSelected(account.id)}
                      className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-[var(--accent)]"
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded border",
                          selected.has(account.id)
                            ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)] text-zinc-950"
                            : "border-[var(--border)]",
                        )}
                      >
                        {selected.has(account.id) && <Check size={13} />}
                      </span>
                      <Avatar
                        account={{
                          displayName: account.displayName,
                          avatarUrl: account.avatarUrl,
                          avatarCrop: account.avatarCrop,
                        }}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{account.displayName}</span>
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">@{account.handle}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && !selectionOnly && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold">{t("ui.noodle.noodlerwizard.disclosure.question")}</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {t("ui.noodle.noodlerwizard.disclosure.help")}
                </p>
              </div>
              {!advanced ? (
                <CompactChoice
                  label={disclosureLabel(disclosure, t)}
                  detail={t(`ui.noodle.noodlerwizard.disclosure.${disclosure}.detail`)}
                  changeLabel={t("ui.noodle.noodlerwizard.change")}
                  onChange={() => setAdvanced(true)}
                />
              ) : (
                <div className="space-y-2">
                {DISCLOSURES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDisclosure(value)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left",
                      disclosure === value
                        ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                        : "border-[var(--border)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <span className="block text-sm font-bold">
                      {t(`ui.noodle.noodlerwizard.disclosure.${value}.title`)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">
                      {t(`ui.noodle.noodlerwizard.disclosure.${value}.detail`)}
                    </span>
                  </button>
                ))}
                </div>
              )}
              {advanced && selected.size > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-bold">{t("ui.noodle.noodlerwizard.exceptions")}</h4>
                  <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                    {accounts
                      .filter((account) => selected.has(account.id))
                      .map((account) => (
                        <label key={account.id} className="flex min-h-11 items-center gap-3 px-3 text-xs">
                          <span className="min-w-0 flex-1 truncate font-semibold">{account.displayName}</span>
                          <select
                            value={exceptions[account.id] ?? disclosure}
                            onChange={(event) =>
                              setExceptions((current) => ({
                                ...current,
                                [account.id]: event.target.value as NoodleIdentityDisclosure,
                              }))
                            }
                            className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2"
                          >
                            {DISCLOSURES.map((value) => (
                              <option key={value} value={value}>
                                {disclosureLabel(value, t)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && !selectionOnly && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold">{t("ui.noodle.noodlerwizard.activity")}</h3>
                <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--muted-foreground)]">
                  {t("ui.noodle.noodlerwizard.activityHelp")}
                </p>
              </div>
              {!advanced ? (
                <CompactChoice
                  label={t("ui.noodle.noodlerwizard.postsSummary", { count: postsPerDay })}
                  detail={nightQuiet ? t("ui.noodle.noodlerwizard.nightQuietOn") : t("ui.noodle.noodlerwizard.nightQuietOff")}
                  changeLabel={t("ui.noodle.noodlerwizard.change")}
                  onChange={() => setAdvanced(true)}
                />
              ) : (
                <>
              <label className="block text-sm font-semibold">
                {t("ui.noodle.noodlerwizard.postsPerDay")}
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={postsPerDay}
                  onChange={(event) => setPostsPerDay(Math.max(1, Math.min(24, Number(event.target.value) || 1)))}
                  className="mt-2 h-11 w-28 rounded-md border border-[var(--border)] bg-[var(--background)] px-3"
                />
              </label>
                </>
              )}
              <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--border)] px-3">
                <input
                  type="checkbox"
                  checked={nightQuiet}
                  onChange={(event) => setNightQuiet(event.target.checked)}
                  className="h-4 w-4 accent-[var(--noodle-accent)]"
                />
                <span>
                  <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.nightQuiet")}</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    {t("ui.noodle.noodlerwizard.nightQuietHelp")}
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 4 && !selectionOnly && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold">{t("ui.noodle.noodlerwizard.images")}</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("ui.noodle.noodlerwizard.imagesHelp")}</p>
              </div>
              {!advanced ? (
                <CompactChoice
                  label={imagesEnabled ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off")}
                  detail={t("ui.noodle.noodlerwizard.imagesCost")}
                  changeLabel={t("ui.noodle.noodlerwizard.change")}
                  onChange={() => setAdvanced(true)}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                {[false, true].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setImagesEnabled(value)}
                    className={cn(
                      "min-h-11 rounded-md border text-sm font-bold",
                      imagesEnabled === value
                        ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                        : "border-[var(--border)]",
                    )}
                  >
                    {value ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off")}
                  </button>
                ))}
                </div>
              )}
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-bold">{t("ui.noodle.noodlerwizard.providerCountsTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {t("ui.noodle.noodlerwizard.setupCount", { count: selected.size })}
                  <br />
                  {imagesEnabled
                    ? t("ui.noodle.noodlerwizard.recurringCountImages", { count: postsPerDay })
                    : t("ui.noodle.noodlerwizard.recurringCount", { count: postsPerDay })}
                </p>
                <label className="mt-3 flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={generateNow}
                    onChange={(event) => setGenerateNow(event.target.checked)}
                    className="h-4 w-4 accent-[var(--noodle-accent)]"
                  />
                  <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.generateNow")}</span>
                </label>
              </div>
            </div>
          )}

          {step === 5 && completion && (
            <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
                {completion === "generated" ? (
                  <Check size={24} />
                ) : completion === "partial" || completion === "failed" ? (
                  <RefreshCw size={22} />
                ) : (
                  <Users size={22} />
                )}
              </div>
              <h3 className="mt-4 text-lg font-bold">{t(`ui.noodle.noodlerwizard.completion.${completion}.title`)}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
                {t(`ui.noodle.noodlerwizard.completion.${completion}.detail`, {
                  created: createdIds.length,
                  generated: generatedCount,
                failed: failedCount,
                })}
              </p>
              {failedIds.length > 0 && (
                <button
                  type="button"
                  disabled={refreshTargeted.isPending}
                  onClick={() => void runGeneration(failedIds)}
                  className="mt-4 flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 px-4 text-sm font-bold text-[var(--noodle-accent)]"
                >
                  <RefreshCw size={15} className={refreshTargeted.isPending ? "animate-spin" : ""} />
                  {t("ui.noodle.noodlerwizard.retryFailed")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          {step > 1 && step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as Step)}
              className="flex min-h-10 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-sm font-bold"
            >
              <ChevronLeft size={15} />
              {t("ui.noodle.noodlerwizard.back")}
            </button>
          ) : (
            <span />
          )}
          {step < 5 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => (step === (selectionOnly ? 1 : 4) ? void finish() : setStep((step + 1) as Step))}
              className="flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 disabled:opacity-50"
            >
              {pending && <Loader2 size={15} className="animate-spin" />}
              {step === (selectionOnly ? 1 : 4)
                ? t("ui.noodle.noodlerwizard.create")
                : t("ui.noodle.noodlerwizard.continue")}{" "}
              {!pending && step !== (selectionOnly ? 1 : 4) && <ChevronRight size={15} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-md bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950"
            >
              {t("ui.noodle.noodlerwizard.openAllCreators")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CompactChoice({
  label,
  detail,
  changeLabel,
  onChange,
}: {
  label: string;
  detail: string;
  changeLabel: string;
  onChange: () => void;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-md border border-[var(--border)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>
      </div>
      <button type="button" onClick={onChange} className="min-h-9 shrink-0 px-2 text-xs font-bold text-[var(--noodle-accent)]">
        {changeLabel}
      </button>
    </div>
  );
}
