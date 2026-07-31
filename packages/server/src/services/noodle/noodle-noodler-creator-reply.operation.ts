import type { NoodlerCreatorReplyResult } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { tryNoodlerAccountOperation } from "./noodle-noodler-account-operation-lock.js";
import { generateNoodlerCreatorReply } from "./noodle-noodler-reply-generation.service.js";

export async function generateAndApplyNoodlerCreatorReply(
  db: DB,
  input: { postId: string; parentInteractionId: string; viewerAccountId: string; debugMode?: boolean },
): Promise<NoodlerCreatorReplyResult> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return { status: "ineligible" };
  const post = await noodle.getNoodlerPostById(input.postId);
  if (!post) return { status: "ineligible" };

  const locked = await tryNoodlerAccountOperation(post.authorAccountId, async () => {
    const connectionId = settings.generationConnectionId;
    if (!connectionId) return { status: "connection_required" } as const;
    const connection = await createConnectionsStorage(db).getWithKey(connectionId);
    if (!connection) return { status: "connection_not_found" } as const;
    const claim = await noodle.claimNoodlerCreatorReply(
      post.authorAccountId,
      post.id,
      input.parentInteractionId,
      input.viewerAccountId,
    );
    if (claim.status !== "claimed") return claim;
    let content: string;
    try {
      content = await generateNoodlerCreatorReply({
        db,
        creator: claim.creator,
        viewer: claim.viewer,
        post: claim.post,
        parent: claim.parent,
        connection,
        debugMode: input.debugMode,
      });
    } catch (error) {
      await noodle.releaseNoodlerCreatorReplyClaim(claim.claimId);
      throw error;
    }
    const interaction = await noodle.finalizeNoodlerCreatorReplyClaim(claim.claimId, content);
    if (!interaction) {
      await noodle.releaseNoodlerCreatorReplyClaim(claim.claimId);
      throw new Error("Failed to persist the generated NoodleR creator reply.");
    }
    return { status: "generated", interaction } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}
