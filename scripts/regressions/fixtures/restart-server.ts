const started = Date.now();
console.info("[restart-fixture] Loading the server module");
const { buildApp } = await import("../../../packages/server/src/app.js");
console.info(`[restart-fixture] Building the app after ${Date.now() - started}ms`);
const app = await buildApp();
console.info(`[restart-fixture] Opening the listener after ${Date.now() - started}ms`);
app.get("/__restart-pid", async () => ({ pid: process.pid, parent: process.ppid }));
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT) });
process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});
