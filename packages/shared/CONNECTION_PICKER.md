# Connection picker

Packages choose a saved Model (a "connection") through the Engine's picker. The package never
imports Engine components, never reads provider keys, and never sees accounts.

## Engine code

Use `ConnectionSelect` (`packages/client/src/components/connections/ConnectionSelect.tsx`).
The default `variant="native"` is a compact `<select>` grouped by account; other variants render a label/value row with a menu.

```tsx
<ConnectionSelect kind="image" value={modelId} onChange={setModelId} defaultLabel="Use chat default" />
```

## Package code

The Engine injects `capabilityProps.ui` (type `CapabilityClientUi` in `@marinara-engine/shared`).
Older Engines do not have it, so feature-detect it. Existing packages may keep their old fallback; new packages can show an upgrade notice instead of building another picker.

```js
async function chooseModel(props, current) {
  if (typeof props.ui?.pickConnection !== "function") {
    showNotice(t("updateEngineForPicker"));
    return;
  }
  const result = await props.ui.pickConnection({
    kind: "image",
    value: current, // saved Model row id, or null
    title: t("pickModel"),
    defaultLabel: t("useDefault"),
    includeDefault: true,
  });
  if (result.status === "cancelled") return; // keep the old setting
  saveMyConfig({ imageModelId: result.value }); // the package saves its own configuration
}
```

## Options

| Option                   | Meaning                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                   | `chat` (default), `image`, `video`, `audio` (audio generation), `decision`, or `all` (every kind). An unknown kind rejects with `TypeError`; it never falls back to `all`. |
| `value`                  | Saved Model row id. Null or an empty string means the inherited/default choice. Non-string values and ids over 200 characters reject with `TypeError`.                     |
| `title` / `defaultLabel` | Package-translated text, trimmed, max 240 / 500 characters.                                                                                                                |
| `includeDefault`         | Boolean, default `true`. Offers `null` as "default/inherited".                                                                                                             |
| `includeLocalSidecar`    | `true` only works with `kind: "chat"`. Set it only if you handle the local sidecar id.                                                                                     |

## Result

- `{ status: "selected", value }`: `value` is a Model id or `null`. Choosing the current value still returns `selected`, so you can tell that apart from cancel.
- `null` means "the caller's default". Its meaning is yours; the Engine changes nothing.
- `{ status: "cancelled" }`: Escape, backdrop, a newer `pickConnection` call (the older one cancels), or the package host unmounting, reloading, failing or changing version. Retained callbacks used after unmount resolve `cancelled`. Promises never hang.

The call is UI only. It does not save settings, change the active chat, or update any default.
