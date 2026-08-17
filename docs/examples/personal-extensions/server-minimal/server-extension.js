const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
