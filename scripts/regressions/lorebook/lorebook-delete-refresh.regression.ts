// Deleting a lorebook refreshes the cached chats, so it leaves active context at once. Reads hook source; replacing
// this needs a browser test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lorebookHooksSource = readFileSync(
  new URL("../../../packages/client/src/hooks/use-lorebooks.ts", import.meta.url),
  "utf8",
);
assert.match(
  lorebookHooksSource,
  /useDeleteLorebook\(\)[\s\S]{0,900}invalidateQueries\(\{ queryKey: \["chats"\] \}\)/u,
  "Deleting a lorebook must refresh cached chat metadata so it leaves active context immediately",
);
