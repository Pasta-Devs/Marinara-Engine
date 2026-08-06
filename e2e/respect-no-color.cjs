"use strict";

// Playwright 1.61 injects FORCE_COLOR=1 into workers and web servers. Preserve
// an explicit caller preference without suppressing unrelated Node warnings.
if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") process.env.FORCE_COLOR = "0";
