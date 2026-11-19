// Row buttons in the side panels and Connections: quiet until hovered, actions that overlay a desktop row and stay
// visible on touch (#4449), and the built-in model row's single action. Reads component source and CSS until a test can
// drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../../packages/client/src/${path}`, import.meta.url), "utf8");

// Row ⋯/download buttons must stay unfilled until hover. Theme and accent rules kept
// outranking the quiet rule by specificity and the bubbles came back, so it uses !important.
const css = read("styles/globals.css");
const quiet = css.match(
  /\.mari-chrome-control--quiet:not\(:hover\):not\(:focus-visible\):not\(\[aria-expanded="true"\]\) \{([^}]*)\}/,
);
assert.ok(quiet, "the quiet row-button rest rule exists");
assert.match(quiet[1], /background: transparent !important;/, "quiet buttons have no fill at rest");
assert.match(quiet[1], /border-color: transparent !important;/, "quiet buttons have no border at rest");

assert.match(
  read("components/connections/ConnectionRow.tsx"),
  /export const ROW_BUTTON = "[^"]*mari-chrome-control--quiet/,
  "row buttons use the quiet variant",
);

// The built-in model row offers one action per state, not a button, a one-item menu and a row click for the same thing.
const card = read("components/connections/DeviceDetail.tsx");
assert.doesNotMatch(card, /ContextMenu/, "no one-item ⋯ menu on the device card");

// #4449: desktop side-panel row actions overlay the row instead of narrowing its text, touch layouts keep room for always-visible actions, keyboard focus reveals them, Connection rows keep their actions visible with 44 px touch targets, and the Settings panel's Conversation Call and quick reply rows fit a narrow panel.
{
  const sidebarPanelSources = new Map(
    ["Characters", "Personas", "Lorebooks", "Agents", "Presets"].map((panelName) => [
      panelName,
      read(`components/panels/${panelName}Panel.tsx`),
    ]),
  );

  for (const [panelName, source] of sidebarPanelSources) {
    assert.match(
      source,
      /max-md:pr-(?:10|14|16|20|24|32|36|\[4\.5rem\]) \[@media\(pointer:coarse\)\]:pr-(?:10|14|16|20|24|32|36|\[4\.5rem\])/u,
      `${panelName} rows must reserve action space only for touch layouts`,
    );
    assert.doesNotMatch(
      source,
      /\[@media\(pointer:fine\)\]:group-hover:pr-/u,
      `${panelName} rows must not shrink their text area when desktop hover actions appear`,
    );
    assert.match(
      source,
      /pointer-events-none[^"\n]*group-hover(?:\/member)?:opacity-100[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:opacity-100[^"\n]*\[@media\(pointer:coarse\)\]:opacity-100[^"\n]*group-hover(?:\/member)?:\[&_button\]:pointer-events-auto[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:\[&_button\]:pointer-events-auto[^"\n]*max-md:\[&_button\]:pointer-events-auto[^"\n]*\[@media\(pointer:coarse\)\]:\[&_button\]:pointer-events-auto/u,
      `${panelName} action overlays must activate button hit targets only when their actions are visible`,
    );
    const hiddenActionOverlayCount = source.match(/pointer-events-none[^"\n]*opacity-0/gu)?.length ?? 0;
    const focusVisibleOverlayCount =
      source.match(/pointer-events-none[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:opacity-100/gu)
        ?.length ?? 0;
    const focusInteractiveOverlayCount =
      source.match(
        /pointer-events-none[^"\n]*\[@media\(pointer:fine\)\]:group-focus-within(?:\/member)?:(?:\[&_button\]:)?pointer-events-auto/gu,
      )?.length ?? 0;
    assert.equal(
      focusVisibleOverlayCount,
      hiddenActionOverlayCount,
      `${panelName} must reveal every fine-pointer action overlay while it contains keyboard focus`,
    );
    assert.equal(
      focusInteractiveOverlayCount,
      hiddenActionOverlayCount,
      `${panelName} must keep every focused fine-pointer action overlay interactive`,
    );
  }

  // Connection Model rows (variant D): the star and "…" stay visible, so nothing overlays the row, and touch
  // layouts get 44 px targets.
  const connectionRowSource = read("components/connections/ConnectionRow.tsx");
  const modelRowSource = read("components/connections/ModelRow.tsx");
  for (const source of [connectionRowSource, modelRowSource]) {
    assert.doesNotMatch(source, /opacity-0|group-hover:/u, "Connection rows must not hide actions behind hover");
  }
  // Row buttons use the shared chrome icon class, which grows to 44 px on phones and touch screens.
  assert.match(connectionRowSource, /ROW_BUTTON = "mari-chrome-control[^"]*mari-chrome-control--icon[^"]*"/u);
  const connectionStyles = read("styles/globals.css");
  assert.match(
    connectionStyles,
    /@media \(max-width: 47\.9375rem\), \(pointer: coarse\) \{[^}]*\.mari-connection-scope \.mari-chrome-control[^}]*min-height: 2\.75rem/u,
  );
  assert.match(
    connectionStyles,
    /@media \(max-width: 47\.9375rem\), \(pointer: coarse\) \{[\s\S]*?\.mari-connection-scope \.mari-chrome-control--icon \{[^}]*width: 2\.75rem/u,
    "Connection icon buttons must retain a 44 px touch width",
  );

  const personasPanelSource = sidebarPanelSources.get("Personas")!;
  const charactersPanelSource = sidebarPanelSources.get("Characters")!;
  const presetsPanelSource = sidebarPanelSources.get("Presets")!;
  for (const panelName of ["Characters", "Personas", "Lorebooks", "Agents", "Presets"]) {
    assert.match(
      sidebarPanelSources.get(panelName)!,
      /group relative flex cursor-pointer[^"\n]*max-md:pr-12 \[@media\(pointer:coarse\)\]:pr-12/u,
      `${panelName} folder headers must reserve space for always-visible touch actions`,
    );
  }
  assert.match(
    charactersPanelSource,
    /pr-0 max-md:pr-32 \[@media\(pointer:coarse\)\]:pr-32/u,
    "Character rows must match their coarse-pointer padding to the desktop-width action toolbar",
  );
  assert.match(
    charactersPanelSource,
    /group-hover\/member:opacity-100[^"\n]*max-md:static max-md:translate-y-0[^"\n]*\[@media\(pointer:coarse\)\]:static \[@media\(pointer:coarse\)\]:translate-y-0/u,
    "Character folder-member actions must participate in touch layout instead of overflowing their row",
  );
  assert.match(
    presetsPanelSource,
    /max-md:pr-36 \[@media\(pointer:coarse\)\]:pr-36/u,
    "Preset rows must reserve space for the complete selected-preset touch toolbar",
  );
  assert.match(
    charactersPanelSource,
    /data-character-row-name\s+className="w-fit max-w-full truncate/u,
    "Character names must keep a content-sized click target beneath overlaid actions",
  );
  assert.match(
    personasPanelSource,
    /className="w-fit max-w-full truncate text-sm font-medium">\{persona\.name\}/u,
    "Persona names must keep a content-sized click target beneath overlaid actions",
  );
  assert.match(
    charactersPanelSource,
    /data-touch-drag-card="character"[\s\S]*?onKeyDown=\{\(e\) => \{\s*if \(e\.target !== e\.currentTarget\) return;/u,
    "Character folder rows must preserve descendant action-button keyboard events",
  );
  assert.match(
    personasPanelSource,
    /data-touch-drag-card="persona"[\s\S]*?onKeyDown=\{\(e\) => \{\s*if \(e\.target !== e\.currentTarget\) return;/u,
    "Persona folder rows must preserve descendant action-button keyboard events",
  );
  assert.match(
    personasPanelSource,
    /group group\/member relative flex/u,
    "Persona folder rows must establish the positioning context for overlaid actions",
  );
  assert.match(
    personasPanelSource,
    /absolute right-1 top-1\/2 flex -translate-y-1\/2 items-center/u,
    "Persona folder actions must overlay their row instead of occupying flex width",
  );

  const settingsPanelSource = read("components/panels/SettingsPanel.tsx");
  assert.match(
    settingsPanelSource,
    /grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,10rem\),1fr\)\)\]/u,
    "Conversation Call clip rows must wrap from the panel width instead of a viewport breakpoint",
  );
  assert.equal(
    settingsPanelSource.match(/w-\[3\.75rem\] grid-cols-\[minmax\(0,1fr\)_auto\]/gu)?.length,
    2,
    "Conversation Call generated and custom clip duration controls must share the compact width",
  );
  assert.match(
    settingsPanelSource,
    /id="quick-replies-actions-drawer"[\s\S]{0,180}grid min-w-0 max-w-full[\s\S]{0,80}overflow-hidden/u,
    "Quick reply actions must shrink within narrow settings panels",
  );
  assert.match(
    settingsPanelSource,
    /CustomQuickRepliesManager[\s\S]{0,900}mt-1 min-w-0 max-w-full overflow-hidden/u,
    "Custom quick replies must contain their fields and destructive controls at narrow widths",
  );
}
console.log("quiet row buttons: OK");
