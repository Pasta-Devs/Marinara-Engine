// @ts-nocheck
/* eslint-disable */
// ──────────────────────────────────────────────
// Prompt viewer: kolache's AIO Prompt Viewer and Editor, built in
//
// Ported from the "kolache's AIO Prompt Viewer and Editor" extension (MIT,
// github.com/kolacheee/Marinara-kolaches-aio-extension). The console's own code
// is kept close to the extension so fixes can move between the two; what
// changed for the new layout:
//   - it is a page (its own tab) instead of a window over the app: the page
//     mounts it with mountPromptViewer() and keeps its state between visits;
//   - Inspect, Summaries and Settings open as views inside the page;
//   - questions (unsaved edits, delete, include history) use the app's dialogs;
//   - saves refresh the app's own editors (no page reload needed);
//   - the open chat comes from the app's chat store.
// ──────────────────────────────────────────────

/** What the page hands the console: the app's dialogs, the open chat, cache refresh. */
const host = {
  activeChatId: () => null,
  invalidate: (_path) => {},
  choice: async (_opts) => null,
  openPage: (_kind, _id) => {},
};
export function configurePromptViewer(next) {
  Object.assign(host, next);
}

const KAIO_ICONS = {
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  summaries:
    '<path d="M4.226 20.925A2 2 0 0 0 6 22h12a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v3.127"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m5 11-3 3"/><path d="m5 17-3-3h10"/>',
  reload:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  settings:
    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  folder:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  persona: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  character: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  characters:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  lorebook:
    '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  preset:
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  world:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  npc: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  spellbook:
    '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  uncategorized:
    '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  validate:
    '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
  viewer:
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>',
};
function ico(name, cls) {
  const body = KAIO_ICONS[name];
  if (!body) return "";
  return (
    '<svg class="kaio-ico' +
    (cls ? " " + cls : "") +
    '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    body +
    "</svg>"
  );
}

/* Three columns:
 *    Left   — pickers for preset / lorebook / character / persona
 *    Middle — the simulated assembled prompt
 *    Right  — inspector + editor + dirty-state guard
 */

// ── API layer ──────────────────────────────────────────────────
// Same-origin REST under /api; the app's global fetch shim adds the CSRF header
// to POST/PATCH/PUT/DELETE calls.
async function api(method, path, body) {
  const opts = {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch("/api" + path, opts);
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(method + " " + path + " → " + r.status + (text ? ": " + text.slice(0, 120) : ""));
  }
  if (method !== "GET") {
    try {
      host.invalidate(path);
    } catch {
      /* the console keeps working */
    }
  }
  if (r.status === 204) return null;
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : null;
}

// Pull a human-readable message out of an api() error. api() throws
// `METHOD path → STATUS: <body>`, where <body> is usually {"error":"..."}.
function serverErrorText(err, fallback) {
  const m = (err && err.message) || "";
  const match = m.match(/"error"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  const after = m.split("→")[1];
  return after && after.trim() ? fallback + " — " + after.trim().slice(0, 100) : fallback;
}

const tryParseJSON = (s, fallback) => {
  if (s !== null && s !== undefined && typeof s !== "string") return s;
  if (typeof s !== "string" || !s.length) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

// The /characters list and get-by-id endpoints return the row verbatim, with
// the entire CharacterData V2 (name, description, personality, etc.) packed
// into a JSON-string `data` column. Normalize so the rest of the extension can
// just read `c.data.name`. Idempotent — if `data` is already an object, no-op.
function normalizeCharacter(c) {
  if (!c) return c;
  if (typeof c.data === "string") {
    return { ...c, data: tryParseJSON(c.data, {}) };
  }
  return c;
}

// Coerce lorebook entry fields that the extension compares with === to
// numbers. Also applies Marinara's order/sortOrder fallback and defaults
// missing position/depth/order so entries always have usable values.
function normalizeEntry(e) {
  if (!e || typeof e !== "object") return e;
  // Marinara 2.0.0 uses `order`; fall back to `sortOrder` for older builds.
  const rawOrder = e.order ?? e.sortOrder ?? 0;
  e.order = Number(rawOrder) || 0;
  e.position = Number(e.position ?? 0) || 0;
  // NaN-safe: depth 0 is valid, so use explicit isNaN check
  e.depth = isNaN(Number(e.depth)) ? 0 : Number(e.depth);
  return e;
}

// Marinara 2.0.0 persists prompt-section booleans as the STRINGS "true"/"false"
// (the server stringifies on write and never re-parses on read). Strict checks
// like `section.enabled !== false` would treat the string "false" as enabled,
// so a disabled section would wrongly render in the Simulated Prompt. Coerce the
// booleans the extension compares back into real booleans. Idempotent — leaves
// values that are already booleans untouched.
function normalizeSection(s) {
  if (!s || typeof s !== "object") return s;
  if (typeof s.enabled === "string") s.enabled = s.enabled !== "false";
  if (typeof s.isMarker === "string") s.isMarker = s.isMarker === "true";
  return s;
}

// ── Global state ───────────────────────────────────────────────
const state = {
  presets: [], // [{id, name, ...}]
  lorebooks: [],
  characters: [],
  personas: [],

  selectedPresetId: null,
  // Multi-lorebook: ordered list of selected lorebook IDs, plus the
  // ID whose entry list is currently "active" (most-recently-tapped).
  selectedLorebookIds: [],
  activeLorebookId: null,
  selectedEntryIdsByLorebook: {}, // {lorebookId → Set<entryId>}
  // Group chat: an ordered list of participant character IDs (index 0 = the
  // primary character / first sequential responder). One entry behaves exactly
  // like the old single-character selection.
  selectedCharacterIds: [],
  selectedPersonaId: null,

  presetFull: null, // {preset, sections, groups, choiceBlocks}
  lorebookEntries: {}, // lorebookId → entries[]
  lorebookFolders: {}, // lorebookId → folders[]
  selectedFolderIdsByLorebook: {}, // {lorebookId → Set<folderId>}
  charactersFull: {}, // {characterId → full character (with .data)}
  personaFull: null,

  // Console-level group-chat settings, mirroring Marinara's Chat Settings →
  // Group Chat panel (see ChatMetadata: groupChatMode, groupResponseOrder,
  // groupTurnPromptEnabled, groupSpeakerNamesInHistory, groupSpeakerColors,
  // groupScenarioText). Only meaningful when a group (2+ characters) is picked
  // and no live chat is open — a group chat's real settings live on the chat.
  groupSettings: {
    mode: "merged", // "merged" (narrator) | "individual"
    responseOrder: "sequential", // "sequential" | "smart" | "manual"
    turnPromptEnabled: true, // append "Respond ONLY as <name>." per turn
    speakerNamesInHistory: false, // prefix history turns with the speaker name
    speakerColors: false, // merged: wrap dialogue in <speaker> tags
    scenarioText: "", // non-empty = shared scenario override
    inactiveCharacterIds: [], // members temporarily benched from the prompt
  },
  // Individual-mode preview: focus a single responder (null = stack all cards).
  groupFocusCharId: null,

  inspecting: null, // {kind, id} – current right-panel target
  draft: null, // local edits before save
  isDirty: false,

  // ── Visual preview + inline variable editing ──
  // variablePreviews[variableName] = { cbId, optionId, value, savedValue }
  //   `value` is the in-progress (possibly edited) text used for substitution.
  //   `savedValue` is the option's value as last loaded from the server, used
  //   to detect dirty state for the Save button.
  variablePreviews: {},
  expandedBlocks: new Set(), // block IDs whose preview is shown in full
  variablesPanelCollapsed: false,
  middleFilter: "", // Simulated Prompt search/filter query (transient)
  entryFilter: "", // active lorebook's entry-search query (transient)
  entryFilterOpen: false, // whether the entry-search box is shown

  // Validation: { blockId → [{ kind, message, snippet }, ...] }
  // Cleared on Reload, source-switch, and Save. Repopulated by clicking
  // the Validate button in the middle column header.
  validationErrors: {},
  validationRanLast: false, // true once Validate has run at least once

  // Folder batch-add UI state (reset on inspect switch)
  folderBatchAdd: { showNested: false, selected: new Set() },

  // Collapsible states for inspector sections
  presetEditorCollapsed: { overview: false, sections: false, variables: false },
  lbEditorCollapsed: { overview: false },
  lbInspectorCollapsed: {
    basic: false,
    matching: true,
    contextFilters: true,
    matchingSources: true,
    timing: true,
    groupTag: true,
    advanced: true,
  },
  // Character editor sections — Card open by default, the rest collapsed for a
  // condensed default view.
  charEditorCollapsed: {
    metadata: true,
    card: false,
    dialogue: true,
    lorebook: true,
    colors: true,
    stats: true,
    advanced: true,
  },
  // Character-editor textareas that are manually Expanded (by field key). Reset
  // when a different block is inspected; persists across in-session re-renders.
  charFieldExpanded: new Set(),
  presetGroupBatchAdd: { groupId: null, selected: new Set() },
  // Which variable is expanded in the preset variables panel (null = none)
  presetExpandedVariableId: null,

  // Active connection's Max Context Window for the token gauge (null = none).
  // Resolved on console open / Reload from /api/connections + the active chat.
  activeConnection: null, // { maxContext, label } | null
};

// ── DOM refs (populated by buildConsole) ──────────────────────
let overlayEl = null;
let leftBodyEl = null;
let middleBodyEl = null;
let tokenGaugeEl = null;
let rightBodyEl = null;
let rightFooterEl = null;
let toastEl = null;
let activeTipEl = null;

// Resolve a CSS variable to an opaque rgb() string by temporarily applying it
// to a hidden element, reading the computed value, and stripping any alpha.
// Works with any color format the browser supports (hex, rgb, hsl, oklch, …).
function resolveOpaque(varName, fallback) {
  const tmp = document.createElement("div");
  tmp.style.display = "none";
  tmp.style.backgroundColor = `var(${varName}, ${fallback})`;
  overlayEl.appendChild(tmp);
  const resolved = getComputedStyle(tmp).backgroundColor;
  tmp.remove();
  // getComputedStyle always returns rgb(r,g,b) or rgba(r,g,b,a)
  const m = resolved.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return `rgb(${m[1]}, ${m[2]}, ${m[3]})`;
  return fallback;
}
function resolveVar(varName, fallback) {
  const tmp = document.createElement("div");
  tmp.style.display = "none";
  tmp.style.color = `var(${varName}, ${fallback})`;
  overlayEl.appendChild(tmp);
  const resolved = getComputedStyle(tmp).color;
  tmp.remove();
  return resolved || fallback;
}

function showTip(tipSpan) {
  hideTip();
  const text = tipSpan.dataset.tip;
  if (!text) return;
  const popup = document.createElement("div");
  popup.className = "kaio-tooltip-popup";
  popup.textContent = text;
  // Resolve theme colors from the overlay scope, force card background opaque
  // so the tooltip is solid regardless of theme alpha. Append to document.body
  // to stay outside the overlay's backdrop-filter stacking context.
  if (overlayEl) {
    popup.style.backgroundColor = resolveOpaque("--card", "#0f0f15");
    popup.style.color = resolveVar("--foreground", "#e4e4e7");
    popup.style.borderColor = resolveVar("--border", "#27272a");
  }
  popup.style.left = "-9999px";
  popup.style.top = "0";
  document.body.appendChild(popup);
  const tipW = 210;
  const tipH = popup.offsetHeight;
  const iconRect = tipSpan.getBoundingClientRect();
  // Center above the icon, then clamp to viewport with 8px inset
  let left = iconRect.left + iconRect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  let top = iconRect.top - tipH - 6;
  // Flip below if there's not enough space above
  if (top < 8) top = iconRect.bottom + 6;
  popup.style.left = left + "px";
  popup.style.top = top + "px";
  activeTipEl = popup;
}
function hideTip() {
  if (activeTipEl) {
    activeTipEl.remove();
    activeTipEl = null;
  }
}

// ── Console build (one-time) ──────────────────────────────────
function buildConsole() {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.className = "kaio-overlay";
  overlayEl.innerHTML = `
    <div class="kaio-shell" role="region" aria-label="Prompt viewer">
      <div class="kaio-titlebar">
        <span class="kaio-title-icon">${ico("viewer")}</span>
        <span class="kaio-title">Prompt viewer</span>
        <span class="kaio-subtitle">Preset, lorebooks, character and persona, in the order they're sent</span>
        <span class="kaio-spacer"></span>
        <button type="button" class="kaio-iconbtn" data-action="inspect" title="Inspect the full prompt as it would be sent to the model">${ico("search")}<span class="kaio-btn-text">Inspect</span></button>
        <button type="button" class="kaio-iconbtn" data-action="summaries" title="Export every chat summary in your library; works with no chat open">${ico("summaries")}<span class="kaio-btn-text">Summaries</span></button>
        <button type="button" class="kaio-iconbtn" data-action="refresh" title="Reload sources">${ico("reload")}<span class="kaio-btn-text">Reload</span></button>
        <button type="button" class="kaio-iconbtn" data-action="settings" title="Prompt viewer settings" aria-label="Prompt viewer settings">${ico("settings")}</button>
      </div>
      <nav class="kaio-mobile-tabs ov-sideswitch" aria-label="Prompt viewer columns">
        <button type="button" class="kaio-mobile-tab ov-sideswitch__btn is-on" data-tab="left" data-active="true" aria-pressed="true">Sources</button>
        <button type="button" class="kaio-mobile-tab ov-sideswitch__btn" data-tab="middle" aria-pressed="false">Prompt</button>
        <button type="button" class="kaio-mobile-tab ov-sideswitch__btn" data-tab="right" aria-pressed="false">Editor</button>
      </nav>
      <div class="kaio-body" data-active-tab="left">
        <section class="kaio-col kaio-col-left" data-col="left">
          <header class="kaio-col-header">
            <h3>Sources</h3>
            <p>Pick one of each. Add lorebooks below.</p>
          </header>
          <div class="kaio-col-body" data-region="left"></div>
        </section>
        <section class="kaio-col kaio-col-middle" data-col="middle">
          <header class="kaio-col-header">
            <div class="kaio-col-header-row">
              <div class="kaio-col-header-text">
                <h3>Simulated Prompt</h3>
                <p>Click any block to edit it.</p>
              </div>
              <div class="kaio-col-header-actions">
                <button class="kaio-col-header-btn" data-action="validate"
                        title="Scan all sources for unbalanced XML tags and broken macros">
                  ✓ Validate
                </button>
              </div>
            </div>
            <div class="kaio-middle-search">
              <span class="kaio-middle-search-icon">${ico("search")}</span>
              <input type="search" class="kaio-middle-search-input" data-action="filter"
                     placeholder="Filter blocks by name or content…" aria-label="Filter simulated prompt blocks" />
              <button class="kaio-middle-search-clear" data-action="filter-clear" title="Clear filter" hidden>✕</button>
            </div>
            <div class="kaio-token-gauge" data-region="token-gauge" data-empty="true"></div>
          </header>
          <div class="kaio-col-body" data-region="middle"></div>
        </section>
        <section class="kaio-col kaio-col-right" data-col="right">
          <header class="kaio-col-header">
            <h3>Editor</h3>
            <p>Edits write back to the actual source.</p>
          </header>
          <div class="kaio-col-body" data-region="right"></div>
          <footer class="kaio-right-footer" data-region="right-footer"></footer>
        </section>
      </div>
      <div class="kaio-toast" data-region="toast"></div>
    </div>
  `;
  leftBodyEl = overlayEl.querySelector('[data-region="left"]');
  middleBodyEl = overlayEl.querySelector('[data-region="middle"]');
  tokenGaugeEl = overlayEl.querySelector('[data-region="token-gauge"]');
  rightBodyEl = overlayEl.querySelector('[data-region="right"]');
  rightFooterEl = overlayEl.querySelector('[data-region="right-footer"]');
  toastEl = overlayEl.querySelector('[data-region="toast"]');

  // Tooltip delegation — works across all dynamic content in the overlay
  overlayEl.addEventListener("mouseover", (e) => {
    const tip = e.target.closest(".kaio-tip");
    if (tip) showTip(tip);
  });
  overlayEl.addEventListener("mouseout", (e) => {
    if (e.target.closest(".kaio-tip")) hideTip();
  });

  overlayEl.querySelector('[data-action="refresh"]').addEventListener("click", async () => {
    await reloadEverything();
    showToast("Reloaded", "success");
  });
  overlayEl.querySelector('[data-action="inspect"]').addEventListener("click", () => openPromptInspector());
  overlayEl.querySelector('[data-action="summaries"]').addEventListener("click", () => openSummaryExporter());
  overlayEl.querySelector('[data-action="settings"]').addEventListener("click", () => showSettings());
  overlayEl.querySelector('[data-action="validate"]').addEventListener("click", runValidation);
  wireConsoleControls();
}

/** Reload every source and the open selection from the server. */
async function reloadEverything() {
  await loadAllSources();
  if (state.selectedPresetId) await loadPresetFull(state.selectedPresetId);
  for (const lbId of state.selectedLorebookIds) {
    await loadLorebookEntries(lbId);
    await loadLorebookFolders(lbId);
  }
  for (const cid of state.selectedCharacterIds) await loadCharacter(cid);
  if (state.selectedPersonaId) await loadPersona(state.selectedPersonaId);
  await loadActiveConnectionContext();
  state.validationErrors = {};
  state.validationRanLast = false;
  resetValidateBtn();
  renderAll();
}

function wireConsoleControls() {
  // Simulated Prompt filter — re-renders only the middle body, so the input
  // (which lives in the static header) keeps focus while typing.
  const filterInput = overlayEl.querySelector('[data-action="filter"]');
  const filterClear = overlayEl.querySelector('[data-action="filter-clear"]');
  filterInput.addEventListener("input", () => {
    state.middleFilter = filterInput.value;
    filterClear.hidden = !filterInput.value;
    renderMiddle();
  });
  filterInput.addEventListener("keydown", (e) => {
    // Esc clears the filter first; only closes the console when already empty.
    if (e.key === "Escape" && filterInput.value) {
      e.stopPropagation();
      filterInput.value = "";
      state.middleFilter = "";
      filterClear.hidden = true;
      renderMiddle();
    }
  });
  filterClear.addEventListener("click", () => {
    filterInput.value = "";
    state.middleFilter = "";
    filterClear.hidden = true;
    renderMiddle();
    filterInput.focus();
  });

  // Mobile tab switching
  overlayEl.querySelector(".kaio-mobile-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".kaio-mobile-tab");
    if (!tab) return;
    const key = tab.dataset.tab;
    const body = overlayEl.querySelector(".kaio-body");
    body.dataset.activeTab = key;
    for (const t of overlayEl.querySelectorAll(".kaio-mobile-tab")) {
      t.dataset.active = t.dataset.tab === key ? "true" : "";
      t.classList.toggle("is-on", t.dataset.tab === key);
      t.setAttribute("aria-pressed", t.dataset.tab === key ? "true" : "false");
    }
  });
}

// ── Mount / unmount (the page owns the console) ───────────────
let kaioLoaded = false;
let kaioLoading = null;

/** Put the console into the page's element. Its state stays between visits. */
export function mountPromptViewer(hostEl) {
  if (!overlayEl) buildConsole();
  overlayEl.dataset.open = "true";
  hostEl.appendChild(overlayEl);
  if (!kaioLoaded) {
    kaioLoaded = true;
    kaioLoading = (async () => {
      await loadAllSources();
      await restoreSelection();
      await loadActiveConnectionContext();
      renderAll();
    })().finally(() => {
      kaioLoading = null;
    });
  } else if (!state.isDirty && !kaioLoading) {
    // Back on the tab: pick up what changed elsewhere (a card edited in its own editor).
    void reloadEverything();
  } else {
    renderAll();
  }
}

/** Take the console out of the page (switching tabs). Nothing is lost. */
export function unmountPromptViewer() {
  persistSelection();
  hideTip();
  if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
}

/** Unsaved edits in the editor column. */
export function promptViewerDirty() {
  return !!state.isDirty;
}

/**
 * Closing the tab: with unsaved edits asks Save / Revert / Stay and runs `proceed` once they are dealt with.
 * False when nothing needs asking.
 */
export function requestPromptViewerClose(proceed) {
  if (!state.isDirty) return false;
  confirmDirtySwitch(null, () => {
    closeConsoleNow();
    proceed();
  });
  return true;
}

function closeConsoleNow() {
  persistSelection(); // save any in-memory selection that didn't flow through renderAll
  if (overlayEl) {
    overlayEl.querySelectorAll(".kaio-pi-bg, .kaio-settings-bg").forEach((el) => {
      if (typeof el._kaioClose === "function") el._kaioClose();
      else el.remove();
    });
  }
  hideTip();
}

// ── Loading data ──────────────────────────────────────────────
// GET /characters now answers one page at a time ({ items, hasMore }), with each card's whole data. The picker
// only needs names, so it reads the light catalog (id, name) page by page; a picked card loads in full.
async function listAllCharacters() {
  const out = [];
  for (let offset = 0; offset < 100000;) {
    const page = await api("GET", "/characters/catalog?view=summary&sort=name-asc&limit=100&offset=" + offset);
    if (Array.isArray(page)) return page;
    const items = page && Array.isArray(page.items) ? page.items : [];
    out.push(...items);
    if (!page || !page.hasMore || !items.length) break;
    offset += items.length;
  }
  return out;
}

async function loadAllSources() {
  try {
    const [presets, lorebooks, characters, personas] = await Promise.all([
      api("GET", "/prompts/").catch(() => []),
      api("GET", "/lorebooks").catch(() => []),
      listAllCharacters().catch(() => []),
      api("GET", "/characters/personas/list").catch(() => []),
    ]);
    state.presets = Array.isArray(presets) ? presets : [];
    state.lorebooks = Array.isArray(lorebooks) ? lorebooks : [];
    state.characters = Array.isArray(characters) ? characters.map(normalizeCharacter) : [];
    state.personas = Array.isArray(personas) ? personas : [];
  } catch (err) {
    console.error("[kolache-AIO] Failed to load sources", err);
    showToast("Failed to load sources — see console", "error");
  }
}

// Resolve the active connection's Max Context Window for the token gauge.
// "Active" mirrors the engine's runtime rule: the open chat's connectionId if
// set, otherwise the default connection (isDefault === "true"). Stores
// { maxContext, label } in state.activeConnection, or null when none resolves
// (in which case the token gauge is hidden entirely). Best-effort — any
// failure leaves activeConnection null rather than throwing.
async function loadActiveConnectionContext() {
  state.activeConnection = null;
  try {
    const conns = await api("GET", "/connections/").catch(() => null);
    if (!Array.isArray(conns) || !conns.length) return;

    let conn = null;
    const chatId = getActiveChatId();
    if (chatId) {
      const chat = await api("GET", "/chats/" + chatId).catch(() => null);
      const cid = chat && chat.connectionId;
      if (cid) conn = conns.find((c) => c.id === cid) || null;
    }
    // Fall back to the default connection (booleans come back as strings).
    if (!conn) conn = conns.find((c) => c.isDefault === "true" || c.isDefault === true) || null;
    if (!conn) return;

    const mc = parseInt(conn.maxContext, 10);
    if (Number.isFinite(mc) && mc > 0) {
      state.activeConnection = {
        maxContext: mc,
        label: conn.name || conn.model || "connection",
      };
    }
  } catch {
    /* leave activeConnection null */
  }
}

async function loadPresetFull(id) {
  const full = await api("GET", "/prompts/" + id + "/full").catch((e) => {
    console.error(e);
    showToast("Couldn't load preset", "error");
    return null;
  });
  if (full && Array.isArray(full.sections)) full.sections = full.sections.map(normalizeSection);
  state.presetFull = full;
}
async function loadLorebookEntries(id) {
  const list = await api("GET", "/lorebooks/" + id + "/entries").catch((e) => {
    console.error(e);
    showToast("Couldn't load entries", "error");
    return [];
  });
  state.lorebookEntries[id] = Array.isArray(list) ? list.map(normalizeEntry) : [];
}
async function loadLorebookFolders(id) {
  const list = await api("GET", "/lorebooks/" + id + "/folders").catch((e) => {
    console.error(e);
    return [];
  });
  state.lorebookFolders[id] = Array.isArray(list) ? list : [];
}
// Folder-tree helpers (folders nest via parentFolderId; null = top level).
// Cycle-guarded against malformed data even though the engine forbids cycles.
function folderDescendantIds(folders, rootId) {
  const byParent = new Map();
  for (const f of folders) {
    const p = f.parentFolderId || null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(f);
  }
  const out = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    for (const child of byParent.get(id) || []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}
function folderAncestorIds(folders, id) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out = new Set();
  let cur = byId.get(id);
  while (cur && cur.parentFolderId && !out.has(cur.parentFolderId)) {
    out.add(cur.parentFolderId);
    cur = byId.get(cur.parentFolderId);
  }
  return out;
}
async function loadCharacter(id) {
  const c = await api("GET", "/characters/" + id).catch((e) => {
    console.error(e);
    showToast("Couldn't load character", "error");
    return null;
  });
  const norm = normalizeCharacter(c);
  if (norm) state.charactersFull[id] = norm;
  else delete state.charactersFull[id];
}
async function loadPersona(id) {
  state.personaFull = await api("GET", "/characters/personas/" + id).catch((e) => {
    console.error(e);
    showToast("Couldn't load persona", "error");
    return null;
  });
}

// ── Group-chat helpers ─────────────────────────────────────────
// The selected characters, in order (index 0 = primary). Skips any that
// failed to load.
function selectedCharacters() {
  return (state.selectedCharacterIds || []).map((id) => state.charactersFull[id]).filter(Boolean);
}
// The group's multi-character preview + settings are a design-time surface for
// when NO Marinara chat is open. When a chat IS open (a group chat is just a
// chat with 2+ characters), its real composition and settings drive generation
// and the live 🔍 Inspect capture reflects them — so we defer to that instead
// of a structural guess, exactly like chat history is structural-only off-chat.
function groupPreviewEnabled() {
  return !getActiveChatId();
}
// True when the console should assemble a multi-character group (2+ picked and
// no live chat to defer to).
function isGroupSelection() {
  return groupPreviewEnabled() && (state.selectedCharacterIds || []).length > 1;
}
// Group members that actually contribute to the prompt (benched members drop
// out, mirroring the engine's inactiveCharacterIds filtering).
function activeGroupCharacters() {
  const inactive = new Set(state.groupSettings.inactiveCharacterIds || []);
  return selectedCharacters().filter((c) => !inactive.has(c.id));
}
// A non-empty Scenario Override replaces every card's own scenario.
function groupScenarioActive() {
  return isGroupSelection() && (state.groupSettings.scenarioText || "").trim().length > 0;
}
function openGroupEditor() {
  inspectBlock({ kind: "group-editor", id: "group-editor" });
}
// Human-readable label for a group mode — single source of truth so the picker
// summary, the banner, and the settings pill can't drift apart.
function groupModeLabel(mode) {
  return mode === "merged" ? "Merged (Narrator)" : "Individual";
}
// Drop all per-member state for a character removed/swapped out of the group.
function pruneGroupMember(id) {
  if (!id) return;
  delete state.charactersFull[id];
  state.groupSettings.inactiveCharacterIds = (state.groupSettings.inactiveCharacterIds || []).filter((x) => x !== id);
  if (state.groupFocusCharId === id) state.groupFocusCharId = null;
}

// ── Remember last selection (persisted across opens) ───────────
const KAIO_SELECTION_KEY = "kaio-selection";
function persistSelection() {
  try {
    const entries = {};
    for (const [lbId, set] of Object.entries(state.selectedEntryIdsByLorebook)) {
      if (set && set.size) entries[lbId] = [...set];
    }
    const folders = {};
    for (const [lbId, set] of Object.entries(state.selectedFolderIdsByLorebook)) {
      if (set && set.size) folders[lbId] = [...set];
    }
    localStorage.setItem(
      KAIO_SELECTION_KEY,
      JSON.stringify({
        presetId: state.selectedPresetId,
        lorebookIds: state.selectedLorebookIds,
        activeLorebookId: state.activeLorebookId,
        characterIds: state.selectedCharacterIds,
        groupSettings: state.groupSettings,
        groupFocusCharId: state.groupFocusCharId,
        personaId: state.selectedPersonaId,
        entries,
        folders,
      }),
    );
  } catch {
    /* ignore */
  }
}
// Restore the saved selection, but only IDs that still exist in the freshly
// loaded sources (so deleted presets/lorebooks/etc. are quietly dropped).
async function restoreSelection() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KAIO_SELECTION_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== "object") return;

  if (saved.presetId && state.presets.some((p) => p.id === saved.presetId)) {
    state.selectedPresetId = saved.presetId;
    await loadPresetFull(saved.presetId);
  }

  const validLbIds = Array.isArray(saved.lorebookIds)
    ? saved.lorebookIds.filter((id) => state.lorebooks.some((lb) => lb.id === id))
    : [];
  state.selectedLorebookIds = validLbIds;
  state.activeLorebookId =
    saved.activeLorebookId && validLbIds.includes(saved.activeLorebookId)
      ? saved.activeLorebookId
      : validLbIds[validLbIds.length - 1] || null;
  for (const lbId of validLbIds) {
    await loadLorebookEntries(lbId);
    await loadLorebookFolders(lbId);
    const entries = state.lorebookEntries[lbId] || [];
    const savedEntries = (saved.entries && saved.entries[lbId]) || [];
    state.selectedEntryIdsByLorebook[lbId] = new Set(savedEntries.filter((eid) => entries.some((e) => e.id === eid)));
    const folders = state.lorebookFolders[lbId] || [];
    const savedFolders = (saved.folders && saved.folders[lbId]) || [];
    state.selectedFolderIdsByLorebook[lbId] = new Set(savedFolders.filter((fid) => folders.some((f) => f.id === fid)));
  }

  // Group characters — accept the new `characterIds` array, and fall back to a
  // pre-group `characterId` scalar so older saved selections still restore.
  const savedCharIds = Array.isArray(saved.characterIds)
    ? saved.characterIds
    : saved.characterId
      ? [saved.characterId]
      : [];
  const validCharIds = savedCharIds.filter((id) => state.characters.some((c) => c.id === id));
  state.selectedCharacterIds = validCharIds;
  for (const cid of validCharIds) await loadCharacter(cid);
  if (saved.groupSettings && typeof saved.groupSettings === "object") {
    state.groupSettings = {
      ...state.groupSettings,
      ...saved.groupSettings,
      // Only keep benched IDs that are still members.
      inactiveCharacterIds: Array.isArray(saved.groupSettings.inactiveCharacterIds)
        ? saved.groupSettings.inactiveCharacterIds.filter((id) => validCharIds.includes(id))
        : [],
    };
  }
  // Restore the focused responder only if it's still a valid, active member of
  // an individual-mode group (matching the invariant saveDraft enforces).
  if (
    saved.groupFocusCharId &&
    validCharIds.includes(saved.groupFocusCharId) &&
    state.groupSettings.mode === "individual" &&
    !(state.groupSettings.inactiveCharacterIds || []).includes(saved.groupFocusCharId)
  ) {
    state.groupFocusCharId = saved.groupFocusCharId;
  }
  if (saved.personaId && state.personas.some((p) => p.id === saved.personaId)) {
    state.selectedPersonaId = saved.personaId;
    await loadPersona(saved.personaId);
  }
}

// ── Rendering ─────────────────────────────────────────────────
function renderAll() {
  renderLeft();
  renderMiddle();
  renderRight();
  persistSelection();
}

// LEFT — source pickers
function renderLeft() {
  if (!leftBodyEl) return;
  leftBodyEl.innerHTML = "";

  const presetPicker = renderSourcePicker({
    label: "Preset",
    icon: ico("preset"),
    items: state.presets,
    valueId: state.selectedPresetId,
    placeholder: "— Select a preset —",
    onCreate: createPreset,
    onChange: async (id) => {
      if ((await guardDirty()) === false) return;
      state.selectedPresetId = id;
      state.presetFull = null;
      state.inspecting = null;
      state.draft = null;
      state.isDirty = false;
      state.variablePreviews = {};
      state.expandedBlocks.clear();
      if (id) await loadPresetFull(id);
      renderAll();
    },
  });
  if (state.selectedPresetId && state.presetFull) {
    const sel = presetPicker.querySelector(".kaio-combo");
    if (sel) {
      const row = document.createElement("div");
      row.className = "kaio-source-select-row";
      sel.parentNode.insertBefore(row, sel);
      row.appendChild(sel);
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "kaio-folder-edit-btn";
      editBtn.innerHTML = ico("edit");
      editBtn.title = "Edit preset properties";
      editBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        inspectBlock({ kind: "preset-editor", id: "preset-editor" });
      });
      row.appendChild(editBtn);
    }
  }
  leftBodyEl.appendChild(presetPicker);

  // Multi-lorebook: one row per selected lorebook + one trailing "add" row.
  // Only the active (most-recently-tapped) lorebook shows its entry checklist.
  const lbSection = document.createElement("div");
  lbSection.className = "kaio-source";

  const lbHeader = document.createElement("div");
  lbHeader.className = "kaio-source-label";
  lbHeader.innerHTML = `<span class="kaio-source-icon">${ico("lorebook")}</span><span>Lorebooks</span>`;
  lbHeader.appendChild(makeSourceCreateBtn("Create a new lorebook", createLorebook));
  lbSection.appendChild(lbHeader);

  const slots = state.selectedLorebookIds.length + 1; // trailing empty
  for (let i = 0; i < slots; i++) {
    const isLast = i === state.selectedLorebookIds.length;
    const currentId = isLast ? null : state.selectedLorebookIds[i];
    const isActive = !isLast && currentId === state.activeLorebookId;

    // Each row is a container that holds the dropdown (and, if active, the
    // entry checklist below it).
    const row = document.createElement("div");
    row.className = "kaio-lb-row";
    if (isActive) row.dataset.active = "true";

    // Pool of lorebooks available for THIS row: everything not already
    // selected in another row, plus whatever this row currently holds.
    const taken = new Set(state.selectedLorebookIds);
    if (currentId) taken.delete(currentId);
    const items = state.lorebooks.filter((lb) => !taken.has(lb.id));

    const rowHeader = document.createElement("div");
    rowHeader.className = "kaio-lb-rowhead";
    // Clicking a non-active lorebook row "activates" it (shows its entries).
    // preventDefault stops the combo input from focusing/opening on this first
    // click — otherwise the dropdown would flash open and be torn down by the
    // re-render below. A second click (now the active row) opens it normally.
    rowHeader.addEventListener("mousedown", (ev) => {
      if (currentId && currentId !== state.activeLorebookId) {
        ev.preventDefault();
        state.activeLorebookId = currentId;
        state.entryFilter = ""; // fresh entry filter per lorebook
        setTimeout(renderLeft, 0);
      }
    });

    const lbCombo = renderSearchableSelect({
      items: items.map((lb) => ({ id: lb.id, name: lb.name || lb.id })),
      valueId: currentId,
      placeholder: isLast
        ? state.selectedLorebookIds.length
          ? "— Add another lorebook —"
          : "— Select a lorebook —"
        : "Lorebook",
      blankLabel: isLast ? undefined : "— Remove this lorebook —",
      ariaLabel: "Lorebook",
      onChange: async (newId) => {
        // guardDirty cancel: the combo auto-reverts since no re-render happens.
        if ((await guardDirty()) === false) return;
        if (isLast) {
          // Adding a new lorebook
          if (!newId) return;
          state.selectedLorebookIds = [...state.selectedLorebookIds, newId];
          if (!state.selectedEntryIdsByLorebook[newId]) {
            state.selectedEntryIdsByLorebook[newId] = new Set();
          }
          state.activeLorebookId = newId;
          if (!state.lorebookEntries[newId]) await loadLorebookEntries(newId);
          if (!state.lorebookFolders[newId]) await loadLorebookFolders(newId);
        } else if (!newId) {
          // Removing this lorebook from the selection
          state.selectedLorebookIds = state.selectedLorebookIds.filter((id) => id !== currentId);
          delete state.selectedEntryIdsByLorebook[currentId];
          delete state.lorebookFolders[currentId];
          delete state.selectedFolderIdsByLorebook[currentId];
          if (state.activeLorebookId === currentId) {
            state.activeLorebookId = state.selectedLorebookIds[state.selectedLorebookIds.length - 1] || null;
          }
          // If the inspector was looking at an entry from this lorebook, clear it.
          if (
            state.inspecting &&
            state.inspecting.kind === "lorebook-entry" &&
            state.inspecting.entry &&
            state.inspecting.entry.lorebookId === currentId
          ) {
            state.inspecting = null;
            state.draft = null;
            state.isDirty = false;
          }
        } else {
          // Swapping this slot to a different lorebook
          const next = [...state.selectedLorebookIds];
          next[i] = newId;
          state.selectedLorebookIds = next;
          if (!state.selectedEntryIdsByLorebook[newId]) {
            state.selectedEntryIdsByLorebook[newId] = new Set();
          }
          delete state.selectedEntryIdsByLorebook[currentId];
          delete state.lorebookFolders[currentId];
          delete state.selectedFolderIdsByLorebook[currentId];
          state.activeLorebookId = newId;
          if (!state.lorebookEntries[newId]) await loadLorebookEntries(newId);
          if (!state.lorebookFolders[newId]) await loadLorebookFolders(newId);
        }
        state.entryFilter = ""; // the active lorebook changed
        renderAll();
      },
    });
    rowHeader.appendChild(lbCombo);
    if (currentId) {
      const lbEditBtn = document.createElement("button");
      lbEditBtn.type = "button";
      lbEditBtn.className = "kaio-folder-edit-btn";
      lbEditBtn.innerHTML = ico("edit");
      lbEditBtn.title = "Edit lorebook properties";
      lbEditBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const lb = state.lorebooks.find((l) => l.id === currentId);
        if (lb) inspectBlock({ kind: "lorebook-editor", id: "lorebook-editor-" + currentId, lorebook: lb });
      });
      rowHeader.appendChild(lbEditBtn);
    }
    // Entry-search toggle, only on the active row (the one showing its entries).
    if (isActive) {
      const searchBtn = document.createElement("button");
      searchBtn.type = "button";
      searchBtn.className = "kaio-folder-edit-btn kaio-entry-search-btn";
      searchBtn.innerHTML = ico("search");
      searchBtn.title = "Search entries in this lorebook";
      if (state.entryFilterOpen) searchBtn.dataset.active = "true";
      searchBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.entryFilterOpen = !state.entryFilterOpen;
        if (!state.entryFilterOpen) state.entryFilter = "";
        renderLeft();
        if (state.entryFilterOpen) {
          const si = overlayEl && overlayEl.querySelector(".kaio-entry-search-input");
          if (si) si.focus();
        }
      });
      rowHeader.appendChild(searchBtn);
    }
    row.appendChild(rowHeader);

    // Entry checklist only under the active lorebook.
    if (isActive) {
      row.appendChild(renderEntryChecklist(currentId));
    }

    lbSection.appendChild(row);
  }
  leftBodyEl.appendChild(lbSection);

  leftBodyEl.appendChild(renderCharacterSources());

  leftBodyEl.appendChild(
    renderSourcePicker({
      label: "Persona",
      icon: ico("persona"),
      items: state.personas,
      valueId: state.selectedPersonaId,
      placeholder: "— Select a persona —",
      onCreate: createPersona,
      onChange: async (id) => {
        if ((await guardDirty()) === false) return;
        state.selectedPersonaId = id;
        state.personaFull = null;
        state.inspecting = null;
        state.draft = null;
        state.isDirty = false;
        if (id) await loadPersona(id);
        renderAll();
      },
    }),
  );
}

// Character source(s). With no live chat open this is a multi-character group
// picker (mirroring the multi-lorebook rows) plus a Group Chat settings hook;
// when a chat IS open we collapse to a single primary picker and defer group
// composition/settings to the live 🔍 Inspect capture.
function renderCharacterSources() {
  const wrap = document.createElement("div");
  wrap.className = "kaio-source";

  const ids = state.selectedCharacterIds || [];
  const groupOn = groupPreviewEnabled();
  const isGroup = groupOn && ids.length > 1;

  const header = document.createElement("div");
  header.className = "kaio-source-label";
  header.innerHTML = `<span class="kaio-source-icon">${ico(isGroup ? "characters" : "character")}</span><span>${isGroup ? "Characters (Group)" : "Character"}</span>`;
  header.appendChild(makeSourceCreateBtn("Create a new character", createCharacter));
  if (isGroup) {
    const gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "kaio-folder-edit-btn";
    gearBtn.innerHTML = ico("settings");
    gearBtn.title = "Group chat settings";
    gearBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openGroupEditor();
    });
    header.appendChild(gearBtn);
  }
  wrap.appendChild(header);

  const charItems = () =>
    state.characters.map((c) => ({
      id: c.id,
      name: (c.data && c.data.name) || c.name || "Untitled character",
    }));
  const clearInspect = () => {
    state.inspecting = null;
    state.draft = null;
    state.isDirty = false;
  };

  if (!groupOn) {
    // A chat is open — keep a single-character picker bound to the primary and
    // leave any extra (hidden) members untouched so closing the chat restores
    // the full group.
    const primary = ids[0] || null;
    const combo = renderSearchableSelect({
      items: charItems(),
      valueId: primary,
      placeholder: "— Select a character —",
      ariaLabel: "Character",
      onChange: async (id) => {
        if ((await guardDirty()) === false) return;
        if (id) {
          // Promote the chosen character to primary; keep every other (hidden)
          // member so closing the chat restores the full group intact.
          state.selectedCharacterIds = [id, ...ids.filter((x) => x !== id)];
          if (!state.charactersFull[id]) await loadCharacter(id);
        } else {
          state.selectedCharacterIds = ids.filter((x) => x !== primary);
        }
        clearInspect();
        renderAll();
      },
    });
    wrap.appendChild(combo);
    const note = document.createElement("div");
    note.className = "kaio-group-note";
    note.innerHTML =
      "A chat is active — group composition &amp; settings come from the live chat. " +
      "Use <strong>Inspect</strong> for the resolved prompt.";
    wrap.appendChild(note);
    return wrap;
  }

  // No chat open: one row per member + a trailing "add" row (like lorebooks).
  const slots = ids.length + 1;
  for (let i = 0; i < slots; i++) {
    const isLast = i === ids.length;
    const currentId = isLast ? null : ids[i];

    const row = document.createElement("div");
    row.className = "kaio-lb-row kaio-char-row";
    const rowHead = document.createElement("div");
    rowHead.className = "kaio-lb-rowhead";

    // Pool for this row: everything not already picked in another row.
    const taken = new Set(ids);
    if (currentId) taken.delete(currentId);
    const items = charItems().filter((c) => !taken.has(c.id));

    const combo = renderSearchableSelect({
      items,
      valueId: currentId,
      placeholder: isLast ? (ids.length ? "— Add another character —" : "— Select a character —") : "Character",
      blankLabel: isLast ? undefined : "— Remove this character —",
      ariaLabel: "Character",
      onChange: async (newId) => {
        // Re-picking the character already in this row is a no-op — bail before
        // pruneGroupMember would delete the still-selected card's data.
        if (newId === currentId) return;
        if ((await guardDirty()) === false) return;
        if (isLast) {
          if (!newId) return;
          state.selectedCharacterIds = [...ids, newId];
          if (!state.charactersFull[newId]) await loadCharacter(newId);
        } else if (!newId) {
          state.selectedCharacterIds = ids.filter((id) => id !== currentId);
          pruneGroupMember(currentId);
        } else {
          const next = [...ids];
          next[i] = newId;
          state.selectedCharacterIds = next;
          if (!state.charactersFull[newId]) await loadCharacter(newId);
          pruneGroupMember(currentId);
        }
        clearInspect();
        renderAll();
      },
    });
    rowHead.appendChild(combo);

    if (currentId) {
      if (i === 0) {
        const badge = document.createElement("span");
        badge.className = "kaio-group-badge kaio-primary-badge";
        badge.textContent = "Primary";
        badge.title = "Primary character (first in the group order)";
        rowHead.appendChild(badge);
      }
      if (i > 0) {
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "kaio-folder-edit-btn";
        upBtn.innerHTML = "▲";
        upBtn.title = "Move earlier in the group order";
        upBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          if ((await guardDirty()) === false) return;
          const next = [...ids];
          [next[i - 1], next[i]] = [next[i], next[i - 1]];
          state.selectedCharacterIds = next;
          renderAll();
        });
        rowHead.appendChild(upBtn);
      }
    }
    row.appendChild(rowHead);
    wrap.appendChild(row);
  }

  // Compact settings summary (only meaningful with 2+ members).
  if (ids.length > 1) {
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const gs = state.groupSettings;
    const bits = [groupModeLabel(gs.mode)];
    if (gs.mode === "individual") bits.push(cap(gs.responseOrder));
    if ((gs.scenarioText || "").trim()) bits.push("Scenario override");
    const summary = document.createElement("div");
    summary.className = "kaio-group-note kaio-group-summary";
    summary.innerHTML = `<span>${escapeHTML(bits.join(" · "))}</span>`;
    const link = document.createElement("button");
    link.type = "button";
    link.className = "kaio-group-settings-link";
    link.textContent = "Group settings";
    link.addEventListener("click", () => openGroupEditor());
    summary.appendChild(link);
    wrap.appendChild(summary);
  }

  return wrap;
}

// The small "+" button that sits at the right edge of a Sources section header
// and creates a brand-new empty entity of that kind.
function makeSourceCreateBtn(title, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "kaio-source-create-btn";
  btn.textContent = "+";
  btn.title = title;
  btn.setAttribute("aria-label", title); // "+" content would otherwise be the a11y name
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    handler();
  });
  return btn;
}

// ── Create brand-new empty sources ─────────────────────────────
// Each POSTs the minimal body Marinara's create schema requires, refreshes the
// source lists, selects the new item, and opens its editor so the user can fill
// it in from scratch. Mirrors the createEntry/createFolder pattern.
async function createPreset() {
  if ((await guardDirty()) === false) return;
  try {
    const created = await api("POST", "/prompts/", { name: "New Preset" });
    await loadAllSources();
    if (created && created.id) {
      state.selectedPresetId = created.id;
      state.variablePreviews = {};
      state.expandedBlocks.clear();
      await loadPresetFull(created.id);
      inspectBlock({ kind: "preset-editor", id: "preset-editor" });
    }
    renderAll();
    showToast("Preset created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create preset failed", err);
    showToast(serverErrorText(err, "Failed to create preset"), "error");
  }
}

async function createLorebook() {
  if ((await guardDirty()) === false) return;
  try {
    // Send only `name` — the create schema's scope superRefine rejects
    // conflicting id/global fields, and everything else has a server default.
    const created = await api("POST", "/lorebooks", { name: "New Lorebook" });
    await loadAllSources();
    if (created && created.id) {
      if (!state.selectedLorebookIds.includes(created.id)) {
        state.selectedLorebookIds = [...state.selectedLorebookIds, created.id];
      }
      state.activeLorebookId = created.id;
      state.entryFilter = ""; // don't carry the previous lorebook's search
      state.entryFilterOpen = false;
      if (!state.selectedEntryIdsByLorebook[created.id]) {
        state.selectedEntryIdsByLorebook[created.id] = new Set();
      }
      await loadLorebookEntries(created.id);
      await loadLorebookFolders(created.id);
      const fresh = state.lorebooks.find((l) => l.id === created.id) || created;
      inspectBlock({ kind: "lorebook-editor", id: "lorebook-editor-" + created.id, lorebook: fresh });
    }
    renderAll();
    showToast("Lorebook created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create lorebook failed", err);
    showToast(serverErrorText(err, "Failed to create lorebook"), "error");
  }
}

async function createCharacter() {
  if ((await guardDirty()) === false) return;
  try {
    // POST wants the V2 card fields under `data` AS AN OBJECT (reads return it
    // as a JSON string, which normalizeCharacter parses).
    const created = await api("POST", "/characters", { data: { name: "New Character" } });
    await loadAllSources();
    if (created && created.id) {
      // Make the new character visible. With a chat open the picker shows only
      // the primary, so promote it there (matching the single-picker's onChange);
      // with no chat, append it as the next group member (the add-row flow).
      if (!groupPreviewEnabled()) {
        state.selectedCharacterIds = [created.id, ...state.selectedCharacterIds.filter((x) => x !== created.id)];
      } else if (!state.selectedCharacterIds.includes(created.id)) {
        state.selectedCharacterIds = [...state.selectedCharacterIds, created.id];
      }
      await loadCharacter(created.id);
      const fresh = state.charactersFull[created.id] || normalizeCharacter(created);
      // Prefer the real rendered block (keeps the editor open after Save); fall
      // back to a standalone editor when no character block is on screen.
      const blk = buildSimulatedPrompt().find(
        (b) => b.kind === "character" && b.character && b.character.id === created.id,
      );
      if (blk) inspectBlock(blk);
      else if (fresh) inspectBlock({ kind: "character", id: "character-editor-" + created.id, character: fresh });
    }
    renderAll();
    showToast("Character created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create character failed", err);
    showToast(serverErrorText(err, "Failed to create character"), "error");
  }
}

async function createPersona() {
  if ((await guardDirty()) === false) return;
  try {
    // Persona fields are flat/top-level — no `data` wrapper.
    const created = await api("POST", "/characters/personas", { name: "New Persona" });
    await loadAllSources();
    if (created && created.id) {
      state.selectedPersonaId = created.id;
      await loadPersona(created.id);
      const fresh = state.personaFull || created;
      const blk = buildSimulatedPrompt().find((b) => b.kind === "persona" && b.persona && b.persona.id === created.id);
      if (blk) inspectBlock(blk);
      else if (fresh) inspectBlock({ kind: "persona", id: "persona-editor-" + created.id, persona: fresh });
    }
    renderAll();
    showToast("Persona created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create persona failed", err);
    showToast(serverErrorText(err, "Failed to create persona"), "error");
  }
}

function renderSourcePicker({ label, icon, items, valueId, placeholder, onChange, inline, onCreate }) {
  const wrap = document.createElement("div");
  if (!inline) wrap.className = "kaio-source";

  const lab = document.createElement("div");
  lab.className = "kaio-source-label";
  lab.innerHTML = `<span class="kaio-source-icon">${icon}</span><span>${label}</span>`;
  if (onCreate) lab.appendChild(makeSourceCreateBtn("Create a new " + label.toLowerCase(), onCreate));
  wrap.appendChild(lab);

  wrap.appendChild(
    renderSearchableSelect({
      items,
      valueId,
      placeholder, // shown in the field itself; no duplicate blank row in the list
      ariaLabel: label,
      onChange,
    }),
  );
  return wrap;
}

// Searchable combobox used by every Sources picker. Type to filter; click,
// Enter, or arrow keys + Enter to choose. Mirrors the old <select> contract:
// onChange(id|null). Optional `blankLabel` adds a "clear" row at the top of the
// list; optional `onOpen` fires when the list opens. Works on desktop and
// mobile (tap to focus → on-screen keyboard filters the list).
function renderSearchableSelect({ items, valueId, placeholder, blankLabel, onChange, onOpen, ariaLabel }) {
  const root = document.createElement("div");
  root.className = "kaio-combo";
  root.dataset.open = "false";

  const field = document.createElement("div");
  field.className = "kaio-combo-field";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "kaio-combo-input";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.placeholder = placeholder || "";
  if (ariaLabel) input.setAttribute("aria-label", ariaLabel);
  const caret = document.createElement("button");
  caret.type = "button";
  caret.className = "kaio-combo-caret";
  caret.tabIndex = -1;
  caret.setAttribute("aria-label", "Toggle list");
  caret.textContent = "▾";
  field.appendChild(input);
  field.appendChild(caret);
  root.appendChild(field);

  const listEl = document.createElement("div");
  listEl.className = "kaio-combo-list";
  listEl.setAttribute("role", "listbox");
  root.appendChild(listEl);

  let selectedId = valueId || null;
  let open = false;
  let query = "";
  let highlight = -1;
  let opts = [];

  const nameFor = (id) => {
    if (!id) return "";
    const it = items.find((x) => x.id === id);
    return it ? it.name || it.id : "";
  };
  input.value = nameFor(selectedId);

  function computeOpts() {
    const q = query.trim().toLowerCase();
    const out = [];
    if (blankLabel) out.push({ id: "", name: blankLabel, blank: true });
    for (const it of items) {
      if (!q || (it.name || it.id).toLowerCase().includes(q)) out.push({ id: it.id, name: it.name || it.id });
    }
    return out;
  }
  function renderList() {
    opts = computeOpts();
    listEl.innerHTML = "";
    if (!opts.length) {
      const none = document.createElement("div");
      none.className = "kaio-combo-empty";
      none.textContent = "No matches";
      listEl.appendChild(none);
      return;
    }
    opts.forEach((o, i) => {
      const row = document.createElement("div");
      row.className = "kaio-combo-opt";
      row.setAttribute("role", "option");
      if (o.blank) row.dataset.blank = "true";
      if (o.id && o.id === selectedId) row.dataset.selected = "true";
      if (i === highlight) row.dataset.highlight = "true";
      row.textContent = o.name;
      row.addEventListener("mousedown", (ev) => {
        ev.preventDefault(); // keep focus; let this fire before the blur
        choose(o.id || null);
      });
      listEl.appendChild(row);
    });
  }
  function scrollHighlight() {
    const el = listEl.querySelector('[data-highlight="true"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  // The dropdown is absolutely positioned inside the scrollable Sources column,
  // so it would be clipped near the column's edges. Pick the side with more
  // room and cap the height to fit, so it always stays visible (e.g. the
  // bottom-most Persona picker flips upward).
  function positionList() {
    root.dataset.drop = "down";
    listEl.style.maxHeight = "240px";
    const scroller = root.closest(".kaio-col-body");
    if (!scroller) return;
    const fr = field.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    const spaceBelow = sr.bottom - fr.bottom - 8;
    const spaceAbove = fr.top - sr.top - 8;
    const up = spaceBelow < 180 && spaceAbove > spaceBelow;
    root.dataset.drop = up ? "up" : "down";
    const avail = Math.max(120, Math.min(240, up ? spaceAbove : spaceBelow));
    listEl.style.maxHeight = avail + "px";
  }
  function openList() {
    if (open) return;
    open = true;
    root.dataset.open = "true";
    input.setAttribute("aria-expanded", "true");
    query = "";
    highlight = -1;
    renderList();
    positionList();
    input.select();
    if (typeof onOpen === "function") onOpen();
  }
  function closeList(restore) {
    if (!open) return;
    open = false;
    root.dataset.open = "false";
    input.setAttribute("aria-expanded", "false");
    if (restore) input.value = nameFor(selectedId);
  }
  async function choose(id) {
    const before = selectedId;
    closeList(false);
    selectedId = id || null;
    input.value = nameFor(selectedId);
    input.blur();
    await onChange(selectedId);
    // If onChange didn't re-render (e.g. guardDirty cancelled the switch), this
    // element is still in the DOM — revert the optimistic selection.
    if (root.isConnected) {
      selectedId = before;
      input.value = nameFor(before);
    }
  }

  input.addEventListener("focus", openList);
  input.addEventListener("blur", () => {
    if (open) closeList(true);
  });
  caret.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    if (open) {
      closeList(true);
      input.blur();
    } else input.focus(); // fires openList
  });
  input.addEventListener("input", () => {
    query = input.value;
    if (!open) openList();
    highlight = -1;
    renderList();
  });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (!open) {
        openList();
        return;
      }
      highlight = Math.min(opts.length - 1, highlight + 1);
      renderList();
      scrollHighlight();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!open) return;
      highlight = Math.max(0, highlight - 1);
      renderList();
      scrollHighlight();
    } else if (ev.key === "Enter") {
      if (!open) return;
      ev.preventDefault();
      ev.stopPropagation();
      let pick = highlight >= 0 ? opts[highlight] : null;
      if (!pick) {
        const nonBlank = opts.filter((o) => !o.blank);
        if (nonBlank.length === 1) pick = nonBlank[0];
      }
      if (pick) choose(pick.id || null);
    } else if (ev.key === "Escape") {
      if (!open) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeList(true);
      input.blur();
    }
  });

  return root;
}

function renderEntryChecklist(lorebookId) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-lb-content";

  const list = document.createElement("div");
  list.className = "kaio-entrylist";
  const entries = state.lorebookEntries[lorebookId] || [];
  const folders = state.lorebookFolders[lorebookId] || [];

  if (!entries.length && !folders.length) {
    list.innerHTML = '<div class="kaio-entrylist-empty">No entries in this lorebook.</div>';
    wrap.appendChild(list);
    wrap.appendChild(renderCreateActions(lorebookId));
    return wrap;
  }

  if (!state.selectedEntryIdsByLorebook[lorebookId]) {
    state.selectedEntryIdsByLorebook[lorebookId] = new Set();
  }
  if (!state.selectedFolderIdsByLorebook[lorebookId]) {
    state.selectedFolderIdsByLorebook[lorebookId] = new Set();
  }
  const checkedSet = state.selectedEntryIdsByLorebook[lorebookId];
  const folderSet = state.selectedFolderIdsByLorebook[lorebookId];

  // Entry search box (toggled by the 🔍 in the lorebook row header). Filters
  // the already-rendered rows in place so the input never loses focus.
  if (state.entryFilterOpen) {
    const search = document.createElement("div");
    search.className = "kaio-entry-search";
    const sicon = document.createElement("span");
    sicon.className = "kaio-entry-search-icon";
    sicon.innerHTML = ico("search");
    const sinput = document.createElement("input");
    sinput.type = "search";
    sinput.className = "kaio-entry-search-input";
    sinput.placeholder = "Filter entries by name or content…";
    sinput.value = state.entryFilter || "";
    sinput.setAttribute("aria-label", "Filter lorebook entries");
    sinput.addEventListener("input", () => {
      state.entryFilter = sinput.value;
      applyEntryFilter(list, state.entryFilter);
    });
    sinput.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sinput.value) {
        e.stopPropagation();
        sinput.value = "";
        state.entryFilter = "";
        applyEntryFilter(list, "");
      }
    });
    search.appendChild(sicon);
    search.appendChild(sinput);
    wrap.appendChild(search);
  }

  // ── Folders at the top (nested tree, indented by depth) ──────
  const byParent = new Map(); // parentId|null → folder[]
  const folderIds = new Set(folders.map((f) => f.id));
  for (const f of folders) {
    // A missing/dangling parent is treated as root so orphans still show.
    const p = f.parentFolderId && folderIds.has(f.parentFolderId) ? f.parentFolderId : null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(f);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const visited = new Set();
  const renderFolderRow = (folder, depth) => {
    if (visited.has(folder.id)) return; // guard against malformed cycles
    visited.add(folder.id);
    const folderEntries = entries.filter((e) => e.folderId === folder.id);
    const isChecked = folderSet.has(folder.id);

    const item = document.createElement("div");
    item.className = "kaio-folder-item";
    item.dataset.search = (folder.name || "").toLowerCase();
    if (depth > 0) item.style.setProperty("--kaio-depth", String(depth));

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isChecked;
    cb.addEventListener("change", async (ev) => {
      if ((await guardDirty()) === false) {
        ev.target.checked = !ev.target.checked;
        return;
      }
      if (cb.checked) {
        folderSet.add(folder.id);
        for (const e of folderEntries) checkedSet.add(e.id);
      } else {
        folderSet.delete(folder.id);
        for (const e of folderEntries) checkedSet.delete(e.id);
      }
      renderLeft();
      renderMiddle();
      persistSelection(); // entry/folder toggles don't go through renderAll
    });
    item.appendChild(cb);

    const icon = document.createElement("span");
    icon.className = "kaio-folder-icon";
    icon.innerHTML = ico("folder");
    item.appendChild(icon);

    const nameEl = document.createElement("span");
    nameEl.className = "kaio-folder-name";
    nameEl.textContent = folder.name || "(unnamed folder)";
    item.appendChild(nameEl);

    const count = document.createElement("span");
    count.className = "kaio-folder-count";
    count.textContent = String(folderEntries.length);
    item.appendChild(count);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "kaio-folder-edit-btn";
    editBtn.innerHTML = ico("edit");
    editBtn.title = "Edit folder";
    editBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      inspectBlock({
        kind: "folder",
        id: "folder-" + folder.id,
        folder: folder,
        lorebookId: lorebookId,
      });
    });
    item.appendChild(editBtn);

    list.appendChild(item);

    for (const child of byParent.get(folder.id) || []) renderFolderRow(child, depth + 1);
  };
  for (const root of byParent.get(null) || []) renderFolderRow(root, 0);
  // Safety net: surface any folder not reached above (e.g. a data cycle).
  for (const f of folders) renderFolderRow(f, 0);

  // Divider between folders and entries
  if (folders.length && entries.length) {
    const divider = document.createElement("div");
    divider.className = "kaio-entrylist-divider";
    list.appendChild(divider);
  }

  // ── Entries ───────────────────────────────────
  const sorted = [...entries].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const e of sorted) {
    const item = document.createElement("label");
    item.className = "kaio-entry-item";
    item.dataset.search = ((e.name || "") + " " + (e.content || "")).toLowerCase();
    const checked = checkedSet.has(e.id);
    const positionLabel = positionToLabel(e.position);
    const folder = e.folderId ? folders.find((f) => f.id === e.folderId) : null;
    const folderTag = folder
      ? `<span class="kaio-entry-folder-tag" title="In folder: ${escapeHTML(folder.name || "")}">${ico("folder")}</span>`
      : "";
    item.innerHTML = `
      <input type="checkbox" ${checked ? "checked" : ""}>
      <div style="flex:1;min-width:0;">
        <div class="kaio-entry-name">${escapeHTML(e.name || "(unnamed)")}</div>
        <div class="kaio-entry-meta">
          ${folderTag}
          <span class="kaio-entry-position">${positionLabel}</span>
          <span>order ${e.order ?? 0}</span>
          ${e.position === 2 ? `<span>depth ${e.depth ?? 0}</span>` : ""}
          ${e.role && e.role !== "system" ? `<span>${escapeHTML(e.role)}</span>` : ""}
        </div>
      </div>
    `;
    item.querySelector("input").addEventListener("change", async (ev) => {
      if ((await guardDirty()) === false) {
        ev.target.checked = !ev.target.checked;
        return;
      }
      if (ev.target.checked) checkedSet.add(e.id);
      else {
        checkedSet.delete(e.id);
        if (e.folderId && folderSet.has(e.folderId)) {
          folderSet.delete(e.folderId);
          renderLeft();
        }
      }
      renderMiddle();
      persistSelection(); // entry/folder toggles don't go through renderAll
    });
    list.appendChild(item);
  }

  wrap.appendChild(list);
  // Re-apply any active entry filter so it survives this re-render.
  if (state.entryFilterOpen && state.entryFilter) applyEntryFilter(list, state.entryFilter);
  wrap.appendChild(renderCreateActions(lorebookId));
  return wrap;
}

// Hides entry/folder rows in a rendered checklist that don't match the query.
// In-place (no re-render) so the search input keeps focus while typing.
function applyEntryFilter(listEl, q) {
  const query = (q || "").trim().toLowerCase();
  const rows = listEl.querySelectorAll(".kaio-entry-item, .kaio-folder-item");
  let anyVisible = false;
  for (const el of rows) {
    const show = !query || (el.dataset.search || "").includes(query);
    el.hidden = !show;
    if (show) anyVisible = true;
  }
  // The folder/entry divider only makes sense in the unfiltered view.
  const divider = listEl.querySelector(".kaio-entrylist-divider");
  if (divider) divider.hidden = !!query;
  // "No matches" note.
  let note = listEl.querySelector(".kaio-entrylist-nomatch");
  if (query && !anyVisible) {
    if (!note) {
      note = document.createElement("div");
      note.className = "kaio-entrylist-empty kaio-entrylist-nomatch";
      listEl.appendChild(note);
    }
    note.textContent = "No entries match “" + query + "”.";
    note.hidden = false;
  } else if (note) {
    note.hidden = true;
  }
}

function renderCreateActions(lorebookId) {
  const actions = document.createElement("div");
  actions.className = "kaio-create-actions";

  const folderBtn = document.createElement("button");
  folderBtn.type = "button";
  folderBtn.className = "kaio-create-btn";
  folderBtn.textContent = "+ Folder";
  folderBtn.addEventListener("click", () => createFolder(lorebookId));
  actions.appendChild(folderBtn);

  const entryBtn = document.createElement("button");
  entryBtn.type = "button";
  entryBtn.className = "kaio-create-btn";
  entryBtn.textContent = "+ Entry";
  entryBtn.addEventListener("click", () => createEntry(lorebookId));
  actions.appendChild(entryBtn);

  return actions;
}

async function createFolder(lorebookId) {
  if ((await guardDirty()) === false) return;
  try {
    const folder = await api("POST", "/lorebooks/" + lorebookId + "/folders", { name: "New Folder" });
    await loadLorebookFolders(lorebookId);
    if (folder && folder.id) {
      const fresh = (state.lorebookFolders[lorebookId] || []).find((f) => f.id === folder.id) || folder;
      inspectBlock({ kind: "folder", id: "folder-" + fresh.id, folder: fresh, lorebookId });
    }
    renderLeft();
    showToast("Folder created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create folder failed", err);
    showToast("Failed to create folder", "error");
  }
}

async function createEntry(lorebookId) {
  if ((await guardDirty()) === false) return;
  try {
    const entry = await api("POST", "/lorebooks/" + lorebookId + "/entries", { name: "New Entry" });
    await loadLorebookEntries(lorebookId);
    if (entry && entry.id) {
      if (!state.selectedEntryIdsByLorebook[lorebookId]) {
        state.selectedEntryIdsByLorebook[lorebookId] = new Set();
      }
      state.selectedEntryIdsByLorebook[lorebookId].add(entry.id);
      const fresh = (state.lorebookEntries[lorebookId] || []).find((e) => e.id === entry.id) || entry;
      inspectBlock({ kind: "lorebook-entry", id: "entry-" + fresh.id, section: null, entry: fresh });
    }
    renderAll();
    showToast("Entry created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create entry failed", err);
    showToast("Failed to create entry", "error");
  }
}

function syncFolderSelections(lorebookId) {
  const folderSet = state.selectedFolderIdsByLorebook[lorebookId];
  if (!folderSet || !folderSet.size) return;
  const entries = state.lorebookEntries[lorebookId] || [];
  const checkedSet = state.selectedEntryIdsByLorebook[lorebookId];
  if (!checkedSet) return;
  for (const e of entries) {
    if (e.folderId && folderSet.has(e.folderId)) {
      checkedSet.add(e.id);
    }
  }
}

function positionToLabel(position) {
  switch (position) {
    case 0:
      return "before char";
    case 1:
      return "after char";
    case 2:
      return "depth";
    default:
      return "?";
  }
}

// ── Build the simulated prompt blocks ─────────────────────────
function buildSimulatedPrompt() {
  const blocks = [];
  if (!state.presetFull) return blocks;

  const sectionOrder = tryParseJSON(state.presetFull.preset.sectionOrder, []);
  const sectionsById = Object.fromEntries((state.presetFull.sections || []).map((s) => [s.id, s]));
  const orderedIds = sectionOrder.length ? sectionOrder : (state.presetFull.sections || []).map((s) => s.id);

  // Collect all entries the user picked across every selected lorebook,
  // then separate by position so each anchor in the preset gets its bucket.
  const picked = [];
  for (const lbId of state.selectedLorebookIds) {
    const checked = state.selectedEntryIdsByLorebook[lbId];
    if (!checked || !checked.size) continue;
    const entries = state.lorebookEntries[lbId] || [];
    for (const e of entries) {
      if (checked.has(e.id)) picked.push(e);
    }
  }
  const beforeEntries = picked.filter((e) => e.position === 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const afterEntries = picked.filter((e) => e.position === 1).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  // Depth is INVERTED relative to Order: higher depth shows higher up in the
  // chat history (= further from the most recent message), so we sort
  // descending here and again where the substack is rendered.
  const depthEntries = picked
    .filter((e) => e.position === 2)
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || (a.order ?? 0) - (b.order ?? 0));

  const persona = state.personaFull || null;

  // Sections with depth-injection are separated out — they would
  // inject inside the chat-history marker, not in the linear flow.
  const depthSections = (state.presetFull.sections || [])
    .filter((s) => s.enabled !== false && s.injectionPosition === "depth")
    .sort((a, b) => (b.injectionDepth ?? 0) - (a.injectionDepth ?? 0));

  for (const id of orderedIds) {
    const section = sectionsById[id];
    if (!section || section.enabled === false) continue;
    if (section.injectionPosition === "depth") continue; // shown inside chat_history block

    if (section.isMarker && section.markerConfig) {
      const cfg = tryParseJSON(section.markerConfig, {});
      switch (cfg.type) {
        case "world_info_before":
          for (const e of beforeEntries) blocks.push(makeEntryBlock(section, e));
          if (!beforeEntries.length) blocks.push(makeMarkerBlock(section, "world_info_before"));
          break;
        case "world_info_after":
          for (const e of afterEntries) blocks.push(makeEntryBlock(section, e));
          if (!afterEntries.length) blocks.push(makeMarkerBlock(section, "world_info_after"));
          break;
        case "lorebook":
          {
            const all = [...beforeEntries, ...afterEntries];
            for (const e of all) blocks.push(makeEntryBlock(section, e));
            if (!all.length) blocks.push(makeMarkerBlock(section, "lorebook"));
          }
          break;
        case "character":
          if (isGroupSelection()) {
            // Group: an info banner (mode + runtime caveats + focus selector),
            // then one card block per active member — stacked exactly like N
            // lorebook entries stack at a world_info anchor.
            const chars = activeGroupCharacters();
            const overrideActive = groupScenarioActive();
            blocks.push({
              kind: "group-info",
              id: "group-info-" + section.id,
              section,
              characters: chars,
            });
            // Individual mode can focus a single responder (the per-turn view).
            let toRender = chars;
            if (state.groupSettings.mode === "individual" && state.groupFocusCharId) {
              const focused = chars.filter((c) => c.id === state.groupFocusCharId);
              if (focused.length) toRender = focused;
            }
            for (const c of toRender) {
              blocks.push(makeCharacterBlock(section, c, cfg, { group: true, omitScenario: overrideActive }));
            }
            if (!toRender.length) blocks.push(makeMarkerBlock(section, "character"));
            // A shared scenario override renders once, after the cards.
            if (overrideActive) {
              blocks.push({
                kind: "group-scenario",
                id: "group-scenario-" + section.id,
                section,
                text: state.groupSettings.scenarioText,
              });
            }
          } else {
            const one = selectedCharacters()[0] || null;
            if (one) blocks.push(makeCharacterBlock(section, one, cfg));
            else blocks.push(makeMarkerBlock(section, "character"));
          }
          break;
        case "persona":
          if (persona) blocks.push(makePersonaBlock(section, persona));
          else blocks.push(makeMarkerBlock(section, "persona"));
          break;
        case "chat_history":
          blocks.push({
            kind: "chat-history",
            id: "marker-" + section.id,
            section,
            depthEntries,
            depthSections,
          });
          break;
        default:
          blocks.push(makeMarkerBlock(section, cfg.type));
      }
    } else {
      blocks.push({
        kind: "section",
        id: "section-" + section.id,
        section,
      });
    }
  }
  return blocks;
}

function makeEntryBlock(section, entry) {
  return {
    kind: "lorebook-entry",
    id: "entry-" + entry.id,
    section,
    entry,
  };
}
function makeCharacterBlock(section, character, cfg, opts) {
  opts = opts || {};
  let fields = (cfg && cfg.characterFields) || null;
  // Under a group Scenario Override each card's own scenario is dropped (the
  // shared one is appended separately), so strip it from the previewed fields.
  if (opts.omitScenario) {
    const base = fields || ["description", "personality", "scenario", "system_prompt"];
    fields = base.filter((f) => f !== "scenario");
  }
  return {
    kind: "character",
    id: "character-" + character.id + "-" + section.id,
    section,
    character,
    fields,
    group: !!opts.group,
  };
}
function makePersonaBlock(section, persona) {
  return {
    kind: "persona",
    id: "persona-" + persona.id + "-" + section.id,
    section,
    persona,
  };
}
function makeMarkerBlock(section, markerType) {
  return {
    kind: "marker",
    id: "marker-" + section.id,
    section,
    markerType,
  };
}

// ── Validation ────────────────────────────────────────────────
//
// `Validate` walks every selected source — preset sections, ALL entries in
// every selected lorebook (whether the user has them checked or not),
// character fields, persona fields — concatenated in the order Marinara would
// assemble them. We run a stack-based XML scan and a macro-shape check across
// the combined stream so an opener in one entry can find its closer in
// another. Any block that ends up "owning" an error gets:
//   • added to state.validationErrors[blockId]
//   • auto-checked into the Simulated Prompt if it's a lorebook entry the
//     user hadn't selected (so the highlight is actually visible).
//
// Returns the error list so the caller can build a toast summary.
function buildValidationItems() {
  const items = [];
  if (!state.presetFull) return items;

  const sectionOrder = tryParseJSON(state.presetFull.preset.sectionOrder, []);
  const sectionsById = Object.fromEntries((state.presetFull.sections || []).map((s) => [s.id, s]));
  const orderedIds = sectionOrder.length ? sectionOrder : (state.presetFull.sections || []).map((s) => s.id);

  // Collect ALL entries from ALL selected lorebooks (regardless of the per-
  // entry checkbox state) so we can spot orphans living in entries the user
  // hasn't yet pulled into the simulation.
  const allEntries = [];
  for (const lbId of state.selectedLorebookIds) {
    const entries = state.lorebookEntries[lbId] || [];
    for (const e of entries) {
      if (e.enabled === false) continue;
      allEntries.push({ ...e, lorebookId: lbId });
    }
  }
  const beforeEntries = allEntries.filter((e) => e.position === 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const afterEntries = allEntries.filter((e) => e.position === 1).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const depthEntries = allEntries
    .filter((e) => e.position === 2)
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || (a.order ?? 0) - (b.order ?? 0));

  const persona = state.personaFull || null;

  const depthSections = (state.presetFull.sections || [])
    .filter((s) => s.enabled !== false && s.injectionPosition === "depth")
    .sort((a, b) => (b.injectionDepth ?? 0) - (a.injectionDepth ?? 0));

  const pushSection = (s) => {
    items.push({
      blockId: "section-" + s.id,
      label: s.name || s.identifier || "Section",
      content: s.content || "",
    });
  };
  const pushEntry = (e) => {
    items.push({
      blockId: "entry-" + e.id,
      label: e.name || "(unnamed entry)",
      content: e.content || "",
      lorebookId: e.lorebookId,
      entryId: e.id,
    });
  };
  const pushCharacter = (sectionId, ch, omitScenario) => {
    if (!ch) return;
    const d = ch.data || {};
    let fields = ["description", "personality", "scenario", "system_prompt", "post_history_instructions"];
    if (omitScenario) fields = fields.filter((f) => f !== "scenario");
    const text = fields
      .map((f) => d[f] || "")
      .filter(Boolean)
      .join("\n\n");
    items.push({
      blockId: "character-" + ch.id + "-" + sectionId,
      label: d.name || ch.name || "Character",
      content: text,
    });
  };
  const pushPersona = (sectionId) => {
    if (!persona) return;
    const text = [persona.description, persona.personality, persona.scenario].filter(Boolean).join("\n\n");
    items.push({
      blockId: "persona-" + persona.id + "-" + sectionId,
      label: persona.name || "Persona",
      content: text,
    });
  };

  for (const id of orderedIds) {
    const section = sectionsById[id];
    if (!section || section.enabled === false) continue;
    if (section.injectionPosition === "depth") continue;

    if (section.isMarker && section.markerConfig) {
      const cfg = tryParseJSON(section.markerConfig, {});
      switch (cfg.type) {
        case "world_info_before":
          for (const e of beforeEntries) pushEntry(e);
          break;
        case "world_info_after":
          for (const e of afterEntries) pushEntry(e);
          break;
        case "lorebook":
          for (const e of [...beforeEntries, ...afterEntries]) pushEntry(e);
          break;
        case "character":
          if (isGroupSelection()) {
            const omit = groupScenarioActive();
            for (const ch of activeGroupCharacters()) pushCharacter(section.id, ch, omit);
            if (omit) {
              items.push({
                blockId: "group-scenario-" + section.id,
                label: "Shared scenario",
                content: state.groupSettings.scenarioText || "",
              });
            }
          } else {
            pushCharacter(section.id, selectedCharacters()[0] || null, false);
          }
          break;
        case "persona":
          pushPersona(section.id);
          break;
        case "chat_history": {
          const allDepth = [
            ...depthSections.map((s) => ({ kind: "section", section: s, depth: s.injectionDepth })),
            ...depthEntries.map((e) => ({ kind: "entry", entry: e, depth: e.depth ?? 0 })),
          ].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));
          for (const item of allDepth) {
            if (item.kind === "section") pushSection(item.section);
            else pushEntry(item.entry);
          }
          break;
        }
        // Other marker kinds (e.g. dialogue_examples, jailbreak) have no
        // user-supplied content to scan, so we skip them.
      }
    } else {
      pushSection(section);
    }
  }
  return items;
}

// Macro shape check: a valid macro is exactly `{{name}}` — two `{`s, a name
// of word-chars (and a few connectors like `:` for `{{getvar::x}}`), two `}`s.
// We scan for any `\{+ ... \}+` substring whose brace counts aren't both 2 and
// flag those as malformed. Nested-brace typos like `{u{ser}}` are caught by
// this same scan: the inner `{ser}}` matches with 1 open / 2 close, which is
// flagged. Single `{ x }` shapes inside code only get flagged when the inner
// looks like a plain identifier — so `{ return y; }` (with punctuation) is
// safely ignored.
function scanMacroErrors(text) {
  const out = [];
  if (!text) return out;
  const re = /(\{+)([^{}]*)(\}+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m[1].length;
    const close = m[3].length;
    if (open === 2 && close === 2) continue; // valid {{name}}
    const inner = m[2].trim();
    if (!inner) continue; // bare `{}` or `{{}}` — not macro-shaped
    if (!/^[A-Za-z0-9_:.\-\s]+$/.test(inner)) continue; // unlikely to be a macro
    out.push({
      kind: "macro",
      message: `Malformed macro (${open} '{', ${close} '}') — expected {{name}}`,
      snippet: m[0],
    });
  }
  return out;
}

// Stack-walk every <tag> across the concatenated source stream. Comments
// (<!-- ... -->), processing instructions (<?...?>), and self-closing tags
// (<br/>) are ignored. Mismatched closers and unclosed openers each carry
// the blockId of the source they came from so renderBlock can highlight it.
function scanXmlErrors(items) {
  const errors = [];
  const stack = [];
  const tagRe = /<(\/?)([A-Za-z][\w:.-]*)\s*([^<>]*?)(\/?)>/g;
  // Skip comments, processing instructions, and backtick-wrapped spans —
  // backtick spans are nearly always referential mentions of a tag (e.g.
  // "refer to `<context>`") rather than real openers/closers, so flagging
  // them produces false positives. Triple-backtick fences first so they
  // win over single-backtick matching inside the same code block.
  const stripRe = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|```[\s\S]*?```|`[^`\n]*`/g;

  for (const it of items) {
    // Replace stripped content with spaces (not "") so snippet positions and
    // any future column reporting stay aligned with the source.
    const text = (it.content || "").replace(stripRe, (m) => " ".repeat(m.length));
    tagRe.lastIndex = 0;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
      const isClose = m[1] === "/";
      const isSelf = !isClose && m[4] === "/";
      if (isSelf) continue;
      const name = m[2];
      const snippet = m[0];
      if (!isClose) {
        stack.push({ name, snippet, blockId: it.blockId, label: it.label });
      } else {
        const top = stack[stack.length - 1];
        if (top && top.name === name) {
          stack.pop();
          continue;
        }
        // Search for the nearest matching opener; everything above it is
        // unclosed and gets reported in its source block.
        let foundIdx = -1;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) {
            foundIdx = i;
            break;
          }
        }
        if (foundIdx >= 0) {
          for (let i = stack.length - 1; i > foundIdx; i--) {
            const orphan = stack[i];
            errors.push({
              blockId: orphan.blockId,
              label: orphan.label,
              kind: "xml-unclosed",
              message: `<${orphan.name}> is never closed`,
              snippet: orphan.snippet,
            });
          }
          stack.length = foundIdx;
        } else {
          errors.push({
            blockId: it.blockId,
            label: it.label,
            kind: "xml-unmatched-close",
            message: `</${name}> has no opener`,
            snippet,
          });
        }
      }
    }
  }
  for (const orphan of stack) {
    errors.push({
      blockId: orphan.blockId,
      label: orphan.label,
      kind: "xml-unclosed",
      message: `<${orphan.name}> is never closed`,
      snippet: orphan.snippet,
    });
  }
  return errors;
}

function resetValidateBtn() {
  const btn = overlayEl && overlayEl.querySelector('[data-action="validate"]');
  if (!btn) return;
  delete btn.dataset.state;
  btn.textContent = "✓ Validate";
}

function runValidation() {
  if (!state.presetFull) {
    showToast("Select a preset first", "error");
    return;
  }
  const items = buildValidationItems();
  const errors = [
    ...scanXmlErrors(items),
    ...items.flatMap((it) =>
      scanMacroErrors(it.content).map((e) => ({
        blockId: it.blockId,
        label: it.label,
        kind: e.kind,
        message: e.message,
        snippet: e.snippet,
      })),
    ),
  ];

  // Auto-check any unselected lorebook entries whose blocks now carry errors,
  // so the highlight is actually visible in the simulated prompt.
  const itemByBlockId = new Map(items.map((it) => [it.blockId, it]));
  let autoChecked = 0;
  for (const err of errors) {
    const it = itemByBlockId.get(err.blockId);
    if (!it || !it.lorebookId || !it.entryId) continue;
    if (!state.selectedEntryIdsByLorebook[it.lorebookId]) {
      state.selectedEntryIdsByLorebook[it.lorebookId] = new Set();
    }
    const checked = state.selectedEntryIdsByLorebook[it.lorebookId];
    if (!checked.has(it.entryId)) {
      checked.add(it.entryId);
      autoChecked++;
    }
  }

  // Group errors by blockId for the per-block UI.
  state.validationErrors = {};
  for (const err of errors) {
    if (!state.validationErrors[err.blockId]) state.validationErrors[err.blockId] = [];
    state.validationErrors[err.blockId].push(err);
  }
  state.validationRanLast = true;
  renderAll();

  const btn = overlayEl && overlayEl.querySelector('[data-action="validate"]');
  if (btn) {
    btn.dataset.state = errors.length ? "errors" : "ok";
    btn.textContent = errors.length ? `⚠ ${errors.length} issue${errors.length === 1 ? "" : "s"}` : "✓ All clean";
  }

  if (!errors.length) {
    showToast("No XML or macro problems found", "success");
  } else {
    const extra = autoChecked ? ` — added ${autoChecked} entr${autoChecked === 1 ? "y" : "ies"} to view` : "";
    showToast(`Found ${errors.length} issue${errors.length === 1 ? "" : "s"}${extra}`, "error");
  }
}

// MIDDLE — render simulated prompt
function renderMiddle() {
  if (!middleBodyEl) return;
  middleBodyEl.innerHTML = "";

  // The filter bar is only useful once a preset's blocks are on screen, and
  // can be hidden via Settings.
  const searchRow = overlayEl && overlayEl.querySelector(".kaio-middle-search");
  const hasBlocks = !!(state.selectedPresetId && state.presetFull);
  if (searchRow) searchRow.hidden = !hasBlocks || !settingOn("showMiddleSearch");

  if (!state.selectedPresetId) {
    middleBodyEl.innerHTML = `
      <div class="kaio-middle-empty">
        <span class="emoji">${ico("viewer")}</span>
        <div>Select a preset on the left to start.<br>
        Lorebook entries, character, and persona will slot into the preset's anchors as the engine would assemble them.</div>
      </div>`;
    return;
  }
  if (!state.presetFull) {
    middleBodyEl.innerHTML = `<div class="kaio-middle-empty"><div>Loading preset…</div></div>`;
    return;
  }

  const blocks = buildSimulatedPrompt();
  if (!blocks.length) {
    middleBodyEl.innerHTML = `<div class="kaio-middle-empty"><div>This preset has no enabled sections.</div></div>`;
    renderTokenGauge(null);
    return;
  }

  const overlaps = computeEntryOverlaps(blocks);
  const q = (state.middleFilter || "").trim().toLowerCase();
  const shown = q ? blocks.filter((b) => blockMatchesFilter(b, q)) : blocks;
  if (!shown.length) {
    middleBodyEl.innerHTML = `<div class="kaio-middle-empty"><div>No blocks match “${escapeHTML(state.middleFilter.trim())}”.</div></div>`;
  } else {
    for (const b of shown) {
      middleBodyEl.appendChild(renderBlock(b, overlaps));
    }
  }
  // The gauge always reflects the full prompt, not the filtered subset.
  renderTokenGauge(blocks);
}

// True when a block matches the Simulated Prompt filter (case-insensitive,
// already lower-cased). Chat-history matches on its depth-injected items too.
function blockMatchesFilter(block, q) {
  if (!q) return true;
  const hay = [
    blockTitle(block),
    blockTagText(block),
    block.kind === "chat-history" ? "" : blockPreviewRaw(block),
    (block.entry && block.entry.role) || (block.section && block.section.role) || "",
  ];
  if (block.kind === "chat-history") {
    for (const s of block.depthSections || []) hay.push(s.name || "", s.content || "");
    for (const e of block.depthEntries || []) hay.push(e.name || "", e.content || "");
  }
  return hay.join("\n").toLowerCase().includes(q);
}

// Renders the "~N tokens" readout + usage bar into the middle column header.
// Hidden entirely when token estimates are off, when there are no blocks, or
// when there is no active connection (the gauge fills toward that connection's
// Max Context Window, so without one there is nothing to fill toward).
function renderTokenGauge(blocks) {
  if (!tokenGaugeEl) return;
  if (!settingOn("showTokenEstimates") || !state.activeConnection || !blocks || !blocks.length) {
    tokenGaugeEl.innerHTML = "";
    tokenGaugeEl.dataset.empty = "true";
    return;
  }
  tokenGaugeEl.dataset.empty = "false";
  const total = totalPromptTokens(blocks);
  const ctx = state.activeConnection.maxContext;
  const label = state.activeConnection.label;
  const ratio = total / ctx;
  const pct = Math.min(100, Math.round(ratio * 100));
  const level = ratio >= 1 ? "over" : ratio >= 0.8 ? "warn" : "ok";
  tokenGaugeEl.innerHTML =
    `<span class="kaio-token-gauge-count">~${total.toLocaleString()} tokens</span>` +
    `<div class="kaio-token-gauge-bar" data-level="${level}" ` +
    `title="≈${total.toLocaleString()} of ${ctx.toLocaleString()} tokens (${Math.round(ratio * 100)}%) — context window of ${escapeHTML(label)}">` +
    `<div class="kaio-token-gauge-fill" style="width:${pct}%"></div></div>` +
    `<span class="kaio-token-gauge-pct" data-level="${level}">${Math.round(ratio * 100)}%</span>` +
    `<span class="kaio-token-gauge-info" ` +
    `title="Rough estimate (~4 characters per token) against the active connection's Max Context Window (${ctx.toLocaleString()}). Excludes the live chat transcript (injected at runtime) and any wrap formatting.">ⓘ</span>`;
}

// Returns a Set of entry IDs whose `order` collides with another displayed
// entry within the same anchor bucket (and same depth, for depth entries).
function computeEntryOverlaps(blocks) {
  const overlap = new Set();
  // Top-level entries (before-char / after-char anchors)
  const topByPosition = new Map(); // position → Map<order, entryId[]>
  for (const b of blocks) {
    if (b.kind !== "lorebook-entry") continue;
    const pos = b.entry.position ?? 0;
    const ord = b.entry.order ?? 0;
    if (!topByPosition.has(pos)) topByPosition.set(pos, new Map());
    const byOrder = topByPosition.get(pos);
    if (!byOrder.has(ord)) byOrder.set(ord, []);
    byOrder.get(ord).push(b.entry.id);
  }
  for (const byOrder of topByPosition.values()) {
    for (const ids of byOrder.values()) {
      if (ids.length > 1) for (const id of ids) overlap.add(id);
    }
  }
  // Depth-injected entries (inside chat-history blocks)
  for (const b of blocks) {
    if (b.kind !== "chat-history") continue;
    const byKey = new Map(); // "depth|order" → entryId[]
    for (const e of b.depthEntries || []) {
      const key = (e.depth ?? 0) + "|" + (e.order ?? 0);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(e.id);
    }
    for (const ids of byKey.values()) {
      if (ids.length > 1) for (const id of ids) overlap.add(id);
    }
  }
  return overlap;
}

function renderBlock(block, overlaps) {
  if (block.kind === "group-info") return renderGroupInfoBlock(block);
  const el = document.createElement("div");
  el.className = "kaio-block";
  const isReadonly = block.kind === "marker" || block.kind === "chat-history";
  el.dataset.readonly = isReadonly ? "true" : "false";
  el.dataset.selected = state.inspecting && state.inspecting.id === block.id ? "true" : "false";

  const isOverlapping = block.kind === "lorebook-entry" && overlaps && overlaps.has(block.entry.id);
  if (isOverlapping) el.dataset.overlap = "true";

  const isDisabled = block.kind === "lorebook-entry" && block.entry.enabled === false;
  if (isDisabled) el.dataset.disabled = "true";

  const validateErrs = state.validationErrors[block.id];
  if (validateErrs && validateErrs.length) el.dataset.validateError = "true";

  const expanded = state.expandedBlocks.has(block.id);
  const previewHTML = blockPreviewHTML(block, expanded);
  const raw = blockPreviewRaw(block);
  // For chat-history we always want the depth substack rendered, but the
  // parent block has no inline body — the runtime hint folds into the head.
  const isChatHistory = block.kind === "chat-history";
  // Compact = render hint inline in the head, no body element. Used for
  // markers (no resolved content), chat-history shell, and any block whose
  // own preview is empty.
  const isCompact = isReadonly || isChatHistory || !previewHTML;
  const headHint = isCompact ? blockEmptyHint(block) : "";

  if (isCompact) el.dataset.compact = "true";

  el.appendChild(
    renderBlockHead(block, {
      isOverlapping,
      isSubblock: false,
      headHint,
    }),
  );

  if (!isCompact) {
    const body = document.createElement("div");
    body.className = "kaio-block-content";
    if (expanded) body.dataset.expanded = "true";
    body.innerHTML = previewHTML;
    if (needsExpandToggle(raw)) body.dataset.hasToggle = "true";
    el.appendChild(body);
  }

  // Chat history shows nested depth-injected items as sub-blocks
  if (isChatHistory) {
    const all = [
      ...block.depthSections.map((s) => ({
        kind: "section",
        id: "section-" + s.id,
        section: s,
        depth: s.injectionDepth,
      })),
      ...block.depthEntries.map((e) => ({
        kind: "lorebook-entry",
        id: "entry-" + e.id,
        section: block.section,
        entry: e,
        depth: e.depth ?? 0,
      })),
    ].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));

    if (all.length) {
      const stack = document.createElement("div");
      stack.className = "kaio-block-substack";
      for (const sub of all) {
        stack.appendChild(renderSubblock(sub, overlaps));
      }
      el.appendChild(stack);
    }
  }

  // Expand/compress toggle: only when there's a body that's actually too big
  // to render at once (or that's been expanded so the user can collapse).
  if (!isCompact && needsExpandToggle(raw)) {
    el.appendChild(makeExpandToggle(block.id, expanded));
  }

  if (validateErrs && validateErrs.length) {
    el.appendChild(renderValidationErrors(validateErrs));
  }

  if (!isReadonly) {
    // A group Scenario Override isn't a standalone source — clicking it opens
    // the Group Chat settings where its text is edited.
    if (block.kind === "group-scenario") el.addEventListener("click", () => openGroupEditor());
    else el.addEventListener("click", () => inspectBlock(block));
  }

  // Drag-and-drop for section and marker blocks in the simulated prompt
  const isDraggableKind = block.kind === "section" || block.kind === "marker" || block.kind === "chat-history";
  if (isDraggableKind && block.section && state.presetFull) {
    el.draggable = true;
    el.dataset.sectionId = block.section.id;
    el.addEventListener("dragstart", (ev) => {
      draggedSectionId = block.section.id;
      ev.dataTransfer.setData("text/plain", block.section.id);
      ev.dataTransfer.effectAllowed = "move";
      el.dataset.dragging = "true";
    });
    el.addEventListener("dragend", () => {
      draggedSectionId = null;
      delete el.dataset.dragging;
      middleBodyEl.querySelectorAll(".kaio-block").forEach((b) => delete b.dataset.dragover);
    });
    el.addEventListener("dragover", (ev) => {
      if (!draggedSectionId || draggedSectionId === block.section.id) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      middleBodyEl.querySelectorAll(".kaio-block").forEach((b) => delete b.dataset.dragover);
      el.dataset.dragover = "true";
    });
    el.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const fromId = ev.dataTransfer.getData("text/plain");
      if (!fromId || fromId === block.section.id) return;
      const sectionOrder = tryParseJSON(state.presetFull.preset.sectionOrder, []);
      const order = sectionOrder.length ? [...sectionOrder] : (state.presetFull.sections || []).map((s) => s.id);
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(block.section.id);
      if (fromIdx < 0 || toIdx < 0) return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromId);
      reorderPresetSections(state.presetFull.preset.id, order);
    });
  }

  return el;
}

function renderSubblock(sub, overlaps) {
  const subEl = document.createElement("div");
  subEl.className = "kaio-subblock";
  const subOverlap = sub.kind === "lorebook-entry" && overlaps && overlaps.has(sub.entry.id);
  if (subOverlap) subEl.dataset.overlap = "true";
  const subErrs = state.validationErrors[sub.id];
  if (subErrs && subErrs.length) subEl.dataset.validateError = "true";
  subEl.dataset.selected = state.inspecting && state.inspecting.id === sub.id ? "true" : "false";

  const subDisabled = sub.kind === "lorebook-entry" && sub.entry.enabled === false;
  if (subDisabled) subEl.dataset.disabled = "true";

  const subExpanded = state.expandedBlocks.has(sub.id);
  const subHTML = blockPreviewHTML(sub, subExpanded);
  const subRaw = blockPreviewRaw(sub);
  const isCompactSub = !subHTML;
  const subHint = isCompactSub ? blockEmptyHint(sub) : "";
  if (isCompactSub) subEl.dataset.compact = "true";

  subEl.appendChild(
    renderBlockHead(sub, {
      isOverlapping: subOverlap,
      isSubblock: true,
      headHint: subHint,
    }),
  );

  if (!isCompactSub) {
    const subBody = document.createElement("div");
    subBody.className = "kaio-block-content";
    if (subExpanded) subBody.dataset.expanded = "true";
    subBody.innerHTML = subHTML;
    if (needsExpandToggle(subRaw)) subBody.dataset.hasToggle = "true";
    subEl.appendChild(subBody);
    if (needsExpandToggle(subRaw)) {
      subEl.appendChild(makeExpandToggle(sub.id, subExpanded));
    }
  }

  if (subErrs && subErrs.length) {
    subEl.appendChild(renderValidationErrors(subErrs));
  }

  subEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    inspectBlock(sub);
  });
  return subEl;
}

// Whether a block's preview is long enough to warrant the Expand/Compress
// toggle. Mirrors the truncation thresholds used in blockPreviewHTML and the
// 3-line clamp from .kaio-block-content.
function needsExpandToggle(raw) {
  if (!raw) return false;
  if (raw.length > 600) return true;
  // Count newlines — if there are 3+ lines the clamp is doing real work.
  let lines = 1;
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) === 10) lines++;
    if (lines > 3) return true;
  }
  return false;
}

function renderValidationErrors(errs) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-block-validate";
  for (const e of errs) {
    const line = document.createElement("div");
    line.className = "kaio-block-validate-line";
    const snippet = e.snippet ? ` <code>${escapeHTML(e.snippet)}</code>` : "";
    line.innerHTML = `⚠ ${escapeHTML(e.message)}${snippet}`;
    wrap.appendChild(line);
  }
  return wrap;
}

function renderBlockHead(block, { isOverlapping, isSubblock, headHint }) {
  const head = document.createElement("div");
  head.className = "kaio-block-head";
  const tagText = blockTagText(block);
  const role = block.section?.role || (block.entry && block.entry.role) || "";

  let orderHTML = "";
  if (block.kind === "lorebook-entry") {
    const ord = block.entry.order ?? 0;
    orderHTML = `<span class="kaio-block-order"${isOverlapping ? ' data-overlap="true"' : ""}>order ${ord}${isOverlapping ? " — OVERLAPPING!" : ""}</span>`;
  }

  // Group badge for sections/markers that belong to a group (toggleable)
  let groupHTML = "";
  if (
    settingOn("showGroupBadges") &&
    block.section &&
    block.section.groupId &&
    state.presetFull &&
    state.presetFull.groups
  ) {
    const group = state.presetFull.groups.find((g) => g.id === block.section.groupId);
    if (group) {
      groupHTML = `<span class="kaio-group-badge">${escapeHTML(group.name || "Group")}</span>`;
    }
  }

  // Folder badge for lorebook entries that belong to a folder (toggleable)
  let folderHTML = "";
  if (settingOn("showFolderBadges") && block.kind === "lorebook-entry" && block.entry.folderId) {
    const lbId = block.entry.lorebookId;
    const folders = (lbId && state.lorebookFolders[lbId]) || [];
    const folder = folders.find((f) => f.id === block.entry.folderId);
    if (folder) {
      folderHTML = `<span class="kaio-folder-badge">${escapeHTML(folder.name || "Folder")}</span>`;
    }
  }

  // Disabled badge for disabled lorebook entries (rightmost indicator)
  let disabledHTML = "";
  if (block.kind === "lorebook-entry" && block.entry.enabled === false) {
    disabledHTML = `<span class="kaio-disabled-badge">disabled</span>`;
  }

  // For depth-injected sub-blocks, the existing depth label still appears at
  // the right; the order indicator (if any) sits to its left.
  const depthLabel =
    isSubblock && block.depth !== undefined ? `<span class="kaio-block-role">depth ${block.depth}</span>` : "";

  // Inline hint replaces the now-removed empty body for compact blocks.
  const hintHTML = headHint ? `<span class="kaio-block-head-hint">${escapeHTML(headHint)}</span>` : "";

  // Rough per-block token estimate — shown only with token estimates enabled
  // and an active connection (matching the header gauge), skipped for empty /
  // runtime blocks.
  const tok = settingOn("showTokenEstimates") && state.activeConnection ? blockOwnTokens(block) : 0;
  const tokenHTML =
    tok > 0
      ? `<span class="kaio-block-tokens" title="≈${tok} tokens (rough estimate, ~4 characters each)">~${tok}</span>`
      : "";

  head.innerHTML = `
    <span class="kaio-block-tag" data-kind="${block.kind}">${tagText}</span>
    <span class="kaio-block-name">${escapeHTML(blockTitle(block))}</span>
    ${tokenHTML}
    ${hintHTML}
    ${groupHTML}
    ${folderHTML}
    ${orderHTML}
    ${disabledHTML}
    ${depthLabel}
    ${role && !isSubblock ? `<span class="kaio-block-role">${escapeHTML(role)}</span>` : ""}
  `;
  return head;
}

function makeExpandToggle(blockId, expanded) {
  const btn = document.createElement("button");
  btn.className = "kaio-expand-toggle";
  btn.type = "button";
  btn.title = expanded ? "Show compressed preview" : "Show full content";
  btn.textContent = expanded ? "Compress" : "Expand";
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (state.expandedBlocks.has(blockId)) state.expandedBlocks.delete(blockId);
    else state.expandedBlocks.add(blockId);
    renderMiddle();
  });
  return btn;
}

// The group banner: a compact, read-only block that sits just above the group's
// character cards. Shows the mode, a plain-language note about what happens at
// runtime for the current settings, and (individual mode) a live focus selector
// to preview a single responder's turn. Clicking it opens the Group Chat editor.
function renderGroupInfoBlock(block) {
  const gs = state.groupSettings;
  const chars = block.characters || [];
  const merged = gs.mode === "merged";
  const modeLabel = groupModeLabel(gs.mode);

  const el = document.createElement("div");
  el.className = "kaio-block kaio-group-info";
  el.dataset.readonly = "true";
  el.dataset.compact = "true";
  el.dataset.selected = state.inspecting && state.inspecting.id === "group-editor" ? "true" : "false";

  const head = document.createElement("div");
  head.className = "kaio-block-head";
  head.innerHTML =
    `<span class="kaio-block-tag" data-kind="group-info">Group</span>` +
    `<span class="kaio-block-name">${chars.length} character${chars.length === 1 ? "" : "s"}</span>` +
    `<span class="kaio-group-badge" data-mode="${gs.mode}">${escapeHTML(modeLabel)}</span>`;
  el.appendChild(head);

  const note = document.createElement("div");
  note.className = "kaio-group-note";
  note.textContent = groupInfoNote(gs, chars);
  el.appendChild(note);

  if (!merged) {
    const row = document.createElement("div");
    row.className = "kaio-group-focus";
    const lab = document.createElement("span");
    lab.textContent = "Preview turn:";
    row.appendChild(lab);
    const sel = document.createElement("select");
    sel.className = "kaio-select";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All members (stack)";
    sel.appendChild(all);
    for (const c of chars) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = (c.data && c.data.name) || c.name || "Character";
      if (state.groupFocusCharId === c.id) o.selected = true;
      sel.appendChild(o);
    }
    // The selector is a view control, not editing — don't bubble to the block.
    sel.addEventListener("click", (ev) => ev.stopPropagation());
    sel.addEventListener("change", () => {
      state.groupFocusCharId = sel.value || null;
      renderMiddle();
      persistSelection(); // view-only, but a bare renderMiddle() skips the close-time save
    });
    row.appendChild(sel);
    el.appendChild(row);
  }

  el.addEventListener("click", () => openGroupEditor());
  return el;
}
// Plain-language summary of how the current group settings assemble at runtime.
function groupInfoNote(gs, chars) {
  const n = chars.length;
  const override = (gs.scenarioText || "").trim().length > 0;
  // Every member benched — no cards contribute, so the mode blurb would lie.
  if (!n) {
    return (
      `All group members are marked Inactive — no character cards are included.` +
      (override ? ` A shared Scenario Override is still applied.` : "")
    );
  }
  const parts = [];
  if (gs.mode === "merged") {
    parts.push(
      `Merged (Narrator): all ${n} card${n === 1 ? "" : "s"} are stacked into one character section and a single reply voices the whole scene.`,
    );
    if (gs.speakerColors) parts.push(`Dialogue is wrapped in <speaker="name"> tags.`);
  } else {
    parts.push(
      `Individual: at generation the engine builds one card per turn — other members' cards are stripped and history is relabeled so the model answers as a single character.`,
    );
    const ord =
      gs.responseOrder === "smart"
        ? "Smart — an agent picks who speaks each turn"
        : gs.responseOrder === "manual"
          ? "Manual — you choose each speaker"
          : "Sequential — members reply in listed order";
    parts.push(`Response order: ${ord}.`);
    parts.push(
      gs.turnPromptEnabled
        ? `Each turn appends "Respond ONLY as <name>."`
        : `No per-turn "Respond ONLY as …" instruction is added.`,
    );
    if (gs.speakerNamesInHistory) parts.push(`History turns are prefixed with the speaker's name.`);
    // Only claim a focused view when the focused member is actually in the set.
    const focused = state.groupFocusCharId && chars.some((c) => c.id === state.groupFocusCharId);
    parts.push(
      focused
        ? `Previewing one member's turn — others are hidden.`
        : `Showing all members stacked; use "Preview turn" to focus a single responder.`,
    );
  }
  if (override) parts.push(`A shared Scenario Override replaces each card's own scenario.`);
  return parts.join(" ");
}

function blockTagText(block) {
  switch (block.kind) {
    case "section":
      return "Section";
    case "lorebook-entry":
      return "Lorebook";
    case "character":
      return "Character";
    case "persona":
      return "Persona";
    case "chat-history":
      return "Chat history";
    case "marker":
      return "Marker";
    case "group-info":
      return "Group";
    case "group-scenario":
      return "Scenario";
    default:
      return block.kind;
  }
}
function blockTitle(block) {
  if (block.kind === "section") return block.section.name || block.section.identifier || "Section";
  if (block.kind === "lorebook-entry") return block.entry.name || "(unnamed entry)";
  if (block.kind === "character") return block.character.data?.name || block.character.name || "Character";
  if (block.kind === "persona") return block.persona.name || "Persona";
  if (block.kind === "chat-history") return block.section.name || "Chat history";
  if (block.kind === "marker") return block.section.name || `[${block.markerType}]`;
  if (block.kind === "group-info") return "Group";
  if (block.kind === "group-scenario") return "Shared scenario";
  return "Block";
}
function blockPreviewRaw(block) {
  if (block.kind === "section") return block.section.content || "";
  if (block.kind === "lorebook-entry") return block.entry.content || "";
  if (block.kind === "character") {
    const d = block.character.data || {};
    const fields = block.fields || ["description", "personality", "scenario", "system_prompt"];
    return fields
      .map((f) => (d[f] ? `[${f}]\n${d[f]}` : ""))
      .filter(Boolean)
      .join("\n\n");
  }
  if (block.kind === "persona") {
    const p = block.persona || {};
    return [p.description, p.personality, p.scenario].filter(Boolean).join("\n\n");
  }
  if (block.kind === "group-scenario") return block.text || "";
  return "";
}

// ── Token estimation (rough heuristic: ~4 characters per token) ──
// Not a real tokenizer — providers differ — but close enough to gauge how
// much of the context window the static prompt fills.
function estimateTokens(text) {
  const s = String(text || "");
  return s ? Math.ceil(s.length / 4) : 0;
}
// A single block's own resolved text (no descent into a chat-history block's
// depth sub-blocks). Markers and the chat-history shell carry no static text.
function blockOwnTokens(block) {
  if (!block || block.kind === "chat-history" || block.kind === "marker") return 0;
  return estimateTokens(blockPreviewRaw(block));
}
// Total across the simulated prompt, descending into the depth-injected
// sections/entries a chat-history block carries. The chat-history placeholder
// itself is excluded — the real transcript is injected at runtime.
function totalPromptTokens(blocks) {
  let total = 0;
  for (const b of blocks || []) {
    if (b.kind === "chat-history") {
      for (const s of b.depthSections || []) total += estimateTokens(s.content || "");
      for (const e of b.depthEntries || []) total += estimateTokens(e.content || "");
    } else {
      total += blockOwnTokens(b);
    }
  }
  return total;
}
// Build the HTML body for a block's preview, applying variable substitution
// and respecting per-block expansion state. Returns "" for empty content.
//
// Truncation happens in raw-text space *before* escaping so a `<` in the
// source never gets escaped twice (which would render as the literal "&lt;").
function blockPreviewHTML(block, expanded) {
  const raw = blockPreviewRaw(block);
  if (!raw) return "";
  const text = expanded ? raw : raw.slice(0, 600);
  const subs = activeVariableSubs();
  if (!subs.length) return escapeHTML(text);

  const pattern = subs.map((s) => `\\{\\{(?:getvar::)?${escapeRegex(s.name)}\\}\\}`).join("|");
  const re = new RegExp(pattern, "gi");
  let out = "";
  let lastIdx = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    out += escapeHTML(text.slice(lastIdx, m.index));
    const inner = m[0].slice(2, -2); // strip "{{" / "}}"
    const name = inner.replace(/^getvar::/i, "");
    const sub = subs.find((s) => s.name.toLowerCase() === name.toLowerCase());
    const value = sub ? sub.value : "";
    out += `<mark class="kaio-var-preview" title="Preview of {{${escapeHTML(name)}}}">${escapeHTML(value)}</mark>`;
    lastIdx = m.index + m[0].length;
  }
  out += escapeHTML(text.slice(lastIdx));
  return out;
}
function activeVariableSubs() {
  const cbs = (state.presetFull && state.presetFull.choiceBlocks) || [];
  const out = [];
  for (const cb of cbs) {
    const entry = state.variablePreviews[cb.variableName];
    if (!entry || entry.value === undefined || entry.value === null) continue;
    out.push({ name: cb.variableName, value: String(entry.value) });
  }
  return out;
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function blockEmptyHint(block) {
  switch (block.kind) {
    case "marker":
      return `(Resolved at runtime: ${block.markerType})`;
    case "chat-history":
      return "(Chat history is injected at runtime)";
    case "lorebook-entry":
      return "(Empty entry)";
    case "character":
      return "(Empty character fields)";
    case "persona":
      return "(Empty persona)";
    default:
      return "(Empty)";
  }
}

// ── Mobile tab helper ────────────────────────────────────────
function switchMobileTab(key) {
  if (!overlayEl) return;
  // One column at a time when the page is narrow (a phone, a tablet held upright, a split view).
  if (overlayEl.clientWidth > 900) return;
  const body = overlayEl.querySelector(".kaio-body");
  if (body) body.dataset.activeTab = key;
  for (const t of overlayEl.querySelectorAll(".kaio-mobile-tab")) {
    t.dataset.active = t.dataset.tab === key ? "true" : "";
    t.classList.toggle("is-on", t.dataset.tab === key);
    t.setAttribute("aria-pressed", t.dataset.tab === key ? "true" : "false");
  }
}

// ── Inspector / editor ────────────────────────────────────────
function inspectBlock(block) {
  if (state.isDirty) {
    confirmDirtySwitch(block);
    return;
  }
  state.inspecting = block;
  state.draft = makeDraft(block);
  state.isDirty = false;
  state.folderBatchAdd = { showNested: false, selected: new Set() };
  state.charFieldExpanded.clear(); // fresh expand state per inspected block
  renderMiddle(); // re-paint selection state
  renderRight();
  switchMobileTab("right");
}

function makeDraft(block) {
  if (!block) return null;
  switch (block.kind) {
    case "section":
      return {
        kind: "section",
        sourceId: block.section.id,
        fields: {
          name: block.section.name || "",
          content: block.section.content || "",
          role: block.section.role || "system",
          enabled: block.section.enabled !== false,
          injectionPosition: block.section.injectionPosition || "ordered",
          injectionDepth: block.section.injectionDepth ?? 4,
          injectionOrder: block.section.injectionOrder ?? 100,
          groupId: block.section.groupId || "",
        },
      };
    case "lorebook-entry": {
      const e = block.entry;
      const arrCSV = (a) => (Array.isArray(a) ? a.join(", ") : "");
      const arrSrc = Array.isArray(e.additionalMatchingSources) ? new Set(e.additionalMatchingSources) : new Set();
      return {
        kind: "lorebook-entry",
        sourceId: e.id,
        lorebookId: e.lorebookId,
        fields: {
          // ── Basic ─────────────────────────────────
          name: e.name || "",
          content: e.content || "",
          description: e.description || "",
          keys: arrCSV(e.keys),
          secondaryKeys: arrCSV(e.secondaryKeys),
          enabled: e.enabled !== false,
          constant: !!e.constant,
          position: e.position ?? 0,
          depth: e.depth ?? 4,
          order: e.order ?? 100,
          role: e.role || "system",
          // ── Matching options ─────────────────────
          selective: !!e.selective,
          selectiveLogic: e.selectiveLogic || "and",
          probability: e.probability ?? null,
          scanDepth: e.scanDepth ?? null,
          matchWholeWords: !!e.matchWholeWords,
          caseSensitive: !!e.caseSensitive,
          useRegex: !!e.useRegex,
          // ── Context filters ──────────────────────
          characterFilterMode: e.characterFilterMode || "any",
          characterFilterIds: arrCSV(e.characterFilterIds),
          characterTagFilterMode: e.characterTagFilterMode || "any",
          characterTagFilters: arrCSV(e.characterTagFilters),
          generationTriggerFilterMode: e.generationTriggerFilterMode || "any",
          generationTriggerFilters: arrCSV(e.generationTriggerFilters),
          // additionalMatchingSources is a Set of enum values
          additionalMatchingSources: arrSrc,
          // ── Timing ───────────────────────────────
          sticky: e.sticky ?? null,
          cooldown: e.cooldown ?? null,
          delay: e.delay ?? null,
          ephemeral: e.ephemeral ?? null,
          // ── Group & Tag ──────────────────────────
          group: e.group || "",
          groupWeight: e.groupWeight ?? null,
          tag: e.tag || "",
          folderId: e.folderId || "",
          // ── Misc ────────────────────────────────
          preventRecursion: !!e.preventRecursion,
          locked: !!e.locked,
        },
      };
    }
    case "character": {
      const c = block.character || {};
      const d = c.data || {};
      const e = d.extensions || {};
      const dp = e.depth_prompt || {};
      return {
        kind: "character",
        sourceId: c.id,
        fields: {
          // Metadata
          name: d.name || "",
          comment: c.comment || "", // record-level "Title / comment"
          creator: d.creator || "",
          character_version: d.character_version || "",
          tags: Array.isArray(d.tags) ? d.tags.join(", ") : "",
          talkativeness: e.talkativeness ?? 0.5,
          fav: !!e.fav,
          creator_notes: d.creator_notes || "",
          // Card
          description: d.description || "",
          personality: d.personality || "",
          backstory: e.backstory || "", // extensions.*
          appearance: e.appearance || "", // extensions.*
          scenario: d.scenario || "",
          // Dialogue
          first_mes: d.first_mes || "",
          mes_example: d.mes_example || "",
          alternate_greetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings.slice() : [],
          // Colors (extensions.*)
          nameColor: e.nameColor || "",
          dialogueColor: e.dialogueColor || "",
          boxColor: e.boxColor || "",
          // Stats (extensions.rpgStats)
          rpgStats: normalizeRpgStats(e.rpgStats),
          // Advanced
          system_prompt: d.system_prompt || "",
          post_history_instructions: d.post_history_instructions || "",
          depthPrompt: dp.prompt || "", // extensions.depth_prompt.*
          depthDepth: dp.depth ?? 4,
          depthRole: dp.role || "system",
        },
      };
    }
    case "persona": {
      const p = block.persona || {};
      return {
        kind: "persona",
        sourceId: p.id,
        fields: {
          name: p.name || "",
          description: p.description || "",
          personality: p.personality || "",
          scenario: p.scenario || "",
        },
      };
    }
    case "group-editor":
      return {
        kind: "group-editor",
        sourceId: "group-editor",
        fields: {
          mode: state.groupSettings.mode || "merged",
          responseOrder: state.groupSettings.responseOrder || "sequential",
          turnPromptEnabled: state.groupSettings.turnPromptEnabled !== false,
          speakerNamesInHistory: !!state.groupSettings.speakerNamesInHistory,
          speakerColors: !!state.groupSettings.speakerColors,
          scenarioText: state.groupSettings.scenarioText || "",
          inactiveCharacterIds: new Set(state.groupSettings.inactiveCharacterIds || []),
        },
      };
    case "folder":
      return {
        kind: "folder",
        sourceId: block.folder.id,
        lorebookId: block.lorebookId,
        fields: {
          name: block.folder.name || "",
          enabled: block.folder.enabled !== false,
          order: block.folder.order ?? 0,
          parentFolderId: block.folder.parentFolderId || "",
        },
      };
    case "preset-editor": {
      const p = state.presetFull && state.presetFull.preset;
      if (!p) return null;
      return {
        kind: "preset-editor",
        sourceId: p.id,
        fields: {
          name: p.name || "",
          description: p.description || "",
          wrapFormat: p.wrapFormat || "xml",
          author: p.author || "",
        },
      };
    }
    case "lorebook-editor": {
      const lb = block.lorebook;
      if (!lb) return null;
      const arrCSV = (a) => (Array.isArray(a) ? a.join(", ") : "");
      return {
        kind: "lorebook-editor",
        sourceId: lb.id,
        fields: {
          name: lb.name || "",
          description: lb.description || "",
          tags: arrCSV(lb.tags),
          category: lb.category || "uncategorized",
          enabled: lb.enabled !== false,
          isGlobal: !!lb.isGlobal,
          scanDepth: lb.scanDepth ?? 2,
          tokenBudget: lb.tokenBudget ?? 2048,
          recursiveScanning: !!lb.recursiveScanning,
        },
      };
    }
    default:
      return null;
  }
}

function renderRight() {
  if (!rightBodyEl || !rightFooterEl) return;
  const savedScroll = rightBodyEl.scrollTop;
  rightBodyEl.innerHTML = "";
  rightFooterEl.innerHTML = "";

  // Variables panel only shows when the currently-inspected block's content
  // references one or more of the preset's choice-block variables. Pure visual
  // preview — never edits anything.
  if (state.inspecting) {
    const referencedVars = collectReferencedVariables(state.inspecting);
    if (referencedVars.length) {
      rightBodyEl.appendChild(renderVariablesPanel(referencedVars));
    }
  }

  if (!state.inspecting || !state.draft) {
    const empty = document.createElement("div");
    empty.className = "kaio-right-empty";
    empty.innerHTML = "Click a block in the simulated prompt to edit it here.";
    rightBodyEl.appendChild(empty);
    return;
  }

  const d = state.draft;
  const editable = d.kind !== "marker";
  const f = d.fields;

  switch (d.kind) {
    case "section":
      rightBodyEl.appendChild(field("Name", f.name, "name", "input"));
      rightBodyEl.appendChild(field("Content", f.content, "content", "textarea"));
      rightBodyEl.appendChild(
        rowOf(
          selectField("Role", f.role, "role", ["system", "user", "assistant"]),
          selectField("Position", f.injectionPosition, "injectionPosition", ["ordered", "depth"]),
        ),
      );
      // Depth & Order only matter for depth-injected sections — ordered sections
      // are sequenced by the preset's sectionOrder array, so showing the fields
      // would imply they do something they don't.
      if (f.injectionPosition === "depth") {
        rightBodyEl.appendChild(
          rowOf(
            numberField("Depth", f.injectionDepth, "injectionDepth"),
            numberField("Order", f.injectionOrder, "injectionOrder"),
          ),
        );
      }
      rightBodyEl.appendChild(checkboxField("Enabled", f.enabled, "enabled"));
      rightBodyEl.appendChild(groupSelectField(f.groupId));
      break;

    case "lorebook-entry": {
      const matchMode = f.constant ? "constant" : f.selective ? "selective" : "normal";
      const lbC = { stateObj: state.lbInspectorCollapsed };

      // ── Basic ─────────────────────────────────────
      rightBodyEl.appendChild(
        renderCollapsible(
          "Basic",
          "basic",
          () => {
            const c = document.createElement("div");
            c.appendChild(field("Name", f.name, "name", "input"));
            c.appendChild(field("Content", f.content, "content", "textarea", null, 6));
            c.appendChild(
              field(
                "Description",
                f.description,
                "description",
                "textarea",
                "Brief summary used by the Knowledge Router to decide whether to inject this entry. Not sent to the AI as content.",
                3,
              ),
            );
            c.appendChild(
              field(
                "Primary keys",
                f.keys,
                "keys",
                "input",
                "Comma-separated keywords that trigger this entry when found in recent chat messages.",
              ),
            );
            c.appendChild(
              field(
                "Secondary keys",
                f.secondaryKeys,
                "secondaryKeys",
                "input",
                "Comma-separated secondary keywords. Used with Selective matching to further filter when this entry fires.",
              ),
            );
            c.appendChild(
              rowOf(
                selectField("Position", String(f.position), "position", [
                  ["0", "before char"],
                  ["1", "after char"],
                  ["2", "depth"],
                ]),
                selectField("Role", f.role, "role", ["system", "user", "assistant"]),
              ),
            );
            c.appendChild(
              rowOf(
                numberField(
                  "Depth",
                  f.depth,
                  "depth",
                  "How many messages deep to insert this entry when Position is set to depth.",
                ),
                numberField(
                  "Order",
                  f.order,
                  "order",
                  "Insertion order relative to other lorebook entries at the same position. Lower numbers insert first.",
                ),
              ),
            );
            c.appendChild(checkboxField("Enabled", f.enabled, "enabled"));
            c.appendChild(
              rowOf(
                checkboxField(
                  "Prevent recursion",
                  f.preventRecursion,
                  "preventRecursion",
                  "Stop this entry's content from being scanned for additional lorebook keyword matches.",
                ),
                checkboxField(
                  "Locked",
                  f.locked,
                  "locked",
                  "Lock this entry to prevent it from being edited in the regular lorebook UI.",
                ),
              ),
            );
            c.appendChild(matchingModeField(matchMode));
            if (matchMode === "selective") {
              c.appendChild(
                selectField(
                  "Selective logic",
                  f.selectiveLogic,
                  "selectiveLogic",
                  ["and", "or", "not"],
                  "How primary and secondary keys are combined. AND = both must match, OR = either, NOT = primary matches but secondary does not.",
                ),
              );
            }
            return c;
          },
          lbC,
        ),
      );

      // ── Matching options ──────────────────────────
      rightBodyEl.appendChild(
        renderCollapsible(
          "Matching options",
          "matching",
          () => {
            const c = document.createElement("div");
            c.appendChild(
              rowOf(
                nullableNumberField(
                  "Probability",
                  f.probability,
                  "probability",
                  { step: "0.05", min: 0, max: 1 },
                  "Chance this entry is injected each time it triggers (0–100%). Leave empty to always inject when matched.",
                ),
                nullableNumberField(
                  "Scan depth",
                  f.scanDepth,
                  "scanDepth",
                  { step: "1", min: 0 },
                  "How many messages back to scan for keywords. Leave empty to use the global lorebook default.",
                ),
              ),
            );
            c.appendChild(
              rowOf(
                checkboxField(
                  "Match whole words",
                  f.matchWholeWords,
                  "matchWholeWords",
                  "Only trigger on whole-word matches. Prevents partial matches like 'cat' matching 'scatter'.",
                ),
                checkboxField("Case sensitive", f.caseSensitive, "caseSensitive"),
              ),
            );
            c.appendChild(
              checkboxField(
                "Treat keys as regex",
                f.useRegex,
                "useRegex",
                "Interpret primary and secondary keys as regular expressions instead of plain text.",
              ),
            );
            return c;
          },
          lbC,
        ),
      );

      // ── Context filters ───────────────────────────
      rightBodyEl.appendChild(
        renderCollapsible(
          "Context filters",
          "contextFilters",
          () => {
            const c = document.createElement("div");
            c.appendChild(
              rowOf(
                selectField("Character mode", f.characterFilterMode, "characterFilterMode", [
                  "any",
                  "include",
                  "exclude",
                ]),
                field(
                  "Character IDs",
                  f.characterFilterIds,
                  "characterFilterIds",
                  "input",
                  "Comma-separated character IDs. Used when Character mode is include or exclude.",
                ),
              ),
            );
            c.appendChild(
              rowOf(
                selectField("Tag mode", f.characterTagFilterMode, "characterTagFilterMode", [
                  "any",
                  "include",
                  "exclude",
                ]),
                field(
                  "Character tags",
                  f.characterTagFilters,
                  "characterTagFilters",
                  "input",
                  "Comma-separated character tags. Used when Tag mode is include or exclude.",
                ),
              ),
            );
            c.appendChild(
              rowOf(
                selectField("Trigger mode", f.generationTriggerFilterMode, "generationTriggerFilterMode", [
                  "any",
                  "include",
                  "exclude",
                ]),
                field(
                  "Generation triggers",
                  f.generationTriggerFilters,
                  "generationTriggerFilters",
                  "input",
                  "Comma-separated generation contexts to filter on, e.g. chat, game.",
                ),
              ),
            );
            return c;
          },
          lbC,
        ),
      );

      // ── Matching sources ─────────────────────────
      rightBodyEl.appendChild(
        renderCollapsible(
          "Additional matching sources",
          "matchingSources",
          () => {
            const c = document.createElement("div");
            c.appendChild(
              multiSelectField(
                "Scan these in addition to the chat",
                f.additionalMatchingSources,
                "additionalMatchingSources",
                [
                  ["character_name", "Character name"],
                  ["character_description", "Character description"],
                  ["character_personality", "Character personality"],
                  ["character_scenario", "Character scenario"],
                  ["character_tags", "Character tags"],
                  ["persona_description", "Persona description"],
                  ["persona_tags", "Persona tags"],
                ],
              ),
            );
            return c;
          },
          lbC,
        ),
      );

      // ── Timing ───────────────────────────────────
      rightBodyEl.appendChild(
        renderCollapsible(
          "Timing",
          "timing",
          () => {
            const c = document.createElement("div");
            c.appendChild(
              rowOf(
                nullableNumberField(
                  "Sticky",
                  f.sticky,
                  "sticky",
                  { step: "1", min: 0 },
                  "Keep this entry injected for N turns after it triggers, even if keywords stop matching.",
                ),
                nullableNumberField(
                  "Cooldown",
                  f.cooldown,
                  "cooldown",
                  { step: "1", min: 0 },
                  "Block this entry from triggering again for N turns after it was last injected.",
                ),
              ),
            );
            c.appendChild(
              rowOf(
                nullableNumberField(
                  "Delay",
                  f.delay,
                  "delay",
                  { step: "1", min: 0 },
                  "Wait N turns after a keyword match before injecting this entry.",
                ),
                nullableNumberField(
                  "Ephemeral",
                  f.ephemeral,
                  "ephemeral",
                  { step: "1", min: 0 },
                  "Automatically remove this entry from context after N turns.",
                ),
              ),
            );
            return c;
          },
          lbC,
        ),
      );

      // ── Group & Tag ──────────────────────────────
      rightBodyEl.appendChild(
        renderCollapsible(
          "Group & Tag",
          "groupTag",
          () => {
            const c = document.createElement("div");
            c.appendChild(
              rowOf(
                field(
                  "Group",
                  f.group,
                  "group",
                  "input",
                  "Group name for mutual-exclusion logic. Only one entry per group fires per turn.",
                ),
                nullableNumberField(
                  "Group weight",
                  f.groupWeight,
                  "groupWeight",
                  { step: "0.1" },
                  "Weighted probability for selection within a group. Higher = more likely to be chosen.",
                ),
              ),
            );
            c.appendChild(rowOf(field("Tag", f.tag, "tag", "input"), folderSelectField(d.lorebookId, f.folderId)));
            return c;
          },
          lbC,
        ),
      );

      break;
    }

    case "character":
      rightBodyEl.appendChild(renderCharacterEditor());
      break;

    case "persona":
      rightBodyEl.appendChild(field("Name", f.name, "name", "input"));
      rightBodyEl.appendChild(field("Description", f.description, "description", "textarea"));
      rightBodyEl.appendChild(field("Personality", f.personality, "personality", "textarea"));
      rightBodyEl.appendChild(field("Scenario", f.scenario, "scenario", "textarea"));
      break;

    case "preset-editor":
      rightBodyEl.appendChild(renderPresetEditorPanel());
      break;

    case "lorebook-editor":
      rightBodyEl.appendChild(renderLorebookEditorPanel());
      break;

    case "group-editor":
      rightBodyEl.appendChild(renderGroupEditorPanel());
      break;

    case "folder": {
      rightBodyEl.appendChild(sectionHeader("Basic"));
      rightBodyEl.appendChild(field("Name", f.name, "name", "input"));
      rightBodyEl.appendChild(
        checkboxField(
          "Enabled",
          f.enabled,
          "enabled",
          "When disabled, all entries in this folder — and in any folder nested inside it — are excluded from activation, regardless of their individual enabled state.",
        ),
      );
      rightBodyEl.appendChild(
        numberField("Order", f.order, "order", "Display order among sibling folders. Lower values appear first."),
      );
      // Parent folder — any folder except this one and its own descendants.
      const allFolders = state.lorebookFolders[d.lorebookId] || [];
      const descendants = folderDescendantIds(allFolders, d.sourceId);
      const parentOptions = [["", "— None (top level) —"]];
      for (const fo of allFolders) {
        if (fo.id === d.sourceId || descendants.has(fo.id)) continue;
        parentOptions.push([fo.id, fo.name || "(unnamed folder)"]);
      }
      rightBodyEl.appendChild(
        selectField(
          "Parent folder",
          f.parentFolderId || "",
          "parentFolderId",
          parentOptions,
          "Nest this folder inside another. A disabled parent disables this folder's entries too. Can't pick this folder or one nested inside it.",
        ),
      );
      rightBodyEl.appendChild(renderFolderChildren(d.sourceId, d.lorebookId));
      rightBodyEl.appendChild(renderFolderEntries(d.sourceId, d.lorebookId));
      rightBodyEl.appendChild(renderFolderBatchAdd(d.sourceId, d.lorebookId));
      break;
    }
  }

  // Footer with Save/Revert
  const dot = document.createElement("span");
  dot.className = "kaio-dirty-dot";
  dot.dataset.dirty = state.isDirty ? "true" : "false";
  dot.title = "Unsaved changes";
  rightFooterEl.appendChild(dot);

  const dirtyTxt = document.createElement("span");
  dirtyTxt.style.fontSize = "0.6875rem";
  dirtyTxt.style.color = "var(--muted-foreground)";
  dirtyTxt.textContent = state.isDirty ? "Unsaved changes" : "No changes";
  rightFooterEl.appendChild(dirtyTxt);

  const spacer = document.createElement("span");
  spacer.className = "kaio-spacer";
  rightFooterEl.appendChild(spacer);

  if (d.kind === "lorebook-entry" || d.kind === "folder") {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "kaio-btn kaio-btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.title = "Permanently delete this " + (d.kind === "folder" ? "folder" : "entry");
    deleteBtn.addEventListener("click", () => deleteInspected());
    rightFooterEl.appendChild(deleteBtn);
  }

  const revertBtn = document.createElement("button");
  revertBtn.className = "kaio-btn";
  revertBtn.textContent = "Revert";
  revertBtn.disabled = !state.isDirty;
  revertBtn.addEventListener("click", () => {
    state.draft = makeDraft(state.inspecting);
    state.isDirty = false;
    renderRight();
    showToast("Reverted", "info");
  });
  rightFooterEl.appendChild(revertBtn);

  const saveBtn = document.createElement("button");
  saveBtn.className = "kaio-btn kaio-btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.disabled = !editable || !state.isDirty;
  saveBtn.addEventListener("click", () => saveDraft());
  rightFooterEl.appendChild(saveBtn);
  requestAnimationFrame(() => {
    rightBodyEl.scrollTop = savedScroll;
  });
}

// ── Field constructors ──────────────────────────────────
function tipIcon(text) {
  const s = document.createElement("span");
  s.className = "kaio-tip";
  s.dataset.tip = text;
  s.textContent = "?";
  return s;
}
function applyLabel(lab, label, tooltip) {
  const txt = document.createElement("span");
  txt.textContent = label;
  lab.appendChild(txt);
  if (tooltip) lab.appendChild(tipIcon(tooltip));
}
function field(label, value, key, type, tooltip, rows) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);
  let input;
  if (type === "textarea") {
    input = document.createElement("textarea");
    input.className = "kaio-textarea";
    input.rows = rows ?? 8;
  } else {
    input = document.createElement("input");
    input.className = "kaio-input";
    input.type = "text";
  }
  input.value = value ?? "";
  input.addEventListener("input", () => onFieldChange(key, input.value));
  wrap.appendChild(input);
  return wrap;
}
function numberField(label, value, key, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);
  const input = document.createElement("input");
  input.className = "kaio-input";
  input.type = "number";
  input.value = String(value ?? 0);
  input.addEventListener("input", () => onFieldChange(key, Number(input.value) || 0));
  wrap.appendChild(input);
  return wrap;
}
function nullableNumberField(label, value, key, attrs, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);
  const input = document.createElement("input");
  input.className = "kaio-input";
  input.type = "number";
  input.placeholder = "(default)";
  if (attrs) for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, String(v));
  input.value = value === null || value === undefined ? "" : String(value);
  input.addEventListener("input", () => {
    const raw = input.value.trim();
    if (raw === "") return onFieldChange(key, null);
    const n = Number(raw);
    onFieldChange(key, Number.isFinite(n) ? n : null);
  });
  wrap.appendChild(input);
  return wrap;
}
function selectField(label, value, key, options, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);
  const sel = document.createElement("select");
  sel.className = "kaio-select";
  for (const opt of options) {
    const o = document.createElement("option");
    if (Array.isArray(opt)) {
      o.value = opt[0];
      o.textContent = opt[1];
    } else {
      o.value = opt;
      o.textContent = opt;
    }
    if (o.value === String(value)) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    let v = sel.value;
    if (key === "position") v = Number(v);
    onFieldChange(key, v);
  });
  wrap.appendChild(sel);
  return wrap;
}
function checkboxField(label, value, key, tooltip) {
  const wrap = document.createElement("label");
  wrap.className = "kaio-checkbox";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!value;
  cb.addEventListener("change", () => onFieldChange(key, cb.checked));
  wrap.appendChild(cb);
  const txt = document.createElement("span");
  txt.textContent = label;
  wrap.appendChild(txt);
  if (tooltip) wrap.appendChild(tipIcon(tooltip));
  return wrap;
}
function matchingModeField(currentMode) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("div");
  lab.className = "kaio-field-label";
  applyLabel(
    lab,
    "Matching mode",
    "Controls when this entry is injected. Normal: keyword-triggered. Selective: requires secondary key match. Constant: always injected regardless of keywords.",
  );
  wrap.appendChild(lab);
  const row = document.createElement("div");
  row.className = "kaio-match-mode";
  for (const [mode, label] of [
    ["normal", "Normal"],
    ["selective", "Selective"],
    ["constant", "Constant"],
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kaio-match-btn";
    btn.dataset.mode = mode;
    btn.dataset.active = String(currentMode === mode);
    const orb = document.createElement("span");
    orb.className = "kaio-match-orb";
    orb.dataset.mode = mode;
    btn.appendChild(orb);
    btn.appendChild(document.createTextNode(label));
    btn.addEventListener("click", () => onFieldChange("matchingMode", mode));
    row.appendChild(btn);
  }
  wrap.appendChild(row);
  return wrap;
}
function multiSelectField(label, value, key, options) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  lab.textContent = label;
  wrap.appendChild(lab);
  const set = value instanceof Set ? value : new Set(value || []);
  const list = document.createElement("div");
  list.className = "kaio-multilist";
  for (const opt of options) {
    const [val, text] = Array.isArray(opt) ? opt : [opt, opt];
    const row = document.createElement("label");
    row.className = "kaio-checkbox kaio-multi-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = set.has(val);
    cb.addEventListener("change", () => {
      const current = state.draft.fields[key] instanceof Set ? state.draft.fields[key] : new Set();
      if (cb.checked) current.add(val);
      else current.delete(val);
      onFieldChange(key, current);
    });
    row.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = text;
    row.appendChild(span);
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}
// ── Character editor helpers ───────────────────────────────────
// Grow a textarea to fit its content up to ~5 lines; beyond that it scrolls
// (collapsed) or shows everything (expanded). Returns whether content overflows
// the 5-line cap. Guards against the collapsed-section (display:none) case.
function autoGrow(ta, expanded) {
  ta.style.height = "auto";
  const cs = getComputedStyle(ta);
  const line = parseFloat(cs.lineHeight) || 18;
  const padV =
    (parseFloat(cs.paddingTop) || 0) +
    (parseFloat(cs.paddingBottom) || 0) +
    (parseFloat(cs.borderTopWidth) || 0) +
    (parseFloat(cs.borderBottomWidth) || 0);
  const cap = Math.round(line * 5 + padV);
  const full = ta.scrollHeight;
  const overflow = full > cap + 2;
  if (expanded) {
    ta.style.height = full + "px";
    ta.style.overflowY = "hidden";
  } else {
    ta.style.height = Math.min(full, cap) + "px";
    ta.style.overflowY = overflow ? "auto" : "hidden";
  }
  return overflow;
}
// A heavy-text field: auto-grows with content to ~5 lines, then an Expand/Compress
// toggle appears. Expanded state persists (by field key) across re-renders so
// adding a greeting / opening another section doesn't snap a field back shut.
function autoField(label, value, key, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);

  const ta = document.createElement("textarea");
  ta.className = "kaio-textarea kaio-autogrow";
  ta.rows = 2;
  ta.value = value ?? "";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "kaio-expand-toggle kaio-autogrow-toggle";
  toggle.hidden = true;
  let expanded = state.charFieldExpanded.has(key);
  const resize = () => {
    const overflow = autoGrow(ta, expanded);
    if (overflow || expanded) {
      toggle.hidden = false;
      toggle.textContent = expanded ? "Compress" : "Expand";
    } else {
      toggle.hidden = true;
    }
  };
  ta.addEventListener("input", () => {
    onFieldChange(key, ta.value);
    resize();
  });
  toggle.addEventListener("click", (ev) => {
    ev.stopPropagation();
    expanded = !expanded;
    if (expanded) state.charFieldExpanded.add(key);
    else state.charFieldExpanded.delete(key);
    resize();
    ta.focus();
  });
  wrap.appendChild(ta);
  wrap.appendChild(toggle);
  requestAnimationFrame(resize); // size once the field is laid out
  return wrap;
}
// 0..1 range slider with a live numeric readout (talkativeness).
function sliderField(label, value, key, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);
  const row = document.createElement("div");
  row.className = "kaio-slider-row";
  const input = document.createElement("input");
  input.type = "range";
  input.className = "kaio-slider";
  // 0.01 step so a stored value that isn't a 0.05 multiple isn't silently
  // snapped/overwritten on first drag (Marinara's own UI uses 0.05 multiples).
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  input.value = String(value ?? 0.5);
  const out = document.createElement("span");
  out.className = "kaio-slider-val";
  out.textContent = Number(input.value).toFixed(2);
  input.addEventListener("input", () => {
    out.textContent = Number(input.value).toFixed(2);
    onFieldChange(key, Number(input.value));
  });
  row.appendChild(input);
  row.appendChild(out);
  wrap.appendChild(row);
  return wrap;
}
function readonlyNote(text) {
  const el = document.createElement("div");
  el.className = "kaio-readonly-note";
  el.textContent = text;
  return el;
}
// A CSS color field: a preview swatch (shows any value incl. rgba/gradient) with
// an overlaid native picker for solid colors, plus a free-form Hex/CSS text input
// (the source of truth — the picker only writes a hex when deliberately used).
function colorField(label, value, key, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);

  const row = document.createElement("div");
  row.className = "kaio-color-row";

  const sw = document.createElement("div");
  sw.className = "kaio-color-swatch";
  sw.title = "Pick a solid color";
  const setSwatch = (v) => {
    const val = (v || "").trim();
    // Only render it when the browser can actually parse it — an invalid/partial
    // value assigned to style.background is a silent no-op, which would otherwise
    // leave the swatch showing a stale color (or a blank, checkerboard-less box).
    if (val && (typeof CSS === "undefined" || CSS.supports("background", val))) {
      sw.style.background = val;
      sw.dataset.empty = "false";
    } else {
      sw.style.background = "";
      sw.dataset.empty = "true";
    }
  };
  const picker = document.createElement("input");
  picker.type = "color";
  picker.className = "kaio-color-picker";
  picker.value = /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#a78bfa";
  sw.appendChild(picker);

  const text = document.createElement("input");
  text.className = "kaio-input";
  text.type = "text";
  text.placeholder = "#hex, rgba(), name, or gradient";
  text.value = value ?? "";

  picker.addEventListener("input", () => {
    text.value = picker.value;
    setSwatch(picker.value);
    onFieldChange(key, picker.value);
  });
  text.addEventListener("input", () => {
    onFieldChange(key, text.value);
    setSwatch(text.value);
    if (/^#[0-9a-fA-F]{6}$/.test(text.value)) picker.value = text.value;
  });

  setSwatch(value);
  row.appendChild(sw);
  row.appendChild(text);
  wrap.appendChild(row);
  return wrap;
}
// Character↔lorebook links live in the lorebook's `characterIds` array (a
// join table). listByCharacter matches characterIds OR the legacy characterId
// scalar, so mirror that when reading the current links.
function lorebookCharIds(lb) {
  if (Array.isArray(lb.characterIds)) return lb.characterIds;
  return lb.characterId ? [lb.characterId] : [];
}
// Shared refresh after any character↔lorebook change: re-load the character (its
// embedded character_book may have been synced server-side), re-load the lorebook
// list, point the inspected block at the fresh character, and repaint. The card
// draft (in-progress field edits) is untouched — this is a separate-resource edit.
async function refreshCharLorebookState(charId) {
  await loadCharacter(charId);
  state.lorebooks = await api("GET", "/lorebooks").catch(() => state.lorebooks);
  if (
    state.inspecting &&
    state.inspecting.character &&
    state.inspecting.character.id === charId &&
    state.charactersFull[charId]
  ) {
    state.inspecting.character = state.charactersFull[charId];
  }
  renderRight();
}
// The card's embedded-lorebook forward pointer: data.extensions.importMetadata.embeddedLorebook.lorebookId.
function getEmbeddedLorebookId(data) {
  const im = data && data.extensions && data.extensions.importMetadata;
  const el = im && im.embeddedLorebook;
  return el && typeof el.lorebookId === "string" ? el.lorebookId : null;
}
// Clear the card's embedded book: null character_book + drop the forward pointer.
// Sends the FULL data (a fresh read-modify-write) because the character PATCH
// replaces the extensions blob rather than deep-merging it.
async function clearEmbeddedOnCharacter(charId) {
  const fresh = normalizeCharacter(await api("GET", "/characters/" + charId));
  const data = { ...((fresh && fresh.data) || {}) };
  const ext = { ...(data.extensions || {}) };
  if (ext.importMetadata && typeof ext.importMetadata === "object") {
    const im = { ...ext.importMetadata };
    delete im.embeddedLorebook;
    ext.importMetadata = im;
  }
  data.extensions = ext;
  data.character_book = null;
  await api("PATCH", "/characters/" + charId, { data });
}
// Link/unlink REPLACE the whole set (syncLorebookLinks is delete-then-insert),
// so PATCH the full desired characterIds array. isGlobal:false is sent on link
// because a global lorebook can't also target a character (schema superRefine).
async function linkCharacterLorebook(charId, lbId) {
  const lb = state.lorebooks.find((l) => l.id === lbId);
  if (!lb || !charId) return;
  const next = lorebookCharIds(lb).slice();
  if (!next.includes(charId)) next.push(charId);
  try {
    await api("PATCH", "/lorebooks/" + lbId, { characterIds: next, isGlobal: false });
    lb.characterIds = next;
    lb.characterId = next[0] || null;
    lb.isGlobal = false;
    await refreshCharLorebookState(charId);
    showToast("Lorebook linked", "success");
  } catch (err) {
    console.error("[kolache-AIO] Link lorebook failed", err);
    showToast(serverErrorText(err, "Failed to link lorebook"), "error");
  }
}
async function unlinkCharacterLorebook(charId, lbId) {
  const lb = state.lorebooks.find((l) => l.id === lbId);
  if (!lb || !charId) return;
  const next = lorebookCharIds(lb).filter((id) => id !== charId);
  try {
    // If this lorebook is the card's embedded one, clear the embedded mirror too —
    // unlinking alone would leave a stale character_book + forward pointer behind.
    const embeddedId = getEmbeddedLorebookId(
      state.inspecting && state.inspecting.character && state.inspecting.character.data,
    );
    if (embeddedId === lbId) await clearEmbeddedOnCharacter(charId);
    await api("PATCH", "/lorebooks/" + lbId, { characterIds: next });
    lb.characterIds = next;
    lb.characterId = next[0] || null;
    await refreshCharLorebookState(charId);
    showToast("Lorebook unlinked", "info"); // detach, not a create/delete — matches "Folder detached"/"Removed from group"
  } catch (err) {
    console.error("[kolache-AIO] Unlink lorebook failed", err);
    await refreshCharLorebookState(charId); // re-sync after a possibly half-applied clear+unlink
    showToast(serverErrorText(err, "Failed to unlink lorebook"), "error");
  }
}
// Embed a linked lorebook INTO the card so it travels on export (data.character_book).
// Order matters: set the character's forward pointer FIRST (the engine's sync only
// fires when the card already points at this lorebook), then PATCH the lorebook's
// characterIds — which triggers syncCharacterBookFromLorebook to mirror its entries
// into the card. One embedded book per card, so this replaces any prior embed.
async function embedCharacterLorebook(charId, lbId) {
  const lb = state.lorebooks.find((l) => l.id === lbId);
  if (!lb || !charId) return;
  // One embedded book per card — note if we're displacing a different one.
  const prevEmbeddedId = getEmbeddedLorebookId(
    state.inspecting && state.inspecting.character && state.inspecting.character.data,
  );
  const replacing = !!(prevEmbeddedId && prevEmbeddedId !== lbId);
  try {
    const fresh = normalizeCharacter(await api("GET", "/characters/" + charId));
    const data = { ...((fresh && fresh.data) || {}) };
    const ext = { ...(data.extensions || {}) };
    const im = { ...(ext.importMetadata || {}) };
    im.embeddedLorebook = { hasEmbeddedLorebook: true, lorebookId: lbId };
    ext.importMetadata = im;
    data.extensions = ext;
    await api("PATCH", "/characters/" + charId, { data }); // 1. forward pointer (must precede the sync trigger)
    // 2. back-pointer, with the target hoisted to characterIds[0]: the engine syncs
    //    into characterIds[0], so the target MUST be first or the mirror never fires.
    const ids = [charId, ...lorebookCharIds(lb).filter((id) => id !== charId)];
    try {
      await api("PATCH", "/lorebooks/" + lbId, { characterIds: ids, isGlobal: false });
    } catch (lbErr) {
      // Undo the forward pointer so we don't strand a "points here, no book" card.
      await clearEmbeddedOnCharacter(charId).catch(() => {});
      throw lbErr;
    }
    lb.characterIds = ids;
    lb.characterId = ids[0] || null;
    lb.isGlobal = false;
    await refreshCharLorebookState(charId);
    // The engine mirrors the lorebook into character_book on a lorebook write, but
    // the first write right after the forward pointer is set doesn't reliably take
    // (the book lands only on a follow-up write). If it didn't land, poke the
    // lorebook once more so the sync re-runs with the pointer already in place.
    const cur = state.charactersFull[charId];
    if (cur && getEmbeddedLorebookId(cur.data) === lbId && !cur.data.character_book) {
      await api("PATCH", "/lorebooks/" + lbId, { characterIds: ids, isGlobal: false });
      await refreshCharLorebookState(charId);
    }
    showToast(
      replacing ? "Lorebook embedded (replaced the previous embedded one)" : "Lorebook embedded into the card",
      "success",
    );
  } catch (err) {
    console.error("[kolache-AIO] Embed lorebook failed", err);
    await refreshCharLorebookState(charId); // re-sync the UI to the actual server state
    showToast(serverErrorText(err, "Failed to embed lorebook"), "error");
  }
}
// Remove the embedded copy (character_book + forward pointer) but keep the link.
async function unembedCharacterLorebook(charId) {
  if (!charId) return;
  try {
    await clearEmbeddedOnCharacter(charId);
    await refreshCharLorebookState(charId);
    showToast("Lorebook un-embedded (still linked)", "info");
  } catch (err) {
    console.error("[kolache-AIO] Un-embed lorebook failed", err);
    showToast(serverErrorText(err, "Failed to un-embed lorebook"), "error");
  }
}
// The character's Lorebook section: which standalone lorebooks are linked to this
// character (link/unlink writes the lorebook's characterIds), then the read-only
// embedded-book summary. Linking is a separate resource edit, not part of the
// card draft, so it applies immediately.
function renderCharLorebookSection() {
  const wrap = document.createElement("div");
  const charId = state.draft && state.draft.sourceId;
  if (!charId) {
    wrap.appendChild(renderCharBookSummary());
    return wrap;
  }

  const charData = (state.inspecting && state.inspecting.character && state.inspecting.character.data) || {};
  const embeddedId = getEmbeddedLorebookId(charData);
  const hasCharacterBook = !!charData.character_book;
  const linked = state.lorebooks.filter((lb) => lorebookCharIds(lb).includes(charId));
  if (linked.length) {
    const list = document.createElement("div");
    list.className = "kaio-field";
    const lab = document.createElement("div");
    lab.className = "kaio-field-label";
    applyLabel(
      lab,
      "Linked lorebooks",
      "Standalone lorebooks assigned to this character (added to the lorebook's characterIds). They fire whenever this character is in a chat. Embed one to also bake it into the card so it travels on export.",
    );
    list.appendChild(lab);
    for (const lb of linked) {
      const row = document.createElement("div");
      row.className = "kaio-array-row kaio-linked-lb";
      const name = document.createElement("span");
      name.className = "kaio-linked-lb-name";
      name.textContent = lb.name || "(unnamed lorebook)";
      row.appendChild(name);
      // Require BOTH the forward pointer AND a real character_book — so a stray
      // pointer with no baked-in book reads as "Embed" (retry), not "Embedded".
      const isEmbedded = embeddedId === lb.id && hasCharacterBook;
      if (isEmbedded) {
        const badge = document.createElement("span");
        badge.className = "kaio-group-badge kaio-embedded-badge";
        badge.textContent = "Embedded";
        badge.title = "Baked into the card — travels with it on export";
        row.appendChild(badge);
      }
      const embedBtn = document.createElement("button");
      embedBtn.type = "button";
      embedBtn.className = "kaio-embed-btn";
      embedBtn.textContent = isEmbedded ? "Un-embed" : "Embed";
      embedBtn.title = isEmbedded
        ? "Remove the baked-in copy from the card (keeps it linked)"
        : "Bake this lorebook into the card so it exports with it. One embedded book per card — this replaces any current one.";
      embedBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (isEmbedded) unembedCharacterLorebook(charId);
        else embedCharacterLorebook(charId, lb.id);
      });
      row.appendChild(embedBtn);
      row.appendChild(inlineRemoveBtn("Unlink from this character", () => unlinkCharacterLorebook(charId, lb.id)));
      list.appendChild(row);
    }
    wrap.appendChild(list);
  }
  // When nothing is linked we show no bubble here — the "Link a lorebook" picker
  // below already conveys it, and the embedded-book note explains the distinction.

  // Picker of link-able lorebooks (exclude already-linked + globals, which apply everywhere).
  const available = state.lorebooks.filter((lb) => !lorebookCharIds(lb).includes(charId) && !lb.isGlobal);
  const pickWrap = document.createElement("div");
  pickWrap.className = "kaio-field";
  const pickLab = document.createElement("div");
  pickLab.className = "kaio-field-label";
  applyLabel(
    pickLab,
    "Link a lorebook",
    "Assign an existing standalone lorebook to this character. Global lorebooks aren't listed — they already apply everywhere.",
  );
  pickWrap.appendChild(pickLab);
  pickWrap.appendChild(
    renderSearchableSelect({
      items: available.map((lb) => ({ id: lb.id, name: lb.name || lb.id })),
      valueId: null,
      placeholder: available.length ? "— Link a lorebook —" : "— No unlinked lorebooks —",
      ariaLabel: "Link a lorebook",
      onChange: (id) => {
        if (id) linkCharacterLorebook(charId, id);
      },
    }),
  );
  wrap.appendChild(pickWrap);

  // Embedded-book summary: only when it isn't already shown as an "Embedded"
  // linked row — i.e. an orphaned embedded book (e.g. an imported card whose
  // lorebook isn't linked), or the explanatory note when nothing is linked at all.
  const embeddedInLinked = embeddedId && hasCharacterBook && linked.some((lb) => lb.id === embeddedId);
  if ((hasCharacterBook && !embeddedInLinked) || (!hasCharacterBook && !linked.length)) {
    wrap.appendChild(renderCharBookSummary());
  }
  return wrap;
}
// Set a draft field and re-render the right panel — for add/remove/reorder in
// the array sub-editors (no active text focus to preserve).
function updateDraftAndRerender(key, value) {
  state.draft.fields[key] = value;
  state.isDirty = isDraftDirty();
  renderRight();
}

// RPG-stats normalizers (load-side and save-side).
function normalizeRpgStats(rs) {
  rs = rs || {};
  const attributes = Array.isArray(rs.attributes)
    ? rs.attributes.map((a) => ({ name: String((a && a.name) || ""), value: Number(a && a.value) || 0 }))
    : [];
  const pools = Array.isArray(rs.pools)
    ? rs.pools.map((p) => ({
        name: String((p && p.name) || ""),
        value: Number(p && p.value) || 0,
        max: Number(p && p.max) || 0,
        color: String((p && p.color) || "#a78bfa"),
      }))
    : [];
  const hp =
    rs.hp && typeof rs.hp === "object"
      ? { value: Number(rs.hp.value) || 0, max: Number(rs.hp.max) || 0 }
      : { value: 100, max: 100 };
  return { enabled: !!rs.enabled, attributes, pools, hp };
}
function cleanRpgStats(rs) {
  const attributes = (rs.attributes || [])
    .map((a) => ({ name: (a.name || "").trim(), value: Number(a.value) || 0 }))
    .filter((a) => a.name);
  const pools = (rs.pools || [])
    .map((p) => ({
      name: (p.name || "").trim(),
      value: Number(p.value) || 0,
      max: Math.max(1, Number(p.max) || 1),
      color: p.color || "#a78bfa",
    }))
    .filter((p) => p.name);
  const hpPool = pools.find((p) => p.name.toLowerCase() === "hp");
  const hp = hpPool ? { value: hpPool.value, max: hpPool.max } : rs.hp || { value: 100, max: 100 };
  return { enabled: !!rs.enabled, attributes, pools, hp };
}
// Small labelled number/text inputs used inside array rows (in-place, no re-render).
function inlineInput(value, placeholder, type, onInput, opts) {
  const i = document.createElement("input");
  i.className = "kaio-input";
  i.type = type || "text";
  if (type === "number" && opts) {
    if (opts.min != null) i.min = String(opts.min);
    if (opts.step != null) i.step = String(opts.step);
  }
  i.placeholder = placeholder || "";
  i.value = value == null ? "" : String(value);
  i.addEventListener("input", () => onInput(type === "number" ? Number(i.value) || 0 : i.value));
  return i;
}
function inlineRemoveBtn(title, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "kaio-folder-edit-btn";
  b.innerHTML = "✕";
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

// Alternate greetings — list of auto-growing textareas with add/remove.
function greetingsEditor(list) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("div");
  lab.className = "kaio-field-label";
  applyLabel(lab, "Alternate greetings", "Extra opening messages to swipe between. {{user}}/{{char}} work here.");
  wrap.appendChild(lab);
  list.forEach((g, i) => {
    const row = document.createElement("div");
    row.className = "kaio-array-row";
    const ta = document.createElement("textarea");
    ta.className = "kaio-textarea kaio-autogrow";
    ta.rows = 2;
    ta.value = g ?? "";
    ta.addEventListener("input", () => {
      list[i] = ta.value;
      autoGrow(ta, false);
      refreshDirtyFooter();
    });
    row.appendChild(ta);
    row.appendChild(
      inlineRemoveBtn("Remove greeting", () => {
        list.splice(i, 1);
        updateDraftAndRerender("alternate_greetings", list);
      }),
    );
    wrap.appendChild(row);
    requestAnimationFrame(() => autoGrow(ta, false));
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "kaio-create-btn";
  add.textContent = "+ Greeting";
  add.addEventListener("click", () => {
    list.push("");
    updateDraftAndRerender("alternate_greetings", list);
  });
  wrap.appendChild(add);
  return wrap;
}

// RPG stats — enabled toggle + attribute rows + pool rows.
function renderRpgStatsEditor(rs) {
  const wrap = document.createElement("div");

  const en = document.createElement("label");
  en.className = "kaio-checkbox";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!rs.enabled;
  cb.addEventListener("change", () => {
    rs.enabled = cb.checked;
    refreshDirtyFooter();
  });
  en.appendChild(cb);
  const enTxt = document.createElement("span");
  enTxt.textContent = "Enable RPG stats";
  en.appendChild(enTxt);
  en.appendChild(
    tipIcon(
      "When on, stats are injected into the prompt (as rpg_attributes) and tracked by the Character Tracker agent.",
    ),
  );
  wrap.appendChild(en);

  wrap.appendChild(sectionHeader("Attributes"));
  rs.attributes.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "kaio-array-row";
    row.appendChild(
      inlineInput(a.name, "Name (STR…)", "text", (v) => {
        a.name = v;
        refreshDirtyFooter();
      }),
    );
    row.appendChild(
      inlineInput(a.value, "0", "number", (v) => {
        a.value = v;
        refreshDirtyFooter();
      }),
    );
    row.appendChild(
      inlineRemoveBtn("Remove attribute", () => {
        rs.attributes.splice(i, 1);
        updateDraftAndRerender("rpgStats", rs);
      }),
    );
    wrap.appendChild(row);
  });
  const addA = document.createElement("button");
  addA.type = "button";
  addA.className = "kaio-create-btn";
  addA.textContent = "+ Attribute";
  addA.addEventListener("click", () => {
    rs.attributes.push({ name: "", value: 0 });
    updateDraftAndRerender("rpgStats", rs);
  });
  wrap.appendChild(addA);

  wrap.appendChild(sectionHeader("Pools"));
  const poolsHint = document.createElement("div");
  poolsHint.className = "kaio-readonly-note";
  poolsHint.textContent =
    'HP/MP/…-style bars: name, current, max, and a #rrggbb color. A pool named "HP" also syncs the card\'s hp on save.';
  wrap.appendChild(poolsHint);
  rs.pools.forEach((p, i) => {
    // Two lines so the name field is readable in the narrow editor: name + remove
    // on top, then current / max / color underneath (four fields won't fit on one).
    const card = document.createElement("div");
    card.className = "kaio-pool-row";
    const line1 = document.createElement("div");
    line1.className = "kaio-pool-line";
    const nameIn = inlineInput(p.name, "Pool name (HP, MP…)", "text", (v) => {
      p.name = v;
      refreshDirtyFooter();
    });
    nameIn.classList.add("kaio-pool-name");
    line1.appendChild(nameIn);
    line1.appendChild(
      inlineRemoveBtn("Remove pool", () => {
        rs.pools.splice(i, 1);
        updateDraftAndRerender("rpgStats", rs);
      }),
    );
    card.appendChild(line1);
    const line2 = document.createElement("div");
    line2.className = "kaio-pool-line";
    line2.appendChild(
      inlineInput(p.value, "current", "number", (v) => {
        p.value = v;
        refreshDirtyFooter();
      }),
    );
    line2.appendChild(
      inlineInput(
        p.max,
        "max",
        "number",
        (v) => {
          p.max = v;
          refreshDirtyFooter();
        },
        { min: 1 },
      ),
    );
    // Plain text (not <input type=color>) so free-form CSS colors — rgba(),
    // named, gradients — round-trip instead of snapping to a 6-digit hex.
    const color = inlineInput(p.color, "#rrggbb", "text", (v) => {
      p.color = v;
      refreshDirtyFooter();
    });
    color.classList.add("kaio-pool-color");
    line2.appendChild(color);
    card.appendChild(line2);
    wrap.appendChild(card);
  });
  const addP = document.createElement("button");
  addP.type = "button";
  addP.className = "kaio-create-btn";
  addP.textContent = "+ Pool";
  addP.addEventListener("click", () => {
    rs.pools.push({ name: "", value: 0, max: 100, color: "#a78bfa" });
    updateDraftAndRerender("rpgStats", rs);
  });
  wrap.appendChild(addP);
  return wrap;
}

// Read-only summary of the card's embedded lorebook (character_book).
function renderCharBookSummary() {
  const book =
    state.inspecting &&
    state.inspecting.character &&
    state.inspecting.character.data &&
    state.inspecting.character.data.character_book;
  if (!book) {
    return readonlyNote(
      "This card has no embedded lorebook. (An embedded book is a separate lorebook baked into the card — distinct from the standalone lorebooks you can link above.)",
    );
  }
  const n = Array.isArray(book.entries) ? book.entries.length : 0;
  return readonlyNote(
    `Embedded lorebook "${book.name || "(unnamed)"}" — ${n} ${n === 1 ? "entry" : "entries"}, scan depth ${book.scan_depth ?? 2}, budget ${book.token_budget ?? 512}. ` +
      "Its entries are edited in Marinara; the embedded book round-trips unchanged on save.",
  );
}

// The full character editor: always-visible Name/Title, then collapsible sections.
function renderCharacterEditor() {
  const f = state.draft.fields;
  const frag = document.createDocumentFragment();
  const co = { stateObj: state.charEditorCollapsed };

  frag.appendChild(
    field("Name", f.name, "name", "input", "Display name; used as {{char}} in prompts. The only required field."),
  );
  frag.appendChild(
    field(
      "Title / comment",
      f.comment,
      "comment",
      "input",
      'Optional label for this version (e.g. "Modern AU"). Stored on the record, not sent to the model.',
    ),
  );

  frag.appendChild(
    renderCollapsible(
      "Metadata",
      "metadata",
      () => {
        const c = document.createElement("div");
        c.appendChild(
          rowOf(
            field("Creator", f.creator, "creator", "input", "Who made the character (credit when sharing)."),
            field("Version", f.character_version, "character_version", "input", 'Version string, e.g. "1.0".'),
          ),
        );
        c.appendChild(field("Tags", f.tags, "tags", "input", "Comma-separated tags for search/organization."));
        c.appendChild(
          sliderField(
            "Talkativeness",
            f.talkativeness,
            "talkativeness",
            "How often this character speaks in group chats. 0 = rarely unless addressed, 1 = responds to almost everything.",
          ),
        );
        c.appendChild(checkboxField("Favorite", f.fav, "fav", "Marks the character as a favorite in Marinara."));
        c.appendChild(
          autoField("Creator notes", f.creator_notes, "creator_notes", "Private notes — not sent to the model."),
        );
        return c;
      },
      co,
    ),
  );

  frag.appendChild(
    renderCollapsible(
      "Card",
      "card",
      () => {
        const c = document.createElement("div");
        c.appendChild(
          autoField(
            "Description",
            f.description,
            "description",
            "General identity/role; sent in every prompt as part of who the character is.",
          ),
        );
        c.appendChild(
          autoField(
            "Personality",
            f.personality,
            "personality",
            "Temperament, behavior, speech habits, emotional patterns.",
          ),
        );
        c.appendChild(
          autoField("Backstory", f.backstory, "backstory", "History, origin, relationships, formative events."),
        );
        c.appendChild(
          autoField("Appearance", f.appearance, "appearance", "Physical description, clothing, distinguishing marks."),
        );
        c.appendChild(autoField("Scenario", f.scenario, "scenario", "Default setting/situation for new interactions."));
        return c;
      },
      co,
    ),
  );

  frag.appendChild(
    renderCollapsible(
      "Dialogue & greetings",
      "dialogue",
      () => {
        const c = document.createElement("div");
        c.appendChild(autoField("First message", f.first_mes, "first_mes", "Opening message for a new chat."));
        c.appendChild(
          autoField(
            "Example dialogue",
            f.mes_example,
            "mes_example",
            "Teaches voice/formatting; use <START> to separate examples and {{user}}/{{char}} placeholders.",
          ),
        );
        c.appendChild(greetingsEditor(f.alternate_greetings));
        return c;
      },
      co,
    ),
  );

  frag.appendChild(renderCollapsible("Lorebook", "lorebook", () => renderCharLorebookSection(), co));

  frag.appendChild(
    renderCollapsible(
      "Colors",
      "colors",
      () => {
        const c = document.createElement("div");
        c.appendChild(
          colorField(
            "Name color",
            f.nameColor,
            "nameColor",
            "CSS color or linear-gradient() for the character's name. Empty = theme default. Supports gradients.",
          ),
        );
        c.appendChild(
          colorField(
            "Dialogue color",
            f.dialogueColor,
            "dialogueColor",
            "Color applied to text inside quotation marks.",
          ),
        );
        c.appendChild(
          colorField(
            "Message box color",
            f.boxColor,
            "boxColor",
            "Background of this character's message bubble (roleplay mode); rgba() works best.",
          ),
        );
        return c;
      },
      co,
    ),
  );

  frag.appendChild(renderCollapsible("Stats (RPG)", "stats", () => renderRpgStatsEditor(f.rpgStats), co));

  frag.appendChild(
    renderCollapsible(
      "Advanced",
      "advanced",
      () => {
        const c = document.createElement("div");
        c.appendChild(
          autoField(
            "System prompt",
            f.system_prompt,
            "system_prompt",
            "Character-specific instructions injected via the preset's character block. Does not replace the chat system prompt.",
          ),
        );
        c.appendChild(
          autoField(
            "Post-history instructions",
            f.post_history_instructions,
            "post_history_instructions",
            "Text inserted after chat history, right before generation.",
          ),
        );
        c.appendChild(sectionHeader("Depth prompt"));
        c.appendChild(
          autoField("Text", f.depthPrompt, "depthPrompt", "Injected at a chosen depth in the chat history."),
        );
        c.appendChild(
          rowOf(
            numberField("Depth", f.depthDepth, "depthDepth", "0 = after the latest message; 4 = four messages back."),
            selectField("Role", f.depthRole, "depthRole", ["system", "user", "assistant"]),
          ),
        );
        return c;
      },
      co,
    ),
  );

  return frag;
}

// Returns the parsed option array for a choice block (the API returns it as a
// JSON-encoded text column, but tolerate it already being an array).
function choiceBlockOptions(cb) {
  if (Array.isArray(cb.options)) return cb.options;
  return tryParseJSON(cb.options, []);
}

// Returns the choice blocks whose `{{varName}}` (or `{{getvar::varName}}`) is
// referenced in the inspected block's source text. Used to scope the
// variables panel to only what's actually relevant to the selection.
function collectReferencedVariables(block) {
  const cbs = (state.presetFull && state.presetFull.choiceBlocks) || [];
  if (!cbs.length || !block) return [];
  const text = blockPreviewRaw(block);
  if (!text) return [];
  const out = [];
  for (const cb of cbs) {
    const re = new RegExp("\\{\\{(?:getvar::)?" + escapeRegex(cb.variableName) + "\\}\\}", "i");
    if (re.test(text)) out.push(cb);
  }
  return out;
}

// Variables panel — pick an option for live substitution in the Simulated
// Prompt, then optionally edit that option's value and save back to the preset.
function renderVariablesPanel(cbs) {
  if (!cbs || !cbs.length) return null;

  const wrap = document.createElement("div");
  wrap.className = "kaio-vars-panel";
  if (state.variablesPanelCollapsed) wrap.dataset.collapsed = "true";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "kaio-vars-header";
  header.innerHTML = `
    <span class="kaio-vars-caret">▾</span>
    <span class="kaio-vars-title">Preset variables</span>
    <span class="kaio-vars-count">${cbs.length}</span>
  `;
  header.addEventListener("click", () => {
    state.variablesPanelCollapsed = !state.variablesPanelCollapsed;
    renderRight();
  });
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "kaio-vars-body";

  const help = document.createElement("div");
  help.className = "kaio-field-help";
  help.textContent =
    "Pick an option to substitute it in the Simulated Prompt. While an option is selected, its value can be edited and saved.";
  body.appendChild(help);

  for (const cb of cbs) {
    body.appendChild(renderVariableRow(cb));
  }
  wrap.appendChild(body);
  return wrap;
}

function renderVariableRow(cb) {
  const row = document.createElement("div");
  row.className = "kaio-field kaio-vars-row";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  lab.textContent = `{{${cb.variableName}}}`;
  if (cb.question) lab.title = cb.question;
  row.appendChild(lab);

  const opts = choiceBlockOptions(cb);
  const sel = document.createElement("select");
  sel.className = "kaio-select";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— No preview —";
  sel.appendChild(blank);
  const current = state.variablePreviews[cb.variableName];
  for (const opt of opts) {
    const o = document.createElement("option");
    o.value = opt.id || opt.value || "";
    o.textContent = opt.label || opt.value || opt.id || "(unnamed option)";
    if (current && current.optionId === o.value) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    const optId = sel.value;
    if (!optId) {
      delete state.variablePreviews[cb.variableName];
    } else {
      const picked = opts.find((o) => (o.id || o.value) === optId);
      const value = picked ? picked.value : "";
      state.variablePreviews[cb.variableName] = {
        cbId: cb.id,
        optionId: optId,
        value,
        savedValue: value,
      };
    }
    renderRight(); // re-render so the editor textarea appears/disappears
    renderMiddle();
  });
  row.appendChild(sel);

  // If an option is currently selected, expose an editable textarea for its
  // value. Edits are live-substituted in the middle column; Save persists the
  // change back through the preset's choice-block API.
  if (current && current.optionId) {
    const ta = document.createElement("textarea");
    ta.className = "kaio-textarea kaio-vars-edit";
    ta.rows = 4;
    ta.value = current.value ?? "";
    ta.addEventListener("input", () => {
      current.value = ta.value;
      // Update Save / Revert button states without a full re-render so the
      // textarea keeps its caret position.
      const dirty = current.value !== current.savedValue;
      const saveBtn = row.querySelector('[data-act="vsave"]');
      const revertBtn = row.querySelector('[data-act="vrevert"]');
      if (saveBtn) saveBtn.disabled = !dirty;
      if (revertBtn) revertBtn.disabled = !dirty;
      renderMiddle();
    });
    row.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "kaio-vars-actions";
    const dirty = current.value !== current.savedValue;

    const revertBtn = document.createElement("button");
    revertBtn.type = "button";
    revertBtn.className = "kaio-btn";
    revertBtn.dataset.act = "vrevert";
    revertBtn.textContent = "Revert";
    revertBtn.disabled = !dirty;
    revertBtn.addEventListener("click", () => {
      current.value = current.savedValue;
      ta.value = current.savedValue;
      renderRight();
      renderMiddle();
    });
    actions.appendChild(revertBtn);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "kaio-btn kaio-btn-primary";
    saveBtn.dataset.act = "vsave";
    saveBtn.textContent = "Save";
    saveBtn.disabled = !dirty;
    saveBtn.addEventListener("click", () => saveVariableOption(cb));
    actions.appendChild(saveBtn);
    row.appendChild(actions);
  }
  return row;
}

async function saveVariableOption(cb) {
  const presetId = state.presetFull && state.presetFull.preset && state.presetFull.preset.id;
  const entry = state.variablePreviews[cb.variableName];
  if (!presetId || !entry) return;
  // Build the new options array, replacing the edited option's value.
  const opts = choiceBlockOptions(cb).map((o) => {
    if ((o.id || o.value) === entry.optionId) return { ...o, value: entry.value };
    return o;
  });
  try {
    await api("PATCH", "/prompts/" + presetId + "/variables/" + cb.id, {
      options: opts,
    });
    await loadPresetFull(presetId);
    // Re-anchor the preview entry to the freshly-loaded option (savedValue
    // catches up). cbId / optionId may be the same; refresh defensively.
    const fresh = (state.presetFull.choiceBlocks || []).find((c) => c.id === cb.id);
    if (fresh) {
      const freshOpts = choiceBlockOptions(fresh);
      const picked = freshOpts.find((o) => (o.id || o.value) === entry.optionId);
      if (picked) {
        state.variablePreviews[cb.variableName] = {
          cbId: fresh.id,
          optionId: entry.optionId,
          value: picked.value,
          savedValue: picked.value,
        };
      }
    }
    renderAll();
    showToast("Saved ✓", "success");
  } catch (err) {
    console.error("[kolache-AIO] Variable save failed", err);
    showToast("Save failed — see console", "error");
  }
}

function folderSelectField(lorebookId, currentValue) {
  const folders = state.lorebookFolders[lorebookId] || [];
  const options = [["", "(none)"], ...folders.map((f) => [f.id, f.name || "(unnamed folder)"])];
  return selectField("Folder", currentValue || "", "folderId", options);
}

// Child-folders multiselect (mirrors renderFolderEntries but for folder
// nesting). Toggling a checkbox immediately re-parents that folder via PATCH.
function renderFolderChildren(folderId, lorebookId) {
  const wrap = document.createElement("div");
  wrap.appendChild(sectionHeader("Child folders"));
  const folders = state.lorebookFolders[lorebookId] || [];
  const ancestors = folderAncestorIds(folders, folderId);
  // Eligible = any folder except this one and its ancestors (avoids cycles;
  // the engine also rejects invalid moves with a 400).
  const eligible = folders.filter((f) => f.id !== folderId && !ancestors.has(f.id));
  if (!eligible.length) {
    const help = document.createElement("div");
    help.className = "kaio-field-help";
    help.textContent = "No other folders available to nest here.";
    wrap.appendChild(help);
    return wrap;
  }
  const help = document.createElement("div");
  help.className = "kaio-field-help";
  help.textContent = "Check a folder to nest it directly inside this one.";
  wrap.appendChild(help);

  const list = document.createElement("div");
  list.className = "kaio-batch-list";
  // Current children first, then alphabetical.
  const sorted = [...eligible].sort((a, b) => {
    const ac = a.parentFolderId === folderId ? 0 : 1;
    const bc = b.parentFolderId === folderId ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return (a.name || "").localeCompare(b.name || "");
  });
  for (const fo of sorted) {
    const row = document.createElement("label");
    row.className = "kaio-batch-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = fo.parentFolderId === folderId;
    cb.addEventListener("change", async () => {
      // Commit/revert any staged folder edit first so the eligibility tree and
      // the staged Parent value can't diverge (mirrors the checklist toggles).
      if ((await guardDirty()) === false) {
        cb.checked = !cb.checked;
        return;
      }
      cb.disabled = true;
      try {
        await api("PATCH", "/lorebooks/" + lorebookId + "/folders/" + fo.id, {
          parentFolderId: cb.checked ? folderId : null,
        });
        await loadLorebookFolders(lorebookId);
        // Keep the inspected folder pointing at a live object + clean draft.
        if (state.inspecting && state.inspecting.kind === "folder" && state.inspecting.folder) {
          const fresh = (state.lorebookFolders[lorebookId] || []).find((f) => f.id === state.inspecting.folder.id);
          if (fresh) {
            state.inspecting.folder = fresh;
            state.draft = makeDraft(state.inspecting);
            state.isDirty = false;
          }
        }
        renderAll();
        showToast(cb.checked ? "Folder nested" : "Folder detached", "info");
      } catch (err) {
        console.error("[kolache-AIO] Re-parent folder failed", err);
        showToast(serverErrorText(err, "Couldn't move folder"), "error");
        cb.checked = !cb.checked;
        cb.disabled = false;
      }
    });
    row.appendChild(cb);
    const nameEl = document.createElement("span");
    nameEl.className = "kaio-batch-item-name";
    nameEl.textContent = fo.name || "(unnamed folder)";
    row.appendChild(nameEl);
    // Note the current parent for folders nested elsewhere.
    if (fo.parentFolderId && fo.parentFolderId !== folderId) {
      const owner = folders.find((x) => x.id === fo.parentFolderId);
      const tag = document.createElement("span");
      tag.className = "kaio-batch-nested-folder";
      tag.textContent = owner ? "in: " + (owner.name || "folder") : "nested";
      row.appendChild(tag);
    }
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

function renderFolderEntries(folderId, lorebookId) {
  const wrap = document.createElement("div");
  const entries = (state.lorebookEntries[lorebookId] || []).filter((e) => e.folderId === folderId);
  wrap.appendChild(sectionHeader("Entries in this folder"));
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "kaio-field-help";
    empty.textContent = "No entries assigned to this folder.";
    wrap.appendChild(empty);
    return wrap;
  }
  const list = document.createElement("div");
  list.className = "kaio-folder-entries";
  for (const e of entries) {
    const row = document.createElement("div");
    row.className = "kaio-folder-entry-row";
    const nameEl = document.createElement("span");
    nameEl.className = "kaio-folder-entry-name";
    nameEl.textContent = e.name || "(unnamed)";
    row.appendChild(nameEl);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "kaio-folder-entry-remove";
    removeBtn.textContent = "Remove";
    removeBtn.title = "Unassign entry from this folder";
    removeBtn.addEventListener("click", async () => {
      try {
        await api("PATCH", "/lorebooks/" + lorebookId + "/entries/" + e.id, { folderId: null });
        await loadLorebookEntries(lorebookId);
        const folderSet = state.selectedFolderIdsByLorebook[lorebookId];
        if (folderSet && folderSet.has(folderId)) {
          const checkedSet = state.selectedEntryIdsByLorebook[lorebookId];
          if (checkedSet) checkedSet.delete(e.id);
        }
        renderAll();
        showToast("Entry removed from folder", "info");
      } catch (err) {
        console.error("[kolache-AIO] Remove from folder failed", err);
        showToast("Failed to remove entry", "error");
      }
    });
    row.appendChild(removeBtn);
    list.appendChild(row);
  }
  wrap.appendChild(list);
  return wrap;
}

function renderFolderBatchAdd(folderId, lorebookId) {
  const wrap = document.createElement("div");
  wrap.appendChild(sectionHeader("Add entries to this folder"));

  const entries = state.lorebookEntries[lorebookId] || [];
  const folders = state.lorebookFolders[lorebookId] || [];
  const available = entries.filter((e) => !e.folderId);
  const nested = entries.filter((e) => e.folderId && e.folderId !== folderId);
  const inThisFolder = entries.filter((e) => e.folderId === folderId);

  if (!available.length && !nested.length) {
    const msg = document.createElement("div");
    msg.className = "kaio-field-help";
    msg.textContent = inThisFolder.length
      ? "All entries are already in this folder."
      : "This lorebook has no entries yet.";
    wrap.appendChild(msg);
    return wrap;
  }

  // "Show already nested" toggle
  if (nested.length) {
    const toggleWrap = document.createElement("label");
    toggleWrap.className = "kaio-checkbox kaio-batch-toggle";
    const toggleCb = document.createElement("input");
    toggleCb.type = "checkbox";
    toggleCb.checked = state.folderBatchAdd.showNested;
    toggleCb.addEventListener("change", () => {
      state.folderBatchAdd.showNested = toggleCb.checked;
      renderRight();
    });
    toggleWrap.appendChild(toggleCb);
    const toggleText = document.createElement("span");
    toggleText.textContent = "Show already nested";
    toggleWrap.appendChild(toggleText);
    wrap.appendChild(toggleWrap);
  }

  const listEl = document.createElement("div");
  listEl.className = "kaio-batch-list";

  // Available (unassigned) entries — selectable
  for (const e of available) {
    const row = document.createElement("label");
    row.className = "kaio-batch-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.folderBatchAdd.selected.has(e.id);
    cb.addEventListener("change", () => {
      if (cb.checked) state.folderBatchAdd.selected.add(e.id);
      else state.folderBatchAdd.selected.delete(e.id);
      const btn = wrap.querySelector(".kaio-batch-add-btn");
      if (btn) {
        const n = state.folderBatchAdd.selected.size;
        btn.textContent = n ? "Add selected (" + n + ")" : "Add selected";
        btn.disabled = !n;
      }
    });
    row.appendChild(cb);
    const nameEl = document.createElement("span");
    nameEl.className = "kaio-batch-item-name";
    nameEl.textContent = e.name || "(unnamed)";
    row.appendChild(nameEl);
    listEl.appendChild(row);
  }

  // Already-nested entries — grayed out, unselectable, folder name on right
  if (state.folderBatchAdd.showNested) {
    for (const e of nested) {
      const ownerFolder = folders.find((f) => f.id === e.folderId);
      const row = document.createElement("div");
      row.className = "kaio-batch-item kaio-batch-nested";
      const dummyCb = document.createElement("input");
      dummyCb.type = "checkbox";
      dummyCb.disabled = true;
      row.appendChild(dummyCb);
      const nameEl = document.createElement("span");
      nameEl.className = "kaio-batch-item-name kaio-batch-nested-name";
      nameEl.textContent = e.name || "(unnamed)";
      row.appendChild(nameEl);
      const folderLabel = document.createElement("span");
      folderLabel.className = "kaio-batch-nested-folder";
      folderLabel.textContent = ownerFolder ? ownerFolder.name : "(unknown)";
      row.appendChild(folderLabel);
      listEl.appendChild(row);
    }
  }

  if (!available.length) {
    const msg = document.createElement("div");
    msg.className = "kaio-batch-empty";
    msg.textContent = "No unassigned entries available.";
    listEl.appendChild(msg);
  }

  wrap.appendChild(listEl);

  // "Add selected" button
  const n = state.folderBatchAdd.selected.size;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "kaio-btn kaio-btn-primary kaio-batch-add-btn";
  addBtn.textContent = n ? "Add selected (" + n + ")" : "Add selected";
  addBtn.disabled = !n;
  addBtn.addEventListener("click", async () => {
    const ids = [...state.folderBatchAdd.selected];
    if (!ids.length) return;
    try {
      await Promise.all(
        ids.map((id) => api("PATCH", "/lorebooks/" + lorebookId + "/entries/" + id, { folderId: folderId })),
      );
      await loadLorebookEntries(lorebookId);
      const folderSelectSet = state.selectedFolderIdsByLorebook[lorebookId];
      if (folderSelectSet && folderSelectSet.has(folderId)) {
        const checkedSet = state.selectedEntryIdsByLorebook[lorebookId];
        if (checkedSet) for (const id of ids) checkedSet.add(id);
      }
      state.folderBatchAdd.selected.clear();
      renderAll();
      showToast("Added " + ids.length + " entr" + (ids.length === 1 ? "y" : "ies") + " to folder", "success");
    } catch (err) {
      console.error("[kolache-AIO] Batch add failed", err);
      showToast("Failed to add entries", "error");
    }
  });
  wrap.appendChild(addBtn);
  return wrap;
}

function sectionHeader(text) {
  const h = document.createElement("div");
  h.className = "kaio-section-header";
  h.textContent = text;
  return h;
}
function rowOf(...children) {
  const row = document.createElement("div");
  row.className = "kaio-field kaio-field-row";
  for (const c of children) row.appendChild(c);
  return row;
}
function onFieldChange(key, value) {
  if (!state.draft) return;
  if (key === "matchingMode") {
    state.draft.fields.constant = value === "constant";
    state.draft.fields.selective = value === "selective";
  } else {
    state.draft.fields[key] = value;
  }
  // Section's injectionPosition toggles whether the Depth/Order row is
  // rendered, so re-render the whole inspector when it changes. Other fields
  // can patch the footer in place to preserve focus / caret.
  if (
    (state.draft.kind === "section" && key === "injectionPosition") ||
    (state.draft.kind === "group-editor" && (key === "mode" || key === "responseOrder")) ||
    key === "matchingMode" ||
    key === "wrapFormat" ||
    key === "category"
  ) {
    state.isDirty = isDraftDirty();
    renderRight();
    return;
  }
  refreshDirtyFooter();
}
// Recompute dirty state and patch the footer (dot / label / Save+Revert enabled)
// in place — used by onFieldChange and by the character editor's array sub-editors
// so an in-place text edit doesn't need a full re-render (which would drop focus).
function refreshDirtyFooter() {
  state.isDirty = isDraftDirty();
  if (!rightFooterEl) return;
  const dot = rightFooterEl.querySelector(".kaio-dirty-dot");
  if (dot) dot.dataset.dirty = state.isDirty ? "true" : "false";
  const txt = rightFooterEl.querySelector("span:nth-child(2)");
  if (txt) txt.textContent = state.isDirty ? "Unsaved changes" : "No changes";
  const footerBtns = rightFooterEl.querySelectorAll("button:not(.kaio-btn-delete)");
  if (footerBtns[0]) footerBtns[0].disabled = !state.isDirty;
  if (footerBtns[1]) footerBtns[1].disabled = !state.isDirty;
}
function isDraftDirty() {
  if (!state.draft || !state.inspecting) return false;
  const fresh = makeDraft(state.inspecting);
  return !deepEqual(fresh.fields, state.draft.fields);
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a),
      bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}
async function saveDraft() {
  if (!state.draft) return;
  const d = state.draft;
  try {
    switch (d.kind) {
      case "section": {
        const presetId = state.presetFull.preset.id;
        const body = {
          name: d.fields.name,
          content: d.fields.content,
          role: d.fields.role,
          enabled: d.fields.enabled,
          injectionPosition: d.fields.injectionPosition,
          injectionDepth: d.fields.injectionDepth,
          injectionOrder: d.fields.injectionOrder,
          groupId: d.fields.groupId ? d.fields.groupId : null,
        };
        await api("PATCH", "/prompts/" + presetId + "/sections/" + d.sourceId, body);
        await loadPresetFull(presetId);
        break;
      }
      case "lorebook-entry": {
        const f = d.fields;
        const csv = (s) =>
          (s || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        const oldFolderId = state.inspecting?.entry?.folderId || null;
        const body = {
          name: f.name,
          content: f.content,
          description: f.description,
          keys: csv(f.keys),
          secondaryKeys: csv(f.secondaryKeys),
          enabled: f.enabled,
          constant: f.constant,
          position: Number(f.position),
          depth: Number(f.depth),
          order: Number(f.order),
          role: f.role,
          selective: f.selective,
          selectiveLogic: f.selectiveLogic,
          probability: f.probability,
          scanDepth: f.scanDepth,
          matchWholeWords: f.matchWholeWords,
          caseSensitive: f.caseSensitive,
          useRegex: f.useRegex,
          characterFilterMode: f.characterFilterMode,
          characterFilterIds: csv(f.characterFilterIds),
          characterTagFilterMode: f.characterTagFilterMode,
          characterTagFilters: csv(f.characterTagFilters),
          generationTriggerFilterMode: f.generationTriggerFilterMode,
          generationTriggerFilters: csv(f.generationTriggerFilters),
          additionalMatchingSources:
            f.additionalMatchingSources instanceof Set
              ? [...f.additionalMatchingSources]
              : Array.isArray(f.additionalMatchingSources)
                ? f.additionalMatchingSources
                : [],
          sticky: f.sticky,
          cooldown: f.cooldown,
          delay: f.delay,
          ephemeral: f.ephemeral,
          group: f.group,
          groupWeight: f.groupWeight,
          tag: f.tag,
          folderId: f.folderId ? f.folderId : null,
          preventRecursion: f.preventRecursion,
          locked: f.locked,
        };
        await api("PATCH", "/lorebooks/" + d.lorebookId + "/entries/" + d.sourceId, body);
        await loadLorebookEntries(d.lorebookId);
        // Sync folder selection: auto-select/deselect entry if it moved between folders
        const folderSet = state.selectedFolderIdsByLorebook[d.lorebookId];
        const checkedSet = state.selectedEntryIdsByLorebook[d.lorebookId];
        if (folderSet && checkedSet) {
          const saved = (state.lorebookEntries[d.lorebookId] || []).find((e) => e.id === d.sourceId);
          if (saved) {
            const newFolderId = saved.folderId || null;
            if (newFolderId && folderSet.has(newFolderId)) checkedSet.add(saved.id);
            if (oldFolderId && folderSet.has(oldFolderId) && oldFolderId !== newFolderId) checkedSet.delete(saved.id);
          }
        }
        break;
      }
      case "character": {
        const f = d.fields;
        const fresh = normalizeCharacter(await api("GET", "/characters/" + d.sourceId));
        const fd = (fresh && fresh.data) || {};
        const csv = (s) =>
          (s || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        // Merge into extensions so passthrough keys (avatarCrop, trackerCardColors,
        // world, conversationStatus, …) survive untouched. Only materialize a key
        // when it carries a value or the card already had it — a minimal diff that
        // matches the colors/rpgStats gating and avoids stamping empty defaults
        // (e.g. an empty depth_prompt) onto cards that never used them.
        const had = fd.extensions || {};
        const ext = { ...had };
        const gate = (key, value, keep) => {
          if (keep || key in had) ext[key] = value;
          else delete ext[key];
        };
        gate("backstory", f.backstory, !!f.backstory);
        gate("appearance", f.appearance, !!f.appearance);
        gate("talkativeness", Number(f.talkativeness), Number(f.talkativeness) !== 0.5);
        gate("fav", !!f.fav, !!f.fav);
        gate(
          "depth_prompt",
          {
            prompt: f.depthPrompt || "",
            depth: Math.max(0, Math.round(Number(f.depthDepth) || 0)),
            role: f.depthRole || "system",
          },
          !!(f.depthPrompt && f.depthPrompt.trim()),
        );
        for (const k of ["nameColor", "dialogueColor", "boxColor"]) {
          if (f[k] && f[k].trim()) ext[k] = f[k];
          else delete ext[k];
        }
        // Only persist rpgStats if it's enabled or the card already carried it.
        if (f.rpgStats && (f.rpgStats.enabled || had.rpgStats)) ext.rpgStats = cleanRpgStats(f.rpgStats);
        const newData = {
          ...fd, // preserve character_book + any passthrough top-level keys
          name: f.name,
          description: f.description,
          personality: f.personality,
          scenario: f.scenario,
          first_mes: f.first_mes,
          mes_example: f.mes_example,
          creator_notes: f.creator_notes,
          system_prompt: f.system_prompt,
          post_history_instructions: f.post_history_instructions,
          creator: f.creator,
          character_version: f.character_version,
          tags: csv(f.tags),
          alternate_greetings: Array.isArray(f.alternate_greetings)
            ? f.alternate_greetings.filter((g) => g != null && String(g).trim() !== "")
            : [],
          extensions: ext,
        };
        await api("PATCH", "/characters/" + d.sourceId, { data: newData, comment: f.comment || "" });
        await loadCharacter(d.sourceId);
        // A standalone "+ Character" editor has an id the save-tail can't
        // re-match (no rendered block), so re-inspect it here to keep it open.
        if (
          state.inspecting &&
          String(state.inspecting.id).startsWith("character-editor-") &&
          state.charactersFull[d.sourceId]
        ) {
          state.inspecting = {
            kind: "character",
            id: "character-editor-" + d.sourceId,
            character: state.charactersFull[d.sourceId],
          };
          state.draft = makeDraft(state.inspecting);
          state.isDirty = false;
          renderAll();
          showToast("Saved ✓", "success");
          return;
        }
        break;
      }
      case "persona": {
        await api("PATCH", "/characters/personas/" + d.sourceId, d.fields);
        await loadPersona(d.sourceId);
        if (state.inspecting && String(state.inspecting.id).startsWith("persona-editor-") && state.personaFull) {
          state.inspecting = { kind: "persona", id: "persona-editor-" + d.sourceId, persona: state.personaFull };
          state.draft = makeDraft(state.inspecting);
          state.isDirty = false;
          renderAll();
          showToast("Saved ✓", "success");
          return;
        }
        break;
      }
      case "group-editor": {
        // Group settings are console-local (a group chat's real settings live on
        // the chat itself) — no REST call, just persist to localStorage.
        const f = d.fields;
        state.groupSettings = {
          mode: f.mode,
          responseOrder: f.responseOrder,
          turnPromptEnabled: f.turnPromptEnabled !== false,
          speakerNamesInHistory: !!f.speakerNamesInHistory,
          speakerColors: !!f.speakerColors,
          scenarioText: f.scenarioText || "",
          inactiveCharacterIds:
            f.inactiveCharacterIds instanceof Set
              ? [...f.inactiveCharacterIds]
              : Array.isArray(f.inactiveCharacterIds)
                ? f.inactiveCharacterIds
                : [],
        };
        // Clear a stale focus (mode left individual, or the member is now benched/gone).
        if (
          state.groupFocusCharId &&
          (state.groupSettings.mode !== "individual" ||
            state.groupSettings.inactiveCharacterIds.includes(state.groupFocusCharId) ||
            !state.selectedCharacterIds.includes(state.groupFocusCharId))
        ) {
          state.groupFocusCharId = null;
        }
        state.inspecting = { kind: "group-editor", id: "group-editor" };
        state.draft = makeDraft(state.inspecting);
        state.isDirty = false;
        renderAll();
        showToast("Saved ✓", "success");
        return;
      }
      case "preset-editor": {
        const presetId = d.sourceId;
        const body = {
          name: d.fields.name,
          description: d.fields.description,
          wrapFormat: d.fields.wrapFormat,
          author: d.fields.author,
        };
        await api("PATCH", "/prompts/" + presetId, body);
        await loadPresetFull(presetId);
        state.presets = await api("GET", "/prompts/").catch(() => state.presets);
        state.inspecting = { kind: "preset-editor", id: "preset-editor" };
        state.draft = makeDraft(state.inspecting);
        state.isDirty = false;
        renderAll();
        showToast("Saved ✓", "success");
        return;
      }
      case "lorebook-editor": {
        const lbId = d.sourceId;
        const tagsArr =
          typeof d.fields.tags === "string"
            ? d.fields.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [];
        const body = {
          name: d.fields.name,
          description: d.fields.description,
          tags: tagsArr,
          category: d.fields.category,
          enabled: d.fields.enabled,
          isGlobal: d.fields.isGlobal,
          scanDepth: Number(d.fields.scanDepth),
          tokenBudget: Number(d.fields.tokenBudget),
          recursiveScanning: d.fields.recursiveScanning,
        };
        await api("PATCH", "/lorebooks/" + lbId, body);
        state.lorebooks = await api("GET", "/lorebooks").catch(() => state.lorebooks);
        const freshLb = state.lorebooks.find((l) => l.id === lbId);
        if (freshLb) {
          state.inspecting = { kind: "lorebook-editor", id: "lorebook-editor-" + lbId, lorebook: freshLb };
          state.draft = makeDraft(state.inspecting);
        } else {
          state.inspecting = null;
          state.draft = null;
        }
        state.isDirty = false;
        renderAll();
        showToast("Saved ✓", "success");
        return;
      }
      case "folder": {
        const body = {
          name: d.fields.name,
          enabled: d.fields.enabled,
          order: Number(d.fields.order),
          parentFolderId: d.fields.parentFolderId || null,
        };
        await api("PATCH", "/lorebooks/" + d.lorebookId + "/folders/" + d.sourceId, body);
        await loadLorebookFolders(d.lorebookId);
        const freshFolder = (state.lorebookFolders[d.lorebookId] || []).find((f) => f.id === d.sourceId);
        if (freshFolder) {
          state.inspecting = {
            kind: "folder",
            id: "folder-" + freshFolder.id,
            folder: freshFolder,
            lorebookId: d.lorebookId,
          };
          state.draft = makeDraft(state.inspecting);
        } else {
          state.inspecting = null;
          state.draft = null;
        }
        state.isDirty = false;
        renderAll();
        showToast("Saved ✓", "success");
        return;
      }
    }
    const previousId = state.inspecting?.id;
    const blocks = buildSimulatedPrompt();
    const same = blocks.find((b) => b.id === previousId);
    state.inspecting = same || null;
    state.draft = same ? makeDraft(same) : null;
    state.isDirty = false;
    renderAll();
    showToast("Saved ✓", "success");
  } catch (err) {
    console.error("[kolache-AIO] Save failed", err);
    showToast(serverErrorText(err, "Save failed — see console"), "error");
  }
}
async function deleteInspected() {
  if (!state.inspecting) return;
  const kind = state.inspecting.kind;
  if (kind !== "lorebook-entry" && kind !== "folder") return;
  const confirmed = await showDeleteConfirm(kind);
  if (!confirmed) return;
  try {
    if (kind === "lorebook-entry") {
      const entry = state.inspecting.entry;
      const lorebookId = entry.lorebookId;
      await api("DELETE", "/lorebooks/" + lorebookId + "/entries/" + entry.id);
      await loadLorebookEntries(lorebookId);
      const checkedSet = state.selectedEntryIdsByLorebook[lorebookId];
      if (checkedSet) checkedSet.delete(entry.id);
    } else if (kind === "folder") {
      const folder = state.inspecting.folder;
      const lorebookId = state.inspecting.lorebookId;
      await api("DELETE", "/lorebooks/" + lorebookId + "/folders/" + folder.id);
      await loadLorebookFolders(lorebookId);
      await loadLorebookEntries(lorebookId);
      const folderSet = state.selectedFolderIdsByLorebook[lorebookId];
      if (folderSet) folderSet.delete(folder.id);
    }
    state.inspecting = null;
    state.draft = null;
    state.isDirty = false;
    renderAll();
    if (kind === "folder") switchMobileTab("left");
    showToast(kind === "folder" ? "Folder deleted" : "Entry deleted", "success");
  } catch (err) {
    console.error("[kolache-AIO] Delete failed", err);
    showToast("Delete failed — see console", "error");
  }
}
function showDeleteConfirm(kind) {
  const label = kind === "folder" ? "folder" : "entry";
  const extra = kind === "folder" ? " Entries inside will be moved to root level." : "";
  return host
    .choice({
      title: "Delete " + label + "?",
      message: "This will permanently delete this " + label + "." + extra + " This cannot be undone.",
      choices: [{ key: "delete", label: "Delete", tone: "destructive" }],
      layout: "row",
    })
    .then((key) => key === "delete");
}
function confirmDirtySwitch(pending, onLeave) {
  void host
    .choice({
      title: "Unsaved changes",
      message: "You have unsaved edits. Save them, revert, or stay here?",
      choices: [
        { key: "save", label: "Save" },
        { key: "revert", label: "Revert" },
      ],
      cancelLabel: "Stay",
      layout: "row",
    })
    .then(async (key) => {
      if (key === "revert") {
        state.draft = makeDraft(state.inspecting);
        state.isDirty = false;
      } else if (key === "save") {
        await saveDraft();
        if (state.isDirty) return;
      } else return;
      if (pending === null) {
        if (onLeave) onLeave();
        else renderAll();
      } else if (pending) inspectBlock(pending);
      else renderAll();
    });
}
function guardDirty() {
  if (!state.isDirty) return Promise.resolve(true);
  return host
    .choice({
      title: "Unsaved changes",
      message: "Save or revert your edits before changing sources.",
      choices: [
        { key: "save", label: "Save" },
        { key: "revert", label: "Revert" },
      ],
      cancelLabel: "Stay",
      layout: "row",
    })
    .then(async (key) => {
      if (key === "revert") {
        state.draft = makeDraft(state.inspecting);
        state.isDirty = false;
        return true;
      }
      if (key === "save") {
        await saveDraft();
        return !state.isDirty;
      }
      return false;
    });
}
let toastTimer = null;
function showToast(msg, kind) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.dataset.kind = kind || "info";
  toastEl.dataset.visible = "true";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.dataset.visible = "false";
  }, 1800);
}
// ── Lorebook editor panel ─────────────────────────────────────
function renderLorebookEditorPanel() {
  const wrap = document.createElement("div");
  wrap.className = "kaio-preset-editor";
  const lb = state.inspecting && state.inspecting.lorebook;
  if (!lb) return wrap;
  const f = state.draft && state.draft.fields;

  wrap.appendChild(
    renderCollapsible(
      "Overview",
      "overview",
      () => {
        const content = document.createElement("div");
        if (!f) return content;
        content.appendChild(field("Name", f.name, "name", "input"));
        content.appendChild(
          field("Description", f.description, "description", "textarea", "Brief description of this lorebook.", 3),
        );
        content.appendChild(field("Tags", f.tags, "tags", "input", "Comma-separated tags for organizing lorebooks."));
        content.appendChild(lorebookCategoryField(f.category));
        content.appendChild(
          rowOf(
            numberField(
              "Scan Depth",
              f.scanDepth,
              "scanDepth",
              "How many messages back to scan for keyword matches. Entries can override this.",
            ),
            numberField(
              "Token Budget",
              f.tokenBudget,
              "tokenBudget",
              "Maximum tokens allocated to this lorebook's injected entries.",
            ),
          ),
        );
        content.appendChild(
          checkboxField(
            "Recursive",
            f.recursiveScanning,
            "recursiveScanning",
            "When enabled, activated entries are re-scanned for keywords that may trigger additional entries.",
          ),
        );
        content.appendChild(
          checkboxField(
            "Enabled",
            f.enabled,
            "enabled",
            "Master switch — when off, no entries from this lorebook will activate.",
          ),
        );
        content.appendChild(
          checkboxField(
            "Global",
            f.isGlobal,
            "isGlobal",
            "When on, this lorebook is active in every chat regardless of linked characters or personas.",
          ),
        );
        return content;
      },
      { stateObj: state.lbEditorCollapsed },
    ),
  );

  return wrap;
}

function lorebookCategoryField(value) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, "Category");
  wrap.appendChild(lab);
  const row = document.createElement("div");
  row.className = "kaio-match-mode";
  for (const [val, label, icon] of [
    ["world", "World", "world"],
    ["character", "Character", "characters"],
    ["npc", "NPC", "npc"],
    ["spellbook", "Spellbook", "spellbook"],
    ["uncategorized", "Uncategorized", "uncategorized"],
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kaio-match-btn kaio-wrap-btn";
    btn.dataset.active = String(value === val);
    const iconEl = document.createElement("span");
    iconEl.style.marginRight = "0.25rem";
    iconEl.innerHTML = ico(icon);
    btn.appendChild(iconEl);
    btn.appendChild(document.createTextNode(label));
    btn.addEventListener("click", () => onFieldChange("category", val));
    row.appendChild(btn);
  }
  wrap.appendChild(row);
  return wrap;
}

// ── Preset editor panel (3 collapsibles: Overview / Sections / Variables) ──
function renderPresetEditorPanel() {
  const wrap = document.createElement("div");
  wrap.className = "kaio-preset-editor";
  const p = state.presetFull && state.presetFull.preset;
  if (!p) return wrap;
  const f = state.draft && state.draft.fields;

  // ── Overview collapsible ──
  wrap.appendChild(
    renderCollapsible("Overview", "overview", () => {
      const content = document.createElement("div");
      if (!f) return content;
      content.appendChild(field("Name", f.name, "name", "input"));
      content.appendChild(
        field(
          "Description",
          f.description,
          "description",
          "textarea",
          "Brief description of this preset. Shown in the preset picker.",
          3,
        ),
      );
      content.appendChild(wrapFormatField(f.wrapFormat));
      content.appendChild(field("Author", f.author, "author", "input"));
      const stats = document.createElement("div");
      stats.className = "kaio-preset-stats";
      const secCount = (state.presetFull.sections || []).length;
      const grpCount = (state.presetFull.groups || []).length;
      stats.innerHTML =
        `<span class="kaio-preset-stat"><strong>${secCount}</strong> Sections</span>` +
        `<span class="kaio-preset-stat"><strong>${grpCount}</strong> Groups</span>`;
      content.appendChild(stats);
      return content;
    }),
  );

  // ── Sections collapsible ──
  const secCount = (state.presetFull.sections || []).length;
  wrap.appendChild(renderCollapsible("Sections", "sections", () => renderPresetSectionsPanel(), { count: secCount }));

  // ── Preset Variables collapsible ──
  const varCount = (state.presetFull.choiceBlocks || []).length;
  wrap.appendChild(
    renderCollapsible("Preset Variables", "variables", () => renderPresetVariablesPanel(), { count: varCount }),
  );

  return wrap;
}

function renderCollapsible(title, key, contentFn, opts) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-collapsible";
  const stateObj = (opts && opts.stateObj) || state.presetEditorCollapsed;
  const collapsed = stateObj[key];
  if (collapsed) wrap.dataset.collapsed = "true";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "kaio-collapsible-header";
  const countHTML = opts && opts.count != null ? `<span class="kaio-collapsible-count">${opts.count}</span>` : "";
  header.innerHTML = `<span class="kaio-collapsible-caret">▾</span><span class="kaio-collapsible-title">${escapeHTML(title)}</span>${countHTML}`;
  header.addEventListener("click", () => {
    stateObj[key] = !stateObj[key];
    renderRight();
  });
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "kaio-collapsible-body";
  body.appendChild(contentFn());
  wrap.appendChild(body);
  return wrap;
}

function wrapFormatField(value) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, "Wrap format", "Sections wrapped in <xml_tags>, ## Markdown headings, or no wrapping.");
  wrap.appendChild(lab);
  const row = document.createElement("div");
  row.className = "kaio-match-mode";
  for (const [val, label, icon] of [
    ["xml", "XML", "</\>"],
    ["markdown", "Markdown", "#"],
    ["none", "None", "T"],
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kaio-match-btn kaio-wrap-btn";
    btn.dataset.active = String(value === val);
    const iconEl = document.createElement("span");
    iconEl.className = "kaio-wrap-icon";
    iconEl.textContent = icon;
    btn.appendChild(iconEl);
    btn.appendChild(document.createTextNode(label.toUpperCase()));
    btn.addEventListener("click", () => onFieldChange("wrapFormat", val));
    row.appendChild(btn);
  }
  wrap.appendChild(row);
  return wrap;
}

function groupSelectField(currentValue) {
  const groups = (state.presetFull && state.presetFull.groups) || [];
  const options = [["", "(none)"], ...groups.map((g) => [g.id, g.name || "(unnamed group)"])];
  return selectField(
    "Group",
    currentValue || "",
    "groupId",
    options,
    "Assign this section to a group. Groups organize related sections visually.",
  );
}

// Generic segmented pill control (like matchingModeField/wrapFormatField but
// data-driven): options is an array of [value, label] pairs.
function pillField(label, value, key, options, tooltip) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-field";
  const lab = document.createElement("label");
  lab.className = "kaio-field-label";
  applyLabel(lab, label, tooltip);
  wrap.appendChild(lab);
  const row = document.createElement("div");
  row.className = "kaio-match-mode";
  for (const [val, text] of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kaio-match-btn kaio-pill-btn";
    btn.dataset.active = String(String(value) === String(val));
    btn.textContent = text;
    btn.addEventListener("click", () => onFieldChange(key, val));
    row.appendChild(btn);
  }
  wrap.appendChild(row);
  return wrap;
}

// Group Chat settings panel — the console-side mirror of Marinara's Chat
// Settings → Group Chat controls (all persisted to localStorage, applied to the
// structural preview). Reached via the ⚙️ on the Characters (Group) source.
function renderGroupEditorPanel() {
  const wrap = document.createElement("div");
  wrap.className = "kaio-preset-editor";
  const f = state.draft.fields;

  wrap.appendChild(sectionHeader("Group Chat"));

  wrap.appendChild(
    pillField(
      "Mode",
      f.mode,
      "mode",
      [
        ["merged", groupModeLabel("merged")],
        ["individual", groupModeLabel("individual")],
      ],
      "Merged: every card is stacked into one section and a single reply voices the scene. Individual: the engine builds one card per turn (others stripped, history relabeled).",
    ),
  );

  if (f.mode === "individual") {
    wrap.appendChild(
      pillField(
        "Response order",
        f.responseOrder,
        "responseOrder",
        [
          ["sequential", "Sequential"],
          ["smart", "Smart"],
          ["manual", "Manual"],
        ],
        "Who responds each turn (a runtime choice). Sequential: members in listed order. Smart: an agent decides. Manual: you pick each speaker.",
      ),
    );
    wrap.appendChild(
      checkboxField(
        "Add Turn To Prompt",
        f.turnPromptEnabled,
        "turnPromptEnabled",
        'Appends a short "Respond ONLY as <name>." instruction to each individual turn.',
      ),
    );
    wrap.appendChild(
      checkboxField(
        "Name Prefix History",
        f.speakerNamesInHistory,
        "speakerNamesInHistory",
        "Prefixes each chat-history turn with the speaker's name before role-merging, so the model can tell who said what.",
      ),
    );
  } else {
    wrap.appendChild(
      checkboxField(
        "Color Dialogues",
        f.speakerColors,
        "speakerColors",
        'Asks the model to wrap each character’s dialogue in <speaker="name"> tags (merged mode only).',
      ),
    );
  }

  wrap.appendChild(
    field(
      "Scenario Override",
      f.scenarioText,
      "scenarioText",
      "textarea",
      "A shared scenario that replaces every character card's own scenario. Leave empty to keep each card's individual scenario.",
      4,
    ),
  );

  const chars = selectedCharacters();
  if (chars.length) {
    wrap.appendChild(
      multiSelectField(
        "Inactive members",
        f.inactiveCharacterIds,
        "inactiveCharacterIds",
        chars.map((c) => [c.id, (c.data && c.data.name) || c.name || "Character"]),
      ),
    );
  }

  return wrap;
}

// ── Sections management panel ─────────────────────────────────
function renderPresetSectionsPanel() {
  const wrap = document.createElement("div");
  const presetId = state.presetFull.preset.id;
  const sections = state.presetFull.sections || [];
  const groups = state.presetFull.groups || [];
  const sectionOrder = tryParseJSON(state.presetFull.preset.sectionOrder, []);
  const sectionsById = Object.fromEntries(sections.map((s) => [s.id, s]));
  const orderedIds = sectionOrder.length ? sectionOrder : sections.map((s) => s.id);

  // Create button with dropdown
  const actions = document.createElement("div");
  actions.className = "kaio-create-actions";
  actions.style.position = "relative";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "kaio-create-btn";
  addBtn.textContent = "+ Section";
  addBtn.addEventListener("click", () => {
    const existing = actions.querySelector(".kaio-add-section-menu");
    if (existing) {
      existing.remove();
      return;
    }
    const menu = document.createElement("div");
    menu.className = "kaio-add-section-menu";
    const items = [
      { label: "Prompt Block", marker: false },
      { divider: true, label: "Markers" },
      { label: "Character Info", type: "character" },
      { label: "Lorebook Marker (All)", type: "lorebook" },
      { label: "Persona", type: "persona" },
      { label: "Chat History", type: "chat_history" },
      { label: "Chat Summary", type: "chat_summary" },
      { label: "Lorebook Marker (Before)", type: "world_info_before" },
      { label: "Lorebook Marker (After)", type: "world_info_after" },
      { label: "Dialogue Examples", type: "dialogue_examples" },
    ];
    for (const it of items) {
      if (it.divider) {
        const d = document.createElement("div");
        d.className = "kaio-add-section-divider";
        d.textContent = it.label;
        menu.appendChild(d);
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kaio-add-section-item";
      btn.textContent = it.label;
      btn.addEventListener("click", async () => {
        menu.remove();
        if (it.marker === false) {
          await createPresetSection(presetId);
        } else {
          await createPresetMarker(presetId, it.label, it.type);
        }
      });
      menu.appendChild(btn);
    }
    actions.appendChild(menu);
    const dismiss = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== addBtn) {
        menu.remove();
        document.removeEventListener("click", dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener("click", dismiss, true), 0);
  });
  actions.appendChild(addBtn);

  // Groups management (above section order)
  wrap.appendChild(renderPresetGroupsUI(presetId, groups, sections));

  // Section order list
  wrap.appendChild(sectionHeader("Section order"));
  if (!orderedIds.length) {
    const empty = document.createElement("div");
    empty.className = "kaio-field-help";
    empty.textContent = "No sections in this preset yet.";
    wrap.appendChild(empty);
    wrap.appendChild(actions);
    return wrap;
  }

  const list = document.createElement("div");
  list.className = "kaio-preset-section-list";
  list.dataset.presetId = presetId;

  for (const id of orderedIds) {
    const s = sectionsById[id];
    if (!s) continue;
    const row = document.createElement("div");
    row.className = "kaio-preset-section-row";
    row.draggable = true;
    row.dataset.sectionId = s.id;

    // Drag handle
    const handle = document.createElement("span");
    handle.className = "kaio-drag-handle";
    handle.textContent = "⠿";
    row.appendChild(handle);

    // Tag
    const tag = document.createElement("span");
    tag.className = "kaio-block-tag";
    const isMarker = s.isMarker === true || s.isMarker === "true";
    tag.dataset.kind = isMarker ? "marker" : "section";
    tag.textContent = isMarker ? "MARKER" : "SECTION";
    row.appendChild(tag);

    // Name
    const name = document.createElement("span");
    name.className = "kaio-preset-section-name";
    name.textContent = s.name || s.identifier || "(unnamed)";
    row.appendChild(name);

    // Group badge
    if (s.groupId) {
      const group = groups.find((g) => g.id === s.groupId);
      if (group) {
        const badge = document.createElement("span");
        badge.className = "kaio-group-badge";
        badge.textContent = group.name || "Group";
        row.appendChild(badge);
      }
    }

    // Role
    const role = document.createElement("span");
    role.className = "kaio-preset-section-role";
    role.textContent = s.role || "system";
    row.appendChild(role);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "kaio-preset-section-delete";
    delBtn.textContent = "✕";
    delBtn.title = "Delete this section";
    delBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      deletePresetSection(presetId, s.id, s.name || s.identifier || "this section");
    });
    row.appendChild(delBtn);

    // Drag events
    row.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", s.id);
      ev.dataTransfer.effectAllowed = "move";
      row.dataset.dragging = "true";
    });
    row.addEventListener("dragend", () => {
      delete row.dataset.dragging;
      list.querySelectorAll(".kaio-preset-section-row").forEach((r) => delete r.dataset.dragover);
    });
    row.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      list.querySelectorAll(".kaio-preset-section-row").forEach((r) => delete r.dataset.dragover);
      row.dataset.dragover = "true";
    });
    row.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const draggedId = ev.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === s.id) return;
      const currentOrder = [...orderedIds];
      const fromIdx = currentOrder.indexOf(draggedId);
      const toIdx = currentOrder.indexOf(s.id);
      if (fromIdx < 0 || toIdx < 0) return;
      currentOrder.splice(fromIdx, 1);
      currentOrder.splice(toIdx, 0, draggedId);
      reorderPresetSections(presetId, currentOrder);
    });

    list.appendChild(row);
  }
  wrap.appendChild(list);
  // + Section button below the section list
  wrap.appendChild(actions);
  return wrap;
}

// ── Groups UI ─────────────────────────────────────────────────
function renderPresetGroupsUI(presetId, groups, sections) {
  const wrap = document.createElement("div");
  wrap.appendChild(sectionHeader("Groups"));

  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "kaio-field-help";
    empty.textContent = "No groups defined. Groups let you organize related sections.";
    wrap.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "kaio-preset-group-list";
    for (const g of groups) {
      list.appendChild(renderPresetGroupRow(presetId, g, groups, sections));
    }
    wrap.appendChild(list);
  }

  const createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.className = "kaio-create-btn";
  createBtn.style.marginTop = "0.375rem";
  createBtn.textContent = "+ Group";
  createBtn.addEventListener("click", () => createPresetGroup(presetId));
  wrap.appendChild(createBtn);
  return wrap;
}

function renderPresetGroupRow(presetId, group, allGroups, allSections) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-preset-group-row";
  const isExpanded = state.presetGroupBatchAdd.groupId === group.id;

  const header = document.createElement("div");
  header.className = "kaio-preset-group-header";

  const caret = document.createElement("span");
  caret.className = "kaio-collapsible-caret kaio-group-caret";
  if (!isExpanded) caret.style.transform = "rotate(-90deg)";
  header.appendChild(caret);

  const icon = document.createElement("span");
  icon.innerHTML = ico("folder");
  icon.className = "kaio-folder-icon";
  header.appendChild(icon);

  // Editable name
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "kaio-input kaio-group-name-input";
  nameInput.value = group.name || "";
  nameInput.placeholder = "(unnamed group)";
  let renameTimer = null;
  nameInput.addEventListener("input", () => {
    clearTimeout(renameTimer);
    renameTimer = setTimeout(() => {
      renamePresetGroup(presetId, group.id, nameInput.value);
    }, 600);
  });
  nameInput.addEventListener("click", (ev) => ev.stopPropagation());
  header.appendChild(nameInput);

  const memberCount = allSections.filter((s) => s.groupId === group.id).length;
  const count = document.createElement("span");
  count.className = "kaio-folder-count";
  count.textContent = String(memberCount);
  header.appendChild(count);

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "kaio-preset-section-delete";
  delBtn.textContent = "✕";
  delBtn.title = "Delete group";
  delBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    deletePresetGroup(presetId, group.id);
  });
  header.appendChild(delBtn);

  header.addEventListener("click", () => {
    if (state.presetGroupBatchAdd.groupId === group.id) {
      state.presetGroupBatchAdd = { groupId: null, selected: new Set() };
    } else {
      state.presetGroupBatchAdd = { groupId: group.id, selected: new Set() };
    }
    renderRight();
  });

  wrap.appendChild(header);

  if (isExpanded) {
    wrap.appendChild(renderGroupSectionsBatchAdd(presetId, group.id, allSections));
  }
  return wrap;
}

function renderGroupSectionsBatchAdd(presetId, groupId, allSections) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-group-batch-body";

  // Current members
  const members = allSections.filter((s) => s.groupId === groupId);
  if (members.length) {
    const memberList = document.createElement("div");
    memberList.className = "kaio-folder-entries";
    for (const s of members) {
      const row = document.createElement("div");
      row.className = "kaio-folder-entry-row";
      const nameEl = document.createElement("span");
      nameEl.className = "kaio-folder-entry-name";
      nameEl.textContent = s.name || s.identifier || "(unnamed)";
      row.appendChild(nameEl);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "kaio-folder-entry-remove";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        try {
          await api("PATCH", "/prompts/" + presetId + "/sections/" + s.id, { groupId: null });
          await loadPresetFull(presetId);
          renderRight();
          renderMiddle();
          showToast("Removed from group", "info");
        } catch (err) {
          console.error("[kolache-AIO] Remove from group failed", err);
          showToast("Failed to remove", "error");
        }
      });
      row.appendChild(removeBtn);
      memberList.appendChild(row);
    }
    wrap.appendChild(memberList);
  }

  // Available to add
  const available = allSections.filter((s) => !s.groupId || s.groupId === "");
  if (available.length) {
    const listEl = document.createElement("div");
    listEl.className = "kaio-batch-list";
    listEl.style.marginTop = "0.375rem";
    for (const s of available) {
      const row = document.createElement("label");
      row.className = "kaio-batch-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.presetGroupBatchAdd.selected.has(s.id);
      cb.addEventListener("change", () => {
        if (cb.checked) state.presetGroupBatchAdd.selected.add(s.id);
        else state.presetGroupBatchAdd.selected.delete(s.id);
        const btn = wrap.querySelector(".kaio-batch-add-btn");
        if (btn) {
          const n = state.presetGroupBatchAdd.selected.size;
          btn.textContent = n ? "Add selected (" + n + ")" : "Add selected";
          btn.disabled = !n;
        }
      });
      row.appendChild(cb);
      const nameEl = document.createElement("span");
      nameEl.className = "kaio-batch-item-name";
      nameEl.textContent = s.name || s.identifier || "(unnamed)";
      row.appendChild(nameEl);
      listEl.appendChild(row);
    }
    wrap.appendChild(listEl);

    const n = state.presetGroupBatchAdd.selected.size;
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "kaio-btn kaio-btn-primary kaio-batch-add-btn";
    addBtn.style.marginTop = "0.375rem";
    addBtn.style.width = "100%";
    addBtn.style.fontSize = "0.6875rem";
    addBtn.textContent = n ? "Add selected (" + n + ")" : "Add selected";
    addBtn.disabled = !n;
    addBtn.addEventListener("click", async () => {
      const ids = [...state.presetGroupBatchAdd.selected];
      if (!ids.length) return;
      try {
        await Promise.all(
          ids.map((id) => api("PATCH", "/prompts/" + presetId + "/sections/" + id, { groupId: groupId })),
        );
        await loadPresetFull(presetId);
        state.presetGroupBatchAdd.selected.clear();
        renderRight();
        renderMiddle();
        showToast("Added " + ids.length + " section" + (ids.length === 1 ? "" : "s") + " to group", "success");
      } catch (err) {
        console.error("[kolache-AIO] Group batch add failed", err);
        showToast("Failed to add sections", "error");
      }
    });
    wrap.appendChild(addBtn);
  } else if (!members.length) {
    const msg = document.createElement("div");
    msg.className = "kaio-field-help";
    msg.textContent = "No ungrouped sections available.";
    wrap.appendChild(msg);
  }
  return wrap;
}

// ── Preset variables management ───────────────────────────────
function renderPresetVariablesPanel() {
  const wrap = document.createElement("div");
  const presetId = state.presetFull.preset.id;
  const cbs = state.presetFull.choiceBlocks || [];

  if (!cbs.length) {
    const empty = document.createElement("div");
    empty.className = "kaio-field-help";
    empty.textContent = "No variables defined. Variables let users select options that substitute into the prompt.";
    wrap.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "kaio-preset-var-list";
    for (const cb of cbs) {
      list.appendChild(renderPresetVariableRow(presetId, cb));
    }
    wrap.appendChild(list);
  }

  const createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.className = "kaio-create-btn";
  createBtn.style.marginTop = "0.375rem";
  createBtn.textContent = "+ Variable";
  createBtn.addEventListener("click", () => createPresetVariable(presetId));
  wrap.appendChild(createBtn);
  return wrap;
}

function renderPresetVariableRow(presetId, cb) {
  const wrap = document.createElement("div");
  wrap.className = "kaio-preset-var-row";
  const isExpanded = state.presetExpandedVariableId === cb.id;

  const header = document.createElement("div");
  header.className = "kaio-preset-var-header";
  header.addEventListener("click", () => {
    state.presetExpandedVariableId = isExpanded ? null : cb.id;
    renderRight();
  });

  const caret = document.createElement("span");
  caret.className = "kaio-collapsible-caret";
  if (!isExpanded) caret.style.transform = "rotate(-90deg)";
  header.appendChild(caret);

  const varTag = document.createElement("span");
  varTag.className = "kaio-preset-var-tag";
  varTag.textContent = "#";
  header.appendChild(varTag);

  const nameEl = document.createElement("span");
  nameEl.className = "kaio-preset-var-name";
  nameEl.textContent = cb.variableName || "(unnamed)";
  header.appendChild(nameEl);

  const opts = choiceBlockOptions(cb);
  const optCount = document.createElement("span");
  optCount.className = "kaio-folder-count";
  optCount.style.background = "rgba(251, 191, 36, 0.15)";
  optCount.style.color = "#fbbf24";
  optCount.textContent = opts.length + " option" + (opts.length === 1 ? "" : "s");
  header.appendChild(optCount);

  const macroTag = document.createElement("span");
  macroTag.className = "kaio-preset-var-macro";
  macroTag.textContent = "{{" + (cb.variableName || "") + "}}";
  header.appendChild(macroTag);

  wrap.appendChild(header);

  if (isExpanded) {
    wrap.appendChild(renderPresetVariableEditor(presetId, cb));
  }
  return wrap;
}

function renderPresetVariableEditor(presetId, cb) {
  const body = document.createElement("div");
  body.className = "kaio-preset-var-body";
  const opts = choiceBlockOptions(cb);
  // Ensure subsequent re-renders see in-progress mutations (added/removed options)
  cb.options = opts;

  // Variable name
  const nameField = document.createElement("div");
  nameField.className = "kaio-field";
  const nameLab = document.createElement("label");
  nameLab.className = "kaio-field-label";
  applyLabel(nameLab, "Variable name", "Used as {{variableName}} macro in sections.");
  nameField.appendChild(nameLab);
  const nameInput = document.createElement("input");
  nameInput.className = "kaio-input";
  nameInput.value = cb.variableName || "";
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  // Question
  const qField = document.createElement("div");
  qField.className = "kaio-field";
  const qLab = document.createElement("label");
  qLab.className = "kaio-field-label";
  applyLabel(qLab, "Question", "Prompt shown to the user when selecting an option.");
  qField.appendChild(qLab);
  const qInput = document.createElement("textarea");
  qInput.className = "kaio-textarea";
  qInput.rows = 2;
  qInput.value = cb.question || "";
  qField.appendChild(qInput);
  body.appendChild(qField);

  // Multi-select, separator, random
  const optRow = document.createElement("div");
  optRow.className = "kaio-field kaio-field-row";
  optRow.style.gridTemplateColumns = "1fr 1fr 1fr";

  const msWrap = document.createElement("label");
  msWrap.className = "kaio-checkbox";
  const msCb = document.createElement("input");
  msCb.type = "checkbox";
  msCb.checked = cb.multiSelect === true || cb.multiSelect === "true";
  msWrap.appendChild(msCb);
  const msTxt = document.createElement("span");
  msTxt.textContent = "Multi-select";
  msWrap.appendChild(msTxt);
  optRow.appendChild(msWrap);

  const rpWrap = document.createElement("label");
  rpWrap.className = "kaio-checkbox";
  const rpCb = document.createElement("input");
  rpCb.type = "checkbox";
  rpCb.checked = cb.randomPick === true || cb.randomPick === "true";
  rpWrap.appendChild(rpCb);
  const rpTxt = document.createElement("span");
  rpTxt.textContent = "Random pick";
  rpWrap.appendChild(rpTxt);
  optRow.appendChild(rpWrap);

  const sepField = document.createElement("div");
  sepField.className = "kaio-field";
  sepField.style.marginBottom = "0";
  const sepLab = document.createElement("label");
  sepLab.className = "kaio-field-label";
  sepLab.textContent = "Separator";
  sepField.appendChild(sepLab);
  const sepInput = document.createElement("input");
  sepInput.className = "kaio-input";
  sepInput.value = cb.separator ?? ", ";
  sepField.appendChild(sepInput);
  optRow.appendChild(sepField);
  body.appendChild(optRow);

  // Options list
  body.appendChild(sectionHeader("Options"));
  const optsList = document.createElement("div");
  optsList.className = "kaio-preset-var-opts";
  for (let i = 0; i < opts.length; i++) {
    optsList.appendChild(renderVariableOptionRow(opts, i));
  }
  body.appendChild(optsList);

  const addOptBtn = document.createElement("button");
  addOptBtn.type = "button";
  addOptBtn.className = "kaio-create-btn";
  addOptBtn.style.marginTop = "0.25rem";
  addOptBtn.textContent = "+ Option";
  addOptBtn.addEventListener("click", () => {
    opts.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), label: "", value: "" });
    renderRight();
  });
  body.appendChild(addOptBtn);

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "kaio-preset-var-actions";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "kaio-btn kaio-btn-delete";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => deletePresetVariable(presetId, cb.id));
  actions.appendChild(delBtn);

  const spacer = document.createElement("span");
  spacer.className = "kaio-spacer";
  actions.appendChild(spacer);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "kaio-btn kaio-btn-primary";
  saveBtn.textContent = "Save variable";
  saveBtn.addEventListener("click", async () => {
    try {
      const body = {
        variableName: nameInput.value.trim(),
        question: qInput.value,
        options: opts,
        multiSelect: msCb.checked,
        randomPick: rpCb.checked,
        separator: sepInput.value,
      };
      await api("PATCH", "/prompts/" + presetId + "/variables/" + cb.id, body);
      await loadPresetFull(presetId);
      renderRight();
      renderMiddle();
      showToast("Variable saved ✓", "success");
    } catch (err) {
      console.error("[kolache-AIO] Save variable failed", err);
      showToast("Save failed — see console", "error");
    }
  });
  actions.appendChild(saveBtn);
  body.appendChild(actions);

  return body;
}

function renderVariableOptionRow(opts, index) {
  const opt = opts[index];
  const row = document.createElement("div");
  row.className = "kaio-preset-var-opt-row";

  const labelInput = document.createElement("input");
  labelInput.className = "kaio-input";
  labelInput.placeholder = "Label";
  labelInput.value = opt.label || "";
  labelInput.addEventListener("input", () => {
    opt.label = labelInput.value;
  });
  row.appendChild(labelInput);

  const valueInput = document.createElement("input");
  valueInput.className = "kaio-input";
  valueInput.placeholder = "Value";
  valueInput.value = opt.value || "";
  valueInput.addEventListener("input", () => {
    opt.value = valueInput.value;
  });
  row.appendChild(valueInput);

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "kaio-preset-section-delete";
  delBtn.textContent = "✕";
  delBtn.title = "Remove option";
  delBtn.addEventListener("click", () => {
    opts.splice(index, 1);
    renderRight();
  });
  row.appendChild(delBtn);
  return row;
}

// ── Preset management API actions ─────────────────────────────
function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function createPresetSection(presetId) {
  try {
    await api("POST", "/prompts/" + presetId + "/sections", {
      identifier: generateId(),
      name: "New Section",
      content: "",
      role: "system",
    });
    await loadPresetFull(presetId);
    renderRight();
    renderMiddle();
    showToast("Section created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create section failed", err);
    showToast("Failed to create section", "error");
  }
}

async function createPresetMarker(presetId, name, type) {
  try {
    await api("POST", "/prompts/" + presetId + "/sections", {
      identifier: generateId(),
      name: name || "New Marker",
      content: "",
      role: "system",
      isMarker: true,
      markerConfig: { type: type || "world_info_before" },
    });
    await loadPresetFull(presetId);
    renderRight();
    renderMiddle();
    showToast("Marker created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create marker failed", err);
    showToast("Failed to create marker", "error");
  }
}

async function deletePresetSection(presetId, sectionId, label) {
  const confirmed = await host
    .choice({
      title: "Delete section?",
      message: 'Permanently delete "' + label + '"? This cannot be undone.',
      choices: [{ key: "delete", label: "Delete", tone: "destructive" }],
      layout: "row",
    })
    .then((key) => key === "delete");
  if (!confirmed) return;
  try {
    await api("DELETE", "/prompts/" + presetId + "/sections/" + sectionId);
    await loadPresetFull(presetId);
    renderRight();
    renderMiddle();
    showToast("Section deleted", "success");
  } catch (err) {
    console.error("[kolache-AIO] Delete section failed", err);
    showToast("Failed to delete section", "error");
  }
}

async function reorderPresetSections(presetId, sectionIds) {
  try {
    await api("PUT", "/prompts/" + presetId + "/sections/reorder", { sectionIds });
    await loadPresetFull(presetId);
    renderRight();
    renderMiddle();
  } catch (err) {
    console.error("[kolache-AIO] Reorder sections failed", err);
    showToast("Failed to reorder sections", "error");
  }
}

async function createPresetGroup(presetId) {
  try {
    await api("POST", "/prompts/" + presetId + "/groups", { name: "New Group" });
    await loadPresetFull(presetId);
    renderRight();
    showToast("Group created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create group failed", err);
    showToast("Failed to create group", "error");
  }
}

async function renamePresetGroup(presetId, groupId, name) {
  try {
    await api("PATCH", "/prompts/" + presetId + "/groups/" + groupId, { name });
    await loadPresetFull(presetId);
    renderMiddle();
  } catch (err) {
    console.error("[kolache-AIO] Rename group failed", err);
  }
}

async function deletePresetGroup(presetId, groupId) {
  try {
    await api("DELETE", "/prompts/" + presetId + "/groups/" + groupId);
    await loadPresetFull(presetId);
    if (state.presetGroupBatchAdd.groupId === groupId) {
      state.presetGroupBatchAdd = { groupId: null, selected: new Set() };
    }
    renderRight();
    renderMiddle();
    showToast("Group deleted", "success");
  } catch (err) {
    console.error("[kolache-AIO] Delete group failed", err);
    showToast("Failed to delete group", "error");
  }
}

async function createPresetVariable(presetId) {
  try {
    const result = await api("POST", "/prompts/" + presetId + "/variables", {
      variableName: "new_variable",
      question: "Select an option",
      options: [{ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), label: "Option 1", value: "" }],
    });
    await loadPresetFull(presetId);
    if (result && result.id) state.presetExpandedVariableId = result.id;
    renderRight();
    showToast("Variable created", "success");
  } catch (err) {
    console.error("[kolache-AIO] Create variable failed", err);
    showToast("Failed to create variable", "error");
  }
}

async function deletePresetVariable(presetId, variableId) {
  const confirmed = await host
    .choice({
      title: "Delete variable?",
      message: "Permanently delete this variable? Any {{macro}} references to it in sections will stop resolving.",
      choices: [{ key: "delete", label: "Delete", tone: "destructive" }],
      layout: "row",
    })
    .then((key) => key === "delete");
  if (!confirmed) return;
  try {
    await api("DELETE", "/prompts/" + presetId + "/variables/" + variableId);
    await loadPresetFull(presetId);
    if (state.presetExpandedVariableId === variableId) state.presetExpandedVariableId = null;
    renderRight();
    showToast("Variable deleted", "success");
  } catch (err) {
    console.error("[kolache-AIO] Delete variable failed", err);
    showToast("Failed to delete variable", "error");
  }
}

// ── Drag-and-drop state for simulated prompt section reordering ──
let draggedSectionId = null;

function escapeHTML(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// ── Prompt Inspector ────────────────────────────────────────────
// Captures the entire prompt for the active chat as it would be sent to the
// API (via the engine's dry-run preview), or a structural preview of the
// console's current selection when history is omitted or no chat is open.

// The Marinara client persists the open chat's id to localStorage as a bare
// string; the key is removed when no chat is open.
function getActiveChatId() {
  try {
    return host.activeChatId() || null;
  } catch {
    return null;
  }
}

// ── Chat summary exporter ───────────────────────────────────────
// Bulk-extracts every stored chat summary in one GET /chats. This reads the
// chat rows directly, so unlike Inspect it is *not* mode-gated: the engine only
// injects metadata.summary into roleplay prompts (roleplay-summary-retrieval
// returns null for other modes), but conversation and game chats still keep
// their own tracks — daySummaries / weekSummaries and gamePreviousSessionSummaries
// — and those come back on the very same response.

// Stored summary values are loosely typed across the three tracks: a bare
// string, a { summary, keyDetails } day/week entry, or a game SessionSummary.
function summaryEntryText(v) {
  if (typeof v === "string") return v.trim();
  if (!v || typeof v !== "object") return "";
  const parts = [v.title, v.summary, v.text, v.resumePoint];
  const joined = parts
    .filter((p) => typeof p === "string" && p.trim())
    .join("\n")
    .trim();
  if (joined) return joined;
  // Last resort: keep the data rather than rendering "[object Object]".
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function summaryTrackList(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    // day/week summaries are keyed maps; sort so exports are stable.
    return Object.keys(v)
      .sort()
      .map((k) => ({ key: k, value: v[k] }));
  }
  return [];
}

// Pull every summary track off one chat row. Returns null when the chat has none.
function readChatSummaryTracks(chat) {
  const meta = tryParseJSON(chat && chat.metadata, {}) || {};
  const rolling = typeof meta.summary === "string" ? meta.summary.trim() : "";
  const entries = Array.isArray(meta.summaryEntries) ? meta.summaryEntries : [];
  const day = summaryTrackList(meta.daySummaries);
  const week = summaryTrackList(meta.weekSummaries);
  const session = summaryTrackList(meta.gamePreviousSessionSummaries);
  if (!rolling && !entries.length && !day.length && !week.length && !session.length) return null;
  return {
    id: chat.id,
    name: (chat.name || "").trim() || "(unnamed chat)",
    mode: chat.mode || "roleplay",
    updatedAt: chat.updatedAt || null,
    rolling,
    entries,
    // A legacy entry with no `enabled` field counts as enabled, matching the
    // engine's own normalizer.
    enabledCount: entries.filter((e) => e && e.enabled !== false).length,
    day,
    week,
    session,
  };
}

async function openSummaryExporter() {
  let chats;
  try {
    chats = await api("GET", "/chats/");
  } catch (e) {
    showToast("Couldn't load chats — " + (e && e.message ? e.message : "see console"), "error");
    return;
  }
  const list = Array.isArray(chats) ? chats : [];
  const rows = list.map(readChatSummaryTracks).filter(Boolean);
  showSummaryExportModal(rows, list.length);
}

function buildSummaryExportMarkdown(rows) {
  const out = ["# Chat summaries", "", "Exported from Marinara's Prompt viewer.", ""];
  for (const r of rows) {
    out.push("## " + r.name, "", "- Chat ID: `" + r.id + "`", "- Mode: " + r.mode);
    if (r.updatedAt) out.push("- Updated: " + r.updatedAt);
    out.push("");
    if (r.rolling) out.push("### Rolling summary", "", r.rolling, "");
    if (r.entries.length) {
      out.push("### Entries (" + r.enabledCount + " enabled of " + r.entries.length + ")", "");
      r.entries.forEach((e, i) => {
        const text = summaryEntryText(e && (e.text !== undefined ? e.text : e));
        out.push("#### Entry " + (i + 1) + (e && e.enabled === false ? " — DISABLED" : ""), "", text, "");
      });
    }
    for (const [label, track] of [
      ["Day summaries", r.day],
      ["Week summaries", r.week],
      ["Session summaries", r.session],
    ]) {
      if (!track.length) continue;
      out.push("### " + label + " (" + track.length + ")", "");
      track.forEach((item, i) => {
        const keyed = item && item.key !== undefined;
        out.push(
          "#### " + (keyed ? item.key : "Session " + (i + 1)),
          "",
          summaryEntryText(keyed ? item.value : item),
          "",
        );
      });
    }
  }
  return out.join("\n");
}

function buildSummaryExportJSON(rows, scanned) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      chatsScanned: scanned,
      chatsWithSummaries: rows.length,
      // `summary` is the engine's compiled text of ENABLED entries only, so the
      // raw entries are kept alongside it rather than derived from it.
      note: "summary is compiled from enabled entries only; summaryEntries is authoritative.",
      chats: rows.map((r) => ({
        id: r.id,
        name: r.name,
        mode: r.mode,
        updatedAt: r.updatedAt,
        summary: r.rolling || null,
        summaryEntries: r.entries,
        daySummaries: r.day,
        weekSummaries: r.week,
        sessionSummaries: r.session,
      })),
    },
    null,
    2,
  );
}

// The console runs in the page, so a Blob download works; clipboard is the
// fallback when the browser blocks it (or the payload is too big to copy).
function downloadTextFile(name, text, mime) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

async function copySummaryExport(text, fallbackName, mime) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied " + text.length.toLocaleString() + " characters", "success");
  } catch {
    if (downloadTextFile(fallbackName, text, mime)) showToast("Too big to copy — downloaded instead", "info");
    else showToast("Copy failed — clipboard blocked", "error");
  }
}

function showSummaryExportModal(rows, scanned) {
  const shell = overlayEl && overlayEl.querySelector(".kaio-shell");
  if (!shell) return;
  const prev = shell.querySelector(".kaio-pi-bg");
  if (prev) {
    if (typeof prev._kaioClose === "function") prev._kaioClose();
    else prev.remove();
  }

  const bg = document.createElement("div");
  bg.className = "kaio-pi-bg";
  bg.innerHTML = `
    <div class="kaio-pi-modal" role="region" aria-label="Chat summaries">
      <div class="kaio-pi-head">
        <span class="kaio-pi-title">Chat summaries</span>
        <span class="kaio-pi-badge"></span>
        <span class="kaio-spacer"></span>
        <div class="kaio-pi-actions">
          <button class="kaio-btn" data-sx="md" title="Copy every summary as readable Markdown">Copy Markdown</button>
          <button class="kaio-btn" data-sx="json" title="Copy as structured JSON, including disabled entries">Copy JSON</button>
          <button class="kaio-btn kaio-btn-ghost" data-sx="dl-md" title="Download as a .md file">${ico("download")}.md</button>
          <button class="kaio-btn kaio-btn-ghost" data-sx="dl-json" title="Download as a .json file">${ico("download")}.json</button>
        </div>
        <button type="button" class="kaio-iconbtn kaio-back" data-pi="close" title="Back (Esc)">${ico("back")}<span class="kaio-btn-text">Back</span></button>
      </div>
      <div class="kaio-pi-body"></div>
    </div>`;
  shell.appendChild(bg);

  const body = bg.querySelector(".kaio-pi-body");
  const totalEntries = rows.reduce((n, r) => n + r.entries.length + r.day.length + r.week.length + r.session.length, 0);
  const totalChars = rows.reduce((n, r) => n + r.rolling.length, 0);
  bg.querySelector(".kaio-pi-badge").textContent =
    rows.length +
    " of " +
    scanned +
    " chats · " +
    totalEntries +
    " entries · " +
    totalChars.toLocaleString() +
    " chars";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "kaio-pi-empty";
    empty.textContent = scanned
      ? "None of your " +
        scanned +
        " chats have a stored summary yet. (Marinara's own internal assistant chat is never returned by this endpoint.)"
      : "The engine returned no chats.";
    body.appendChild(empty);
  }

  // User data goes in as textContent throughout — summaries are free text.
  for (const r of rows) {
    const card = document.createElement("div");
    card.className = "kaio-pi-msg";

    const head = document.createElement("div");
    head.className = "kaio-pi-msg-role";
    head.textContent = r.name + "  ·  " + r.mode;
    card.appendChild(head);

    const bits = [];
    if (r.rolling) bits.push(r.rolling.length.toLocaleString() + " chars");
    if (r.entries.length) bits.push(r.entries.length + " entries (" + r.enabledCount + " enabled)");
    if (r.day.length) bits.push(r.day.length + " day");
    if (r.week.length) bits.push(r.week.length + " week");
    if (r.session.length) bits.push(r.session.length + " session");
    const meta = document.createElement("div");
    meta.className = "kaio-group-note";
    meta.textContent = bits.join(" · ");
    card.appendChild(meta);

    const preview = document.createElement("div");
    preview.className = "kaio-pi-pre";
    const first =
      r.rolling ||
      summaryEntryText(
        (r.entries[0] && (r.entries[0].text !== undefined ? r.entries[0].text : r.entries[0])) ||
          (r.day[0] && r.day[0].value) ||
          (r.week[0] && r.week[0].value) ||
          r.session[0] ||
          "",
      );
    preview.textContent = first.length > 240 ? first.slice(0, 240) + "…" : first;
    card.appendChild(preview);

    body.appendChild(card);
  }

  const md = () => buildSummaryExportMarkdown(rows);
  const js = () => buildSummaryExportJSON(rows, scanned);
  bg.querySelector('[data-sx="md"]').addEventListener("click", () =>
    copySummaryExport(md(), "chat-summaries.md", "text/markdown"),
  );
  bg.querySelector('[data-sx="json"]').addEventListener("click", () =>
    copySummaryExport(js(), "chat-summaries.json", "application/json"),
  );
  bg.querySelector('[data-sx="dl-md"]').addEventListener("click", () => {
    if (!downloadTextFile("chat-summaries.md", md(), "text/markdown"))
      showToast("Download blocked by the browser", "error");
  });
  bg.querySelector('[data-sx="dl-json"]').addEventListener("click", () => {
    if (!downloadTextFile("chat-summaries.json", js(), "application/json"))
      showToast("Download blocked by the browser", "error");
  });

  function close() {
    document.removeEventListener("keydown", onKey, true);
    bg.remove();
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }
  bg._kaioClose = close; // let closeConsoleNow tear this down cleanly
  document.addEventListener("keydown", onKey, true);
  bg.querySelector('[data-pi="close"]').addEventListener("click", close);
  bg.addEventListener("click", (e) => {
    if (e.target === bg) close();
  });
}

// ── AIO settings (persisted in localStorage) ────────────────────
const KAIO_SETTINGS_KEY = "kaio-settings";
const KAIO_DEFAULT_SETTINGS = {
  connectionlessHistoryLimit: 0,
  inspectHistoryDefault: "ask",
  // Simulated Prompt column — clutter toggles (default on).
  showMiddleSearch: true,
  showTokenEstimates: true,
  showGroupBadges: true,
  showFolderBadges: true,
  piShowRoleLabels: false,
  piColorSystem: "#22d3ee", // cyan
  piColorAssistant: "#e879f9", // magenta
  piColorUser: "#facc15", // yellow
  piBorderWidth: 3,
};
function getSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KAIO_SETTINGS_KEY) || "{}");
    return { ...KAIO_DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    return { ...KAIO_DEFAULT_SETTINGS };
  }
}
function setSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  try {
    localStorage.setItem(KAIO_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
// Boolean settings are ON unless explicitly stored false (safe default-on).
function settingOn(key) {
  return getSettings()[key] !== false;
}

function showSettings() {
  const shell = overlayEl && overlayEl.querySelector(".kaio-shell");
  if (!shell) return;
  const prev = shell.querySelector(".kaio-settings-bg");
  if (prev) {
    if (typeof prev._kaioClose === "function") prev._kaioClose();
    else prev.remove();
  }

  const s = getSettings();
  const bg = document.createElement("div");
  bg.className = "kaio-settings-bg";
  bg.innerHTML = `
    <div class="kaio-settings" role="region" aria-label="Prompt viewer settings">
      <div class="kaio-settings-head">
        <span class="kaio-settings-title">Prompt viewer settings</span>
        <span class="kaio-spacer"></span>
        <button type="button" class="kaio-iconbtn kaio-back" data-set="close" title="Back (Esc)">${ico("back")}<span class="kaio-btn-text">Back</span></button>
      </div>
      <div class="kaio-settings-body">
        <div class="kaio-set-field">
          <label class="kaio-set-label" for="kaio-set-histdefault">Inspect — chat history default</label>
          <select id="kaio-set-histdefault" class="kaio-set-input kaio-set-select" data-set="histDefault">
            <option value="ask">Always ask</option>
            <option value="include">Include history</option>
            <option value="omit">Omit history</option>
          </select>
          <div class="kaio-set-hint">What Inspect does when a chat is open. "Always ask" shows the Include / Omit prompt each time.</div>
        </div>
        <div class="kaio-set-field">
          <label class="kaio-set-label" for="kaio-set-histlimit">Connection-free Inspect — max history messages</label>
          <input id="kaio-set-histlimit" type="number" min="0" step="1" class="kaio-set-input" data-set="historyLimit" />
          <div class="kaio-set-hint">When a chat has no API connection, the Prompt Inspector inserts the raw chat history. This caps how many of the most recent turns are shown. <strong>0 = all.</strong></div>
        </div>
        <div class="kaio-set-divider"></div>
        <div class="kaio-set-group-label">Simulated Prompt column</div>
        <div class="kaio-set-field">
          <label class="kaio-set-checkrow">
            <input type="checkbox" data-set="showSearch" />
            <span class="kaio-set-label">Show the filter / search bar</span>
          </label>
        </div>
        <div class="kaio-set-field">
          <label class="kaio-set-checkrow">
            <input type="checkbox" data-set="showTokens" />
            <span class="kaio-set-label">Show token estimates</span>
          </label>
          <div class="kaio-set-hint">Per-block estimates and the context-usage gauge. <strong>Requires an active API connection</strong> — the gauge fills toward that connection's Max Context Window, so with no connection no estimates appear regardless of this toggle.</div>
        </div>
        <div class="kaio-set-field">
          <label class="kaio-set-checkrow">
            <input type="checkbox" data-set="showGroups" />
            <span class="kaio-set-label">Show group badges on prompt sections</span>
          </label>
        </div>
        <div class="kaio-set-field">
          <label class="kaio-set-checkrow">
            <input type="checkbox" data-set="showFolders" />
            <span class="kaio-set-label">Show folder badges on lorebook entries</span>
          </label>
        </div>
        <div class="kaio-set-divider"></div>
        <div class="kaio-set-group-label">Prompt Inspector appearance</div>
        <div class="kaio-set-field">
          <label class="kaio-set-checkrow">
            <input type="checkbox" data-set="roleLabels" />
            <span class="kaio-set-label">Show role labels (System / User / Assistant)</span>
          </label>
          <div class="kaio-set-hint">Off by default — roles are shown by the coloured left border instead.</div>
        </div>
        <div class="kaio-set-field">
          <span class="kaio-set-label">Role colours</span>
          <div class="kaio-set-colorrow">
            <label class="kaio-set-color"><input type="color" data-set="colorSystem" /> System</label>
            <label class="kaio-set-color"><input type="color" data-set="colorAssistant" /> Assistant</label>
            <label class="kaio-set-color"><input type="color" data-set="colorUser" /> User</label>
          </div>
        </div>
        <div class="kaio-set-field">
          <label class="kaio-set-label" for="kaio-set-borderw">Role border thickness (px)</label>
          <input id="kaio-set-borderw" type="number" min="1" max="16" step="1" class="kaio-set-input" data-set="borderWidth" />
          <div class="kaio-set-hint">Thicker borders can help tell roles apart at a glance.</div>
        </div>
      </div>
    </div>`;
  shell.appendChild(bg);

  const histDefault = bg.querySelector('[data-set="histDefault"]');
  histDefault.value = s.inspectHistoryDefault || "ask";
  histDefault.addEventListener("change", () => setSetting("inspectHistoryDefault", histDefault.value));

  const input = bg.querySelector('[data-set="historyLimit"]');
  input.value = String(s.connectionlessHistoryLimit || 0);
  const commit = () => {
    let v = parseInt(input.value, 10);
    if (!Number.isFinite(v) || v < 0) v = 0;
    input.value = String(v);
    setSetting("connectionlessHistoryLimit", v);
  };
  input.addEventListener("change", commit);

  // Simulated Prompt column toggles — each re-renders the middle column live.
  const colToggles = {
    showSearch: "showMiddleSearch",
    showTokens: "showTokenEstimates",
    showGroups: "showGroupBadges",
    showFolders: "showFolderBadges",
  };
  for (const attr of Object.keys(colToggles)) {
    const key = colToggles[attr];
    const el = bg.querySelector('[data-set="' + attr + '"]');
    el.checked = s[key] !== false; // default on
    el.addEventListener("change", () => {
      setSetting(key, el.checked);
      // Turning the search bar off should not strand an active filter.
      if (attr === "showSearch" && !el.checked) {
        state.middleFilter = "";
        const fi = overlayEl && overlayEl.querySelector('[data-action="filter"]');
        const fc = overlayEl && overlayEl.querySelector('[data-action="filter-clear"]');
        if (fi) fi.value = "";
        if (fc) fc.hidden = true;
      }
      renderMiddle();
    });
  }

  const roleLabels = bg.querySelector('[data-set="roleLabels"]');
  roleLabels.checked = !!s.piShowRoleLabels;
  roleLabels.addEventListener("change", () => setSetting("piShowRoleLabels", roleLabels.checked));

  const colorMap = { colorSystem: "piColorSystem", colorAssistant: "piColorAssistant", colorUser: "piColorUser" };
  for (const attr of Object.keys(colorMap)) {
    const el = bg.querySelector('[data-set="' + attr + '"]');
    el.value = s[colorMap[attr]] || KAIO_DEFAULT_SETTINGS[colorMap[attr]];
    el.addEventListener("input", () => setSetting(colorMap[attr], el.value));
  }

  const borderW = bg.querySelector('[data-set="borderWidth"]');
  borderW.value = String(s.piBorderWidth || 3);
  borderW.addEventListener("change", () => {
    let v = parseInt(borderW.value, 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    if (v > 16) v = 16;
    borderW.value = String(v);
    setSetting("piBorderWidth", v);
  });

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  }
  function close() {
    commit();
    document.removeEventListener("keydown", onKey, true);
    bg.remove();
  }
  bg._kaioClose = close;
  document.addEventListener("keydown", onKey, true);
  bg.querySelector('[data-set="close"]').addEventListener("click", close);
  bg.addEventListener("click", (e) => {
    if (e.target === bg) close();
  });
}

// Plain-text variant of blockPreviewHTML's variable substitution — no HTML,
// no <mark>. Non-variable macros ({{char}}, {{user}}, …) are left untouched.
function substituteVars(text, subs) {
  if (!text || !subs.length) return text || "";
  const pattern = subs.map((s) => `\\{\\{(?:getvar::)?${escapeRegex(s.name)}\\}\\}`).join("|");
  const re = new RegExp(pattern, "gi");
  return text.replace(re, (mm) => {
    const name = mm.slice(2, -2).replace(/^getvar::/i, "");
    const sub = subs.find((s) => s.name.toLowerCase() === name.toLowerCase());
    return sub ? sub.value : "";
  });
}

// Serialize the console's current selection (the Simulated Prompt assembly)
// into a flat, role-tagged message list. At the chat-history anchor:
//   • historyMessages omitted → a single {{chat_history}} placeholder with the
//     depth-injected blocks stacked above it (higher depth first). Used for the
//     "omit history" choice and the no-chat-open case.
//   • historyMessages provided (an array of {role, content}) → the real chat
//     turns, with each depth injection interleaved `depth` turns from the end
//     (depth 1 = just before the last turn), mirroring runtime depth injection.
//     Used as the connection-free fallback when the engine dry-run can't run.
function buildPromptMessagesFromSimulation(historyMessages) {
  const blocks = buildSimulatedPrompt();
  const subs = activeVariableSubs();
  const out = [];
  const roleOf = (b) => (b.section && b.section.role) || (b.entry && b.entry.role) || "system";
  const textOf = (b) => substituteVars(blockPreviewRaw(b), subs);

  for (const b of blocks) {
    if (b.kind === "chat-history") {
      const depth = [
        ...(b.depthSections || []).map((s) => ({
          role: s.role || "system",
          content: textOf({ kind: "section", section: s }),
          depth: s.injectionDepth ?? 0,
        })),
        ...(b.depthEntries || []).map((e) => ({
          role: e.role || "system",
          content: textOf({ kind: "lorebook-entry", entry: e }),
          depth: e.depth ?? 0,
        })),
      ].filter((d) => d.content);

      if (Array.isArray(historyMessages)) {
        const L = historyMessages.length;
        const byBoundary = {};
        for (const d of depth) {
          const idx = Math.max(0, Math.min(L, L - (d.depth || 0)));
          (byBoundary[idx] = byBoundary[idx] || []).push(d);
        }
        for (let i = 0; i <= L; i++) {
          for (const d of byBoundary[i] || []) {
            out.push({ role: d.role, content: d.content, depthInjection: true, depth: d.depth });
          }
          if (i < L) {
            const m = historyMessages[i] || {};
            const role = m.role === "user" || m.role === "assistant" ? m.role : "system";
            out.push({ role, content: m.content || "", isHistory: true });
          }
        }
      } else {
        depth.sort((x, y) => (y.depth ?? 0) - (x.depth ?? 0));
        for (const d of depth) {
          out.push({ role: d.role, content: d.content, depthInjection: true, depth: d.depth });
        }
        out.push({ role: "system", content: "{{chat_history}}", historyPlaceholder: true });
      }
      continue;
    }
    if (b.kind === "marker") continue; // runtime-only placeholder, no content
    if (b.kind === "group-info") continue; // UI banner, not prompt content
    const content = textOf(b);
    if (!content) continue;
    out.push({ role: roleOf(b), content });
  }
  return out;
}

// Fetch a chat's messages directly (no API connection required) for the
// connection-free history fallback. Returns [] on any failure.
async function fetchChatMessages(chatId) {
  try {
    const list = await api("GET", "/chats/" + chatId + "/messages");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("[kolache-AIO] couldn't load chat messages", e);
    return [];
  }
}

// Capture the prompt the engine would send for a chat, via the dry-run preview
// endpoint. Returns { messages, meta }. CSRF is added by Marinara's global fetch
// shim (same path as every other api() call).
//
// The chat summary, lorebook entries and tracker metadata are *explicit opt-ins*
// on this endpoint ("Optional prompt injections are explicit opt-ins", per the
// engine's own route docs) even though real generation always includes them —
// omit the flags and the capture silently drops all three.
//
// Even with them, a dry run is not byte-identical to a live send: it runs no
// agents or tools, and passes no chat embedding, so semantically-recalled
// lorebook entries can still differ.
async function dryRunPrompt(chatId) {
  const data = await api("POST", "/generate/dryRun", {
    chatId,
    returnPrompt: true,
    injectChatSummary: true,
    injectLorebook: true,
    injectTrackers: true,
  });
  const msgs = (data && data.prompt && data.prompt.messages) || [];
  const p = (data && data.parameters) || {};
  return {
    messages: msgs.map((m) => ({
      role: m.role,
      content: m.content || "",
      images: Array.isArray(m.images) ? m.images.length : 0,
      files: Array.isArray(m.files) ? m.files.length : 0,
    })),
    meta: {
      mode: "live",
      wrapFormat: data && data.prompt && data.prompt.wrapFormat,
      provider: p.provider,
      model: p.model,
      maxContext: p.maxContext,
    },
  };
}

// Include / Omit history dialog (only shown when a chat is open).
// Resolves "include" | "omit" | null (cancel).
function askIncludeHistory() {
  return host.choice({
    title: "Inspect prompt",
    message:
      "A chat is open. Include its chat history (fit to the preset's context limit) in the captured prompt, or omit it and show a placeholder instead?",
    choices: [
      { key: "include", label: "Include history" },
      { key: "omit", label: "Omit history" },
    ],
    layout: "row",
  });
}

let piBusy = false;
// Structural-preview meta, with a group-chat caveat when a multi-character
// group is selected — otherwise the modal stacks all member cards with no hint
// that (in Individual mode) the engine actually builds one card per turn.
function structuralMeta() {
  const m = { mode: "structural" };
  if (isGroupSelection()) {
    const gs = state.groupSettings;
    m.groupChat = true;
    m.groupNote =
      gs.mode === "individual"
        ? `Group chat (Individual): at runtime the engine builds ONE character per turn — it strips the other members' cards, relabels history, and ` +
          (gs.turnPromptEnabled ? `appends "Respond ONLY as <name>."` : `adds no per-turn instruction`) +
          `. The cards below are ALL members stacked for reference, not a single request; who responds is decided by "${gs.responseOrder}" order at generation time.`
        : `Group chat (Merged): all member cards are stacked into one character section and a single reply voices the whole scene` +
          (gs.speakerColors ? `, with each character's dialogue wrapped in <speaker="name"> tags.` : `.`);
  }
  return m;
}
async function openPromptInspector() {
  if (piBusy) return; // ignore re-entrant clicks while a dialog/capture is pending
  piBusy = true;
  try {
    const chatId = getActiveChatId();
    let messages, meta;
    if (chatId) {
      const def = getSettings().inspectHistoryDefault;
      const choice = def === "include" || def === "omit" ? def : await askIncludeHistory();
      if (!choice) return;
      if (choice === "include") {
        showToast("Capturing prompt…", "info");
        try {
          const res = await dryRunPrompt(chatId);
          messages = res.messages;
          meta = res.meta;
        } catch (e) {
          const errMsg = e && e.message ? String(e.message) : String(e);
          // The dry-run needs an API connection (to resolve the model + context
          // window). When the chat has none, fall back to a connection-free view:
          // fetch the raw chat history and interleave it into the structural
          // prompt. It isn't trimmed to a model context window, but it shows the
          // real turns (with depth prompts placed between them).
          if (/No API connection/i.test(errMsg)) {
            const all = await fetchChatMessages(chatId);
            const limit = getSettings().connectionlessHistoryLimit;
            const limited = limit > 0 && all.length > limit;
            const history = limited ? all.slice(-limit) : all;
            messages = buildPromptMessagesFromSimulation(history);
            meta = {
              mode: "structural",
              note:
                "No API connection on this chat, so this is a structural approximation — not the exact request. " +
                "Preset macros (e.g. {{user}}, {{char}}) are left unresolved, wrap formatting (XML/markdown) isn't applied, " +
                "the messages aren't merged/ordered exactly as the provider would receive them, and the history isn't " +
                "trimmed to a model's context window. Showing " +
                (limited ? "the most recent " + limit + " of " + all.length + " chat turns" : "the raw chat history") +
                " (cap in Settings). Add a connection and choose Include for the engine's resolved prompt — and Copy JSON for the real messages array.",
            };
          } else {
            console.error("[kolache-AIO] dryRun failed", e);
            showPromptInspectorModal([], { mode: "error", error: errMsg });
            return;
          }
        }
      } else {
        messages = buildPromptMessagesFromSimulation();
        meta = structuralMeta();
      }
    } else {
      messages = buildPromptMessagesFromSimulation();
      meta = structuralMeta();
    }
    showPromptInspectorModal(messages, meta);
  } finally {
    piBusy = false;
  }
}

// Visible-line-break preference, persisted across opens.
function piShowBreaks() {
  try {
    return localStorage.getItem("kaio-pi-breaks") === "1";
  } catch {
    return false;
  }
}
function setPiShowBreaks(v) {
  try {
    localStorage.setItem("kaio-pi-breaks", v ? "1" : "0");
  } catch {
    /* ignore */
  }
}
// View mode preference (plaintext default), persisted across opens.
function piView() {
  try {
    return localStorage.getItem("kaio-pi-view") === "json" ? "json" : "plaintext";
  } catch {
    return "plaintext";
  }
}
function setPiView(v) {
  try {
    localStorage.setItem("kaio-pi-view", v === "json" ? "json" : "plaintext");
  } catch {
    /* ignore */
  }
}
function piRoleLabel(role) {
  if (role === "user") return "User";
  if (role === "assistant") return "Assistant";
  return "System";
}

function showPromptInspectorModal(messages, meta) {
  const shell = overlayEl && overlayEl.querySelector(".kaio-shell");
  if (!shell) return;
  const prev = shell.querySelector(".kaio-pi-bg");
  if (prev) {
    if (typeof prev._kaioClose === "function") prev._kaioClose();
    else prev.remove();
  }

  const bg = document.createElement("div");
  bg.className = "kaio-pi-bg";
  bg.innerHTML = `
    <div class="kaio-pi-modal" role="region" aria-label="Inspect prompt">
      <div class="kaio-pi-head">
        <span class="kaio-pi-title">Inspect prompt</span>
        <span class="kaio-pi-badge"></span>
        <span class="kaio-spacer"></span>
        <div class="kaio-pi-actions">
          <button class="kaio-btn" data-pi="view" title="Toggle between plaintext and a JSON messages array (colour-coding kept either way)">{ } JSON</button>
          <button class="kaio-btn kaio-btn-ghost" data-pi="breaks" title="Toggle visible line breaks">¶ Line breaks</button>
          <button class="kaio-btn" data-pi="copy" title="Copy as readable text (### role headers — not the wire format)">Copy</button>
          <button class="kaio-btn" data-pi="copyjson" title="Copy the messages array as JSON — the structure actually sent to chat APIs">Copy JSON</button>
        </div>
        <button type="button" class="kaio-iconbtn kaio-back" data-pi="close" title="Back (Esc)">${ico("back")}<span class="kaio-btn-text">Back</span></button>
      </div>
      <div class="kaio-pi-body"></div>
    </div>`;
  shell.appendChild(bg);

  // Apply user appearance settings (role colours, border width, label visibility)
  // as CSS variables / a data-attr on the modal root.
  const piSettings = getSettings();
  const modal = bg.querySelector(".kaio-pi-modal");
  modal.style.setProperty("--pi-system", piSettings.piColorSystem || KAIO_DEFAULT_SETTINGS.piColorSystem);
  modal.style.setProperty("--pi-assistant", piSettings.piColorAssistant || KAIO_DEFAULT_SETTINGS.piColorAssistant);
  modal.style.setProperty("--pi-user", piSettings.piColorUser || KAIO_DEFAULT_SETTINGS.piColorUser);
  modal.style.setProperty("--pi-border-width", (piSettings.piBorderWidth || 3) + "px");
  modal.dataset.roleLabels = piSettings.piShowRoleLabels ? "true" : "false";

  const badge = bg.querySelector(".kaio-pi-badge");
  if (meta.mode === "live") {
    const bits = [];
    if (meta.provider || meta.model) bits.push(`${meta.provider ? meta.provider + "/" : ""}${meta.model || ""}`);
    if (meta.maxContext) bits.push(`ctx ${meta.maxContext}`);
    if (meta.wrapFormat) bits.push(meta.wrapFormat);
    badge.textContent = "Live · " + bits.join(" · ");
    badge.dataset.mode = "live";
  } else if (meta.mode === "error") {
    badge.textContent = "Live capture failed";
    badge.dataset.mode = "error";
  } else {
    badge.textContent = meta.note
      ? "Raw chat history · no connection"
      : meta.groupChat
        ? "Structural preview · group (" + (state.groupSettings.mode === "individual" ? "individual" : "merged") + ")"
        : "Structural preview · console selection";
    badge.dataset.mode = "structural";
  }
  if (settingOn("showTokenEstimates") && messages.length && meta.mode !== "error") {
    const piTokens = messages.reduce((n, m) => n + estimateTokens(m.content || ""), 0);
    badge.textContent += " · ~" + piTokens.toLocaleString() + " tok";
  }

  const body = bg.querySelector(".kaio-pi-body");
  const breaksBtn = bg.querySelector('[data-pi="breaks"]');
  const viewBtn = bg.querySelector('[data-pi="view"]');

  function renderBody() {
    const view = piView();
    const show = piShowBreaks();
    modal.dataset.view = view;
    viewBtn.dataset.active = view === "json" ? "true" : "";
    breaksBtn.dataset.active = show ? "true" : "";
    body.innerHTML = "";
    const noteText = meta.note || meta.groupNote;
    if (noteText) {
      const note = document.createElement("div");
      note.className = "kaio-pi-note";
      note.textContent = noteText;
      body.appendChild(note);
    }
    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "kaio-pi-empty";
      if (meta.mode === "error") {
        const title = document.createElement("div");
        title.className = "kaio-pi-error-title";
        title.textContent = "Couldn't capture the live prompt";
        const msg = document.createElement("pre");
        msg.className = "kaio-pi-error-msg";
        msg.textContent = meta.error || "Unknown error";
        const hint = document.createElement("div");
        hint.className = "kaio-pi-error-hint";
        hint.textContent =
          "403 → add this browser's origin to BOTH CORS_ORIGINS and CSRF_TRUSTED_ORIGINS in the engine .env. " +
          "400 → the chat has no API connection configured. " +
          '"Failed to fetch" → the request was blocked before reaching the server (CORS, or an interfering browser extension).';
        empty.appendChild(title);
        empty.appendChild(msg);
        empty.appendChild(hint);
      } else {
        empty.textContent =
          meta.mode === "structural"
            ? "Nothing to preview yet — open Sources and pick a preset (plus optional character, persona, and lorebook entries) to see its assembled structure."
            : "The engine returned an empty prompt.";
      }
      body.appendChild(empty);
      return;
    }
    if (view === "json") {
      const open = document.createElement("div");
      open.className = "kaio-pi-json-bracket";
      open.textContent = "[";
      body.appendChild(open);
    }
    messages.forEach((m, i) => {
      const blk = document.createElement("div");
      blk.className = "kaio-pi-msg";
      blk.dataset.role = m.role || "system";
      if (m.historyPlaceholder) blk.dataset.placeholder = "true";
      if (m.depthInjection) blk.dataset.depth = "true";

      const label = document.createElement("div");
      label.className = "kaio-pi-msg-role";
      let labelText = m.historyPlaceholder
        ? "Chat history"
        : piRoleLabel(m.role) + (m.depthInjection ? " · depth " + (m.depth ?? 0) : "");
      const att = [];
      if (m.images) att.push(m.images + " img");
      if (m.files) att.push(m.files + " file");
      if (att.length) labelText += " · " + att.join(", ");
      label.textContent = labelText;

      const pre = document.createElement("pre");
      pre.className = "kaio-pi-pre";
      if (view === "json") {
        // Per-message JSON object, colour-coded by the block's left border.
        // Copy JSON still yields the full valid array; this view keeps the
        // role colour-coding for visual comprehension.
        const obj = { role: m.role || "system", content: m.content || "" };
        pre.textContent = JSON.stringify(obj, null, 2) + (i < messages.length - 1 ? "," : "");
      } else {
        const content = m.content || "";
        pre.textContent = show ? content.replace(/\n/g, "↵\n") : content;
      }

      blk.appendChild(label);
      blk.appendChild(pre);
      body.appendChild(blk);
    });
    if (view === "json") {
      const close = document.createElement("div");
      close.className = "kaio-pi-json-bracket";
      close.textContent = "]";
      body.appendChild(close);
    }
  }
  renderBody();

  breaksBtn.addEventListener("click", () => {
    setPiShowBreaks(!piShowBreaks());
    renderBody();
  });
  viewBtn.addEventListener("click", () => {
    setPiView(piView() === "json" ? "plaintext" : "json");
    renderBody();
  });
  bg.querySelector('[data-pi="copy"]').addEventListener("click", async () => {
    const text = messages
      .map((m) => {
        const head = m.historyPlaceholder
          ? "### Chat history"
          : "### " + piRoleLabel(m.role) + (m.depthInjection ? " (depth " + (m.depth ?? 0) + ")" : "");
        return head + "\n" + (m.content || "");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Prompt copied", "success");
    } catch {
      showToast("Copy failed — clipboard unavailable", "error");
    }
  });
  bg.querySelector('[data-pi="copyjson"]').addEventListener("click", async () => {
    const json = JSON.stringify(
      messages.map((m) => ({ role: m.role || "system", content: m.content || "" })),
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(json);
      showToast("Copied as JSON", "success");
    } catch {
      showToast("Copy failed — clipboard unavailable", "error");
    }
  });

  function onPiKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  }
  function close() {
    document.removeEventListener("keydown", onPiKey, true);
    bg.remove();
  }
  bg._kaioClose = close; // let closeConsoleNow tear this down cleanly
  document.addEventListener("keydown", onPiKey, true);
  bg.querySelector('[data-pi="close"]').addEventListener("click", close);
  bg.addEventListener("click", (e) => {
    if (e.target === bg) close();
  });
}

export { closeConsoleNow as closePromptViewerViews };
