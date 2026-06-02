# Classification Guide

Load this before classifying parityscan findings.

Use these labels consistently:

- `Confirmed regression`: legacy behavior exists, refactor intended to support the same user outcome, and current refactor evidence shows it is missing or broken.
- `Likely parity gap`: legacy has behavior that appears product-important and no refactor evidence shows a deliberate removal, but intent is not fully proven.
- `Legacy better`: both implementations support the outcome, but legacy has materially better UX, safety, data preservation, compatibility, validation, recovery, performance, or completeness.
- `Current refactor defect`: current refactor has a confirmed bug, performance cliff, hostability gap, or user-visible failure even when legacy evidence is absent or irrelevant.
- `Current refactor risk`: code shape strongly suggests a current defect, drift, or performance issue, but proof is static or incomplete.
- `Intentional divergence`: refactor deliberately changed the behavior, and the new direction is documented, architecturally necessary, or clearly better for the refactor product.
- `Unknown/product decision`: evidence shows a real difference, but intent or desired product behavior cannot be inferred safely.
- `Refactor better`: refactor is materially safer, simpler, more capable, or better aligned with architecture.

Do not call missing legacy-only behavior a regression just because it existed. Tie it to a current product goal, visible affordance, schema compatibility need, runtime dependency, or user workflow.

## Legacy Better Criteria

Call out where legacy performs better when at least one is true:

- It preserves or imports more user data.
- It exposes a complete workflow that refactor only partially exposes.
- It has stronger validation, clearer error handling, or safer recovery.
- It requires fewer awkward steps for a common user task.
- It makes important state visible that refactor hides.
- It handles edge cases refactor drops, such as missing assets, duplicate names, malformed imports, old schemas, or mode-specific runtime use.
- It connects the feature to generation/runtime behavior while refactor keeps it UI-only.
- It avoids broad fallbacks, fake success, silent catches, or broken contracts present in refactor.

Also note where refactor is better so the report does not become a one-way gap list.
