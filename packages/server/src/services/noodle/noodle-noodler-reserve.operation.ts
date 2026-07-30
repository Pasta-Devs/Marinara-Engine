import type { DB } from "../../db/connection.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage, noodlerReservePolicyFingerprint } from "../storage/noodle.storage.js";
import { generateNoodlerPost } from "./noodle-noodler-generation.service.js";
import { generateNoodlerPostImage } from "./noodle-noodler-images.service.js";
import { tryNoodlerAccountOperation } from "./noodle-noodler-account-operation-lock.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { tryBackgroundConnection } from "../generation/connection-admission.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function plannedPublicationTimes(now: Date, postsPerDay: number): string[] {
  const interval = DAY_MS / postsPerDay;
  return Array.from({ length: postsPerDay }, (_, index) =>
    new Date(now.getTime() + interval * (index + 1)).toISOString(),
  );
}

export async function prepareNextNoodlerReservePost(
  db: DB,
  at = new Date(),
): Promise<"prepared" | "covered" | "disabled" | "holding" | "exhausted" | "busy" | "ineligible"> {
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
    (candidate) => ![...covered].some((existing) => Math.abs(Date.parse(existing) - Date.parse(candidate)) < DAY_MS / settings.postsPerDay / 2),
  );
  if (!publishAt) return "covered";
  if (accounts.length === 0) return "ineligible";

  const lastActivity = new Map<string, number>();
  for (const account of accounts) {
    const posts = await noodle.listNoodlerPostsByAccount(account.id, 1);
    const preparedTimes = validPrepared.filter((item) => item.creatorAccountId === account.id).map((item) => Date.parse(item.publishAt));
    lastActivity.set(account.id, Math.max(Date.parse(posts[0]?.createdAt ?? "0"), ...preparedTimes, 0));
  }
  const account = [...accounts].sort(
    (a, b) => (lastActivity.get(a.id) ?? 0) - (lastActivity.get(b.id) ?? 0) || a.id.localeCompare(b.id),
  )[0]!;

  const locked = await tryNoodlerAccountOperation(account.id, async () => {
    const connectionId = settings.generationConnectionId;
    if (!connectionId) return "ineligible" as const;
    const connection = await createConnectionsStorage(db).getWithKey(connectionId);
    if (!connection) return "ineligible" as const;
    const textAdmission = tryBackgroundConnection(connection.id, at);
    if (!textAdmission.acquired) return "busy" as const;
    const claim = await noodle.claimNoodlerAutomaticAttempt("text", settings.postsPerDay, at);
    if (claim.status !== "claimed") {
      textAdmission.release();
      return claim.status;
    }
    try {
      let payload = await generateNoodlerPost(db, {
        account,
        connection,
        prepareOnly: true,
        request: {
          mode: "noodler",
          targetAccountId: account.id,
          access: "locked",
          noodlerPostGuide: `Write a standalone post appropriate for publication at ${publishAt}. Do not refer to events after the current moment.`,
        },
      });
      textAdmission.release();
      if (account.settings.scheduler.autoPosting?.imagesEnabled && payload.imagePrompt) {
        const imageConnection = settings.imageGenerationConnectionId
          ? await createConnectionsStorage(db).getWithKey(settings.imageGenerationConnectionId)
          : await createConnectionsStorage(db).getDefaultForImageGeneration();
        if (imageConnection) {
          const imageAdmission = tryBackgroundConnection(imageConnection.id, at);
          if (!imageAdmission.acquired) {
            payload = { ...payload, metadata: { ...payload.metadata, imageGenerationDeferred: true } };
          } else {
          const imageClaims = new Map<number, string>();
          try {
            const linkedPublicAccount = account.noodleAccountId ? await noodle.getAccountById(account.noodleAccountId) : null;
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
              beforeProviderAttempt: async () => {
                const imageClaim = await noodle.claimNoodlerAutomaticAttempt("image", settings.postsPerDay, at);
                if (imageClaim.status !== "claimed") throw new Error(`Automatic image attempt ${imageClaim.status}.`);
                imageClaims.set(imageClaims.size + 1, imageClaim.claimId);
              },
              onProviderAttemptFailure: async (attempt) => {
                const failedClaim = imageClaims.get(attempt);
                if (failedClaim) await noodle.completeNoodlerAutomaticAttempt(failedClaim, "failed");
              },
            });
            image.stagedMedia?.promote();
            payload = { ...payload, metadata: { ...payload.metadata, ...image.metadata } };
            const successfulClaim = imageClaims.get(imageClaims.size);
            if (successfulClaim) await noodle.completeNoodlerAutomaticAttempt(successfulClaim, "completed");
          } catch {
            await Promise.all(
              [...imageClaims.values()].map((id) => noodle.completeNoodlerAutomaticAttempt(id, "failed")),
            );
            payload = { ...payload, metadata: { ...payload.metadata, imageGenerationFailed: true } };
          } finally {
            imageAdmission.release();
          }
          }
        }
      }
      await noodle.createNoodlerPreparedPost({
        creatorAccountId: account.id,
        generatedAt: at.toISOString(),
        publishAt,
        payload,
        policyFingerprint: noodlerReservePolicyFingerprint(
          account,
          settings,
          account.noodleAccountId ? (await noodle.getAccountById(account.noodleAccountId))?.updatedAt : null,
        ),
      });
      await noodle.completeNoodlerAutomaticAttempt(claim.claimId, "completed");
      return "prepared" as const;
    } catch (error) {
      textAdmission.release();
      await noodle.completeNoodlerAutomaticAttempt(claim.claimId, "failed");
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
