// Runs a regression file's named cases one after another, printing "ok - <name>" or "not ok - <name>" for each, so
// one failure doesn't hide the cases after it. It throws at the end rather than setting process.exitCode, so a failed
// case also fails its file inside a batched shared process (scripts/run-regression-batch.mjs).
export type RegressionCase = {
  name: string;
  run: () => void | Promise<void>;
};

export async function runNamedCases(cases: RegressionCase[]) {
  const failed: string[] = [];
  for (const regression of cases) {
    try {
      await regression.run();
      console.log(`ok - ${regression.name}`);
    } catch (error) {
      failed.push(regression.name);
      console.error(`not ok - ${regression.name}`);
      console.error(error);
    }
  }
  if (failed.length > 0) throw new Error(`${failed.length} of ${cases.length} cases failed: ${failed.join("; ")}`);
}
