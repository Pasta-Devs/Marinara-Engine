// Drag-or-arrow-key reorder row for the setup stage's Cast editor. The order is
// `chat.characterIds`: group chats in one-after-another mode answer in that order.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useUpdateChat } from "../../hooks/use-chats";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { AvatarImage } from "../characters/AvatarImage";
import type { StageEditorContext } from "./ChatSetupStageEditors";

function moveItem(list: string[], id: string, toIndex: number) {
  const from = list.indexOf(id);
  if (from < 0 || toIndex < 0 || toIndex >= list.length || from === toIndex) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(toIndex, 0, id);
  return next;
}

function OrderItem({
  id,
  index,
  total,
  name,
  avatarUrl,
  avatarCrop,
  onMove,
}: {
  id: string;
  index: number;
  total: number;
  name: string;
  avatarUrl: string | null;
  avatarCrop: Parameters<typeof getAvatarCropStyle>[0];
  onMove: (id: string, toIndex: number) => void;
}) {
  const { t } = useTranslation();
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  const key = (event: React.KeyboardEvent) => {
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    onMove(id, index + step);
  };
  return (
    <li
      ref={drop.setNodeRef}
      className={cn("flex items-center gap-1", drag.isDragging && "relative z-20", drop.isOver && !drag.isDragging && "opacity-70")}
    >
      <button
        ref={drag.setNodeRef}
        type="button"
        data-order-id={id}
        {...drag.listeners}
        {...drag.attributes}
        onKeyDown={key}
        aria-label={t("chat.setupStage.order.item", { name, position: index + 1, total })}
        style={{
          transform: drag.transform ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` : undefined,
          touchAction: "none",
        }}
        className={cn(
          "flex min-h-11 cursor-grab items-center gap-2 rounded-[12px] py-1 pl-2 pr-3 text-[14px] outline-none",
          drag.isDragging ? "bg-[var(--background)]" : "bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]",
          !drag.isDragging && "hover:bg-[color-mix(in_srgb,var(--foreground)_11%,transparent)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          drag.isDragging && "z-10 cursor-grabbing shadow-lg",
        )}
      >
        <span className="w-3 text-center text-[11px] tabular-nums text-[var(--muted-foreground)]" aria-hidden>
          {index + 1}
        </span>
        <span className="size-9 shrink-0 overflow-hidden rounded-full bg-[var(--secondary)]">
          <AvatarImage
            src={avatarUrl ?? ""}
            alt=""
            className="size-full object-cover"
            style={getAvatarCropStyle(avatarCrop)}
          />
        </span>
        <span className="max-w-[9rem] truncate">{name}</span>
      </button>
    </li>
  );
}

export function ChatSetupStageCastOrder({ ctx }: { ctx: StageEditorContext }) {
  const { t } = useTranslation();
  const updateChat = useUpdateChat();
  const [local, setLocal] = useState<string[] | null>(null);
  const [announce, setAnnounce] = useState("");
  const focusId = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );
  const ids = local ?? ctx.chatCharIds;

  useEffect(() => {
    if (!focusId.current) return;
    document.querySelector<HTMLElement>(`[data-order-id="${CSS.escape(focusId.current)}"]`)?.focus();
    focusId.current = null;
  });

  // Hosted rooms change their cast through room actions, so leave their order alone.
  if (ctx.chatCharIds.length < 2 || ctx.chatMeta.multiplayer) return null;

  const move = (id: string, toIndex: number, refocus = false) => {
    const next = moveItem(ids, id, toIndex);
    if (next === ids) return;
    if (refocus) focusId.current = id;
    setLocal(next);
    setAnnounce(
      t("chat.setupStage.order.moved", {
        name: ctx.characterMap.get(id)?.name ?? id,
        position: next.indexOf(id) + 1,
        total: next.length,
      }),
    );
    updateChat.mutate({ id: ctx.chat.id, characterIds: next }, { onSettled: () => setLocal(null) });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && over.id !== active.id) move(String(active.id), ids.indexOf(String(over.id)));
  };

  return (
    <section className="px-3 pb-2" aria-label={t("chat.setupStage.order.title")}>
      <p className="pb-1 text-[12.5px] text-[var(--muted-foreground)]">{t("chat.setupStage.order.title")}</p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <ul className="flex flex-wrap gap-2">
          {ids.map((id, index) => {
            const character = ctx.characterMap.get(id);
            return (
              <OrderItem
                key={id}
                id={id}
                index={index}
                total={ids.length}
                name={character?.name ?? id}
                avatarUrl={character?.avatarUrl ?? null}
                avatarCrop={character?.avatarCrop}
                onMove={(itemId, toIndex) => move(itemId, toIndex, true)}
              />
            );
          })}
        </ul>
      </DndContext>
      <p className="pt-1 text-[12px] text-[var(--muted-foreground)]">{t("chat.setupStage.order.hint")}</p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
