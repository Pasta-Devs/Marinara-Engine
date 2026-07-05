import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import {
  CONVERSATION_SCHEDULE_DAYS,
  type ConversationMessageIntent,
  type ConversationPresenceStatus,
  type ScheduleBlock,
  type WeekSchedule,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { api } from "../../lib/api-client";
import { cn, getAvatarCropStyle, type AvatarCrop, type LegacyAvatarCrop } from "../../lib/utils";
import { toast } from "sonner";

type CharacterScheduleEditorModalProps = {
  open: boolean;
  chatId: string;
  characterId: string;
  characterName: string;
  characterAvatarUrl?: string | null;
  characterAvatarCrop?: AvatarCrop | LegacyAvatarCrop | null;
  schedule?: WeekSchedule;
  initialDay?: string | null;
  onClose: () => void;
  onSave: (characterId: string, schedule: WeekSchedule) => void;
};

type DraftSchedule = {
  days: Record<string, ScheduleBlock[]>;
  inactivityThresholdMinutes: string;
  idleResponseDelayMinutes: string;
  dndResponseDelayMinutes: string;
  autonomousDailyCapOverride: string;
  weekStart: string;
  talkativeness: number;
  routineSummary: string;
  routineSummaryGeneratedAt: string;
  disabledAutonomousIntents: ConversationMessageIntent[];
};

type DraftScheduleResponse = { schedule: WeekSchedule };

type DraftDayResponse = { day: string; blocks: ScheduleBlock[] };

type RoutineSummaryResponse = { summary: string; generatedAt: string };

type WeekDraftMode = "rewrite" | "adjust" | "vary" | "repair";

const STATUS_OPTIONS: Array<{ value: ConversationPresenceStatus; label: string; className: string }> = [
  { value: "online", label: "Online", className: "bg-green-500" },
  { value: "idle", label: "Away", className: "bg-yellow-500" },
  { value: "dnd", label: "Busy", className: "bg-red-500" },
  { value: "offline", label: "Offline", className: "bg-gray-400" },
];

const STATUS_COLORS: Record<ConversationPresenceStatus, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

const STATUS_LABELS: Record<ConversationPresenceStatus, string> = {
  online: "Online",
  idle: "Away",
  dnd: "Busy",
  offline: "Offline",
};

const CHECK_IN_STYLES = [
  { value: 10, label: "Rare", chip: "Rare talkativeness", hint: "Only occasional autonomous check-ins." },
  { value: 30, label: "Quiet", chip: "Quiet talkativeness", hint: "Low-pressure check-ins." },
  { value: 50, label: "Balanced", chip: "Balanced talkativeness", hint: "A moderate routine presence." },
  { value: 70, label: "Social", chip: "Social talkativeness", hint: "More frequent check-ins when available." },
  { value: 90, label: "Very frequent", chip: "Very frequent talkativeness", hint: "Often initiates when the schedule allows." },
] as const;

const CHECK_IN_MOMENTS: Array<{ intent: ConversationMessageIntent; label: string; hint: string }> = [
  { intent: "good_morning", label: "Morning", hint: "First check-ins after waking up." },
  { intent: "good_night", label: "Goodnight", hint: "Messages before going offline for the night." },
  { intent: "meal_break", label: "Meal breaks", hint: "Quick messages during meals or short breaks." },
  { intent: "after_busy", label: "After busy", hint: "Messages after work, study, or focused blocks." },
  { intent: "long_absence_check_in", label: "Long absence", hint: "Low-pressure check-ins after a long silence." },
];

const WEEK_DRAFT_MODES: Array<{ value: WeekDraftMode; label: string; hint: string }> = [
  { value: "rewrite", label: "Rewrite", hint: "Fresh full-week draft from the character and guidance." },
  { value: "adjust", label: "Adjust", hint: "Preserve most of the routine while applying guidance." },
  { value: "vary", label: "Vary", hint: "Make the week visibly different but still plausible." },
  { value: "repair", label: "Repair", hint: "Fix coverage and obvious schedule problems with minimal changes." },
];

const WEEK_DRAFT_MODE_LABELS: Record<WeekDraftMode, string> = {
  rewrite: "Rewrite",
  adjust: "Adjust",
  vary: "Vary",
  repair: "Repair",
};

function getCurrentMondayIso(): string {
  const date = new Date();
  const diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function cloneDays(schedule?: WeekSchedule): Record<string, ScheduleBlock[]> {
  const days: Record<string, ScheduleBlock[]> = {};
  for (const day of CONVERSATION_SCHEDULE_DAYS) {
    days[day] = (schedule?.days?.[day] ?? []).map((block) => ({
      time: block.time ?? "",
      activity: block.activity ?? "",
      status: block.status ?? "online",
    }));
  }
  return days;
}

function createDraft(schedule?: WeekSchedule): DraftSchedule {
  return {
    days: cloneDays(schedule),
    inactivityThresholdMinutes: String(schedule?.inactivityThresholdMinutes ?? 120),
    idleResponseDelayMinutes:
      typeof schedule?.idleResponseDelayMinutes === "number" ? String(schedule.idleResponseDelayMinutes) : "",
    dndResponseDelayMinutes:
      typeof schedule?.dndResponseDelayMinutes === "number" ? String(schedule.dndResponseDelayMinutes) : "",
    autonomousDailyCapOverride:
      typeof schedule?.autonomousDailyCapOverride === "number" ? String(schedule.autonomousDailyCapOverride) : "",
    weekStart: schedule?.weekStart ?? getCurrentMondayIso(),
    talkativeness: schedule?.talkativeness ?? 50,
    routineSummary: schedule?.routineSummary ?? "",
    routineSummaryGeneratedAt: schedule?.routineSummaryGeneratedAt ?? "",
    disabledAutonomousIntents: Array.isArray(schedule?.disabledAutonomousIntents) ? schedule.disabledAutonomousIntents : [],
  };
}

function draftToSchedule(draft: DraftSchedule, schedule?: WeekSchedule): WeekSchedule {
  const next: WeekSchedule = {
    weekStart: draft.weekStart,
    days: draft.days,
    inactivityThresholdMinutes: parseNumber(draft.inactivityThresholdMinutes, schedule?.inactivityThresholdMinutes ?? 120, 15, 360),
    talkativeness: Math.max(0, Math.min(100, draft.talkativeness)),
    routineSummary: draft.routineSummary.trim() || null,
    routineSummaryGeneratedAt: draft.routineSummaryGeneratedAt || null,
    disabledAutonomousIntents: draft.disabledAutonomousIntents,
  };
  const idleDelay = parseOptionalNumber(draft.idleResponseDelayMinutes, 0, 120);
  const dndDelay = parseOptionalNumber(draft.dndResponseDelayMinutes, 0, 120);
  if (idleDelay !== undefined) next.idleResponseDelayMinutes = idleDelay;
  if (dndDelay !== undefined) next.dndResponseDelayMinutes = dndDelay;
  next.autonomousDailyCapOverride = parseOptionalCap(draft.autonomousDailyCapOverride);
  return next;
}

function parseNumber(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseOptionalNumber(value: string, min: number, max: number): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(min, Math.min(max, parsed));
}

function parseOptionalCap(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(8, Math.floor(parsed)));
}

function parseClock(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  if (hours === 24 && minutes !== 0) return null;
  return hours * 60 + minutes;
}

function parseTimeRange(value: string): { start: number; end: number } | null {
  const [startRaw, endRaw] = value.split("-");
  const start = parseClock(startRaw);
  const end = parseClock(endRaw);
  if (start == null || end == null || start === end) return null;
  return { start, end: end === 0 ? 1440 : end };
}

function blockSegments(block: ScheduleBlock): Array<{
  left: number;
  width: number;
  status: ConversationPresenceStatus;
}> {
  const range = parseTimeRange(block.time);
  if (!range) return [];
  const status = block.status ?? "online";
  const toSegment = (start: number, end: number) => {
    const width = Math.max(0.4, ((end - start) / 1440) * 100);
    return {
      left: (start / 1440) * 100,
      width,
      status,
    };
  };
  if (range.start > range.end) return [toSegment(range.start, 1440), toSegment(0, range.end)];
  return [toSegment(range.start, range.end)];
}

function blocksEqual(left: ScheduleBlock[], right: ScheduleBlock[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((block, index) => {
    const other = right[index];
    return !!other && block.time === other.time && block.activity === other.activity && (block.status ?? "online") === (other.status ?? "online");
  });
}

function getCheckInStyleLabel(value: number): string {
  return getNearestCheckInStyle(value).chip;
}

function getNearestCheckInStyle(value: number): (typeof CHECK_IN_STYLES)[number] {
  return CHECK_IN_STYLES.reduce((nearest, option) =>
    Math.abs(option.value - value) < Math.abs(nearest.value - value) ? option : nearest,
  );
}

function getNearestCheckInStyleIndex(value: number): number {
  const nearest = getNearestCheckInStyle(value);
  return CHECK_IN_STYLES.findIndex((option) => option.value === nearest.value);
}

function getDailyCapLabel(value: string): string {
  const parsed = parseOptionalCap(value);
  return parsed ? `Limit ${parsed}/day` : "";
}

function ScheduleTimeline({ day, blocks }: { day: string; blocks: ScheduleBlock[] }) {
  const now = new Date();
  const todayName = CONVERSATION_SCHEDULE_DAYS[(now.getDay() + 6) % 7];
  const nowLeft = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  const rulerHours = Array.from({ length: 25 }, (_, hour) => hour);

  return (
    <div className="space-y-1.5">
      <div className="relative h-4 overflow-hidden rounded-[3px] bg-[var(--background)] ring-1 ring-[var(--border)]">
        {blocks.flatMap((block, index) =>
          blockSegments(block).map((segment, segmentIndex) => (
            <div
              key={`${index}-${segmentIndex}`}
              className={cn("absolute top-1/2 h-2 -translate-y-1/2 opacity-80", STATUS_COLORS[segment.status])}
              style={{
                left: `calc(${segment.left}% + 1px)`,
                width: `calc(${segment.width}% - 2px)`,
                minWidth: "2px",
                borderRadius: "3px",
              }}
              title={`${block.time} ${block.activity || STATUS_LABELS[segment.status]}`}
            />
          )),
        )}
        {day === todayName && (
          <div className="absolute inset-y-0 z-10 w-1 -translate-x-1/2 bg-[var(--primary)]" style={{ left: `${nowLeft}%` }} />
        )}
      </div>
      <div className="relative h-4 text-[0.5625rem] tabular-nums text-[var(--muted-foreground)]/70">
        {day === todayName && (
          <div
            className="absolute top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[7px] border-x-transparent border-b-[var(--primary)]"
            style={{ left: `${nowLeft}%` }}
            title="Current time"
          />
        )}
        {rulerHours.map((hour) => {
          const major = hour === 0 || hour === 6 || hour === 12 || hour === 18 || hour === 24;
          const label = hour === 0 || hour === 24 ? "00" : String(hour).padStart(2, "0");
          return (
            <div
              key={hour}
              className={cn(
                "absolute top-0 flex flex-col items-center",
                hour === 0 ? "translate-x-0 items-start" : hour === 24 ? "-translate-x-full items-end" : "-translate-x-1/2",
              )}
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              <span className={cn("w-px bg-[var(--border)]", major ? "h-2" : "h-1")} />
              {major && <span className="mt-0.5">{label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CharacterScheduleEditorModal({
  open,
  chatId,
  characterId,
  characterName,
  characterAvatarUrl,
  characterAvatarCrop,
  schedule,
  initialDay,
  onClose,
  onSave,
}: CharacterScheduleEditorModalProps) {
  const [draft, setDraft] = useState<DraftSchedule>(() => createDraft(schedule));
  const [expandedDay, setExpandedDay] = useState<string | null>(initialDay ?? null);
  const [generationGuidance, setGenerationGuidance] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  const [generatingDay, setGeneratingDay] = useState<string | null>(null);
  const [summaryStale, setSummaryStale] = useState(false);
  const [dayGuidance, setDayGuidance] = useState<Record<string, string>>({});
  const [dayGenerationStatus, setDayGenerationStatus] = useState<Record<string, string>>({});
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);
  const [tuningOpen, setTuningOpen] = useState(false);
  const [weekGuideOpen, setWeekGuideOpen] = useState(false);
  const [weekDraftMode, setWeekDraftMode] = useState<WeekDraftMode>(() => (schedule ? "adjust" : "rewrite"));
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!open) return;
    setDraft(createDraft(schedule));
    setExpandedDay(initialDay && CONVERSATION_SCHEDULE_DAYS.includes(initialDay) ? initialDay : null);
    setGenerationGuidance("");
    setSummaryStale(false);
    setDayGuidance({});
    setDayGenerationStatus({});
    setOpenStatusMenu(null);
    setTuningOpen(false);
    setWeekGuideOpen(false);
    setWeekDraftMode(schedule ? "adjust" : "rewrite");
  }, [characterId, initialDay, open, schedule]);

  useEffect(() => {
    if (!openStatusMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-schedule-status-menu]")) return;
      setOpenStatusMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenStatusMenu(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openStatusMenu]);

  const markSummaryStale = () => {
    if (draftRef.current.routineSummary.trim()) setSummaryStale(true);
  };

  const applyDraftAndMarkSummaryStale = (updater: (current: DraftSchedule) => DraftSchedule) => {
    setDraft((current) => {
      const next = updater(current);
      draftRef.current = next;
      return next;
    });
    markSummaryStale();
  };

  const updateSetting = (field: keyof Omit<DraftSchedule, "days" | "weekStart" | "talkativeness">, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateTalkativeness = (value: string) => {
    const parsed = Number(value);
    setDraft((current) => ({
      ...current,
      talkativeness: Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : current.talkativeness,
    }));
  };

  const toggleCheckInMoment = (intent: ConversationMessageIntent) => {
    setDraft((current) => {
      const disabled = new Set(current.disabledAutonomousIntents);
      if (disabled.has(intent)) disabled.delete(intent);
      else disabled.add(intent);
      return { ...current, disabledAutonomousIntents: Array.from(disabled) };
    });
  };

  const updateBlock = (day: string, index: number, patch: Partial<ScheduleBlock>) => {
    markSummaryStale();
    setDraft((current) => {
      const blocks = [...(current.days[day] ?? [])];
      blocks[index] = { ...blocks[index]!, ...patch };
      return { ...current, days: { ...current.days, [day]: blocks } };
    });
  };

  const addBlock = (day: string) => {
    markSummaryStale();
    setDraft((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: [...(current.days[day] ?? []), { time: "09:00-10:00", activity: "Free time", status: "online" }],
      },
    }));
    setExpandedDay(day);
  };

  const removeBlock = (day: string, index: number) => {
    markSummaryStale();
    setOpenStatusMenu(null);
    setDraft((current) => ({
      ...current,
      days: { ...current.days, [day]: (current.days[day] ?? []).filter((_, blockIndex) => blockIndex !== index) },
    }));
  };

  const currentSchedule = draftToSchedule(draft, schedule);
  const enabledMomentCount = CHECK_IN_MOMENTS.filter((option) => !draft.disabledAutonomousIntents.includes(option.intent)).length;
  const momentsLabel =
    enabledMomentCount === CHECK_IN_MOMENTS.length
      ? "Natural moments"
      : enabledMomentCount === 0
        ? "Basic check-ins only"
        : `${enabledMomentCount} moments on`;

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const result = await api.post<RoutineSummaryResponse>("/conversation/schedule/summary", {
        chatId,
        characterId,
        schedule: currentSchedule,
        guidance: generationGuidance,
      });
      const nextDraft = { ...draftRef.current, routineSummary: result.summary, routineSummaryGeneratedAt: result.generatedAt };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      onSave(characterId, draftToSchedule(nextDraft, schedule));
      setSummaryStale(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate routine summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const generateWeek = async () => {
    setIsGeneratingWeek(true);
    try {
      const result = await api.post<DraftScheduleResponse>("/conversation/schedule/draft", {
        chatId,
        characterId,
        mode: "week",
        schedule: currentSchedule,
        guidance: generationGuidance,
        draftMode: weekDraftMode,
      });
      applyDraftAndMarkSummaryStale((current) => ({
        ...createDraft(result.schedule),
        routineSummary: current.routineSummary,
        routineSummaryGeneratedAt: current.routineSummaryGeneratedAt,
        disabledAutonomousIntents: current.disabledAutonomousIntents,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate schedule");
    } finally {
      setIsGeneratingWeek(false);
    }
  };

  const generateDay = async (day: string) => {
    setGeneratingDay(day);
    setDayGenerationStatus((current) => ({ ...current, [day]: `Regenerating ${day}...` }));
    const previousBlocks = draft.days[day] ?? [];
    const specificGuidance = dayGuidance[day]?.trim() ?? "";
    try {
      const result = await api.post<DraftDayResponse>("/conversation/schedule/draft", {
        chatId,
        characterId,
        mode: "day",
        day,
        schedule: currentSchedule,
        guidance: generationGuidance,
        dayGuidance: specificGuidance,
      });
      applyDraftAndMarkSummaryStale((current) => ({ ...current, days: { ...current.days, [result.day]: result.blocks } }));
      if (blocksEqual(previousBlocks, result.blocks)) {
        setDayGenerationStatus((current) => ({ ...current, [day]: "No visible changes returned" }));
        toast.message("The model returned the same day. Try stronger guidance.");
      } else {
        setDayGenerationStatus((current) => ({ ...current, [day]: specificGuidance ? `${day} guidance applied` : `${day} regenerated` }));
        toast.success(specificGuidance ? `${day} guidance applied` : `${day} regenerated`);
      }
    } catch (error) {
      setDayGenerationStatus((current) => ({ ...current, [day]: `Failed to regenerate ${day}` }));
      toast.error(error instanceof Error ? error.message : `Failed to regenerate ${day}`);
    } finally {
      setGeneratingDay(null);
    }
  };

  const save = () => {
    onSave(characterId, currentSchedule);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${characterName} Schedule`} width="max-w-5xl" chatFloatingPanel>
      <div className="space-y-4">
        <div className="rounded-xl bg-[var(--secondary)] p-4 ring-1 ring-[var(--border)]">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--background)] ring-1 ring-[var(--border)] sm:h-20 sm:w-20">
              {characterAvatarUrl ? (
                <img
                  src={characterAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={getAvatarCropStyle(characterAvatarCrop)}
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[var(--muted-foreground)]">
                  {characterName.trim().charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="min-w-0">
                <div className="text-[0.625rem] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Routine profile</div>
                <h2 className="mt-1 truncate text-xl font-semibold">{characterName}</h2>
              </div>
              <div className="flex min-h-20 flex-col gap-3">
                <div className="max-w-3xl text-sm leading-6 text-[var(--foreground)]">
                  {draft.routineSummary.trim() ? (
                    <div className="space-y-1.5">
                      <p>{draft.routineSummary}</p>
                      {summaryStale && <div className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Summary may be stale</div>}
                    </div>
                  ) : (
                    <p className="text-[var(--muted-foreground)]">No routine readout yet. Generate one from the current draft.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={generateSummary}
                  disabled={isGeneratingSummary || isGeneratingWeek || !!generatingDay}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 self-end rounded-md bg-[var(--background)] px-3 py-2 text-xs font-semibold ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGeneratingSummary ? <Loader2 size="0.75rem" className="animate-spin" /> : <Sparkles size="0.75rem" />}
                  {draft.routineSummary.trim() ? "Refresh summary" : "Generate summary"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <details
          open={tuningOpen}
          onToggle={(event) => setTuningOpen(event.currentTarget.open)}
          className="rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold marker:hidden">
            <span className="inline-flex items-center gap-2">
              <ChevronRight size="0.875rem" className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", tuningOpen && "rotate-90")} />
              Tuning
            </span>
            {!tuningOpen && (
              <span className="flex flex-wrap justify-end gap-1.5">
                <span className="rounded-full bg-[var(--background)] px-2 py-1 text-[0.625rem] font-normal text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  {getCheckInStyleLabel(draft.talkativeness)}
                </span>
                <span className="rounded-full bg-[var(--background)] px-2 py-1 text-[0.625rem] font-normal text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  {momentsLabel}
                </span>
                {getDailyCapLabel(draft.autonomousDailyCapOverride) && (
                  <span className="rounded-full bg-[var(--background)] px-2 py-1 text-[0.625rem] font-normal text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                    {getDailyCapLabel(draft.autonomousDailyCapOverride)}
                  </span>
                )}
              </span>
            )}
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.8fr)]">
            <div className="space-y-1.5 text-xs">
              <span className="font-medium">Chat talkativeness</span>
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={CHECK_IN_STYLES.length - 1}
                  step={1}
                  value={getNearestCheckInStyleIndex(draft.talkativeness)}
                  onChange={(event) => updateTalkativeness(String(CHECK_IN_STYLES[Number(event.target.value)]?.value ?? 50))}
                  className="w-full accent-[var(--primary)]"
                  aria-label="Chat talkativeness"
                />
                <div className="grid grid-cols-5 gap-1 text-center text-[0.5625rem] leading-tight text-[var(--muted-foreground)]">
                  {CHECK_IN_STYLES.map((option) => (
                    <span key={option.value}>{option.label}</span>
                  ))}
                </div>
              </div>
              <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                Overrides this character's default talkativeness for this chat. Affects initiative, follow-ups, group chatter, and the default daily cap.
              </div>
            </div>
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium">Wait before checking in</span>
              <input
                type="number"
                min={15}
                max={360}
                step={5}
                value={draft.inactivityThresholdMinutes}
                onChange={(event) => updateSetting("inactivityThresholdMinutes", event.target.value)}
                className="w-full rounded-md bg-[var(--background)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/50"
              />
              <div className="text-[0.6875rem] text-[var(--muted-foreground)]">Minimum silence before this character can start an autonomous check-in.</div>
            </label>
            <div className="space-y-2 text-xs md:col-span-2">
              <div>
                <div className="font-medium">Check-in moments</div>
                <div className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">Let this character use these routine moments as reasons to reach out.</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CHECK_IN_MOMENTS.map((option) => {
                  const enabled = !draft.disabledAutonomousIntents.includes(option.intent);
                  return (
                    <button
                      key={option.intent}
                      type="button"
                      title={option.hint}
                      onClick={() => toggleCheckInMoment(option.intent)}
                      className={cn(
                        "rounded-full px-2.5 py-1.5 text-[0.6875rem] font-semibold ring-1 ring-[var(--border)] transition-colors",
                        enabled
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {enabled ? "✓ " : ""}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <details className="group rounded-md bg-[var(--background)] p-3 ring-1 ring-[var(--border)] md:col-span-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold marker:hidden">
                <ChevronRight size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-90" />
                Advanced timing
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium">Daily safety limit</span>
                  <select
                    value={draft.autonomousDailyCapOverride}
                    onChange={(event) => updateSetting("autonomousDailyCapOverride", event.target.value)}
                    className="w-full rounded-md bg-[var(--secondary)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/50"
                  >
                    <option value="">Default</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((cap) => (
                      <option key={cap} value={cap}>
                        {cap} / day
                      </option>
                    ))}
                  </select>
                  <div className="text-[0.6875rem] text-[var(--muted-foreground)]">Hard maximum per day. Usually leave this on Default.</div>
                </label>
                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium">Delay while you're away</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={1}
                    value={draft.idleResponseDelayMinutes}
                    placeholder="Default"
                    onChange={(event) => updateSetting("idleResponseDelayMinutes", event.target.value)}
                    className="w-full rounded-md bg-[var(--secondary)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/50"
                  />
                  <div className="text-[0.6875rem] text-[var(--muted-foreground)]">Extra minutes to wait when your presence is away or idle.</div>
                </label>
                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium">Delay while you're busy</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={1}
                    value={draft.dndResponseDelayMinutes}
                    placeholder="Default"
                    onChange={(event) => updateSetting("dndResponseDelayMinutes", event.target.value)}
                    className="w-full rounded-md bg-[var(--secondary)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/50"
                  />
                  <div className="text-[0.6875rem] text-[var(--muted-foreground)]">Extra minutes to wait when your presence is busy or do-not-disturb.</div>
                </label>
              </div>
            </details>
          </div>
        </details>

        <details
          open={weekGuideOpen}
          onToggle={(event) => setWeekGuideOpen(event.currentTarget.open)}
          className="rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold marker:hidden">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ChevronRight size="0.875rem" className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", weekGuideOpen && "rotate-90")} />
              <span>Schedule AI</span>
            </span>
            {!weekGuideOpen && (
              <span className="truncate rounded-full bg-[var(--background)] px-2 py-1 text-[0.625rem] font-normal text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {WEEK_DRAFT_MODE_LABELS[weekDraftMode]}{generationGuidance.trim() ? " · Guidance set" : ""}
              </span>
            )}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs font-medium">Week action</div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {WEEK_DRAFT_MODES.map((option) => {
                  const selected = weekDraftMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWeekDraftMode(option.value)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-left text-xs ring-1 transition-colors",
                        selected
                          ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-[var(--primary)]/35"
                          : "bg-[var(--background)] text-[var(--muted-foreground)] ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                      )}
                    >
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[0.625rem] leading-4 opacity-80">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block text-xs">
                <span className="mb-1.5 block font-medium">Week guidance</span>
                <input
                  value={generationGuidance}
                  onChange={(event) => setGenerationGuidance(event.target.value)}
                  placeholder="Example: make weekdays more nocturnal, keep weekends social"
                  className="w-full rounded-md bg-[var(--background)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/50"
                />
              </label>
              <button
                type="button"
                onClick={generateWeek}
                disabled={isGeneratingSummary || isGeneratingWeek || !!generatingDay}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--background)] px-3 py-2 text-xs font-semibold ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingWeek ? <Loader2 size="0.75rem" className="animate-spin" /> : <RefreshCw size="0.75rem" />}
                {WEEK_DRAFT_MODE_LABELS[weekDraftMode]} week
              </button>
            </div>
            <div className="text-[0.6875rem] text-[var(--muted-foreground)]">Draft only. Save schedule applies changes.</div>
          </div>
        </details>

        <div className="space-y-2">
          {CONVERSATION_SCHEDULE_DAYS.map((day) => {
            const blocks = draft.days[day] ?? [];
            const expanded = expandedDay === day;
            return (
              <section key={day} className="rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setExpandedDay(expanded ? null : day)}
                  className="grid w-full gap-3 text-left md:grid-cols-[8rem_minmax(0,1fr)] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ChevronRight
                      size="0.875rem"
                      className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", expanded && "rotate-90")}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{day}</div>
                      <div className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {blocks.length} block{blocks.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <ScheduleTimeline day={day} blocks={blocks} />
                </button>

                {expanded && (
                  <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold">{day} blocks</div>
                      {dayGenerationStatus[day] && <div className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{dayGenerationStatus[day]}</div>}
                    </div>
                    <label className="block text-xs">
                      <span className="mb-1.5 block font-medium">Guide {day}</span>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          value={dayGuidance[day] ?? ""}
                          onChange={(event) => setDayGuidance((current) => ({ ...current, [day]: event.target.value }))}
                          placeholder={`Example: make ${day} more social after dinner`}
                          className="w-full rounded-md bg-[var(--background)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]/50"
                        />
                        <button
                          type="button"
                          onClick={() => generateDay(day)}
                          disabled={isGeneratingSummary || isGeneratingWeek || !!generatingDay}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--background)] px-3 py-2 text-xs font-semibold ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {generatingDay === day ? <Loader2 size="0.75rem" className="animate-spin" /> : <RefreshCw size="0.75rem" />}
                          Regenerate {day}
                        </button>
                      </div>
                    </label>
                    {blocks.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">No blocks scheduled for this day.</p>}
                    {blocks.map((block, index) => {
                      const menuKey = `${day}-${index}`;
                      const status = block.status ?? "online";
                      const isStatusMenuOpen = openStatusMenu === menuKey;
                      return (
                      <div key={index} className="grid gap-2 rounded-md bg-[var(--background)] p-2 ring-1 ring-[var(--border)] md:grid-cols-[minmax(0,1fr)_2.5rem]">
                        <div className="space-y-1 text-xs">
                          <div className="font-medium">Status, time & activity</div>
                          <div
                            data-schedule-status-menu
                            className="relative flex w-full min-w-0 items-stretch overflow-visible rounded-md bg-[var(--secondary)] ring-1 ring-[var(--border)] transition-colors hover:ring-[var(--border)]/80 focus-within:ring-[var(--primary)]/50"
                          >
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={isStatusMenuOpen}
                              aria-label={`Choose ${day} block status, currently ${STATUS_LABELS[status]}`}
                              className={cn(
                                "inline-flex min-h-[2.125rem] shrink-0 items-center justify-center gap-1 border-r border-[var(--border)] px-2 text-[0.6875rem] font-medium transition-colors hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                                isStatusMenuOpen && "bg-[var(--accent)]",
                              )}
                              onClick={() => setOpenStatusMenu((current) => (current === menuKey ? null : menuKey))}
                            >
                              <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
                              <ChevronDown size="0.625rem" className="shrink-0 opacity-60" />
                            </button>
                            <input
                              value={block.time}
                              onChange={(event) => updateBlock(day, index, { time: event.target.value })}
                              placeholder="09:00-11:30"
                              aria-label={`${day} block time range`}
                              className="min-h-[2.125rem] w-[7.75rem] shrink-0 border-r border-[var(--border)] bg-transparent px-2 py-1.5 font-mono text-xs text-[var(--foreground)]/88 outline-none placeholder:text-[var(--muted-foreground)]/55 max-sm:w-[6.75rem]"
                            />
                            <input
                              value={block.activity}
                              onChange={(event) => updateBlock(day, index, { activity: event.target.value })}
                              placeholder={STATUS_LABELS[status]}
                              aria-label={`${day} block activity`}
                              className="min-h-[2.125rem] w-full min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-xs text-[var(--foreground)]/88 outline-none placeholder:text-[var(--muted-foreground)]/55"
                            />
                            {isStatusMenuOpen && (
                              <div
                                role="menu"
                                aria-label="Choose schedule block status"
                                className="absolute left-0 top-[calc(100%+0.375rem)] z-20 w-44 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]"
                              >
                                {STATUS_OPTIONS.map((option) => {
                                  const selected = status === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      role="menuitemradio"
                                      aria-checked={selected}
                                      onClick={() => {
                                        if (!selected) updateBlock(day, index, { status: option.value });
                                        setOpenStatusMenu(null);
                                      }}
                                      className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.6875rem] transition-colors",
                                        selected
                                          ? "bg-[var(--accent)] text-[var(--foreground)]"
                                          : "text-[var(--popover-foreground)] hover:bg-[var(--accent)]",
                                      )}
                                    >
                                      <span className={cn("h-2 w-2 shrink-0 rounded-full", option.className)} />
                                      <span>{option.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBlock(day, index)}
                          className="flex h-10 w-10 items-center justify-center self-end rounded-md text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
                          title="Remove block"
                        >
                          <Trash2 size="0.875rem" />
                        </button>
                      </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addBlock(day)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                      >
                        <Plus size="0.75rem" /> Add block
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Unsaved draft</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
            >
              Save schedule
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
