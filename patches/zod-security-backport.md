# Temporary Zod 3.25.76 security backport

This is an explicit source backport for [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), based on the upper-size preflight behavior in [upstream Zod PR #6652](https://github.com/colinhacks/zod/pull/6652) ([commit a0ebf970](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)). It retains the actual `zod@3.25.76` package identity and API-1 package interface. It does not replace Zod 3 with a compatibility export hidden beneath a version 4 declaration.

The patch covers both parser generations shipped inside that package:

- Zod 3 arrays reject an existing maximum or exact upper length before element parsing; sets do the same for maximum/exact size. Zod 3 maps have no upper-size API.
- Bundled Zod 4.0.0 arrays, sets and maps reject existing leading upper-size checks before element parsing. Classic and Mini share this core. There is no separate collection compiler in this bundled release; object JIT delegates to child `_zod.run`, which the backport guards. Installation is deferred until constructor initialization finishes, and the guard returns before the old check loop can duplicate the bound issue.
- Both ESM and CJS runtimes and their TypeScript source inputs are patched. Public exports, package version and declarations stay unchanged.

## Intentional security behavior

Oversized constrained collections return one existing bound error before visiting their elements. They abort instead of remaining dirty: element effects and later parent refinements do not run, and unions may select a different error branch or return an `invalid_union` containing the bound error.

Bundled Zod 4 formerly allowed oversized raw sets/maps when value/key transforms collapsed them to a smaller output. This backport rejects those raw oversized collections before the transforms, matching upstream 4.6.7. Within-bound transforms/defaults and earlier preprocessing or overwriting stay intact. These are intentional validation changes, not a claim that every previously successful invalid-size input behaves identically.

Unbounded collections and nonleading Zod 4 checks remain unchanged, as in the upstream fix. No arbitrary collection, import/export or error-count limit is added. Endpoint-specific prevalidation remains necessary for exposed unbounded invalid input.

## Policy and regression guard

Engine core now uses native Zod 4.6.7. The explicit `zod-v3` dependency preserves the documented API-1 client slot and package-server imports, with this exact backport applied. It does not redirect Engine core validation to the legacy parser.

`node scripts/regressions/zod-security-backport.regression.mjs` imports the actual server-resolved compatibility alias, bundled v4 and Mini parsers in ESM and CJS. It verifies bounded sync/async rejection, valid/default/transform behavior, the Zod 3 interface, unchanged unlimited valid parsing, intentional set/map raw-size behavior, and object JIT/interpreter paths. It also verifies the native core version in all three workspaces.

The advisory-specific workspace exemption is valid only with the exact registered patch, matching frozen-lock patch hash, installed legacy version 3.25.76 and reviewed native version 4.6.7. The regression fails closed if those assumptions change. A stock 3.25.76 installation fails its runtime negative control. The exemption acknowledges a reviewed source backport; it does not assert that the upstream version is patched or suppress other advisories.

The [core migration #8221](https://github.com/Pasta-Devs/Marinara-Engine/issues/8221) keeps this patched compatibility interface explicit. Remove the patch and its one-advisory exemption when a genuinely patched compatible upstream release or a coordinated package SDK migration replaces the legacy interface. Reassess the patch if the advisory changes.
