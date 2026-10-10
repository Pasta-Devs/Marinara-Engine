// K6: how long the omnibar takes from open (⌘K, the mobile pull gesture, or any
// other trigger that flips `omnibarOpen`) to the first results paint. Debug-mode
// only - this is a developer measurement, not a user-facing feature.
const START_MARK = "omnibar-open-start";
const PAINT_MARK = "omnibar-first-result-paint";
const MEASURE_NAME = "omnibar-open-to-first-paint";

export function markOmnibarOpenStart() {
  performance.mark(START_MARK);
}

export function measureOmnibarFirstResultPaint(debugMode: boolean) {
  if (!debugMode) {
    performance.clearMarks(START_MARK);
    return;
  }
  try {
    performance.mark(PAINT_MARK);
    const { duration } = performance.measure(MEASURE_NAME, START_MARK, PAINT_MARK);
    console.debug(`[omnibar] open → first result paint: ${duration.toFixed(1)}ms`);
  } catch {
    // No start mark - e.g. debug mode was turned on after the open already began.
  } finally {
    performance.clearMarks(START_MARK);
    performance.clearMarks(PAINT_MARK);
    performance.clearMeasures(MEASURE_NAME);
  }
}
