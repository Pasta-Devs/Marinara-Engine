type ChatRecencyFields = {
  id?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastMessageAt?: string | null;
};

function readTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function getChatActivityTime(chat: ChatRecencyFields): number {
  return readTimestamp(chat.lastMessageAt) || readTimestamp(chat.createdAt) || readTimestamp(chat.updatedAt);
}

export function compareChatsByActivityAsc(left: ChatRecencyFields, right: ChatRecencyFields): number {
  const activity = getChatActivityTime(left) - getChatActivityTime(right);
  if (activity !== 0) return activity;

  const created = readTimestamp(left.createdAt) - readTimestamp(right.createdAt);
  if (created !== 0) return created;

  const updated = readTimestamp(left.updatedAt) - readTimestamp(right.updatedAt);
  if (updated !== 0) return updated;

  return (left.id ?? "").localeCompare(right.id ?? "");
}

export function compareChatsByActivityDesc(left: ChatRecencyFields, right: ChatRecencyFields): number {
  return compareChatsByActivityAsc(right, left);
}

export function compareChatsByCreatedAtAsc(left: ChatRecencyFields, right: ChatRecencyFields): number {
  const created = readTimestamp(left.createdAt) - readTimestamp(right.createdAt);
  if (created !== 0) return created;
  return (left.id ?? "").localeCompare(right.id ?? "");
}

export function compareChatsByCreatedAtDesc(left: ChatRecencyFields, right: ChatRecencyFields): number {
  return compareChatsByCreatedAtAsc(right, left);
}
