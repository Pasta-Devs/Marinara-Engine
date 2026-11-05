import { useTranslation as useUiTranslation } from "react-i18next";
import { Check, Circle, Loader2 } from "lucide-react";
import type { MariTodoItem, MariTodoStatus } from "@marinara-engine/shared";

/**
 * The list she keeps for herself on a longer job, pinned under her newest message. It takes no input: one hairline
 * group in the frame of `MariList`, one quiet row per step. Once you write after it, it is muted and says so.
 */
export function MariTodoList({
  todos,
  stale,
  running,
}: {
  todos: readonly MariTodoItem[];
  /** You wrote after the reply that saved it. */
  stale: boolean;
  /** A run is going, so the step she is on may spin. */
  running: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (todos.length === 0) return null;
  const done = todos.filter((todo) => todo.status === "completed").length;
  const statusLabel: Record<MariTodoStatus, string> = {
    pending: localizeUi("ui.chat.homeprofessormarichat.todo.status.pending"),
    in_progress: localizeUi("ui.chat.homeprofessormarichat.todo.status.inProgress"),
    completed: localizeUi("ui.chat.homeprofessormarichat.todo.status.completed"),
  };
  return (
    <section className="mari-todo" data-component="HomeProfessorMariChat.Todo" data-stale={stale ? "true" : undefined}>
      <p className="mari-todo__head">
        {stale
          ? localizeUi("ui.chat.homeprofessormarichat.todo.stale")
          : localizeUi("ui.chat.homeprofessormarichat.todo.count", { done, total: todos.length })}
      </p>
      <ul className="mari-todo__list" aria-label={localizeUi("ui.chat.homeprofessormarichat.todo.label")}>
        {todos.map((todo, index) => (
          <li key={`${index}:${todo.content}`} className="mari-todo__item" data-status={todo.status}>
            <span className="mari-todo__icon" aria-hidden="true">
              {todo.status === "completed" ? (
                <Check />
              ) : todo.status === "in_progress" ? (
                running && !stale ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Circle className="fill-current" />
                )
              ) : (
                <Circle />
              )}
            </span>
            <span className="sr-only">{statusLabel[todo.status]}: </span>
            <span className="mari-todo__text">{todo.content}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
