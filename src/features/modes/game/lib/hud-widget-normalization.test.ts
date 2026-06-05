import { describe, expect, it } from "vitest";
import type { HudWidget } from "../../../../engine/contracts/types/game";
import { normalizeHudWidgets } from "./hud-widget-normalization";

type LegacyHudWidget = Omit<HudWidget, "position"> & { position: HudWidget["position"] | "hud_bottom" };

function widget(id: string, position: LegacyHudWidget["position"]): LegacyHudWidget {
  return {
    id,
    type: "counter",
    label: id,
    position,
    config: { count: 1 },
  };
}

describe("normalizeHudWidgets", () => {
  it("remaps legacy hud_bottom widgets onto alternating visible HUD columns", () => {
    const normalized = normalizeHudWidgets([widget("first", "hud_bottom"), widget("second", "hud_bottom")]);

    expect(normalized.map((entry) => entry.position)).toEqual(["hud_left", "hud_right"]);
  });

  it("preserves supported HUD positions while counting only legacy bottom widgets for alternation", () => {
    const normalized = normalizeHudWidgets([
      widget("left", "hud_left"),
      widget("legacy-a", "hud_bottom"),
      widget("right", "hud_right"),
      widget("legacy-b", "hud_bottom"),
    ]);

    expect(normalized.map((entry) => [entry.id, entry.position])).toEqual([
      ["left", "hud_left"],
      ["legacy-a", "hud_left"],
      ["right", "hud_right"],
      ["legacy-b", "hud_right"],
    ]);
  });

  it("migrates legacy inventory items when contents is malformed", () => {
    const normalized = normalizeHudWidgets([
      {
        ...widget("inventory", "hud_left"),
        type: "inventory_grid",
        config: {
          contents: "not-an-array" as never,
          items: [{ name: "Torch", quantity: "2" }] as never,
        },
      },
    ]);

    expect(normalized[0]?.config.contents).toEqual([{ name: "Torch", quantity: 2 }]);
  });
});
