// ──────────────────────────────────────────────
// UI overhaul: Library > Assets > Game assets
//
// The game asset browser as a Library page (music, sound effects, sprites, backgrounds),
// instead of the classic full-screen overlay. The browser keeps its tree, grid, uploads,
// menus and viewers; variant="page" gives it the Library header and the in-pane editor.
// ──────────────────────────────────────────────
import { GameAssetsBrowserView } from "../game-assets/GameAssetsBrowserView";

export function GameAssetsPage() {
  return <GameAssetsBrowserView variant="page" />;
}
