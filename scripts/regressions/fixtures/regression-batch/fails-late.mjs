// A batch member that finishes loading, then throws: alone it fails, so its batch must not pass anyone.
setTimeout(() => {
  throw new Error("planted late error");
}, 200);
