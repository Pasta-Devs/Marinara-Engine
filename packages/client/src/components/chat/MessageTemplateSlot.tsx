// The theme's message template, filled for one message (lib/theme-template.ts). Renders nothing
// unless the active theme has a template and the user allows themes with HTML.
import { memo, useMemo } from "react";
import type { MessageHookInput } from "../../lib/message-hooks";
import { pickTemplate, renderMessageTemplate, useThemeTemplates } from "../../lib/theme-template";

export const MessageTemplateSlot = memo(function MessageTemplateSlot({
  hook,
  createdAt,
}: {
  hook: MessageHookInput;
  createdAt?: string | null;
}) {
  const templates = useThemeTemplates((s) => s.templates);
  const template = pickTemplate(templates, hook.role);
  const html = useMemo(
    () =>
      template && !hook.streaming
        ? renderMessageTemplate(template, {
            char: hook.characterName,
            role: hook.role,
            index: hook.index,
            generationMs: hook.generationMs,
            createdAt,
          })
        : "",
    [template, hook.streaming, hook.characterName, hook.role, hook.index, hook.generationMs, createdAt],
  );
  if (!html) return null;
  return (
    <div
      data-mari-part="message-extra"
      className="mari-message-extra"
      // Sanitised in renderMessageTemplate: no scripts, styles, links, images or event attributes.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
