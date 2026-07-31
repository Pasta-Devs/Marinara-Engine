import type { DB } from "../../db/connection.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage, noodlerReservePolicyFingerprint } from "../storage/noodle.storage.js";
import { generateNoodlerPost } from "./noodle-noodler-generation.service.js";
import { generateNoodlerPostImage } from "./noodle-noodler-images.service.js";
import { tryNoodlerAccountOperation } from "./noodle-noodler-account-operation-lock.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { unlinkNoodlerMedia } from "./noodle-noodler-media.js";
import {
  BackgroundConnectionBusyError,
  ConnectionAttemptRejectedError,
} from "../generation/connection-admission.js";

const DAY_MS = 24 * 60 * 60 * 1000;

class NoodlerAttemptUnavailableError extends Error {
  constructor(readonly status: "exhausted" | "holding") {
    super(`Automatic NoodleR attempt ${status}.`);
  }
}

function plannedPublicationTimes(now: Date, postsPerDay: number): string[] {
  const interval = DAY_MS / postsPerDay;
  return Array.from({ length: postsPerDay }, (_, index) =>
    new Date(now.getTime() + interval * (index + 1)).toISOString(),
  );
}

export function isNoodlerNightQuietTime(at: Date): boolean {
  const hour = at.getHours();
  return hour >= 23 || hour < 7;
}

export async function prepareNextNoodlerReservePost(
  db: DB,
  at = new Date(),
): Promise<"prepared" | "covered" | "disabled" | "holding" | "exhausted" | "busy" | "ineligible" | "missed"> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler || !settings.autoPostingScheduleEnabled) return "disabled";
  const state = await noodle.ensureNoodlerReserveState(at);
  if (at.getTime() < Date.parse(state.preparationNotBefore)) return "holding";

  const [items, accounts] = await Promise.all([
    noodle.listNoodlerPreparedPosts(),
    noodle.listAutoPostEnabledAccounts(),
  ]);
  const validPrepared = items.filter((item) => item.state === "prepared" && Date.parse(item.publishAt) > at.getTime());
  const covered = new Set(validPrepared.map((item) => item.publishAt));
  const publishAt = plannedPublicationTimes(at, settings.postsPerDay).find(
    (candidate) =>
      ![...covered].some(
        (existing) => Math.abs(Date.parse(existing) - Date.parse(candidate)) < DAY_MS / settings.postsPerDay / 2,
      ),
  );
  if (!publishAt) return "covered";
  if (accounts.length === 0) return "ineligible";
  let eligibleAccounts = accounts;
  if (settings.noodlerNightQuiet && isNoodlerNightQuietTime(new Date(publishAt))) {
    eligibleAccounts = accounts.filter((account) => account.kind !== "character");
  }
  if (eligibleAccounts.length === 0) return "ineligible";

  const lastActivity = new Map<string, number>();
  for (const account of eligibleAccounts) {
    const posts = await noodle.listNoodlerPostsByAccount(account.id, 1);
    const preparedTimes = validPrepared
      .filter((item) => item.creatorAccountId === account.id)
      .map((item) => Date.parse(item.publishAt));
    lastActivity.set(account.id, Math.max(Date.parse(posts[0]?.createdAt ?? "0"), ...preparedTimes, 0));
  }
  const account = [...eligibleAccounts].sort(
    (a, b) => (lastActivity.get(a.id) ?? 0) - (lastActivity.get(b.id) ?? 0) || a.id.localeCompare(b.id),
  )[0]!;

  const locked = await tryNoodlerAccountOperation(account.id, async () => {
    const connectionId = settings.generationConnectionId;
    if (!connectionId) return "ineligible" as const;
    const connection = await createConnectionsStorage(db).getWithKey(connectionId);
    if (!connection) return "ineligible" as const;
    try {
      let payload = await generateNoodlerPost(db, {
        account,
        connection,
        prepareOnly: true,
        admissionMode: {
          kind: "background",
          beforeAttempt: async () => {
            const claim = await noodle.claimNoodlerAutomaticAttempt("text", settings.postsPerDay, at);
            if (claim.status !== "claimed") throw new NoodlerAttemptUnavailableError(claim.status);
            return (outcome) => noodle.completeNoodlerAutomaticAttempt(claim.claimId, outcome);
          },
        },
        request: {
          mode: "noodler",
          targetAccountId: account.id,
          access: "locked",
          noodlerPostGuide: `Write a standalone post appropriate for publication at ${publishAt}. Do not refer to events after the current moment.`,
        },
      });
      if (account.settings.scheduler.autoPosting?.imagesEnabled && payload.imagePrompt) {
        const imageConnection = settings.imageGenerationConnectionId
          ? await createConnectionsStorage(db).getWithKey(settings.imageGenerationConnectionId)
          : await createConnectionsStorage(db).getDefaultForImageGeneration();
        if (imageConnection) {
          try {
            const linkedPublicAccount = account.noodleAccountId
              ? await noodle.getAccountById(account.noodleAccountId)
              : null;
            const image = await generateNoodlerPostImage({
              account,
              linkedPublicAccount,
              disclosureMode: account.settings.privacy.identityDisclosure ?? "secret",
              postContent: payload.content,
              draftPrompt: payload.imagePrompt,
              settings,
              characters: createCharactersStorage(db),
              promptOverrides: createPromptOverridesStorage(db),
              imageConnection,
              db,
              debugMode: false,
              admissionMode: {
                kind: "background",
                beforeAttempt: async () => {
                  const claim = await noodle.claimNoodlerAutomaticAttempt("image", settings.postsPerDay, at);
                  if (claim.status !== "claimed") throw new NoodlerAttemptUnavailableError(claim.status);
                  return (outcome) => noodle.completeNoodlerAutomaticAttempt(claim.claimId, outcome);
                },
              },
            });
            image.stagedMedia?.promote();
            payload = { ...payload, metadata: { ...payload.metadata, ...image.metadata } };
          } catch (error) {
            if (
              error instanceof BackgroundConnectionBusyError ||
              (error instanceof ConnectionAttemptRejectedError && error.cause instanceof NoodlerAttemptUnavailableError)
            ) {
              payload = { ...payload, metadata: { ...payload.metadata, imageGenerationDeferred: true } };
            } else {
              payload = { ...payload, metadata: { ...payload.metadata, imageGenerationFailed: true } };
            }
          }
        }
      }
      const completedAt = new Date();
      if (completedAt.getTime() >= Date.parse(publishAt)) {
        const mediaPath = payload.metadata.noodlerMediaPath;
        unlinkNoodlerMedia(typeof mediaPath === "string" ? mediaPath : null);
        return "missed" as const;
      }
      await noodle.createNoodlerPreparedPost({
        creatorAccountId: account.id,
        generatedAt: completedAt.toISOString(),
        publishAt,
        payload,
        policyFingerprint: noodlerReservePolicyFingerprint(
          account,
          settings,
          account.noodleAccountId ? (await noodle.getAccountById(account.noodleAccountId))?.updatedAt : null,
        ),
      });
      return "prepared" as const;
    } catch (error) {
      if (error instanceof BackgroundConnectionBusyError) return "busy" as const;
      if (error instanceof ConnectionAttemptRejectedError && error.cause instanceof NoodlerAttemptUnavailableError) {
        return error.cause.status;
      }
      throw error;
    }
  });
  return locked.acquired ? locked.value : "busy";
}

export async function reconcileNoodlerReserve(db: DB, at = new Date()): Promise<number> {
  const noodle = createNoodleStorage(db);
  await noodle.reconcileNoodlerPreparedPosts(at);
  return noodle.publishDueNoodlerPreparedPosts(at);
}
