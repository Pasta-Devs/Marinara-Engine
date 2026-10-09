// Mari's work timeline: the live headline and sprite, her steps by phase, and the done marks.
import { useMariAppearancePack } from "../../../hooks/use-mari-appearance-pack";
import { useMariSpriteSource } from "../../../lib/mari-sprite-ready";
import { MariStorySprite } from "../MariStorySprite";
import { MariHold } from "./MariHold";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronRight, Pencil, Search, Terminal, type LucideIcon } from "lucide-react";
import { type MariWorkspaceActionResult } from "@marinara-engine/shared";
import { type CharacterPreviewModel } from "../../../lib/character-preview";
import { resolveRunAnchorMs, resolveRunSeconds, type RunStepTiming } from "../../../lib/mari-work-card-timing";
import { type LorebookPreviewModel } from "../../../lib/lorebook-preview";
import {
  pickMariPhraseIndex,
  selectMariWorkAnimation,
  type MariStoryState,
  type MariWorkAnimation,
} from "../../../lib/mari-work-animations";
import {
  buildWorkTimelineBlocks,
  groupRunPhases,
  isLookStep,
  pastTenseStepTitle,
  splitMariAnswerWhy,
  type RunPhaseKind,
} from "../../../lib/mari-work-timeline";
import { CharacterSubject } from "../../characters/CharacterSubject";
import { LorebookSubject } from "../../lorebooks/LorebookSubject";

import { TranscriptRow } from "../MariTranscriptRow";
import { cn } from "../../../lib/utils";
import {
  collectMariReferencedResources,
  countMariListOutput,
  isMariNotFoundOutput,
  type MariReferencedResource,
} from "../../../lib/mari-referenced-resources";
import { fieldLabel } from "../../../lib/mari-edit-diff";
import { resourceResultType } from "../../../lib/command-icons";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  WorkspaceTimelineItem,
  WorkspaceToolCall,
  inferToolPresentation,
  asRecord,
  formatToolName,
  previewValue,
} from "./mari-tool-presentation";
import { buildMariReplyLinks, CompactMarkdown, MariReasoningPanel, MariFace } from "./MariReplyContent";

/**
 * Ticks while the run is active. Anchored to the run's own start when the steps carry one, so
 * closing and reopening the omnibar mid-run resumes the count instead of restarting at zero.
 */
function useWorkspaceElapsedSeconds(active: boolean, startedAtMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  const mountedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      mountedAtRef.current = null;
      return;
    }
    mountedAtRef.current ??= Date.now();
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [active]);

  if (!active) return 0;
  const anchor = startedAtMs ?? mountedAtRef.current;
  return anchor ? Math.max(0, Math.floor((now - anchor) / 1_000)) : 0;
}

type WorkspaceToolItem = Extract<WorkspaceTimelineItem, { type: "tool" }>;

/**
 * What the live line says between steps depends on where she is and how long you have waited, not on a
 * timer: a fresh start, going over what she just found (naming it when she can), a longer wait, a very
 * long one, or writing her answer. Sizes of each `mari.workCard.phrases.<group>.pN` group in en.json.
 */
const MARI_PHRASE_GROUPS = { start: 8, review: 8, reviewSubject: 4, long: 8, veryLong: 6, replying: 8 } as const;
const MARI_LONG_WAIT_SECONDS = 15;
const MARI_VERY_LONG_WAIT_SECONDS = 45;

/** A little pixel Mari. The inner span is keyed by scene, so a new scene pops in instead of cutting. */
function MariSprite({
  scene,
  role,
  pullTarget = true,
}: {
  scene: MariWorkAnimation;
  role: "working";
  /** D1: suppressed while an appended arrival at the bottom of the transcript owns the marker instead. */
  pullTarget?: boolean;
}) {
  const appearance = useMariAppearancePack();
  const sheet = useMariSpriteSource(scene.src);
  // Slice 85: she can be held while she works; the run goes on and she lands back on this line.
  return (
    <MariHold heldSrc={appearance.portraits.drag} hopOnTap>
      <span
        className="mari-live-work__sprite"
        data-scene={scene.id}
        data-role={role}
        data-appearance-pack={appearance.id}
        data-mari-pull-target={pullTarget ? "mari-current" : undefined}
        data-mari-sheet={sheet.ready ? "ready" : "pending"}
        aria-hidden="true"
      >
        <span
          key={`${appearance.id}:${scene.id}`}
          style={{ "--mari-work-sprite": `url(${sheet.src})` } as CSSProperties}
        />
      </span>
    </MariHold>
  );
}

/**
 * What Mari is doing right now, as one line. A new phrase writes itself in letter by letter while
 * the old one lifts away; screen readers get the plain text once.
 */
function MariLiveHeadline({ text, subject }: { text: string; subject?: string | null }) {
  const reduceMotion = useReducedMotion();
  const letters = (value: string, offset: number) =>
    [...value].map((char, index) => (
      <span
        key={index}
        className="mari-work-timeline__char"
        style={{ "--i": Math.min(offset + index, 40) } as CSSProperties}
      >
        {char}
      </span>
    ));
  return (
    <span className="mari-work-timeline__phrase" role="status">
      <AnimatePresence initial={false}>
        <motion.span
          key={`${text}\u0000${subject ?? ""}`}
          className="mari-work-timeline__line"
          exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="sr-only">{subject ? [text, subject].join(" ") : text}</span>
          <span aria-hidden="true">
            {letters(text, 0)}
            {subject ? (
              <span className="mari-work-timeline__subject-text">{letters(` ${subject}`, [...text].length)}</span>
            ) : null}
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const PHASE_ICONS: Record<RunPhaseKind, LucideIcon> = { look: Search, change: Pencil, other: Terminal };

/**
 * Her reply column: the words and what they made, indented by an avatar gutter that is always there (so
 * nothing reflows when she arrives). On her newest finished reply she rests in it beside the first line.
 */
export function MariAnswer({
  restStory,
  pullTarget = true,
  children,
}: {
  restStory: MariStoryState | null;
  /** D1: suppressed while an appended arrival at the bottom of the transcript owns the marker instead. */
  pullTarget?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mari-answer" data-sprite={restStory ? "true" : undefined}>
      {restStory ? (
        <span className="mari-answer__sprite">
          <MariStorySprite
            key={restStory}
            state={restStory}
            settleTo={restStory === "success" ? "idle" : undefined}
            pullTarget={pullTarget}
          />
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** The green "done" check: it draws itself once when it mounts. */
function MariDoneMark({ className }: { className?: string }) {
  return (
    <svg className={cn("mari-work-timeline__done-mark", className)} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="8" transform="rotate(-90 9 9)" />
      <path d="M5.5 9.2l2.3 2.2 4.6-4.8" />
    </svg>
  );
}

/** R14 (item 3): the face of the record a step read directly (a character, a lorebook, an entry's lorebook…). */
function stepRecordFace(
  tool: WorkspaceToolCall,
  characterPreviews?: ReadonlyMap<string, CharacterPreviewModel>,
  lorebookPreviews?: ReadonlyMap<string, LorebookPreviewModel>,
) {
  const record = collectMariReferencedResources([tool]).find((resource) => !resource.fromList);
  if (!record || record.kind === "setting") return null;
  const character = record.kind === "character" ? characterPreviews?.get(record.id) : undefined;
  const lorebook = lorebookPreviews?.get(record.kind === "lorebookEntry" ? (record.parentId ?? "") : record.id);
  return {
    type: resourceResultType(record.kind),
    src: character?.avatarSrc ?? (record.kind === "lorebook" ? lorebook?.imageSrc : undefined),
    avatarCropStyle: character?.avatarCropStyle,
  };
}

const STEP_RECORD_SUFFIX = /\s+(?:character|persona|lorebook entries|lorebook entry|lorebook|chat|agent|preset)$/iu;

/**
 * Slice 72: one step in words - "Read · [face] Shrek", "Read · [face] Swamp Lore · 3 entries", "Updated · Shrek ·
 * scenario", or a read she could not do ("Couldn't find · missing-donkey"), which she worked around.
 */
function describeStep(
  tool: WorkspaceToolCall,
  t: (key: string, options?: Record<string, unknown>) => string,
  characterPreviews?: ReadonlyMap<string, CharacterPreviewModel>,
  lorebookPreviews?: ReadonlyMap<string, LorebookPreviewModel>,
) {
  const presentation = inferToolPresentation(tool);
  const input = asRecord(tool.input);
  const missed = tool.status === "error" && isLookStep(presentation.title);
  // The record the step is about, by its id (a write names no record in its output).
  const kind = typeof input?.action === "string" ? input.action.split(".")[0] : null;
  const recordId = String(input?.[`${kind}Id`] ?? input?.id ?? "");
  const character = kind === "character" ? characterPreviews?.get(recordId) : undefined;
  const lorebook = kind === "lorebook" ? lorebookPreviews?.get(String(input?.lorebookId ?? recordId)) : undefined;
  const entries = input?.action === "lorebook.entries" ? lorebook : undefined;
  const face =
    stepRecordFace(tool, characterPreviews, lorebookPreviews) ??
    (character
      ? { type: resourceResultType("character"), src: character.avatarSrc, avatarCropStyle: character.avatarCropStyle }
      : lorebook
        ? { type: resourceResultType("lorebook"), src: lorebook.imageSrc, avatarCropStyle: undefined }
        : null);
  const name =
    entries?.name ??
    presentation.detail ??
    character?.name ??
    lorebook?.name ??
    (missed
      ? (Object.entries(input ?? {}).find(
          ([key, value]) => /id$|query/iu.test(key) && typeof value === "string",
        )?.[1] as string | undefined)
      : undefined) ??
    null;
  const count = entries ? countMariListOutput(tool.output) : null;
  const patch = asRecord(input?.patch);
  const fields = patch ? Object.keys(patch).map((key) => fieldLabel(key).toLocaleLowerCase()) : [];
  const fact =
    count !== null
      ? t("ui.chat.homeprofessormarichat.refFact.entries", { count })
      : fields.length > 0
        ? fields.length > 2
          ? `${fields.slice(0, 2).join(", ")} +${fields.length - 2}`
          : fields.join(", ")
        : null;
  const title = pastTenseStepTitle(presentation.title);
  const verb = missed
    ? t(isMariNotFoundOutput(tool.output) ? "mari.workCard.couldNotFind" : "mari.workCard.couldNotRead")
    : face && name
      ? title.replace(STEP_RECORD_SUFFIX, "")
      : title;
  return {
    verb,
    name,
    fact,
    face: missed || !name ? null : face,
    missed,
    notFound: missed && isMariNotFoundOutput(tool.output),
    failed: tool.status === "error" && !missed,
  };
}

/** Slice 72: a failed step she did not work around (a write, a command) fails the run; a missed read does not. */
export function isHardStepFailure(tool: WorkspaceToolCall) {
  return tool.status === "error" && !isLookStep(inferToolPresentation(tool).title);
}

export function MariWorkTimeline({
  items,
  character,
  lorebook,
  active = true,
  restStory = null,
  goal = null,
  pullTarget = true,
  runFailed = false,
  startedAtMs = null,
  endedAtMs = null,
  characterPreviews,
  lorebookPreviews,
  actionResults = [],
  onOpenResource,
  held = false,
  children,
}: {
  items: WorkspaceTimelineItem[];
  character?: CharacterPreviewModel | null;
  lorebook?: LorebookPreviewModel | null;
  active?: boolean;
  /** R14: the run itself failed (a provider error, no answer), whatever its steps did. */
  runFailed?: boolean;
  /** R14 (item 7): when you sent the message, so the timer and "Worked for" never restart on a step. */
  startedAtMs?: number | null;
  /** When the run ended (her saved reply), for "Worked for". */
  endedAtMs?: number | null;
  /** Faces for the records a step names (R14 item 3). */
  characterPreviews?: ReadonlyMap<string, CharacterPreviewModel>;
  lorebookPreviews?: ReadonlyMap<string, LorebookPreviewModel>;
  /** Slice 72: what she changed, so its name in her answer links too. */
  actionResults?: readonly MariWorkspaceActionResult[];
  /** Slice 72: names in her finished answer open their record. */
  onOpenResource?: (resource: MariReferencedResource) => void;
  /** D1: suppressed while an appended arrival at the bottom of the transcript owns the marker instead. */
  pullTarget?: boolean;
  /** M5a: the request she reported acting on, as one muted line above the run. */
  goal?: ReactNode;
  /** On the newest finished turn, Mari stands on the "Worked for" line in this story. */
  restStory?: MariStoryState | null;
  /** UX-25: the turn holds a change for you, so it does not end on "Done". */
  held?: boolean;
  /** What she made (tiles, references), between her answer and the "Worked for" line. */
  children?: ReactNode;
}) {
  const { t } = useUiTranslation();
  const reduceMotion = useReducedMotion();
  const appearance = useMariAppearancePack();
  const toolItems = items.filter((item): item is WorkspaceToolItem => item.type === "tool");
  // Her thinking is part of the run too, so it counts toward "Worked for".
  const runTimings = items.flatMap((item): RunStepTiming[] =>
    item.type === "tool" ? [item.tool] : item.type === "thinking" ? [item] : [],
  );
  const runAnchorMs = resolveRunAnchorMs(startedAtMs, runTimings);
  const liveElapsedSeconds = useWorkspaceElapsedSeconds(active, runAnchorMs);
  const elapsedSeconds = active
    ? liveElapsedSeconds
    : resolveRunSeconds(runTimings, { startMs: runAnchorMs, endMs: endedAtMs });
  // R13: "Still on it" counts from her last visible change (a step, a thought), not from the run's start,
  // so each new round first names what she just did instead of a generic waiting line.
  const lastChangeMs = runTimings.reduce(
    (latest, timing) => Math.max(latest, timing.updatedAt || timing.startedAt || 0),
    0,
  );
  const quietSeconds =
    active && lastChangeMs ? Math.max(0, Math.floor((Date.now() - lastChangeMs) / 1_000)) : elapsedSeconds;
  // A finished run that failed, or still holds a failed step, is not a success, whatever the last step was.
  // Slice 72: a read she could not do and worked around is amber on its step; it does not fail the run.
  const failed = !active && (runFailed || toolItems.some(({ tool }) => isHardStepFailure(tool)));
  const missedTools = toolItems.filter(({ tool }) => tool.status === "error" && !isHardStepFailure(tool));
  // The running step is the live line itself, so it is not also a row in the list.
  const shownItems = active ? items.filter((item) => item.type !== "tool" || item.tool.status !== "running") : items;
  // M5a: what came before her first step, her steps as phases (all open while she runs, R13), then
  // her answer.
  const { intro, phases, tail } = groupRunPhases(shownItems, {
    active,
    describe: (tool) => ({ title: inferToolPresentation(tool).title, failed: tool.status === "error" }),
  });
  const introBlocks = buildWorkTimelineBlocks(intro);
  const tailBlocks = buildWorkTimelineBlocks(tail);
  const lastBlock = tailBlocks.at(-1);
  // Her words (and what they made) sit in one column with her avatar gutter on the left; a thought she
  // had before them stays with the work above.
  const answerStart = tailBlocks.findIndex((block) => block.kind === "text");
  const answerBlocks = answerStart < 0 ? [] : tailBlocks.slice(answerStart);
  // On the newest finished turn she rests beside her reply, like an avatar beside a bubble.
  const spriteBesideAnswer = !active && Boolean(restStory) && answerBlocks.length > 0;
  const replyLinks =
    !active && onOpenResource && answerBlocks.length > 0
      ? buildMariReplyLinks(
          answerBlocks.map((block) => (block.kind === "text" ? block.content : "")).join("\n\n"),
          toolItems.map(({ tool }) => tool),
          actionResults,
          characterPreviews ?? new Map(),
          lorebookPreviews ?? new Map(),
        )
      : undefined;
  const runningTool = active ? [...toolItems].reverse().find(({ tool }) => tool.status === "running") : undefined;
  // One scene per step, so the Mari who worked a step is the one left beside it when it is done.
  const stepAnimation = ({ tool }: WorkspaceToolItem) =>
    selectMariWorkAnimation({
      activity: inferToolPresentation(tool).title,
      toolNames: [tool.name],
      packId: appearance.id,
    });
  const runningPresentation = runningTool ? inferToolPresentation(runningTool.tool) : null;
  const replying = lastBlock?.kind === "text";
  const lastDoneSubject = [...toolItems].reverse().find(({ tool }) => tool.status === "done");
  const lastSubject = lastDoneSubject ? inferToolPresentation(lastDoneSubject.tool).detail : null;
  const phraseGroup: keyof typeof MARI_PHRASE_GROUPS = replying
    ? "replying"
    : quietSeconds >= MARI_VERY_LONG_WAIT_SECONDS
      ? "veryLong"
      : quietSeconds >= MARI_LONG_WAIT_SECONDS
        ? "long"
        : toolItems.length > 0
          ? lastSubject
            ? "reviewSubject"
            : "review"
          : "start";
  // Each finished step moves to the next phrase in the group; each run starts on its own phrase.
  const phraseIndex = pickMariPhraseIndex(
    MARI_PHRASE_GROUPS[phraseGroup],
    `${phraseGroup}:${startedAtMs ?? items[0]?.id ?? "mari"}`,
    toolItems.length,
  );
  const headline = runningPresentation
    ? { text: runningPresentation.title, subject: runningPresentation.detail }
    : {
        text: t(`mari.workCard.phrases.${phraseGroup}.p${phraseIndex}`, { subject: lastSubject ?? "" }),
        subject: null,
      };
  // While she works, one scene plays on the live line: the running step's, or a thinking one between steps.
  const liveScene = !active
    ? null
    : runningTool
      ? stepAnimation(runningTool)
      : selectMariWorkAnimation({
          // A long wait grows a seed; otherwise she thinks or edits.
          activity: replying ? "write" : quietSeconds >= MARI_LONG_WAIT_SECONDS ? "wait" : "think",
          toolNames: [],
          packId: appearance.id,
        });
  const renderBlock = (block: (typeof tailBlocks)[number]) => {
    if (block.kind !== "steps") {
      return block.kind === "text" ? (
        <CompactMarkdown
          key={block.id}
          // A finished answer's trailing "Why" list folds into one line under the outcome.
          content={!active && block === lastBlock ? splitMariAnswerWhy(block.content).answer : block.content}
          streaming={active && block === lastBlock}
          links={answerBlocks.includes(block) ? replyLinks : undefined}
          onOpenLink={onOpenResource}
        />
      ) : (
        <MariReasoningPanel
          key={block.id}
          thinking={block.content}
          seconds={block.seconds}
          live={active && block === lastBlock}
        />
      );
    }
    return (
      <ol key={block.id} className="mari-live-work__steps" aria-label={t("mari.workCard.progress")}>
        <AnimatePresence initial={false}>
          {block.steps.map((step) => {
            const { id, tool } = step;
            const described = describeStep(tool, t, characterPreviews, lorebookPreviews);
            return (
              // M3: append-only - no layout animation (it fought MariSmoothGrow's height transition and
              // produced a frame of overlapping/ghost rows). Still true here: no `layout` prop, no height
              // animation, the row never moves. The key includes status so a step's running->done/error
              // transition remounts just that row (a "changed" plop); an unrelated re-render (duration
              // ticking, sibling update) keeps the same key and replays nothing.
              <motion.li
                key={`${id}:${tool.status}`}
                data-status={described.missed ? "missed" : tool.status}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", visualDuration: 0.22, bounce: 0.25 }}
              >
                <details className="mari-live-work__step-details group">
                  <summary>
                    {/* Slice 72: the row's state leads it - the green check, an amber or red warning. */}
                    {tool.status === "error" ? (
                      <AlertTriangle className="mari-step__glyph" aria-hidden="true" />
                    ) : (
                      <MariDoneMark className="mari-step__glyph" />
                    )}
                    {stepText(described)}
                    <ChevronRight size="0.7rem" className="mari-live-work__step-chevron shrink-0" aria-hidden="true" />
                  </summary>
                  {technicalDetails(tool)}
                </details>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    );
  };
  // Consecutive work blocks (thoughts and steps) share one rail; her words sit at full width between them.
  const renderSegments = (list: typeof tailBlocks) => {
    const out: ReactNode[] = [];
    let rail: ReactNode[] = [];
    const flush = () => {
      if (!rail.length) return;
      out.push(
        <div key={`rail-${out.length}`} className="mari-work-timeline__rail">
          {rail}
        </div>,
      );
      rail = [];
    };
    for (const block of list) {
      if (block.kind === "text") {
        flush();
        out.push(renderBlock(block));
      } else rail.push(renderBlock(block));
    }
    flush();
    return out;
  };
  const workedFor = t("mari.workCard.workedFor", { seconds: elapsedSeconds, count: toolItems.length });
  const missedLabel = (tools: readonly WorkspaceToolItem[]) =>
    t(
      tools.every(({ tool }) => isMariNotFoundOutput(tool.output)) ? "mari.workCard.notFound" : "mari.workCard.skipped",
      { count: tools.length },
    );
  const workedForMark = failed ? (
    <AlertTriangle size="0.8rem" className="mari-live-work__failed-icon" aria-hidden="true" />
  ) : (
    <MariDoneMark />
  );
  const restStoryText =
    // Slice 71 (N7): waiting on you has no words here; the "Needs you" card says what she waits for.
    restStory && restStory !== "idle" && restStory !== "success" && restStory !== "approval"
      ? t(`mari.stories.${restStory}`)
      : null;
  const technicalDetails = (tool: WorkspaceToolCall) => (
    <div className="mari-live-work__step-details-body">
      <div className="mari-live-work__step-details-label">
        <Terminal size="0.7rem" aria-hidden="true" />
        {t("mari.workCard.technicalDetails")}
      </div>
      <code>{formatToolName(tool.name)}</code>
      {tool.input !== undefined ? <pre>{previewValue(tool.input, 240)}</pre> : null}
      {tool.output !== null && tool.output !== undefined ? <pre>{previewValue(tool.output, 320)}</pre> : null}
    </div>
  );
  const stepText = (described: ReturnType<typeof describeStep>) => (
    <span className="mari-live-work__step-label">
      <span className="mari-step__verb">{described.verb}</span>
      {described.name ? (
        <span className="mari-live-work__step-subject">
          {described.face ? (
            <MariFace
              type={described.face.type}
              name={described.name}
              src={described.face.src}
              avatarCropStyle={described.face.avatarCropStyle}
            />
          ) : null}
          {described.name}
        </span>
      ) : null}
      {described.fact ? <span className="mari-step__fact">· {described.fact}</span> : null}
    </span>
  );
  const renderPhase = (phase: (typeof phases)[number]) => {
    const PhaseIcon = PHASE_ICONS[phase.kind];
    const phaseTools = phase.items.filter((item): item is WorkspaceToolItem => item.type === "tool");
    const phaseMissed = phaseTools.filter(({ tool }) => tool.status === "error" && !isHardStepFailure(tool));
    const status = (
      <>
        {phaseMissed.length > 0 ? <span className="mari-phase__missed">{missedLabel(phaseMissed)}</span> : null}
        {phase.failed > 0 ? (
          <span className="mari-phase__failed">{t("mari.workCard.phase.failed", { count: phase.failed })}</span>
        ) : null}
        {!phase.live && phase.failed === 0 ? <MariDoneMark className="mari-done-mark--step" /> : null}
      </>
    );
    const only = phaseTools.length === 1 && !phase.live ? phaseTools[0]!.tool : null;
    if (only) {
      // Slice 72: a phase of one step is that step on the phase line, not "Changed 1 thing" over one row.
      const rest = buildWorkTimelineBlocks<WorkspaceToolCall>(phase.items.filter((item) => item.type !== "tool"));
      return (
        <details key={phase.id} className="mari-phase" data-single="true" data-state="done">
          <summary className="mari-disclosure">
            <PhaseIcon size="0.85rem" className="shrink-0" aria-hidden="true" />
            {stepText(describeStep(only, t, characterPreviews, lorebookPreviews))}
            {status}
            <ChevronRight size="0.7rem" className="mari-disclosure__chevron shrink-0" aria-hidden="true" />
          </summary>
          <div className="mari-phase__body">
            {phase.caption ? <p className="mari-phase__caption">{phase.caption}</p> : null}
            {rest.map(renderBlock)}
            {technicalDetails(only)}
          </div>
        </details>
      );
    }
    // The faces of what a look phase read, stacked on its line, so a folded phase still says what it read.
    const faces =
      phase.kind === "look"
        ? [
            ...new Map(
              phaseTools.flatMap(({ tool }) => {
                const described = describeStep(tool, t, characterPreviews, lorebookPreviews);
                return described.face && described.name
                  ? [[described.name, { ...described.face, name: described.name }] as const]
                  : [];
              }),
            ).values(),
          ].slice(0, 3)
        : [];
    return (
      <details key={phase.id} className="mari-phase" open={phase.open} data-state={phase.live ? "live" : "done"}>
        <summary className="mari-disclosure">
          <PhaseIcon size="0.85rem" className="shrink-0" aria-hidden="true" />
          <span>
            {phase.live
              ? t(`mari.workCard.phase.${phase.kind}Live`)
              : t(`mari.workCard.phase.${phase.kind}`, { count: phase.steps - phaseMissed.length })}
          </span>
          {faces.length > 0 ? (
            <span className="mari-face-stack">
              {faces.map((face) => (
                <MariFace
                  key={face.name}
                  type={face.type}
                  name={face.name}
                  src={face.src}
                  avatarCropStyle={face.avatarCropStyle}
                />
              ))}
            </span>
          ) : null}
          {phase.live ? <span className="mari-phase__count">{phase.steps}</span> : null}
          {status}
          <ChevronRight size="0.7rem" className="mari-disclosure__chevron shrink-0" aria-hidden="true" />
        </summary>
        <div className="mari-phase__body">
          {phase.caption ? <p className="mari-phase__caption">{phase.caption}</p> : null}
          {buildWorkTimelineBlocks(phase.items).map(renderBlock)}
        </div>
      </details>
    );
  };
  const work = (
    <>
      {renderSegments(introBlocks)}
      {phases.length > 0 ? <div className="mari-work-timeline__rail">{phases.map(renderPhase)}</div> : null}
      {renderSegments(answerStart < 0 ? tailBlocks : tailBlocks.slice(0, answerStart))}
    </>
  );
  // Slice 72: on a finished run "Worked for" sits on top and folds the work below it - open on the newest
  // turn (its green checks stay in view), folded on older ones.
  const restLine = Boolean(restStory && (!spriteBesideAnswer || restStoryText));

  return (
    <TranscriptRow layout="document" marker={null}>
      <section
        className="mari-work-timeline"
        data-active={active ? "true" : "false"}
        data-outcome={failed ? "failed" : undefined}
        aria-label={t("mari.workCard.label")}
        aria-busy={active}
      >
        <MariResourceSubject character={character} lorebook={lorebook} className="mari-work-timeline__subject" />

        {goal}
        {active || toolItems.length === 0 ? (
          work
        ) : (
          <details className="mari-run" open={restStory !== null}>
            <summary className="mari-work-timeline__header">
              {workedForMark}
              <span className="mari-work-timeline__status">{workedFor}</span>
              {missedTools.length > 0 ? <span className="mari-run__missed">· {missedLabel(missedTools)}</span> : null}
              <ChevronRight size="0.7rem" className="mari-disclosure__chevron shrink-0" aria-hidden="true" />
            </summary>
            {work}
          </details>
        )}
        {answerBlocks.length > 0 || children ? (
          <MariAnswer restStory={spriteBesideAnswer ? restStory : null} pullTarget={pullTarget}>
            {renderSegments(answerBlocks)}
            {children}
          </MariAnswer>
        ) : null}

        {active ? (
          // The live line is always the last line, and working Mari leads it on the left: new work lands above
          // it and pushes the older lines up, so she is never left behind on an old step or clipped.
          <div className="mari-work-timeline__live">
            {liveScene ? <MariSprite scene={liveScene} role="working" pullTarget={pullTarget} /> : null}
            <MariLiveHeadline text={headline.text} subject={headline.subject} />
            <span
              className="mari-work-timeline__timer"
              aria-label={t("mari.workCard.elapsed", { seconds: elapsedSeconds })}
            >
              {[...String(elapsedSeconds), "s"].map((char, index, chars) => (
                // Keyed by place and value, so only the digit that changed rolls in.
                <span key={`${chars.length - index}:${char}`} aria-hidden="true">
                  {char}
                </span>
              ))}
            </span>
          </div>
        ) : restLine || (toolItems.length === 0 && answerBlocks.length > 0) ? (
          // Done: on the newest turn she rests beside her reply; only a turn without words keeps her on this
          // line, with her story. An answer without steps ends on a small done check (R13).
          <div className="mari-work-timeline__live" data-past={restStory && !spriteBesideAnswer ? undefined : "true"}>
            {restStory && !spriteBesideAnswer ? (
              <MariStorySprite
                key={restStory}
                state={restStory}
                settleTo={restStory === "success" ? "idle" : undefined}
                pullTarget={pullTarget}
              />
            ) : null}
            {restStoryText ? (
              <span className="text-xs text-[var(--muted-foreground)]">{restStoryText}</span>
            ) : toolItems.length === 0 && answerBlocks.length > 0 && !held ? (
              <span className="mari-work-timeline__done">
                <MariDoneMark />
                {t("mari.workCard.done")}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
    </TranscriptRow>
  );
}

export function MariResourceSubject({
  character,
  lorebook,
  compact = true,
  className,
}: {
  character?: CharacterPreviewModel | null;
  lorebook?: LorebookPreviewModel | null;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useUiTranslation();
  if (character) {
    return (
      <CharacterSubject
        character={character}
        label={t("ui.chat.homeprofessormarichat.aboutCharacter")}
        compact={compact}
        className={cn("w-fit max-w-full border-0 bg-[var(--primary)]/6", className)}
      />
    );
  }
  if (lorebook) {
    return (
      <LorebookSubject
        lorebook={lorebook}
        label={t("ui.chat.homeprofessormarichat.aboutLorebook")}
        compact={compact}
        className={cn("w-fit max-w-full border-0 bg-[var(--primary)]/6", className)}
      />
    );
  }
  return null;
}
