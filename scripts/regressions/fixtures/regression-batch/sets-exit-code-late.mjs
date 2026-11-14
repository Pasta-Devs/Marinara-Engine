// A batch member that finishes loading, then reports failure through process.exitCode: alone it exits 1.
setTimeout(() => {
  console.error("sets-exit-code-late: failing without throwing, after loading");
  process.exitCode = 1;
}, 200);
