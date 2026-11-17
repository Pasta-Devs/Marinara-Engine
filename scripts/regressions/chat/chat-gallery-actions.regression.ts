// The chat gallery's actions: scene videos delete through the chat-scoped route, and batch select, download and
// delete, with a guard against a second batch while one runs. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chatGallerySource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatGallery.tsx", import.meta.url),
  "utf8",
);
const galleryHooksSource = readFileSync(
  new URL("../../../packages/client/src/hooks/use-gallery.ts", import.meta.url),
  "utf8",
);
assert.match(galleryHooksSource, /api\.delete\(`\/gallery\/scene-videos\/\$\{chatId\}\/\$\{videoId\}`\)/u);
assert.match(chatGallerySource, /handleDeleteVideo\(video\)/u);
assert.match(chatGallerySource, /ui\.chat\.chatgallery\.deleteSceneVideo/u);
assert.match(chatGallerySource, /const \[selectingImages, setSelectingImages\] = useState\(false\)/u);
assert.match(chatGallerySource, /const selectableImageIds = useMemo/u);
assert.match(chatGallerySource, /handleBatchDownload/u);
assert.match(chatGallerySource, /handleBatchDelete/u);
assert.match(chatGallerySource, /ui\.gallery\.batch\.deletePartial/u);
assert.match(chatGallerySource, /batchOperationPendingRef\.current/u);
assert.equal(
  chatGallerySource.match(/disabled=\{selectedImages\.length === 0 \|\| batchOperationPending\}/gu)?.length,
  2,
  "both chat Gallery batch actions remain disabled while an operation is pending",
);
assert.match(chatGallerySource, /ui\.gallery\.batch\.toggleImageNamed/u);
assert.match(chatGallerySource, /asset\.id\.startsWith\("chat-gallery:"\)[\s\S]{0,120}: asset\.id/u);
assert.doesNotMatch(chatGallerySource, /bg-red-500/u);
assert.match(chatGallerySource, /ui\.chat\.chatgallery\.deleteGalleryImage[\s\S]{0,180}mari-chrome-accent-surface/u);
assert.match(
  chatGallerySource,
  /handleDeleteVideo\(video\)[\s\S]{0,240}ui\.chat\.chatgallery\.deleteSceneVideo[\s\S]{0,240}mari-chrome-accent-surface/u,
);
assert.match(
  chatGallerySource,
  /onClick=\{\(\) => handleDelete\(confirmDeleteId\)\}[\s\S]{0,180}mari-chrome-accent-surface/u,
);
