// Capability API 1.820: a package that declares the `chat-activity` slot gets its `activity` view mounted in the
// Agent activity panel, once for the chat drawer and the Tracker Panel; an unknown slot is still refused.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const { capabilityPackageManifestSchema, supportedCapabilityApi } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");

const manifest = (slots: string[]) => ({
  schemaVersion: 2,
  id: "activity-probe",
  name: "Activity probe",
  version: "1.0.0",
  description: "",
  engine: { min: "2.4.0", maxExclusive: "3.0.0" },
  kind: ["agent"],
  entrypoints: { client: "client.js" },
  contributions: { slots },
  files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }],
  permissions: [],
  restartRequired: false,
  capabilityApi: { major: 1, minor: 820 },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
});

assert.ok(supportedCapabilityApi.minor >= 820, "the host supports the chat-activity slot's Capability API");
assert.deepEqual(capabilityPackageManifestSchema.parse(manifest(["chat-activity"])).contributions?.slots, [
  "chat-activity",
]);
assert.throws(() => capabilityPackageManifestSchema.parse(manifest(["chat-activty"])), "an unknown slot is refused");

const menu = read("packages/client/src/components/chat/RoleplayHUDActionsMenu.tsx");
assert.match(
  menu,
  /item\.status === "active" &&\s*enabledAgentTypes\?\.has\(item\.id\) &&/u,
  "only packages the chat runs",
);
assert.match(menu, /item\.manifest\.contributions\?\.slots\?\.includes\("chat-activity"\)/u);
assert.match(
  menu,
  /<CapabilityElement\s+key=\{item\.id\}\s+packageId=\{item\.id\}\s+view="activity"[\s\S]*?chatId,\s+onOpenAgentSettings:[\s\S]*?className="contents"/u,
  "the menu mounts each package's activity view without wrapper chrome",
);
assert.match(
  menu,
  /const hasAnyActivity =\s*chatActivityPackages\.length > 0 \|\|/u,
  "a card replaces the empty state",
);
// The panel is mounted once in the menu; both hosts render it.
assert.match(
  read("packages/client/src/components/agents/AgentActivitySection.tsx"),
  /<RoleplayHUDActionsMenu\b/u,
  "the chat's activity section renders the menu",
);
assert.match(
  read("packages/client/src/features/tracker-panel/components/TrackerAgentActivitySection.tsx"),
  /<AgentActivitySection\b/u,
  "the Tracker Panel's activity section renders the chat's",
);

console.log("capability chat activity slot regression passed");
