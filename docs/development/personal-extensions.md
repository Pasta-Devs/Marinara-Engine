# Personal Extension Architecture

Personal Extensions are disabled-by-default, hash-approved code with two isolated runtimes. Professor Mari drafts are the only extension class available by default. All other sources are External Extensions and require two independent operator gates.

## Security invariants

Keep these properties true:

1. Creation and import always produce a disabled, unapproved draft.
2. Approval requires the exact current `sha256:` content hash and an explicit sandboxed-code acknowledgement.
3. Any executable change disables the extension and clears `approvedHash`.
4. Rollback restores a disabled draft.
5. Backup and profile import clear approval and enabled state.
6. Professor Mari may create and update drafts but has no action that approves or enables them.
7. Every source other than `professor_mari` is external, including `external`, `local`, `legacy`, `profile_import`, and unknown values normalized to `legacy`.
8. External records are absent from management and runtime responses unless `ENABLE_EXTERNAL_EXTENSIONS=true` and the persisted Danger Zone opt-in is also true.
9. Closing either gate disables stored external records and stops active server processes. Browser runtime polling removes active browser workers.
10. Browser code never executes in the Marinara document. Server code never executes in the Marinara server process.
11. There is no URL installer, remote catalog, or automatic updater.
12. Host contributions are plain validated descriptors. Extension markup, styles, URLs, components, and callbacks never cross into Marinara's React tree.
13. Contribution registration, activation, events, updates, and removal remain bound to the enabled extension's exact approved content hash.
14. Browser context snapshots always contain only the active chat ID and Character IDs at baseline. Optional `read_active_characters` and `read_active_persona` permissions may add bounded, allowlisted fields from only records active in that chat; they never expose messages, full libraries, undeclared fields, metadata, or application access.
15. Requested permissions are part of the executable hash. Any permission change disables the extension and requires fresh exact-hash approval.

The gates are enforced in routes and runtime services. Hiding controls is not a security boundary. A manually added, restored, legacy, or out-of-band external record must remain invisible and unexecutable while either gate is closed.

## Storage and policy

The `installed_extensions` file table stores metadata, executable code, `contentHash`, `approvedHash`, source, and up to ten prior executable revisions. Private extension settings use `app_settings` keys prefixed with `extension-storage:`. The Danger Zone opt-in uses `external-extensions-enabled`.

Startup runs `preparePersonalExtensionTrust`. A legacy row without a hash is retained but disabled and unapproved. A row whose stored hash no longer matches its executable fields is also disabled and re-fingerprinted.

`personal-extension-policy.service.ts` combines the live `.env` gate with the persisted user opt-in. `personal-extension-storage.service.ts` can disable all non-Professor records. The `.env` watcher reapplies the policy within roughly two seconds and asks the server runtime to stop code when the gate closes.

## API

The management surface is under `/api/personal-extensions`:

- `GET /policy` returns both gate states and server sandbox availability.
- `PATCH /policy/external` changes the Danger Zone opt-in and refuses `true` unless the `.env` gate is open.
- `GET /` lists Professor drafts plus external drafts only when both gates are open.
- `POST /` imports an External Extension and is rejected unless both gates are open.
- `PATCH /:id` edits or disables a draft.
- `POST /:id/approve` approves the exact current hash, applies the external gate, and refuses Server approval without a supported OS sandbox.
- `POST /:id/rollback` restores a prior disabled revision.
- `DELETE /:id` deletes the extension and private settings.

Approved Browser runtime metadata is read from `GET /runtime/client`. The executable document is served by `GET /:id/sandbox.html?hash=...` only while the exact hash is enabled, approved, and allowed by policy.

## Browser runtime

`PersonalExtensionInjector.tsx` creates a hidden iframe with `sandbox="allow-scripts"` and no `allow-same-origin`. The iframe therefore has an opaque origin and cannot access Marinara's DOM, cookies, storage, or same-origin APIs.

The sandbox response replaces the normal page policy with a narrow CSP: no default resources, no connections, no forms, no objects, and no navigation authority. Extension CSS stays inside the hidden iframe. JavaScript runs in a dedicated Worker created by the trusted iframe bootstrap. Network and nested-worker globals are removed as defense in depth.

The worker receives only:

- namespaced logging;
- private extension storage brokered by the parent;
- managed timers;
- cleanup registration;
- read-only active chat and Character identifiers through `marinara.context`;
- bounded fields from active Character cards and the selected Persona only through separately approved capabilities;
- a constrained iframe window through `marinara.ui.showWindow(...)`;
- trusted host contribution slots through `marinara.ui.registerContribution(...)`.

Browser Extension API version 5 adds `marinara.context.get()` and `marinara.context.subscribe(listener)`. The immutable snapshot has this shape:

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

The client derives the snapshot from `useChatStore` and posts it when the active chat, its Character list, or its selected Persona changes. IDs are non-empty strings capped at 256 characters; the Character list is deduplicated and capped at 256 entries. The iframe accepts a context update only from its parent and only when its `contentHash` matches the exact extension revision, then the Worker normalizes and freezes the payload again. Extension startup waits for the first host snapshot, with a one-second null-context fallback so a failed bridge cannot stall the Worker indefinitely.

`characterId` is a single-chat convenience and remains `null` for group chats; `characterIds` contains every active participant. `personaId` is available only with `read_active_persona`. With no active chat, `chatId`, `characterId`, `personaId`, and `persona` are `null`, while `characterIds` and `characters` are empty. Extensions can safely use the identifiers as keys in their own private storage.

`read_active_characters` allows `characters` to contain only the active cards' `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, and `conversationDisplayName`. `read_active_persona` allows `persona` to contain only `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, and `conversationDisplayName`. The server derives both sets from the active chat, applies per-field and aggregate bounds, and never accepts a client-supplied record ID as proof of scope.

Capabilities are declared in the extension payload, persisted with every revision, displayed in Settings and the approval dialog, and included in the executable hash. The host first sends the ID-only snapshot, then enriches it through the approved extension-specific broker. The Worker independently drops undeclared records, rejects Character records whose IDs are not in `characterIds`, bounds the payload again, and freezes the result.

`marinara.ui.showWindow({ title, elements, onEvent, onClose })` returns a handle with `update({ title?, elements? })` and `close()`. The worker only sends descriptors, and the trusted iframe bootstrap builds every element with DOM APIs and `textContent` (never `innerHTML`). The host reveals the otherwise-hidden sandbox iframe only while a window is open and hides it again on close.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, elements?, onActivate?, onEvent? })` returns a frozen handle with `update(patch)` and `remove()`. It supports three fixed locations:

- `button`: a compact top-bar action on larger screens and an action in the Extensions menu everywhere;
- `menu-item`: an action in the Extensions menu;
- `panel`: an entry that opens Marinara's trusted Extensions side panel.

Panel elements use the same declarative vocabulary as constrained windows: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color`, and `spacer`. Interactive controls require unique IDs. A panel button posts `{ contributionId, elementId, values }` to `onEvent`; `values` contains the current string value of every control. `onActivate` runs inside the extension Worker when the user opens or invokes the contribution. The extension can call `handle.update(...)` to replace its label, description, icon, or panel elements after state changes.

The client independently validates every descriptor before adding it to the runtime store. Contribution kinds, icons, controls, IDs, option lists, text lengths, total panel text, element count, and per-extension contribution count are allowlisted and capped. React renders extension text as text. No extension-controlled HTML, CSS, URL, React component, or host callback is accepted. The host removes all contributions when the worker is stopped, its hash changes, or it disappears from the approved runtime response. Events are dispatched only to the worker registered for the same extension ID and content hash.

There is no DOM helper, Marinara API fetch, parent event access, or arbitrary network capability. The iframe validates and rate-limits messages. A heartbeat watchdog terminates an unresponsive or busy-looping worker.

## Complex extension compatibility

The contribution protocol is intended to support real settings-heavy tools and multi-step workflows, not only decorative buttons. A complex extension can progressively replace a panel's elements and keep its own state in private extension storage.

Existing legacy packages that inject buttons with host selectors, traverse React internals, write arbitrary overlays, or call same-origin `/api` routes do not run unchanged in the safe runtime. Port them by replacing their interface with contribution descriptors. Chat- or Character-keyed private state can use `marinara.context`; active card displays can request the relevant active-record permission. Functionality that needs messages, whole libraries, undeclared record fields, or scene-level visual effects must use a separate, narrowly scoped broker capability when one exists. Never restore raw DOM or unrestricted API authority as a compatibility shortcut.

## Server runtime

Server source runs in a separate Node process, never through an in-process import. Node's permission model denies filesystem, network, child-process, worker, native-addon, WASI, and inspector capabilities. The child also runs inside:

- macOS Seatbelt; or
- Linux Bubblewrap with separate PID, network, IPC, and mount namespaces.

The sandbox receives a minimal environment, a small V8 heap, no application files, no server secrets, and bounded line-delimited protocol files inside its private temporary directory. It receives only logging, private extension storage, managed timers, and cleanup registration. Message quotas and a separate heartbeat file contain protocol flooding and busy loops.

Node permissions and `node:vm` are defense-in-depth layers, not the security boundary. The separate OS sandbox is mandatory. Windows, Android, Linux without `bwrap`, and any other unsupported platform refuse to enable Server Extensions.

## Validation

Run:

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

The security regression must prove the two-step gate, exact-hash invalidation, opaque-origin worker shape, bounded and hash-bound context snapshots, host contribution validation and cleanup, removal of same-origin injection, environment stripping, filesystem/network denial, private storage, and fail-closed sandbox availability.
