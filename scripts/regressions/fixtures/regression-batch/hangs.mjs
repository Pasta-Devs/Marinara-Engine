// A batch member that never finishes loading.
await new Promise(() => {
  setInterval(() => {}, 1_000);
});
