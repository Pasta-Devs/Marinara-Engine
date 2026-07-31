import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  NoodleIdentityDisclosure,
  NoodlerRefreshNowOutcome,
  NoodlerPostView,
  NoodlerStageProfile,
} from "@marinara-engine/shared";
import { NOODLER_POSTS_PER_DAY_MAX, resolveNoodlerOnboardingCompletion } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  useBulkCreateNoodlerStageProfiles,
  useNoodle,
  useNoodlerEligibleAccounts,
  useRefreshTargetedNoodlerCreatorsNow,
  useUpdateNoodleSettings,
} from "../../hooks/use-noodle";
import { cn, generateClientId } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "./NoodleShell";
import { LockedNoodlerPostCard } from "./NoodlerPostCard";

type Step = 1 | 2 | 3 | 4 | 5;
/** The teaching screens that run ahead of the numbered steps on first run. */
type Intro = 0 | 1 | 2 | 3 | null;
type SetupLane = "easy" | "customize" | null;
const LAST_INTRO = 3;
type CompletionKind = "declined" | "generated" | "partial" | "failed" | "zero";
type ActivityChoice = "manual" | "occasional" | "lively" | "veryActive";

const DISCLOSURES: NoodleIdentityDisclosure[] = ["open", "hinted", "secret"];

// The intro uses the real locked post card for a staged walkthrough. Mari is demonstrating
// the interaction, so the example stays independent from the identity choice above.
const DEMO_PROFILE: NoodlerStageProfile = {
  id: "onboarding-demo",
  noodleAccountId: null,
  handle: "professor_mari",
  displayName: "Professor Mari",
  bio: "",
  avatarUrl: "/sprites/mari/chibi-professor-mari.png",
  avatarCrop: null,
  disclosureMode: "open",
  stagePersonality: "",
  publicIdentity: null,
  createdAt: "",
  updatedAt: "",
};
const DEMO_POST: Pick<NoodlerPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
  Partial<Pick<NoodlerPostView, "likeCount" | "replyCount">> = {
  id: "onboarding-demo-post",
  access: "locked",
  createdAt: new Date().toISOString(),
  title: null,
  // Pre-blurred teaser: the locked card is what the user is being taught to recognise, so the demo
  // image must read as "paywalled" even outside the card's own blur treatment. Unlocking swaps in
  // the payoff image (see `unlockedImageUrl` below) rather than sharpening this one.
  imageUrl: "/sprites/mari/Mari_noodler_teaser_locked.webp",
  likeCount: 12,
  replyCount: 3,
};

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
  const [intro, setIntro] = useState<Intro>(selectionOnly ? null : 0);
  const [setupLane, setSetupLane] = useState<SetupLane>(selectionOnly ? "easy" : null);
  const [postExplored, setPostExplored] = useState(false);
  const [activityChoice, setActivityChoice] = useState<ActivityChoice>("lively");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [disclosure, setDisclosure] = useState<NoodleIdentityDisclosure>("hinted");
  const [exceptions, setExceptions] = useState<Record<string, NoodleIdentityDisclosure>>({});
  const [autoPostingEnabled, setAutoPostingEnabled] = useState(true);
  const [postsPerDay, setPostsPerDay] = useState(4);
  const [nightQuiet, setNightQuiet] = useState(true);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [generateNow, setGenerateNow] = useState(true);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [creationFailures, setCreationFailures] = useState(0);
  const [outcomes, setOutcomes] = useState<NoodlerRefreshNowOutcome[]>([]);
  const [completion, setCompletion] = useState<CompletionKind | null>(null);
  const [executionId, setExecutionId] = useState("");
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const demoProfile: NoodlerStageProfile = {
    ...DEMO_PROFILE,
    displayName:
      disclosure === "open"
        ? t("ui.noodle.noodlerwizard.identityPreview.openName")
        : disclosure === "hinted"
          ? t("ui.noodle.noodlerwizard.identityPreview.hintedName")
          : t("ui.noodle.noodlerwizard.identityPreview.secretName"),
    handle:
      disclosure === "open"
        ? t("ui.noodle.noodlerwizard.identityPreview.openHandle")
        : disclosure === "hinted"
          ? t("ui.noodle.noodlerwizard.identityPreview.hintedHandle")
          : t("ui.noodle.noodlerwizard.identityPreview.secretHandle"),
    avatarUrl: disclosure === "secret" ? null : "/sprites/mari/chibi-professor-mari.png",
    disclosureMode: disclosure,
  };

  useEffect(() => {
    if (completion) completionHeadingRef.current?.focus();
  }, [completion]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setIntro(selectionOnly ? null : 0);
    setSetupLane(selectionOnly ? "easy" : null);
    setPostExplored(false);
    setActivityChoice("lively");
    setSelected(new Set());
    setSelectionInitialized(false);
    setDisclosure("hinted");
    setExceptions({});
    setAutoPostingEnabled(true);
    setImagesEnabled(false);
    setGenerateNow(true);
    setCreatedIds([]);
    setCreationFailures(0);
    setOutcomes([]);
    setCompletion(null);
    setExecutionId(generateClientId());
  }, [open, selectionOnly]);

  useEffect(() => {
    if (!open || !data?.settings) return;
    setPostsPerDay(data.settings.postsPerDay);
    setNightQuiet(data.settings.noodlerNightQuiet);
  }, [data?.settings, open]);

  const { fetchNextPage, hasNextPage, isFetching } = eligible;
  useEffect(() => {
    if (!open || isFetching || !hasNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetching, open]);

  useEffect(() => {
    if (!open || selectionInitialized || eligible.isLoading || eligible.hasNextPage) return;
    setSelected(new Set());
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
  const chooseActivity = (choice: ActivityChoice) => {
    setActivityChoice(choice);
    if (choice === "manual") {
      setAutoPostingEnabled(false);
      return;
    }
    setAutoPostingEnabled(true);
    setPostsPerDay(choice === "occasional" ? 2 : choice === "veryActive" ? 8 : 4);
  };
  const failedIds = outcomes.filter((outcome) => outcome.status !== "generated").map((outcome) => outcome.accountId);
  const failedCount = creationFailures + failedIds.length;
  const generatedCount = outcomes.filter((outcome) => outcome.status === "generated").length;
  const finalizeOutcomes = (
    next: NoodlerRefreshNowOutcome[],
    createFailures = creationFailures,
    createdCount = createdIds.length,
  ) => {
    setOutcomes(next);
    setCompletion(
      resolveNoodlerOnboardingCompletion({
        selectedCount: selected.size,
        createdCount,
        createFailures,
        outcomes: next,
      }),
    );
    setStep(5);
  };
  const runGeneration = async (ids: string[], createFailures = creationFailures) => {
    const result = await refreshTargeted.mutateAsync({ accountIds: ids, executionId });
    const retriedIds = new Set(ids);
    const merged = [...outcomes.filter((outcome) => !retriedIds.has(outcome.accountId)), ...result.outcomes];
    finalizeOutcomes(merged, createFailures);
  };
  // Settings are recoverable from the settings panel, so a failure here must not block the
  // rest of the flow — but it must also never be the reason onboarding counts as done.
  const saveSettings = async (state: "zero" | "completed") => {
    if (selectionOnly) return true;
    try {
      await updateSettings.mutateAsync({
        postsPerDay,
        noodlerNightQuiet: nightQuiet,
        noodlerOnboardingComplete: true,
        noodlerOnboardingState: state,
      });
      return true;
    } catch {
      return false;
    }
  };
  const skip = async () => {
    if (await saveSettings("zero")) onClose();
  };
  const finish = async () => {
    let newIds: string[] = [];
    let createFailureCount = 0;
    try {
      {
        const result = await bulkCreate.mutateAsync({
          noodleAccountIds: [...selected],
          executionId,
          disclosureMode: disclosure,
          disclosureExceptions: exceptions,
          autoPosting: { enabled: autoPostingEnabled, imagesEnabled },
        });
        newIds = result.created.map((profile) => profile.id);
        setCreatedIds(newIds);
        createFailureCount = result.skipped.length + (result.failed?.length ?? 0);
        setCreationFailures(createFailureCount);
      }
    } catch {
      // Nothing was created, so onboarding stays incomplete and the wizard remains reachable.
      setCompletion("failed");
      setStep(5);
      return;
    }
    if (!(await saveSettings(selected.size === 0 ? "zero" : "completed"))) {
      setCompletion("failed");
      setStep(5);
      return;
    }
    onComplete?.();
    if (newIds.length === 0 || !generateNow) {
      setCompletion(
        resolveNoodlerOnboardingCompletion({
          selectedCount: selected.size,
          createdCount: newIds.length,
          createFailures: createFailureCount,
          outcomes: null,
        }),
      );
      setStep(5);
      return;
    }
    try {
      const result = await refreshTargeted.mutateAsync({ accountIds: newIds, executionId });
      finalizeOutcomes(result.outcomes, createFailureCount, newIds.length);
    } catch {
      // The profiles exist; only generation fell over, so every one of them is retryable.
      finalizeOutcomes(
        newIds.map((accountId) => ({ accountId, status: "error" as const })),
        createFailureCount,
        newIds.length,
      );
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
    : setupLane === "easy"
      ? [
          {
            step: 1 as Step,
            label: t("ui.noodle.noodlerwizard.characters"),
            value: t("ui.noodle.noodlerwizard.selectedCount", { count: selected.size }),
          },
          {
            step: 4 as Step,
            label: t("ui.noodle.noodlerwizard.review"),
            value: t("ui.noodle.noodlerwizard.readyToCreate"),
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
            value: autoPostingEnabled
              ? t("ui.noodle.noodlerwizard.postsSummary", { count: postsPerDay })
              : t("ui.noodle.noodlerwizard.manualOnly"),
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
      onClose={selectionOnly || completion ? onClose : () => void skip()}
      closeDisabled={pending}
      title={selectionOnly ? t("ui.noodle.noodlerwizard.addCreators") : t("ui.noodle.noodlerwizard.title")}
      width="max-w-3xl"
      mobileFullscreen
      contentClassName="max-sm:flex max-sm:flex-col max-sm:overflow-hidden max-sm:px-4 max-sm:py-2"
      panelStyle={getNoodleAccentStyle(NOODLE_PINK)}
    >
      <div className="flex max-h-[min(78vh,46rem)] min-h-[26rem] flex-col max-sm:min-h-0 max-sm:max-h-none max-sm:flex-1 max-sm:self-stretch">
        {intro !== null && (
          <div
            className="flex items-center gap-2 border-b border-[var(--border)] pb-3 max-sm:gap-1.5 max-sm:pb-2"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  dot === intro ? "w-6 bg-[var(--noodle-accent)]" : "w-1.5 bg-[var(--border)]",
                )}
              />
            ))}
          </div>
        )}
        {intro === null && setupLane !== null && step < 5 && (
          <div className="border-b border-[var(--border)] pb-3 max-sm:pb-1.5">
            {/* Progress rail: done steps stay reachable, later ones stay locked until you get there. */}
            <ol className="flex gap-1.5">
              {summaries.map((item) => {
                const reachable = item.step <= step;
                return (
                  <li key={item.step} className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!reachable}
                      aria-current={step === item.step ? "step" : undefined}
                      onClick={() => setStep(item.step)}
                      className={cn(
                        "w-full min-w-0 rounded-md px-2 pb-1.5 pt-2 text-left transition-colors max-sm:px-1 max-sm:pb-1 max-sm:pt-1.5",
                        reachable ? "hover:bg-[var(--accent)]" : "cursor-default opacity-45",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-1 rounded-full transition-colors",
                          step === item.step
                            ? "bg-[var(--noodle-accent)]"
                            : item.step < step
                              ? "bg-[var(--noodle-accent)]/45"
                              : "bg-[var(--border)]",
                        )}
                      />
                      <span className="mt-1.5 block truncate text-[0.7rem] font-bold max-sm:mt-1">{item.label}</span>
                      <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)] max-sm:hidden">
                        {item.value}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto py-4 max-sm:py-2.5">
          {intro === 0 && (
            <div className="space-y-4 max-sm:space-y-3">
              <StepHeading
                icon={<Sparkles size={18} />}
                title={t("ui.noodle.noodlerwizard.intro.welcome.title")}
                help={t("ui.noodle.noodlerwizard.intro.welcome.help")}
              />
              <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--accent)]/25 p-4 max-sm:items-start max-sm:gap-3 max-sm:p-3">
                <img
                  src="/sprites/mari/Mari_wave.png"
                  alt=""
                  className="h-36 w-auto shrink-0 object-contain max-sm:h-24"
                />
                <div className="space-y-3 text-sm leading-6 max-sm:space-y-1.5 max-sm:leading-5">
                  <p className="font-semibold">{t("ui.noodle.noodlerwizard.intro.welcome.lead")}</p>
                  <p className="text-[var(--muted-foreground)]">{t("ui.noodle.noodlerwizard.intro.welcome.detail")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 px-3 py-2 text-xs leading-5 text-[var(--muted-foreground)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--noodle-accent)]" />
                <p>{t("ui.noodle.noodlehome.noodlerIsStillBeingImplementedAndIsNotUsable")}</p>
              </div>
            </div>
          )}

          {intro === 1 && (
            <div className="space-y-4 max-sm:space-y-3">
              <StepHeading
                icon={<Eye size={18} />}
                title={t("ui.noodle.noodlerwizard.intro.identity.title")}
                help={t("ui.noodle.noodlerwizard.intro.identity.help")}
              />
              <div className="grid gap-3 max-sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent)]/25 p-4 text-center max-sm:p-2">
                  <Avatar
                    account={{
                      displayName: demoProfile.displayName,
                      avatarUrl: demoProfile.avatarUrl,
                      avatarCrop: demoProfile.avatarCrop,
                    }}
                    size="lg"
                  />
                  <p className="mt-3 font-bold max-sm:mt-2 max-sm:text-xs">{demoProfile.displayName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">@{demoProfile.handle}</p>
                  <p className="mt-2 text-xs font-semibold text-[var(--noodle-accent)] max-sm:mt-1 max-sm:text-[0.625rem]">
                    {t(`ui.noodle.noodlerwizard.identityPreview.${disclosure}.connection`)}
                  </p>
                </div>
                <div className="space-y-2">
                  {DISCLOSURES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setDisclosure(value);
                        setPostExplored(false);
                      }}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors max-sm:px-2.5 max-sm:py-2",
                        disclosure === value
                          ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                          : "border-[var(--border)] hover:bg-[var(--accent)]",
                      )}
                    >
                      <span className="block text-sm font-bold">
                        {t(`ui.noodle.noodlerwizard.disclosure.${value}.title`)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)] max-sm:line-clamp-2 max-sm:leading-4">
                        {t(`ui.noodle.noodlerwizard.disclosure.${value}.detail`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {intro === 2 && (
            <div className="space-y-4 max-sm:space-y-3">
              <StepHeading
                icon={<Lock size={18} />}
                title={t("ui.noodle.noodlerwizard.intro.locked.title")}
                help={t("ui.noodle.noodlerwizard.intro.locked.help")}
              />
              {/* Capped width: the wizard modal is 3xl, and a full-bleed card makes the demo post
                  read as a page rather than as one item in a feed. */}
              <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-[var(--noodle-divider)] max-sm:max-w-[18rem]">
                <LockedNoodlerPostCard
                  key={disclosure}
                  post={{
                    ...DEMO_POST,
                    title: t("ui.noodle.noodlerwizard.demoPost.walkthrough.title"),
                    imageUrl: DEMO_POST.imageUrl,
                  }}
                  profile={DEMO_PROFILE}
                  subscribed={false}
                  unlockPending={false}
                  subscriptionPending={false}
                  onUnlock={() => {}}
                  onToggleSubscription={() => {}}
                  demo={{
                    body: t("ui.noodle.noodlerwizard.demoPost.walkthrough.body"),
                    lockedTitle: t("ui.noodle.noodlerwizard.demoPost.walkthrough.lockedTitle"),
                    unlockedLabel: t("ui.noodle.postaccess.unlocked"),
                    unlockedImageUrl: "/sprites/mari/Mari_noodler_teaser_unlocked.webp",
                    onReveal: () => setPostExplored(true),
                  }}
                />
              </div>
            </div>
          )}

          {intro === 3 && (
            <div className="space-y-4 max-sm:space-y-3">
              <StepHeading
                icon={<Clock size={18} />}
                title={t("ui.noodle.noodlerwizard.intro.activity.title")}
                help={t("ui.noodle.noodlerwizard.intro.activity.help")}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {(["manual", "occasional", "lively", "veryActive"] as ActivityChoice[]).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => chooseActivity(choice)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors max-sm:py-2",
                      activityChoice === choice
                        ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                        : "border-[var(--border)] hover:bg-[var(--accent)]",
                    )}
                  >
                    <span className="block text-sm font-bold">
                      {t(`ui.noodle.noodlerwizard.activityChoice.${choice}.title`)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)]">
                      {t(`ui.noodle.noodlerwizard.activityChoice.${choice}.detail`)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={nightQuiet}
                    onChange={(event) => setNightQuiet(event.target.checked)}
                    className="h-4 w-4 accent-[var(--noodle-accent)]"
                  />
                  {t("ui.noodle.noodlerwizard.nightQuiet")}
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={imagesEnabled}
                    onChange={(event) => setImagesEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--noodle-accent)]"
                  />
                  {t("ui.noodle.noodlerwizard.imagesShort")}
                </label>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/8 px-3 py-2.5 max-sm:py-2">
                <img
                  src="/sprites/mari/Mari_explaining.png"
                  alt=""
                  className="h-16 w-auto object-contain max-sm:h-12"
                />
                <p className="text-sm leading-5">
                  {activityChoice === "manual"
                    ? t("ui.noodle.noodlerwizard.intro.activity.manualPreview")
                    : t("ui.noodle.noodlerwizard.intro.activity.preview", { count: postsPerDay })}
                </p>
              </div>
            </div>
          )}

          {intro === null && setupLane === null && (
            <div className="space-y-5">
              <StepHeading
                icon={<Sparkles size={18} />}
                title={t("ui.noodle.noodlerwizard.handoff.title")}
                help={t("ui.noodle.noodlerwizard.handoff.help")}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setSetupLane("easy");
                    setStep(1);
                  }}
                  className="rounded-lg border border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 p-4 text-left transition-colors hover:bg-[var(--noodle-accent)]/15"
                >
                  <span className="flex items-center gap-2 text-base font-bold">
                    <Sparkles size={17} className="text-[var(--noodle-accent)]" />
                    {t("ui.noodle.noodlerwizard.handoff.easy.title")}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[var(--muted-foreground)]">
                    {t("ui.noodle.noodlerwizard.handoff.easy.detail")}
                  </span>
                  <span className="mt-4 flex items-center gap-1 text-sm font-bold text-[var(--noodle-accent)]">
                    {t("ui.noodle.noodlerwizard.handoff.easy.action")}
                    <ChevronRight size={15} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupLane("customize");
                    setStep(1);
                  }}
                  className="rounded-lg border border-[var(--border)] p-4 text-left transition-colors hover:bg-[var(--accent)]"
                >
                  <span className="flex items-center gap-2 text-base font-bold">
                    <SlidersHorizontal size={17} />
                    {t("ui.noodle.noodlerwizard.handoff.customize.title")}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[var(--muted-foreground)]">
                    {t("ui.noodle.noodlerwizard.handoff.customize.detail")}
                  </span>
                  <span className="mt-4 flex items-center gap-1 text-sm font-bold text-[var(--foreground)]">
                    {t("ui.noodle.noodlerwizard.handoff.customize.action")}
                    <ChevronRight size={15} />
                  </span>
                </button>
              </div>
            </div>
          )}

          {intro === null && setupLane !== null && step === 1 && (
            <div className="space-y-4">
              <StepHeading
                icon={<Users size={18} />}
                title={t("ui.noodle.noodlerwizard.chooseCharacters")}
                help={t("ui.noodle.noodlerwizard.selectionRule")}
              />
              {accounts.length > 0 && (
                <div className="sticky top-0 z-10 -mt-1 flex items-center justify-between gap-3 bg-[var(--background)] py-1.5">
                  <span className="text-xs font-bold text-[var(--muted-foreground)]">
                    {t("ui.noodle.noodlerwizard.selectedCount", { count: selected.size })}
                  </span>
                  <button
                    type="button"
                    disabled={hasNextPage}
                    onClick={() =>
                      setSelected(
                        new Set(selected.size === accounts.length ? [] : accounts.map((account) => account.id)),
                      )
                    }
                    className="min-h-10 shrink-0 px-1 text-xs font-bold text-[var(--noodle-accent)] disabled:opacity-40"
                  >
                    {selected.size === accounts.length
                      ? t("ui.noodle.noodlerwizard.selectNone")
                      : t("ui.noodle.noodlerwizard.selectAll")}
                  </button>
                </div>
              )}
              {eligible.isError && accounts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-[var(--muted-foreground)]">{t("ui.noodle.noodlerwizard.loadFailed")}</p>
                  <button
                    type="button"
                    onClick={() => void eligible.refetch()}
                    className="mt-2 min-h-10 px-2 text-sm font-bold text-[var(--noodle-accent)]"
                  >
                    {t("capabilities.actions.tryAgain")}
                  </button>
                </div>
              ) : accounts.length === 0 && !eligible.isLoading && !eligible.hasNextPage ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
                    <Users size={22} />
                  </span>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
                    {t("ui.noodle.noodlerwizard.zeroEligible")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected.has(account.id)}
                      onClick={() => toggleSelected(account.id)}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        selected.has(account.id)
                          ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 ring-1 ring-[var(--noodle-accent)]/35"
                          : "border-[var(--border)] hover:bg-[var(--accent)]",
                      )}
                    >
                      <Avatar
                        account={{
                          displayName: account.displayName,
                          avatarUrl: account.avatarUrl,
                          avatarCrop: account.avatarCrop,
                        }}
                        size="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{account.displayName}</span>
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">@{account.handle}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          selected.has(account.id)
                            ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)] text-zinc-950"
                            : "border-[var(--border)]",
                        )}
                      >
                        {selected.has(account.id) && <Check size={13} />}
                      </span>
                    </button>
                  ))}
                  {(eligible.isLoading || eligible.hasNextPage) &&
                    Array.from({ length: 4 }, (_, index) => (
                      <span
                        key={`skeleton-${index}`}
                        className="min-h-14 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--accent)]/40"
                      >
                        <span className="sr-only">{t("ui.noodle.noodlerwizard.loadingCharacters")}</span>
                      </span>
                    ))}
                </div>
              )}
              {selectionOnly && selected.size > 0 && (
                <label className="flex min-h-14 items-center gap-3 rounded-md bg-[var(--accent)]/30 px-4 py-3 ring-1 ring-inset ring-[var(--border)]">
                  <input
                    type="checkbox"
                    checked={generateNow}
                    onChange={(event) => setGenerateNow(event.target.checked)}
                    className="h-5 w-5 accent-[var(--noodle-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.generateNow")}</span>
                    <span className="block text-xs leading-5 text-[var(--muted-foreground)]">
                      {t("ui.noodle.noodlerwizard.generateNowHelp")}
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          {step === 2 && !selectionOnly && (
            <div className="space-y-4">
              <StepHeading
                icon={<Eye size={18} />}
                title={t("ui.noodle.noodlerwizard.disclosure.question")}
                help={t("ui.noodle.noodlerwizard.disclosure.help")}
              />
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
              {setupLane === "customize" && selected.size > 0 && (
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
              <StepHeading
                icon={<Clock size={18} />}
                title={t("ui.noodle.noodlerwizard.activity")}
                help={t("ui.noodle.noodlerwizard.activityHelp")}
              />
              <>
                <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--border)] px-3">
                  <input
                    type="checkbox"
                    checked={autoPostingEnabled}
                    onChange={(event) => setAutoPostingEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--noodle-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.autoPosting")}</span>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {t("ui.noodle.noodlerwizard.autoPostingHelp")}
                    </span>
                  </span>
                </label>
                {autoPostingEnabled && (
                  <>
                    <label className="block text-sm font-semibold">
                      {t("ui.noodle.noodlerwizard.postsPerDay")}
                      <input
                        type="number"
                        min={1}
                        max={NOODLER_POSTS_PER_DAY_MAX}
                        value={postsPerDay}
                        onChange={(event) =>
                          setPostsPerDay(Math.max(1, Math.min(NOODLER_POSTS_PER_DAY_MAX, Number(event.target.value) || 1)))
                        }
                        className="mt-2 h-11 w-28 rounded-md border border-[var(--border)] bg-[var(--background)] px-3"
                      />
                    </label>
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
                  </>
                )}
              </>
            </div>
          )}

          {step === 4 && !selectionOnly && (
            <div className="space-y-5">
              <StepHeading
                icon={<ImageIcon size={18} />}
                title={
                  setupLane === "easy" ? t("ui.noodle.noodlerwizard.reviewTitle") : t("ui.noodle.noodlerwizard.images")
                }
                help={
                  setupLane === "easy"
                    ? t("ui.noodle.noodlerwizard.reviewHelp")
                    : t("ui.noodle.noodlerwizard.imagesHelp")
                }
              />
              {setupLane === "customize" && (
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
              {setupLane === "easy" ? (
                <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                  <div className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
                    <span>
                      <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.characters")}</span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {t("ui.noodle.noodlerwizard.selectedCount", { count: selected.size })}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="min-h-9 shrink-0 px-2 text-xs font-bold text-[var(--noodle-accent)]"
                    >
                      {t("ui.noodle.noodlerwizard.change")}
                    </button>
                  </div>
                  <label className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
                    <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.identity")}</span>
                    <select
                      value={disclosure}
                      onChange={(event) => setDisclosure(event.target.value as NoodleIdentityDisclosure)}
                      className="h-9 min-w-0 max-w-[65%] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                    >
                      {DISCLOSURES.map((value) => (
                        <option key={value} value={value}>
                          {disclosureLabel(value, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-3 px-3 py-3">
                    <label className="flex min-h-9 items-center justify-between gap-4">
                      <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.activity")}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={autoPostingEnabled}
                        onChange={(event) => setAutoPostingEnabled(event.target.checked)}
                        className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
                      />
                    </label>
                    {autoPostingEnabled && (
                      <label className="flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)]">
                        <span>{t("ui.noodle.noodlerwizard.easyPostingPace")}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={NOODLER_POSTS_PER_DAY_MAX}
                            value={postsPerDay}
                            onChange={(event) =>
                              setPostsPerDay(
                                Math.max(1, Math.min(NOODLER_POSTS_PER_DAY_MAX, Number(event.target.value) || 1)),
                              )
                            }
                            aria-label={t("ui.noodle.noodlerwizard.postsPerDay")}
                            className="h-9 w-16 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-center text-sm text-[var(--foreground)]"
                          />
                          {t("ui.noodle.noodlerwizard.postsPerDayShort")}
                        </span>
                      </label>
                    )}
                  </div>
                  <label className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
                    <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.nightQuiet")}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={nightQuiet}
                      onChange={(event) => setNightQuiet(event.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
                    />
                  </label>
                  <label className="flex min-h-14 items-center justify-between gap-4 px-3 py-2.5">
                    <span className="text-sm font-semibold">{t("ui.noodle.noodlerwizard.images")}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={imagesEnabled}
                      onChange={(event) => setImagesEnabled(event.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[var(--noodle-accent)]"
                    />
                  </label>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                  {[
                    [
                      t("ui.noodle.noodlerwizard.characters"),
                      t("ui.noodle.noodlerwizard.selectedCount", { count: selected.size }),
                    ],
                    [t("ui.noodle.noodlerwizard.identity"), disclosureLabel(disclosure, t)],
                    [
                      t("ui.noodle.noodlerwizard.activity"),
                      autoPostingEnabled
                        ? t("ui.noodle.noodlerwizard.automaticActivityDetail", { count: postsPerDay })
                        : t("ui.noodle.noodlerwizard.manualOnly"),
                    ],
                    [
                      t("ui.noodle.noodlerwizard.nightQuiet"),
                      nightQuiet ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off"),
                    ],
                    [
                      t("ui.noodle.noodlerwizard.images"),
                      imagesEnabled ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off"),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
                      <span className="font-semibold">{label}</span>
                      <span className="max-w-[65%] text-right text-[var(--muted-foreground)]">{value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-md bg-[var(--accent)]/30 p-4 ring-1 ring-inset ring-[var(--border)]">
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={generateNow}
                    onChange={(event) => setGenerateNow(event.target.checked)}
                    className="h-5 w-5 accent-[var(--noodle-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{t("ui.noodle.noodlerwizard.generateNow")}</span>
                    <span className="block text-xs leading-5 text-[var(--muted-foreground)]">
                      {t("ui.noodle.noodlerwizard.generateNowHelp")}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 5 && completion && (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]",
                  completion === "generated" &&
                    "ring-4 ring-[var(--noodle-accent)]/20 transition-shadow duration-500 motion-reduce:transition-none",
                )}
              >
                {completion === "generated" ? (
                  <Check size={26} />
                ) : completion === "partial" || completion === "failed" ? (
                  <RefreshCw size={24} />
                ) : (
                  <Users size={24} />
                )}
              </div>
              <h3 ref={completionHeadingRef} tabIndex={-1} className="mt-4 text-xl font-bold outline-none">
                {t(`ui.noodle.noodlerwizard.completion.${completion}.title`)}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
                {t(`ui.noodle.noodlerwizard.completion.${completion}.detail`, {
                  created: createdIds.length,
                  generated: generatedCount,
                  failed: failedCount,
                })}
              </p>
              {createdIds.length > 0 && (
                <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    { key: "created", value: createdIds.length },
                    { key: "posted", value: generatedCount },
                    { key: "failed", value: failedCount },
                  ].map((cell) => (
                    <div
                      key={cell.key}
                      className="min-w-24 rounded-md bg-[var(--accent)]/30 px-3 py-2 ring-1 ring-inset ring-[var(--border)]"
                    >
                      <dt className="text-[0.7rem] font-semibold text-[var(--muted-foreground)]">
                        {t(`ui.noodle.noodlerwizard.stat.${cell.key}`)}
                      </dt>
                      <dd className="text-lg font-bold">{cell.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {failedIds.length > 0 && (
                <button
                  type="button"
                  disabled={refreshTargeted.isPending}
                  onClick={() => void runGeneration(failedIds)}
                  className="mt-5 flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 px-4 text-sm font-bold text-[var(--noodle-accent)] disabled:opacity-50"
                >
                  <RefreshCw size={15} className={refreshTargeted.isPending ? "animate-spin" : ""} />
                  {t("ui.noodle.noodlerwizard.retryFailed")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] pt-3 max-sm:pt-2">
          <div className="flex items-center justify-between gap-3 max-sm:gap-1.5">
            <div className="flex items-center gap-2 max-sm:gap-0.5">
              {intro !== null && intro > 0 && (
                <button
                  type="button"
                  onClick={() => setIntro((intro - 1) as Intro)}
                  className="flex min-h-10 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-sm font-bold max-sm:px-2"
                >
                  <ChevronLeft size={15} />
                  {t("ui.noodle.noodlerwizard.back")}
                </button>
              )}
              {intro === null && setupLane !== null && step > 1 && step < 5 && (
                <button
                  type="button"
                  onClick={() => setStep(setupLane === "easy" ? 1 : ((step - 1) as Step))}
                  className="flex min-h-10 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-sm font-bold max-sm:px-2"
                >
                  <ChevronLeft size={15} />
                  {t("ui.noodle.noodlerwizard.back")}
                </button>
              )}
              {intro === null && setupLane !== null && step === 1 && !selectionOnly && (
                <button
                  type="button"
                  onClick={() => setSetupLane(null)}
                  className="flex min-h-10 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-sm font-bold max-sm:px-2"
                >
                  <ChevronLeft size={15} />
                  {t("ui.noodle.noodlerwizard.back")}
                </button>
              )}
              {!selectionOnly && step < 5 && (intro !== null || setupLane !== null) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => (intro === null ? void skip() : setIntro(null))}
                  className="min-h-10 rounded-md px-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 max-sm:px-1.5 max-sm:text-xs"
                >
                  {intro === null ? t("ui.noodle.noodlerwizard.skip") : t("ui.noodle.noodlerwizard.skipIntro")}
                </button>
              )}
            </div>
            {intro !== null ? (
              <button
                type="button"
                disabled={intro === 2 && !postExplored}
                onClick={() => setIntro(intro < LAST_INTRO ? ((intro + 1) as Intro) : null)}
                className="flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 disabled:opacity-50 max-sm:px-3"
              >
                {intro < LAST_INTRO ? t("ui.noodle.noodlerwizard.continue") : t("ui.noodle.noodlerwizard.introDone")}
                <ChevronRight size={15} />
              </button>
            ) : setupLane === null ? null : step < 5 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending || (step === 1 && selected.size === 0)}
                  onClick={() => {
                    if (step === (selectionOnly ? 1 : 4)) void finish();
                    else if (setupLane === "easy" && step === 1) setStep(4);
                    else setStep((step + 1) as Step);
                  }}
                  className="flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 disabled:opacity-50 max-sm:px-3 max-sm:text-xs"
                >
                  {pending && <Loader2 size={15} className="animate-spin" />}
                  {step === (selectionOnly ? 1 : 4)
                    ? t("ui.noodle.noodlerwizard.createCount", { count: selected.size })
                    : setupLane === "easy"
                      ? t("ui.noodle.noodlerwizard.reviewSetup")
                      : step === 1
                        ? t("ui.noodle.noodlerwizard.setIdentities")
                        : step === 2
                          ? t("ui.noodle.noodlerwizard.setActivity")
                          : t("ui.noodle.noodlerwizard.setImages")}
                  {!pending && step !== (selectionOnly ? 1 : 4) && <ChevronRight size={15} />}
                </button>
              </div>
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
          {/* Creating profiles then writing first posts can take a while; say which half we are in. */}
          <p aria-live="polite" className="mt-2 min-h-4 text-xs text-[var(--muted-foreground)] max-sm:mt-1">
            {bulkCreate.isPending
              ? t("ui.noodle.noodlerwizard.progressCreating")
              : refreshTargeted.isPending
                ? t("ui.noodle.noodlerwizard.progressWriting")
                : ""}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function StepHeading({ icon, title, help }: { icon: ReactNode; title: string; help: string }) {
  return (
    <div className="flex gap-3 max-sm:gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)] max-sm:h-8 max-sm:w-8">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-xl font-bold leading-snug max-sm:text-lg">{title}</h3>
        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--muted-foreground)] max-sm:leading-5">{help}</p>
      </div>
    </div>
  );
}
