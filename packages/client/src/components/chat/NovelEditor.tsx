// ──────────────────────────────────────────────
// Novel Mode: the editable page
// ──────────────────────────────────────────────
// One TipTap editor holds the whole novel, so the writer clicks anywhere and types, and can select
// across passages. Each passage is still a message: its view renders the Roleplay message row (TTS,
// swipes, actions) around the editable text, edits save back to that message shortly after typing
// stops, and text written at the end of the page becomes a new passage. Nothing here sends a user
// message; the chat input below only steers the next passage.
import { UndoRedo } from "@tiptap/extensions";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { Extension, type Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCreateMessage, useUpdateMessage } from "../../hooks/use-chats";
import { cn, generateClientId } from "../../lib/utils";
import {
  NOVEL_SYNC_META,
  NovelBold,
  NovelDocument,
  NovelItalic,
  NovelParagraph,
  NovelPassage,
  NovelText,
  deleteAcrossNovelPassages,
  emptiedNovelPassages,
  flattenPastedNovelPassages,
  novelCurrentPassage,
  novelDocumentJSON,
  novelPassageAttrs,
  novelPassageGuard,
  novelPassageKey,
  novelHiddenPassageGuard,
  novelPassageText,
  queueNovelSave,
  syncNovelPassages,
  unsavedNovelEdits,
  type NovelPassageAttrs,
  type NovelPassageBaseline,
  type NovelPassageEdit,
  type NovelSyncMessage,
} from "./novel-document";

/** How long after the last keystroke an edited passage is saved. */
const SAVE_DELAY_MS = 800;

export interface NovelEditorHandle {
  /** Saves every edit and turns text written at the end of the page into passages. */
  flush: () => Promise<void>;
}

export interface NovelEditorPassage {
  message: NovelSyncMessage;
  /** The message's place in the visible transcript, for the row's grouping and depth. */
  index: number;
}

interface NovelEditorProps {
  chatId: string;
  passages: NovelEditorPassage[];
  /** Renders a passage's message row with the editable text in place of its content. */
  renderPassage: (index: number, content: ReactNode) => ReactNode;
  /** Asks to delete a message (the Roleplay delete dialog), for a passage the writer emptied. */
  onDelete?: (messageId: string) => void;
  editable: boolean;
  /** A new passage is being written below the page; the empty draft line steps aside for it. */
  streaming: boolean;
  /** A passage the writer wrote was saved as this message. */
  onPassageCreated?: (messageId: string) => void;
}

interface PassageViewContext {
  passages: Map<string, NovelEditorPassage>;
  renderPassage: (index: number, content: ReactNode) => ReactNode;
  draftPlaceholder: string;
}

const NovelPassageViewContext = createContext<PassageViewContext | null>(null);

function NovelPassageView({ node }: ReactNodeViewProps) {
  const context = useContext(NovelPassageViewContext);
  const { messageId, draft } = novelPassageAttrs(node);
  // Stable, so the memoized message row does not re-render on every keystroke.
  const content = useMemo(() => <NodeViewContent className="mari-novel-passage-view" />, []);
  const passage = messageId ? context?.passages.get(messageId) : undefined;
  const lastRowRef = useRef<ReactNode>(null);
  const row = passage ? context!.renderPassage(passage.index, content) : null;
  // Remembered only once committed, so a render React discards never becomes the fallback.
  useLayoutEffect(() => {
    if (row) lastRowRef.current = row;
  });
  // A deleted message keeps its last row until the sync removes the passage: swapping in another tree
  // here would unmount the row around the editable text ProseMirror still owns.
  const shownRow = row ?? lastRowRef.current;
  if (messageId && shownRow) return <NodeViewWrapper>{shownRow}</NodeViewWrapper>;
  const empty = node.childCount === 1 && node.firstChild!.content.size === 0;
  return (
    <NodeViewWrapper
      className={cn("mari-novel-unsaved", draft && "mari-novel-draft", empty && "is-empty")}
      style={
        draft
          ? ({ "--mari-novel-placeholder": JSON.stringify(context?.draftPlaceholder ?? "") } as CSSProperties)
          : undefined
      }
    >
      <div className="mari-novel-passage-text">{content}</div>
    </NodeViewWrapper>
  );
}

const NovelPassageWithView = NovelPassage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NovelPassageView, {
      // The message row's buttons and menus belong to React, not to the editor.
      stopEvent: ({ event }) => {
        const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement;
        return !!target?.closest("[data-novel-chrome]");
      },
    });
  },
});

/** A transaction deleting the selection (or from..to) inside each passage it reaches across, or null within one. */
function deleteAcross(view: EditorView, from = view.state.selection.from, to = view.state.selection.to) {
  const tr = view.state.tr;
  return deleteAcrossNovelPassages(tr, from, to) ? tr : null;
}

const NovelPlugins = Extension.create({
  name: "novelPlugins",
  addProseMirrorPlugins() {
    return [novelPassageGuard(), novelHiddenPassageGuard(), novelCurrentPassage()];
  },
});

export const NovelEditor = forwardRef<NovelEditorHandle, NovelEditorProps>(function NovelEditor(
  { chatId, passages, renderPassage, onDelete, editable, streaming, onPassageCreated },
  ref,
) {
  const { t } = useTranslation();
  // mutateAsync is stable across renders; the mutation result object is not. Both are this chat's own, so a
  // save made on the way out of the chat (the unmount flush) updates this chat, not the one opening.
  const { mutateAsync: createMessage } = useCreateMessage(chatId);
  const { mutateAsync: updateMessage } = useUpdateMessage(chatId);
  const baselinesRef = useRef(new Map<string, NovelPassageBaseline>());
  const createdPendingRef = useRef(new Map<string, string>());
  const createRunRef = useRef<Promise<void> | null>(null);
  const savingRef = useRef(new Map<string, Promise<void>>());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caretPassageRef = useRef<NovelPassageAttrs | null>(null);
  // Kept current by one layout effect below, for the editor's callbacks, which are created once.
  const passagesRef = useRef(passages);
  const callbacksRef = useRef({ onDelete, onPassageCreated });
  const editorRef = useRef<Editor | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const toastSaveError = useCallback(
    (error: unknown) => void toast.error(error instanceof Error ? error.message : t("chat.novel.saveFailed")),
    [t],
  );

  /**
   * Saves each passage whose text differs from its message, or only the given edits. An emptied passage
   * is never saved: it is offered for deletion instead (see handleCaretMove).
   */
  const saveEdits = useCallback(
    async (edits?: NovelPassageEdit[], onError: (error: unknown) => void = toastSaveError) => {
      const editor = editorRef.current;
      if (!edits) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (!editor || editor.isDestroyed) return;
      await Promise.all(
        (edits ?? unsavedNovelEdits(editor.state.doc, baselinesRef.current)).map((edit) =>
          queueNovelSave(
            savingRef.current,
            baselinesRef.current,
            edit,
            // The save names its swipe, so the server never writes it to another one either.
            ({ messageId, content, swipe }) => updateMessage({ messageId, content, swipeIndex: swipe }),
            onError,
          ),
        ),
      );
    },
    [toastSaveError, updateMessage],
  );

  const syncMessages = useCallback(
    (editor: Editor | null = editorRef.current) => {
      if (!editor || editor.isDestroyed) return;
      const messages = passagesRef.current.map((passage) => passage.message);
      // A passage leaving the list (the transcript window moving on, or its message deleted) is taken out
      // with its baseline, so an edit still waiting for its save is saved now rather than lost.
      const ids = new Set(messages.map((message) => message.id));
      const leaving = unsavedNovelEdits(editor.state.doc, baselinesRef.current).filter(
        (edit) => !ids.has(edit.messageId),
      );
      if (leaving.length) void saveEdits(leaving);
      const tr = syncNovelPassages(editor.state, messages, baselinesRef.current, createdPendingRef.current);
      if (tr) editor.view.dispatch(tr);
    },
    [saveEdits],
  );

  const createPendingPassages = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const { state } = editor;
    const tr = state.tr.setMeta(NOVEL_SYNC_META, true).setMeta("addToHistory", false);
    const toCreate: Array<{ key: string; text: string }> = [];
    state.doc.forEach((passage, pos) => {
      const attrs = novelPassageAttrs(passage);
      const text = novelPassageText(passage);
      if (!attrs.messageId && text) {
        const key = attrs.pendingKey ?? generateClientId();
        if (!createdPendingRef.current.has(key)) toCreate.push({ key, text });
        if (attrs.draft) tr.setNodeMarkup(pos, undefined, { ...attrs, draft: false, pendingKey: key });
      }
    });
    if (!toCreate.length) return;
    if (!novelPassageAttrs(tr.doc.lastChild!).draft) {
      tr.insert(
        tr.doc.content.size,
        state.schema.nodes.passage!.create({ draft: true }, state.schema.nodes.paragraph!.create()),
      );
    }
    editor.view.dispatch(tr);
    // A failure goes to the caller, which reports it once; the text stays to save again.
    for (const { key, text } of toCreate) {
      // Saved as the story's own text (no character), so the model reads it as part of the manuscript.
      const message = await createMessage({ role: "assistant", content: text, characterId: null });
      callbacksRef.current.onPassageCreated?.(message.id);
      baselinesRef.current.set(message.id, { text, swipe: 0 });
      createdPendingRef.current.set(key, message.id);
    }
    syncMessages();
  }, [createMessage, syncMessages]);

  /**
   * Turns the draft and any unsaved passages into messages, in page order. A run waits for one already
   * in flight (the caret leaving the draft just before Send), so a flush ends only once the text is saved.
   */
  const createPassages = useCallback(() => {
    const inFlight = createRunRef.current;
    const run = inFlight ? inFlight.then(createPendingPassages) : createPendingPassages();
    const settled: Promise<void> = run
      .catch(() => undefined)
      .then(() => {
        if (createRunRef.current === settled) createRunRef.current = null;
      });
    createRunRef.current = settled;
    return run;
  }, [createPendingPassages]);

  // Rejects when any save fails, so whatever asked for the flush (Send, a choice, a swipe) shows the error and
  // stops instead of generating from text that was not saved.
  const flush = useCallback(async () => {
    let failure: unknown;
    await Promise.all([
      saveEdits(undefined, (error) => {
        failure ??= error;
      }),
      createPassages(),
    ]);
    if (failure) throw failure;
  }, [createPassages, saveEdits]);

  /**
   * When the caret leaves the draft, writes it out. Any passage left empty outside the caret gets its
   * text back, and the delete dialog asks about the first of them; the dialog takes one message, so the
   * rest simply come back and the writer can empty them again to be asked about each.
   */
  const handleCaretMove = useCallback(
    (editor: Editor, blurred = false) => {
      const caretIndex = blurred ? -1 : editor.state.selection.$from.index(0);
      const passage = editor.state.doc.maybeChild(caretIndex);
      const now = passage ? novelPassageAttrs(passage) : null;
      const before = caretPassageRef.current;
      caretPassageRef.current = now;
      if (before && (!now || novelPassageKey(now) !== novelPassageKey(before))) {
        if (before.draft) void createPassages().catch(toastSaveError);
        // Unsaved text the writer emptied and left goes from the page (see syncNovelPassages).
        else if (before.pendingKey && !before.messageId) syncMessages();
      }
      const emptied = emptiedNovelPassages(editor.state.doc, baselinesRef.current, caretIndex);
      if (!emptied.length) return;
      // Without a baseline the sync writes each passage back from its message, so the text comes back until
      // the writer confirms the delete, which then removes the passage.
      for (const messageId of emptied) baselinesRef.current.delete(messageId);
      syncMessages();
      // ponytail: asks about the first emptied passage only, since the Roleplay delete dialog takes one
      // message; the others come back and are asked about one at a time. Upgrade path: a dialog that takes
      // several messages, if emptying many passages at once turns out to be common.
      callbacksRef.current.onDelete?.(emptied[0]!);
    },
    [createPassages, syncMessages, toastSaveError],
  );

  const editor = useEditor({
    extensions: [
      NovelDocument,
      NovelPassageWithView,
      NovelParagraph,
      NovelText,
      NovelBold,
      NovelItalic,
      UndoRedo,
      NovelPlugins,
    ],
    content: novelDocumentJSON(),
    editable,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: "mari-novel-editor",
        "aria-label": t("chat.novel.editorLabel"),
        spellcheck: "true",
      },
      transformPasted: flattenPastedNovelPassages,
      // Edits that reach across passages delete inside each one instead of joining their messages.
      handleKeyDown: (view, event) => {
        if (event.key !== "Backspace" && event.key !== "Delete" && event.key !== "Enter") return false;
        const tr = deleteAcross(view);
        if (!tr) return false;
        view.dispatch(tr);
        // Enter goes on to split the paragraph at the caret.
        return event.key !== "Enter";
      },
      handleTextInput: (view, from, to, text) => {
        const tr = deleteAcross(view, from, to);
        if (!tr) return false;
        view.dispatch(tr.insertText(text));
        return true;
      },
      handlePaste: (view, _event, slice) => {
        const tr = deleteAcross(view);
        if (!tr) return false;
        view.dispatch(tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
      handleDOMEvents: {
        cut: (view, event) => {
          if (!event.clipboardData) return false;
          const { from, to } = view.state.selection;
          const tr = deleteAcross(view, from, to);
          if (!tr) return false;
          event.preventDefault();
          event.clipboardData.setData("text/plain", view.state.doc.textBetween(from, to, "\n\n"));
          view.dispatch(tr);
          return true;
        },
      },
    },
    // The ref follows only the rendered editor (below). In development StrictMode builds a second editor that
    // is never shown and is destroyed at once; its create event must not take the ref from the shown one,
    // or the page stops saving.
    onCreate: ({ editor }) => syncMessages(editor),
    onUpdate: ({ editor, transaction }) => {
      if (transaction.getMeta(NOVEL_SYNC_META)) return;
      // An edit that reaches across passages can empty one the caret is not in.
      handleCaretMove(editor, !editor.isFocused);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void saveEdits(), SAVE_DELAY_MS);
    },
    onSelectionUpdate: ({ editor }) => handleCaretMove(editor),
    onFocus: ({ editor }) => handleCaretMove(editor),
    onBlur: ({ editor }) => {
      handleCaretMove(editor, true);
      void saveEdits();
    },
  });

  useEffect(() => {
    syncMessages();
  }, [passages, syncMessages]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editable, editor]);

  useLayoutEffect(() => {
    passagesRef.current = passages;
    callbacksRef.current = { onDelete, onPassageCreated };
    editorRef.current = editor;
    flushRef.current = flush;
  });

  // Leaving the chat saves what was written.
  useEffect(() => () => void flushRef.current().catch(toastSaveError), [toastSaveError]);

  useImperativeHandle(ref, () => ({ flush }), [flush]);

  // renderPassage is the surface's inline function, new on each of its renders, so this follows every surface
  // render: the rows must show the surface's current state anyway. The memo spares the passage views on the
  // editor's own renders, which its save and create mutations cause while the writer types.
  const passagesById = useMemo(() => new Map(passages.map((passage) => [passage.message.id, passage])), [passages]);
  const viewContext = useMemo<PassageViewContext>(
    () => ({
      passages: passagesById,
      renderPassage,
      draftPlaceholder: t(passages.length ? "chat.novel.draftPlaceholder" : "chat.novel.draftPlaceholderEmpty"),
    }),
    [passages.length, passagesById, renderPassage, t],
  );

  return (
    <NovelPassageViewContext.Provider value={viewContext}>
      <EditorContent editor={editor} data-novel-streaming={streaming ? "true" : undefined} />
    </NovelPassageViewContext.Provider>
  );
});
