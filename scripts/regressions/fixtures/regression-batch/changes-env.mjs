// A batch member that changes the environment and working directory; the next file must not see either.
import { tmpdir } from "node:os";

process.env.REGRESSION_BATCH_PROBE = "left behind";
delete process.env.DATA_DIR;
process.chdir(tmpdir());
