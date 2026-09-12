import { buildApp } from "../../../packages/server/src/app.js";

const app = await buildApp();
app.get("/__restart-pid", async () => ({ pid: process.pid, parent: process.ppid }));
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT) });
process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});
