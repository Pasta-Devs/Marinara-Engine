import type { SlashCommandContext } from "../../lib/slash-commands";

export interface InputDraftStore {
  get: (chatId: string) => string | undefined;
  set: (chatId: string, text: string) => void;
  clear: (chatId: string) => void;
}

/**
 * Slash commands still running, by chat: the text that was sent. The box clears on send, but the stored draft keeps
 * this text until the command succeeds, so a failed or lost run (a reload, or a mobile app killed in the background)
 * can still hand it back. An empty box does not clear a held draft.
 */
export function createSubmittedDraftHold(drafts: InputDraftStore) {
  const held = new Map<string, string>();
  return {
    hold(chatId: string, text: string) {
      if (!text.trim()) {
        drafts.clear(chatId);
        return;
      }
      held.set(chatId, text);
      drafts.set(chatId, text);
    },
    /** Ends a hold. A success clears the stored draft unless the user has typed a new one since. */
    release(chatId: string, text: string, succeeded: boolean) {
      if (held.get(chatId) === text) held.delete(chatId);
      if (succeeded && drafts.get(chatId) === text) drafts.clear(chatId);
    },
    /** Stores an empty box's draft: nothing, or the held text of a command still running in that chat. */
    storeEmpty(chatId: string) {
      const text = held.get(chatId);
      if (text) drafts.set(chatId, text);
      else drafts.clear(chatId);
    },
    /** The draft to show on opening a chat. A held draft comes back only if its command fails. */
    shownDraft(chatId: string, storedDraft: string) {
      return held.get(chatId) === storedDraft ? "" : storedDraft;
    },
  };
}

export type SubmittedDraftHold = ReturnType<typeof createSubmittedDraftHold>;

/**
 * Runs a slash command with its typed text held. A generating command reports failure as `false` instead of
 * throwing; on that or a throw, `restore` hands the text back (a throw is then rethrown). Only a success clears the
 * stored draft.
 */
export async function runHeldSlashCommand<Result>(input: {
  drafts: SubmittedDraftHold;
  chatId: string;
  text: string;
  ctx: SlashCommandContext;
  execute: (ctx: SlashCommandContext) => Promise<Result>;
  restore: () => void;
}): Promise<Result> {
  const { drafts, chatId, text, ctx } = input;
  let generationSucceeded: boolean | undefined;
  const trackedCtx: SlashCommandContext = {
    ...ctx,
    generate: async (params) => {
      const succeeded = await ctx.generate(params);
      if (succeeded !== undefined) generationSucceeded = succeeded;
      return succeeded;
    },
  };
  const restore = () => {
    drafts.release(chatId, text, false);
    input.restore();
  };

  drafts.hold(chatId, text);
  let result: Result;
  try {
    result = await input.execute(trackedCtx);
  } catch (error) {
    restore();
    throw error;
  }
  if (generationSucceeded === false) restore();
  else drafts.release(chatId, text, true);
  return result;
}
