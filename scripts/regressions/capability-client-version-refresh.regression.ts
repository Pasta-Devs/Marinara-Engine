import assert from "node:assert/strict";
import {
  beginCapabilityClientImport,
  capabilityClientNeedsRefresh,
  finishCapabilityClientImport,
  getCapabilityClientImport,
} from "../../packages/client/src/lib/capability-client-version";

assert.equal(
  capabilityClientNeedsRefresh("1.2.2", "1.2.3", true),
  true,
  "A registered client from an older package version must require a page refresh",
);
assert.equal(
  capabilityClientNeedsRefresh("1.2.3", "1.2.3", true),
  false,
  "A registered client at the installed version must remain ready",
);
assert.equal(
  capabilityClientNeedsRefresh(undefined, "1.2.3", false),
  false,
  "A fresh page must load the installed client without asking for another refresh",
);
assert.equal(
  capabilityClientNeedsRefresh("1.2.2", "1.2.3", false),
  false,
  "A stale version marker without a registered element can safely load the installed client",
);

assert.equal(
  beginCapabilityClientImport("hierarchical-maps", { version: "1.2.2", attempt: 0 }),
  true,
  "The first client import for a package must start",
);
assert.deepEqual(
  getCapabilityClientImport("hierarchical-maps"),
  { version: "1.2.2", attempt: 0 },
  "The active import must retain the exact package version and attempt",
);
assert.equal(
  beginCapabilityClientImport("hierarchical-maps", { version: "1.2.3", attempt: 0 }),
  false,
  "A newer version must wait while the older client import is still pending",
);
assert.equal(
  finishCapabilityClientImport("hierarchical-maps", { version: "1.2.3", attempt: 0 }),
  false,
  "A stale or mismatched completion must not clear another import",
);
assert.equal(
  finishCapabilityClientImport("hierarchical-maps", { version: "1.2.2", attempt: 0 }),
  true,
  "The matching completion must release the package import slot",
);
assert.equal(
  beginCapabilityClientImport("hierarchical-maps", { version: "1.2.3", attempt: 0 }),
  true,
  "The installed version can load after the older import settles without registering an element",
);
assert.equal(
  finishCapabilityClientImport("hierarchical-maps", { version: "1.2.3", attempt: 0 }),
  true,
  "The latest matching import must settle cleanly",
);

console.info("Capability client version refresh regression passed.");
