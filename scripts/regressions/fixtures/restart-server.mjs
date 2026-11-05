import { startRestartDiagnostics } from "./restart-diagnostics.mjs";

const started = Date.now();
const compiled = process.env.MARINARA_RESTART_COMPILED === "true";
const diagnostics = startRestartDiagnostics(compiled ? "compiled" : "source");
console.info(`[restart-fixture] Loading the ${compiled ? "compiled" : "source"} server module`);
const { buildApp } = await import(
  compiled ? "../../../packages/server/dist/app.js" : "../../../packages/server/src/app.js"
);
diagnostics.phase("build");
console.info(`[restart-fixture] Building the app after ${Date.now() - started}ms`);
const app = await buildApp();
diagnostics.phase("listen");
console.info(`[restart-fixture] Opening the listener after ${Date.now() - started}ms`);
app.get("/__restart-pid", async () => ({ pid: process.pid, parent: process.ppid }));
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT) });
diagnostics.ready();
process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});
