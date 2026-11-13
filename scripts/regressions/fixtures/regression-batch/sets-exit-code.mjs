// A batch member that reports failure through process.exitCode instead of throwing.
console.error("sets-exit-code: failing without throwing");
process.exitCode = 1;
