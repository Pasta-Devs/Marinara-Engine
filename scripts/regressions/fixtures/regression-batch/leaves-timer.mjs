// A batch member that loads fine but leaves a timer running: alone it never exits, so it times out.
setInterval(() => {}, 1_000);
