import { z } from "zod";
import { CARD_FIELD_KEYS } from "../types/card-field.js";

export const cardFieldAlternativeSchema = z.object({
  id: z.string().trim().min(1),
  field: z.enum(CARD_FIELD_KEYS),
  value: z.string(),
  chatIds: z.array(z.string().trim().min(1)),
});

/** An entity has at most one replacement for each field in any given chat. */
export const cardFieldAlternativesSchema = z.array(cardFieldAlternativeSchema).superRefine((alternatives, ctx) => {
  const ids = new Set<string>();
  const assignments = new Map<string, Set<string>>();
  alternatives.forEach((alternative, index) => {
    if (ids.has(alternative.id))
      ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate alternative id" });
    ids.add(alternative.id);
    const chats = assignments.get(alternative.field) ?? new Set<string>();
    for (const chatId of alternative.chatIds) {
      if (chats.has(chatId))
        ctx.addIssue({
          code: "custom",
          path: [index, "chatIds"],
          message: "A field can have only one alternative per chat",
        });
      chats.add(chatId);
    }
    assignments.set(alternative.field, chats);
  });
});

export type CardFieldAlternative = z.infer<typeof cardFieldAlternativeSchema>;
