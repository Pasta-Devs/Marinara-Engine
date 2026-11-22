import assert from "node:assert/strict";
import { isKeyboardContextMenu } from "../../../packages/client/src/hooks/use-menu-keyboard.js";

// QC Nov 22 AX5: Shift+F10 and the menu key open the app's menus; right clicks and long presses stay pointer menus.
const event = (pointerType: string | undefined, button: number, x = 893, y = 674) => ({
  nativeEvent: { pointerType, button } as unknown as Event,
  clientX: x,
  clientY: y,
  button,
});

// Chromium: Shift+F10 is a "mouse" PointerEvent with button -1, placed on the element.
assert.equal(isKeyboardContextMenu(event("mouse", -1)), true);
// A real right click.
assert.equal(isKeyboardContextMenu(event("mouse", 2)), false);
// A touch long-press.
assert.equal(isKeyboardContextMenu(event("touch", 0)), false);
// Older Chromium: empty pointer type.
assert.equal(isKeyboardContextMenu(event("", 0)), true);
// A plain MouseEvent at 0,0 (old WebKit).
assert.equal(isKeyboardContextMenu(event(undefined, 0, 0, 0)), true);
assert.equal(isKeyboardContextMenu(event(undefined, 2)), false);

console.log("keyboard context menu detection ok");
