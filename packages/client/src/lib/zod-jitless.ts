// Zod checks once whether it may compile validators with `new Function`. The app's Content-Security-Policy says
// no, so that probe logged a "blocked a JavaScript eval" error on every load in Firefox, which then ends up in
// console logs people paste into bug reports (Firefox reviewer, FF3). Telling Zod up front skips the probe; it
// already fell back to the same non-compiled path.
import { config } from "zod";

config({ jitless: true });
