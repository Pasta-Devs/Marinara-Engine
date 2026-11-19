// The saved Home widget catalog: an empty catalog starts at revision 0, and timestamps that aren't ISO, executable
// fields and duplicate widget IDs are refused.
import assert from "node:assert/strict";
import { homeCustomWidgetCatalogSchema } from "../../../packages/shared/src/index.js";

assert.equal(homeCustomWidgetCatalogSchema.parse({ widgets: [] }).revision, 0);
assert.throws(() =>
  homeCustomWidgetCatalogSchema.parse({
    widgets: [
      {
        id: "bad-timestamp",
        title: "Bad timestamp",
        description: "Widget timestamps must use the ISO format emitted by the writer.",
        accent: "cyan",
        icon: "sparkles",
        createdAt: "yesterday",
        updatedAt: "today",
      },
    ],
  }),
);
assert.throws(() =>
  homeCustomWidgetCatalogSchema.parse({
    widgets: [
      {
        id: "unsafe-widget",
        title: "Unsafe",
        description: "No executable fields are allowed.",
        accent: "cyan",
        icon: "sparkles",
        html: "<script>alert(1)</script>",
        createdAt: "2026-08-09T00:00:00.000Z",
        updatedAt: "2026-08-09T00:00:00.000Z",
      },
    ],
  }),
);
assert.throws(
  () =>
    homeCustomWidgetCatalogSchema.parse({
      widgets: [
        {
          id: "duplicate-widget",
          title: "One",
          description: "First widget",
          accent: "cyan",
          icon: "note",
          createdAt: "2026-08-09T00:00:00.000Z",
          updatedAt: "2026-08-09T00:00:00.000Z",
        },
        {
          id: "duplicate-widget",
          title: "Two",
          description: "Second widget",
          accent: "pink",
          icon: "heart",
          createdAt: "2026-08-09T00:00:00.000Z",
          updatedAt: "2026-08-09T00:00:00.000Z",
        },
      ],
    }),
  /Widget IDs must be unique/u,
);
