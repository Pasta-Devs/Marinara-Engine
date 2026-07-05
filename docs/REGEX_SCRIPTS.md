# Regex Scripts

Regex scripts transform text with find/replace rules. They are useful for cleaning model output, normalizing tags, hiding unwanted wrappers, or reshaping prompt text.

## Where They Apply

Each script has an apply mode:

- **Only Prompt** changes text before it is sent to the model.
- **Only Display** changes what you see without changing model-visible history.
- **Both** applies the rule in both places.

Choose carefully. Display-only cleanup is safest for cosmetic fixes. Prompt changes alter future model context.

## Depth And Order

Depth controls how far back the script applies in chat history. Order controls which script runs first when multiple rules match. Put broad cleanup rules before narrow formatting rules only when the broad rule cannot damage the narrow one.

## Global And Character-Scoped Scripts

Global scripts can run across chats. Character-scoped scripts only apply when the relevant character is present. Use character-scoped scripts for quirks tied to a specific card, such as stripping an unwanted signature.

## Safety

The server applies regex timeouts to reduce ReDoS risk, but expensive patterns still slow generation. Avoid nested catastrophic patterns and test scripts on short text before enabling them broadly.

