// ──────────────────────────────────────────────
// Novel Mode: the book as one ProseMirror document
// ──────────────────────────────────────────────
// The whole novel is one editor document: a passage node per message, each holding its book
// paragraphs, then the writer's draft passage at the end. Passages stay messages on the server,
// so an edit may cross passages but never removes one: each keeps its message, swipes and media.
import { Node, getSchema, mergeAttributes, type JSONContent } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Italic } from "@tiptap/extension-italic";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Fragment, Slice, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { EditorState, Plugin, PluginKey, Selection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/** Marks the editor's own transactions that mirror the messages; they are not user edits or undo steps. */
export const NOVEL_SYNC_META = "novelSync";

export interface NovelPassageAttrs {
  /** The message this passage shows; null for text the writer has not saved yet. */
  messageId: string | null;
  /** The writer's line at the end of the page. */
  draft: boolean;
  /** Names unsaved text waiting to become a message. */
  pendingKey: string | null;
}

/** A message's book paragraphs: its non-blank lines. */
export function splitNovelParagraphs(content: string): string[] {
  return content.split("\n").filter((line) => line.trim());
}

/** A stretch of a paragraph's text and the marks it carries. */
interface NovelRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

const isNovelSpace = (char: string | undefined) => char === undefined || /\s/u.test(char);
const isNovelPunctuation = (char: string | undefined) => char !== undefined && /[\p{P}\p{S}]/u.test(char);

interface NovelDelimiter {
  char: string;
  start: number;
  end: number;
  length: number;
  canOpen: boolean;
  canClose: boolean;
  active: boolean;
}

/**
 * Reads a paragraph's *italic*, _italic_, **bold** and __bold__ with CommonMark's emphasis rules, cut down
 * to those two marks. A marker opens only before text and closes only after it, so "5 * 3", a lone "*", an
 * unmatched marker and a backslash-escaped one stay as written; "_" never opens or closes inside a word.
 * All other markdown stays literal text. A paragraph is one line, so no mark spans a line break.
 */
export function parseNovelMarks(line: string): NovelRun[] {
  const delimiters: NovelDelimiter[] = [];
  for (let i = 0; i < line.length;) {
    const char = line[i]!;
    if (char === "\\") {
      // ponytail: an escape stays as written, backslash included (the Roleplay renderer hides it). Upgrade
      // path: hide it here too, and escape literal markers on save, if models start writing escapes.
      i += 2;
      continue;
    }
    if (char !== "*" && char !== "_") {
      i++;
      continue;
    }
    let end = i;
    while (line[end] === char) end++;
    const before = line[i - 1];
    const after = line[end];
    const leftFlanking =
      !isNovelSpace(after) && (!isNovelPunctuation(after) || isNovelSpace(before) || isNovelPunctuation(before));
    const rightFlanking =
      !isNovelSpace(before) && (!isNovelPunctuation(before) || isNovelSpace(after) || isNovelPunctuation(after));
    delimiters.push({
      char,
      start: i,
      end,
      length: end - i,
      canOpen: char === "*" ? leftFlanking : leftFlanking && (!rightFlanking || isNovelPunctuation(before)),
      canClose: char === "*" ? rightFlanking : rightFlanking && (!leftFlanking || isNovelPunctuation(after)),
      active: true,
    });
    i = end;
  }

  const bold = new Array<boolean>(line.length).fill(false);
  const italic = new Array<boolean>(line.length).fill(false);
  const hidden = new Array<boolean>(line.length).fill(false);
  delimiters.forEach((closer, closerIndex) => {
    if (!closer.canClose) return;
    while (closer.start < closer.end) {
      let openerIndex = closerIndex - 1;
      for (; openerIndex >= 0; openerIndex--) {
        const opener = delimiters[openerIndex]!;
        if (!opener.active || opener.char !== closer.char || !opener.canOpen || opener.start === opener.end) continue;
        // CommonMark's rule of three: "*a**b*" is one italic, not an italic and a stray bold marker.
        const sum = opener.length + closer.length;
        const multiples = opener.length % 3 === 0 && closer.length % 3 === 0;
        if ((opener.canClose || closer.canOpen) && sum % 3 === 0 && !multiples) continue;
        break;
      }
      if (openerIndex < 0) break;
      const opener = delimiters[openerIndex]!;
      const use = opener.end - opener.start >= 2 && closer.end - closer.start >= 2 ? 2 : 1;
      const marks = use === 2 ? bold : italic;
      for (let k = opener.end; k < closer.start; k++) marks[k] = true;
      opener.end -= use;
      for (let k = 0; k < use; k++) hidden[opener.end + k] = hidden[closer.start + k] = true;
      closer.start += use;
      // Markers between the pair can no longer match: "*a _b* c_" is one italic.
      for (let k = openerIndex + 1; k < closerIndex; k++) delimiters[k]!.active = false;
    }
  });

  const runs: NovelRun[] = [];
  for (let k = 0; k < line.length; k++) {
    if (hidden[k]) continue;
    const last = runs.at(-1);
    if (last && last.bold === bold[k] && last.italic === italic[k]) last.text += line[k];
    else runs.push({ text: line[k]!, bold: bold[k]!, italic: italic[k]! });
  }
  return runs;
}

const NOVEL_MARKERS = { bold: "**", italic: "*" } as const;

/**
 * Writes a paragraph's runs back as markdown, always as *italic* and **bold**. Text is written as it
 * stands, so what parseNovelMarks read comes back unchanged (in that style). Spaces at a mark's edges move
 * outside it, since "**word **" would not read back as bold.
 */
export function serializeNovelMarks(runs: NovelRun[]): string {
  const chars = runs.flatMap((run) => Array.from(run.text, (char) => ({ char, bold: run.bold, italic: run.italic })));
  const markEnd = (from: number, mark: keyof typeof NOVEL_MARKERS) => {
    let end = from;
    while (end < chars.length && chars[end]![mark]) end++;
    return end;
  };
  for (const mark of ["bold", "italic"] as const) {
    for (let start = 0; start < chars.length; start++) {
      if (!chars[start]![mark]) continue;
      const end = markEnd(start, mark);
      for (let k = start; k < end && /\s/u.test(chars[k]!.char); k++) chars[k]![mark] = false;
      for (let k = end - 1; k >= start && /\s/u.test(chars[k]!.char); k--) chars[k]![mark] = false;
      start = end;
    }
  }
  // ponytail: marks that overlap without nesting (bold "ab", italic "bc") close and reopen, which can
  // read back differently; the shortcuts rarely make them. Upgrade path: split the overlap into nested runs.
  let out = "";
  const open: Array<keyof typeof NOVEL_MARKERS> = [];
  for (let i = 0; i <= chars.length; i++) {
    const char = chars[i];
    const closeFrom = open.findIndex((mark) => !char?.[mark]);
    if (closeFrom >= 0) while (open.length > closeFrom) out += NOVEL_MARKERS[open.pop()!];
    if (!char) break;
    // Of two marks opening together, the longer one goes outside, so the shorter closes first.
    const opening = (["bold", "italic"] as const)
      .filter((mark) => char[mark] && !open.includes(mark))
      .sort((a, b) => markEnd(i, b) - markEnd(i, a));
    for (const mark of opening) {
      out += NOVEL_MARKERS[mark];
      open.push(mark);
    }
    out += char.char;
  }
  return out;
}

/**
 * A message's text as the editor writes it back, with a blank line between paragraphs: what its baseline
 * holds, so a passage counts as unedited whatever paragraph breaks or marker style the message used.
 */
export function normalizeNovelText(content: string): string {
  return splitNovelParagraphs(content)
    .map((line) => serializeNovelMarks(parseNovelMarks(line)))
    .join("\n\n");
}

/** The paragraph break a message uses: a single line break if it never leaves a blank line, else a blank line. */
export function novelParagraphSeparator(content: string): string {
  const lines = content.trim().split("\n");
  return lines.length > 1 && lines.every((line) => line.trim()) ? "\n" : "\n\n";
}

/** A passage's text as markdown, its paragraphs joined by the separator (a blank line unless told otherwise). */
// Passage nodes are immutable and untouched ones are reused, so each is serialized once (default separator).
const passageTextCache = new WeakMap<PMNode, string>();

export function novelPassageText(passage: PMNode, separator = "\n\n"): string {
  const cached = separator === "\n\n" ? passageTextCache.get(passage) : undefined;
  if (cached !== undefined) return cached;
  const paragraphs: string[] = [];
  passage.forEach((paragraph) => {
    if (!paragraph.textContent.trim()) return;
    const runs: NovelRun[] = [];
    paragraph.forEach((text) => {
      const marked = (name: string) => text.marks.some((mark) => mark.type.name === name);
      runs.push({ text: text.text ?? "", bold: marked("bold"), italic: marked("italic") });
    });
    paragraphs.push(serializeNovelMarks(runs));
  });
  const text = paragraphs.join(separator);
  if (separator === "\n\n") passageTextCache.set(passage, text);
  return text;
}

/** One name for a passage across edits: its message, else its pending save, else the draft. */
export function novelPassageKey(attrs: NovelPassageAttrs): string | null {
  return attrs.messageId ?? attrs.pendingKey ?? (attrs.draft ? "draft" : null);
}

export function novelPassageAttrs(passage: PMNode): NovelPassageAttrs {
  return passage.attrs as NovelPassageAttrs;
}

export function createNovelPassage(schema: Schema, attrs: Partial<NovelPassageAttrs>, content: string): PMNode {
  const paragraphs = splitNovelParagraphs(content).map((line) =>
    schema.nodes.paragraph!.create(
      null,
      parseNovelMarks(line).map(({ text, bold, italic }) =>
        schema.text(text, [
          ...(bold ? [schema.marks.bold!.create()] : []),
          ...(italic ? [schema.marks.italic!.create()] : []),
        ]),
      ),
    ),
  );
  return schema.nodes.passage!.create(attrs, paragraphs.length ? paragraphs : schema.nodes.paragraph!.create());
}

export function novelDocumentJSON(): JSONContent {
  return { type: "doc", content: [{ type: "passage", attrs: { draft: true }, content: [{ type: "paragraph" }] }] };
}

/** One passage of the novel; the editor gives it a view with the message's actions. */
export const NovelPassage = Node.create({
  name: "passage",
  content: "paragraph+",
  // Backspace and Delete stop at a passage's edge instead of joining two messages.
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      messageId: { default: null, rendered: false },
      draft: { default: false, rendered: false },
      pendingKey: { default: null, rendered: false },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-novel-passage]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-novel-passage": "" }), 0];
  },
});

export const NovelDocument = Node.create({ name: "doc", topNode: true, content: "passage+" });

export const NovelParagraph = Paragraph.configure({ HTMLAttributes: { class: "mari-novel-paragraph" } });
export { Text as NovelText };

// A novel's only formatting: italic and bold, saved as *…* and **…** (Ctrl/Cmd+I and Ctrl/Cmd+B). Without
// input or paste rules, asterisks the writer types stay as typed ("5 * 3 *" is not turned italic); they are
// read as marks the next time the passage is loaded, which saves the same markdown either way.
export const NovelItalic = Italic.extend({ addInputRules: () => [], addPasteRules: () => [] });
export const NovelBold = Bold.extend({ addInputRules: () => [], addPasteRules: () => [] });

/** The novel's document state without an editor view, for checking the document logic in Node. */
export function createNovelState(doc: JSONContent = novelDocumentJSON()): EditorState {
  const schema = getSchema([NovelDocument, NovelPassage, NovelParagraph, Text, NovelBold, NovelItalic]);
  return EditorState.create({ schema, doc: schema.nodeFromJSON(doc), plugins: [novelPassageGuard()] });
}

/** Whether from..to reaches across more than one passage. */
export function crossesNovelPassages(doc: PMNode, from: number, to: number): boolean {
  return from !== to && doc.resolve(from).index(0) !== doc.resolve(to).index(0);
}

/**
 * Deletes from..to inside each passage it touches, keeping every passage (and its message), and puts
 * the caret at from. Returns false when the range stays inside one passage.
 */
export function deleteAcrossNovelPassages(tr: Transaction, from: number, to: number): boolean {
  const { doc } = tr;
  if (!crossesNovelPassages(doc, from, to)) return false;
  const $from = doc.resolve(from);
  const first = $from.index(0);
  const last = doc.resolve(to).index(0);
  // Later passages first, so the earlier positions still hold.
  for (let index = last; index >= first; index--) {
    const start = $from.posAtIndex(index, 0);
    const passage = doc.child(index);
    const contentStart = start + 1;
    const contentEnd = contentStart + passage.content.size;
    const deleteFrom = Math.max(from, contentStart);
    const deleteTo = Math.min(to, contentEnd);
    if (deleteFrom >= deleteTo) continue;
    if (deleteFrom === contentStart && deleteTo === contentEnd) {
      // A passage emptied entirely keeps one empty paragraph to write in.
      tr.replaceWith(contentStart, contentEnd, tr.doc.type.schema.nodes.paragraph!.create());
    } else {
      tr.delete(deleteFrom, deleteTo);
    }
  }
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size))));
  return true;
}

/** Text copied from the novel pastes as paragraphs, never as more passages with the same message. */
export function flattenPastedNovelPassages(slice: Slice): Slice {
  let hasPassage = false;
  const nodes: PMNode[] = [];
  slice.content.forEach((node) => {
    if (node.type.name !== "passage") return void nodes.push(node);
    hasPassage = true;
    node.forEach((child) => nodes.push(child));
  });
  if (!hasPassage) return slice;
  return new Slice(Fragment.from(nodes), Math.max(0, slice.openStart - 1), Math.max(0, slice.openEnd - 1));
}

function passageKeys(doc: PMNode): Set<string> {
  const keys = new Set<string>();
  doc.forEach((passage) => {
    const key = novelPassageKey(novelPassageAttrs(passage));
    if (key) keys.add(key);
  });
  return keys;
}

/**
 * The backstop for edit paths the editor does not handle itself (dragging text, composition): a user
 * edit that would remove a passage is refused rather than losing its message.
 */
export function novelPassageGuard(): Plugin {
  return new Plugin({
    key: new PluginKey("novelPassageGuard"),
    filterTransaction(tr: Transaction, state: EditorState) {
      if (!tr.docChanged || tr.getMeta(NOVEL_SYNC_META)) return true;
      const after = passageKeys(tr.doc);
      for (const key of passageKeys(state.doc)) if (!after.has(key)) return false;
      return novelPassageAttrs(tr.doc.lastChild!).draft;
    },
  });
}

/** Positions, in `before`, of the message passages whose text `after` changes or removes. */
export function changedNovelPassages(before: PMNode, after: PMNode): number[] {
  const afterById = new Map<string, PMNode>();
  after.forEach((passage) => {
    const { messageId } = novelPassageAttrs(passage);
    if (messageId) afterById.set(messageId, passage);
  });
  const changed: number[] = [];
  before.forEach((passage, offset) => {
    const { messageId } = novelPassageAttrs(passage);
    const next = messageId ? afterById.get(messageId) : passage;
    // Untouched passages are the same node, so only the edited ones are compared.
    if (next !== passage && !next?.content.eq(passage.content)) changed.push(offset);
  });
  return changed;
}

/**
 * Refuses a user edit to a passage whose editable text is hidden (translated or collapsed, with the
 * usual content shown in its place): the writer cannot see what it would change, as with Select All.
 */
export function novelHiddenPassageGuard(): Plugin {
  let view: EditorView | null = null;
  return new Plugin({
    key: new PluginKey("novelHiddenPassageGuard"),
    view(editorView) {
      view = editorView;
      return { destroy: () => void (view = null) };
    },
    filterTransaction(tr: Transaction, state: EditorState) {
      const current = view;
      if (!current || !tr.docChanged || tr.getMeta(NOVEL_SYNC_META)) return true;
      return !changedNovelPassages(state.doc, tr.doc).some((pos) => {
        const dom = current.nodeDOM(pos);
        return dom instanceof HTMLElement && !!dom.querySelector(".mari-novel-passage-view")?.closest("[hidden]");
      });
    },
  });
}

/** Marks the passage holding the caret, so it shows its actions as a hovered one does. */
export function novelCurrentPassage(): Plugin {
  return new Plugin({
    key: new PluginKey("novelCurrentPassage"),
    props: {
      decorations(state) {
        const { $from } = state.selection;
        const index = $from.index(0);
        const pos = $from.posAtIndex(index, 0);
        const passage = state.doc.maybeChild(index);
        if (!passage) return null;
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + passage.nodeSize, { class: "is-current-passage" }),
        ]);
      },
    },
  });
}

export interface NovelSyncMessage {
  id: string;
  content: string;
  activeSwipeIndex: number;
}

/** The text a passage was last given from its message, so the editor can tell the writer's edits apart. */
export interface NovelPassageBaseline {
  /** The message's text as normalizeNovelText gives it, to compare with novelPassageText. */
  text: string;
  swipe: number;
  /** The message's paragraph break, kept when an edit is saved; a blank line when not given. */
  separator?: string;
}

export interface NovelPassageEdit {
  messageId: string;
  /** The edited text, normalized as its baseline is. */
  text: string;
  /** What is saved to the message: the text with the message's own paragraph breaks. */
  content: string;
  /** The swipe the text was written on. */
  swipe: number;
}

/**
 * The writer's edits not yet saved: each message passage whose text differs from what it was last given.
 * An emptied passage is left out; it is offered for deletion instead of being saved empty.
 */
export function unsavedNovelEdits(doc: PMNode, baselines: Map<string, NovelPassageBaseline>): NovelPassageEdit[] {
  const edits: NovelPassageEdit[] = [];
  doc.forEach((passage) => {
    const { messageId } = novelPassageAttrs(passage);
    const baseline = messageId ? baselines.get(messageId) : undefined;
    const text = novelPassageText(passage);
    if (messageId && baseline && text && text !== baseline.text)
      edits.push({ messageId, text, content: novelPassageText(passage, baseline.separator), swipe: baseline.swipe });
  });
  return edits;
}

/**
 * Whether a queued edit still belongs on its message: not once the passage shows another swipe, whose text
 * the writer is now looking at instead. A passage that has left the page still saves.
 */
export function novelEditStillCurrent(baselines: Map<string, NovelPassageBaseline>, edit: NovelPassageEdit): boolean {
  const baseline = baselines.get(edit.messageId);
  return !baseline || (baseline.swipe === edit.swipe && baseline.text !== edit.text);
}

/** After a save, the passage's baseline takes the saved text, unless the passage has moved to another swipe. */
export function recordNovelSave(baselines: Map<string, NovelPassageBaseline>, edit: NovelPassageEdit): void {
  const baseline = baselines.get(edit.messageId);
  if (baseline && baseline.swipe === edit.swipe) baseline.text = edit.text;
}

/**
 * Queues an edit's save behind any earlier save of the same message, so saves land in order, and settles
 * once it is saved or reported. At its turn the edit is checked again: an earlier save may already have
 * written its text, or the passage may have moved to another swipe, which this text does not belong on.
 */
export function queueNovelSave(
  queue: Map<string, Promise<void>>,
  baselines: Map<string, NovelPassageBaseline>,
  edit: NovelPassageEdit,
  save: (edit: NovelPassageEdit) => Promise<unknown>,
  onError: (error: unknown) => void,
): Promise<void> {
  const previous = queue.get(edit.messageId) ?? Promise.resolve();
  const saving: Promise<void> = previous
    .then(async () => {
      if (!novelEditStillCurrent(baselines, edit)) return;
      await save(edit);
      recordNovelSave(baselines, edit);
    })
    .catch(onError)
    .finally(() => {
      if (queue.get(edit.messageId) === saving) queue.delete(edit.messageId);
    });
  queue.set(edit.messageId, saving);
  return saving;
}

/**
 * Message passages the writer has emptied, in page order, except the one holding the caret (pass -1
 * when the editor has lost focus), which is still being written in. However a passage was emptied (by
 * the caret leaving it or by a delete reaching across passages), it is found here, so its text can come
 * back until the writer confirms deleting it. A message that was empty to begin with is not counted.
 */
export function emptiedNovelPassages(
  doc: PMNode,
  baselines: Map<string, NovelPassageBaseline>,
  caretIndex: number,
): string[] {
  const emptied: string[] = [];
  doc.forEach((passage, _offset, index) => {
    const { messageId } = novelPassageAttrs(passage);
    if (!messageId || index === caretIndex || !baselines.get(messageId)?.text) return;
    if (!passage.textContent.trim()) emptied.push(messageId);
  });
  return emptied;
}

/**
 * Brings the document in line with the messages: new and changed messages are written in, removed ones
 * taken out, and passages the writer is still editing kept as they are. Unsaved text stays at the end,
 * before the draft; an unsaved passage left empty goes. Only the changed stretch of the document is replaced, so the caret keeps its place.
 * Returns null when nothing changed.
 */
export function syncNovelPassages(
  state: EditorState,
  messages: NovelSyncMessage[],
  baselines: Map<string, NovelPassageBaseline>,
  /** Unsaved passages whose message has been created: pendingKey → message id. */
  createdPending: Map<string, string>,
): Transaction | null {
  const { doc, schema } = state;
  const current: PMNode[] = [];
  doc.forEach((passage) => current.push(passage));
  const byMessageId = new Map<string, PMNode>();
  for (const passage of current) {
    const { messageId, pendingKey } = novelPassageAttrs(passage);
    const id = messageId ?? (pendingKey ? createdPending.get(pendingKey) : undefined);
    if (id) byMessageId.set(id, passage);
  }

  const next: PMNode[] = [];
  const consumed = new Set<PMNode>();
  for (const message of messages) {
    const existing = byMessageId.get(message.id);
    const baseline = baselines.get(message.id);
    const swipe = message.activeSwipeIndex ?? 0;
    if (existing) consumed.add(existing);
    const editing = existing && baseline && baseline.swipe === swipe && novelPassageText(existing) !== baseline.text;
    if (editing) {
      next.push(
        novelPassageAttrs(existing).messageId === message.id
          ? existing
          : schema.nodes.passage!.create({ messageId: message.id }, existing.content),
      );
      continue;
    }
    const text = normalizeNovelText(message.content);
    baselines.set(message.id, { text, swipe, separator: novelParagraphSeparator(message.content) });
    next.push(
      existing && novelPassageAttrs(existing).messageId === message.id && novelPassageText(existing) === text
        ? existing
        : createNovelPassage(schema, { messageId: message.id }, message.content),
    );
  }
  const ids = new Set(messages.map((message) => message.id));
  for (const [pendingKey, messageId] of createdPending) if (ids.has(messageId)) createdPending.delete(pendingKey);
  // A passage just saved as a message keeps its baseline until the message loads, so an edit made
  // meanwhile is still told apart from the message's text.
  const loading = new Set(createdPending.values());
  for (const id of baselines.keys()) if (!ids.has(id) && !loading.has(id)) baselines.delete(id);

  const caretIndex = state.selection.$from.index(0);
  current.forEach((passage, index) => {
    const { messageId, draft, pendingKey } = novelPassageAttrs(passage);
    if (messageId || draft || consumed.has(passage)) return;
    // Emptied unsaved text with no message on the way has nothing left to save (a failed save leaves it
    // here), so it goes once the caret is elsewhere rather than staying as a blank block.
    const saving = pendingKey !== null && createdPending.has(pendingKey);
    if (!novelPassageText(passage) && !saving && index !== caretIndex) return;
    next.push(passage);
  });
  const draft = current.find((passage) => novelPassageAttrs(passage).draft);
  next.push(draft ?? createNovelPassage(schema, { draft: true }, ""));

  let prefix = 0;
  while (prefix < current.length && prefix < next.length && current[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < current.length - prefix &&
    suffix < next.length - prefix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  )
    suffix++;
  if (prefix === current.length && prefix === next.length) return null;

  let from = 0;
  for (let i = 0; i < prefix; i++) from += current[i]!.nodeSize;
  let to = doc.content.size;
  for (let i = 0; i < suffix; i++) to -= current[current.length - 1 - i]!.nodeSize;
  return state.tr
    .replaceWith(from, to, next.slice(prefix, next.length - suffix))
    .setMeta(NOVEL_SYNC_META, true)
    .setMeta("addToHistory", false);
}
