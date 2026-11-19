/**
 * #9340: Professor Mari's composer draft, saved to the shared drafts store (and so localStorage) after a pause in
 * typing instead of on every keystroke, as the chat inputs do: each save made a new drafts map, which re-rendered
 * the chat list. An emptied draft (a send, a new chat) and a flush (unmount, pagehide) are saved at once, so a sent
 * message never comes back after a reload. A store value other than the one saved last was written elsewhere (the
 * omnibar's handoff) and replaces the draft, unsaved typing included, as it did when the store held every keystroke.
 */
export function createMariDraftPersist(saved: string, save: (value: string) => void, delayMs = 300) {
  let draft = saved;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const flush = () => {
    stop();
    if (draft === saved) return;
    saved = draft;
    save(draft);
  };
  return {
    current: () => draft,
    /** An edit: the draft now, the store after the pause, or at once when the draft is empty. */
    set(value: string) {
      draft = value;
      stop();
      if (value) timer = setTimeout(flush, delayMs);
      else flush();
    },
    flush,
    /** The store's value for her draft changed. Returns the draft to show when another writer set it, else null. */
    stored(value: string): string | null {
      if (value === saved) return null;
      stop();
      saved = value;
      draft = value;
      return value;
    },
  };
}

/**
 * #9340: `next` is `previous` with text put in at one place (typing, a paste). That can only add lines to the
 * composer, so it needs measuring only once the text overflows the field; any other edit may need fewer lines.
 */
export function onlyInsertedInto(previous: string, next: string) {
  if (next.length <= previous.length) return false;
  let start = 0;
  while (start < previous.length && previous[start] === next[start]) start += 1;
  return next.endsWith(previous.slice(start));
}
