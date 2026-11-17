/* global module, require */
// lightningcss's Node loader requires `lightningcss-<platform>-<arch>`, and lightningcss publishes no android-x64
// build (Chromebooks, BlueStacks and other x86 Android). Its WebAssembly build has the same API and, through its
// CommonJS entry, loads synchronously, which is what the loader expects.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the loader require()s this package synchronously.
module.exports = require("lightningcss-wasm");
