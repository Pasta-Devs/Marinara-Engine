// Real sequence/cache boundary with synthetic audio: no network provider or browser playback.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { ttsConfigSchema } from "../../packages/shared/src/types/tts.js";
import { withTTSVoiceRequestCacheKeys } from "../../packages/client/src/lib/tts-dialogue.js";
import { ttsService, type TTSSpeakRequest } from "../../packages/client/src/lib/tts-service.js";
import {
  __resetTTSMemoryCacheForTests,
  deleteCachedTTSAudioKeys,
  getCachedTTSAudioBlob,
  getOrCreateCachedTTSAudioBlob,
} from "../../packages/client/src/lib/tts-audio-cache.js";

class FixtureAudio extends EventTarget {
  src = "";
  volume = 1;
  muted = false;
  paused = true;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  async play() {
    this.paused = false;
    setTimeout(() => this.onended?.(), 0);
  }
  pause() {
    this.paused = true;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load() {}
}

const originalAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
const originalFetch = globalThis.fetch;
const sent: Array<Record<string, string>> = [];
const failures: string[] = [];
const check = (condition: boolean, label: string) => {
  if (!condition) failures.push(label);
};
Object.defineProperty(globalThis, "Audio", { configurable: true, value: FixtureAudio });
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as Record<string, string>;
  sent.push(body);
  return new Response(new Blob([JSON.stringify(body)], { type: "audio/mpeg" }));
};

try {
  __resetTTSMemoryCacheForTests();
  const requests: TTSSpeakRequest[] = ["First line.", "Second line."].map((text, index) => ({
    text,
    voice: "voice-a",
    cacheKey: `identity-message:${index}`,
    cacheAliases: [`identity-text:${index}`],
  }));
  const play = (lines: TTSSpeakRequest[], audioConnectionId?: string) =>
    ttsService.speakSequence(lines, "identity", { audioConnectionId, throwOnError: true });
  await play(requests, "connection-a");
  check(sent.length === 2, "initial two chunks synthesize");
  await play(requests, "connection-a");
  check(sent.length === 2, "identical source and voice reuse both chunks");
  await play(requests, "connection-b");
  check(sent.length === 4, "another explicit connection synthesizes the same text again");
  const otherVoice = requests.map((line) => ({ ...line, voice: "voice-b" }));
  await play(otherVoice, "connection-b");
  check(sent.length === 6, "another explicit voice synthesizes the same text again");
  await play(otherVoice, "");
  check(sent.length === 8, "legacy empty sentinel has a distinct cache identity");
  await play(otherVoice);
  check(sent.length === 10, "default resolution is distinct from explicit legacy settings");
  const aliases = otherVoice.map((line) => ({ ...line, cacheKey: `another:${line.cacheKey}` }));
  await play(aliases);
  check(sent.length === 10, "same-context text aliases still share synthesis");
  const keyOnlyRequests = otherVoice.map(({ cacheKey, cacheAliases }) => ({ cacheKey, cacheAliases }));
  await ttsService.clearCachedAudio(keyOnlyRequests);
  await play(otherVoice);
  check(sent.length === 12, "clearing the current primary and aliases regenerates both clips");
  await ttsService.clearCachedAudio(keyOnlyRequests);
  await play(otherVoice, "connection-b");
  check(sent.length === 14, "key-only clearing removes other source variants of the same line");
  assert.deepEqual(
    sent.map(({ audioConnectionId, voice }) => [audioConnectionId, voice]),
    [
      ...Array.from({ length: 2 }, () => ["connection-a", "voice-a"]),
      ...Array.from({ length: 2 }, () => ["connection-b", "voice-a"]),
      ...Array.from({ length: 2 }, () => ["connection-b", "voice-b"]),
      ...Array.from({ length: 2 }, () => ["", "voice-b"]),
      ...Array.from({ length: 4 }, () => [undefined, "voice-b"]),
      ...Array.from({ length: 2 }, () => ["connection-b", "voice-b"]),
    ],
    "actual synthesis requests preserve the selected source and voice, including the legacy sentinel",
  );
  check(ttsService.getState() === "idle" && ttsService.getPlayback() === null, "sequence playback cleans up");

  // A minimal transaction fixture exercises the actual persistent-cache branch without adding a dependency.
  // The companion browser proof uses real Chromium IndexedDB; this fixture makes the regression portable in Node.
  const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const stores = new Map(["voiceLines", "voiceLineMeta"].map((name) => [name, new Map<string, any>()]));
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    close() {},
    transaction() {
      let pending = 0;
      const tx = { oncomplete: null as (() => void) | null, objectStore };
      function request(read: () => unknown) {
        pending += 1;
        const result = { result: undefined as unknown, onsuccess: null as (() => void) | null };
        queueMicrotask(() => {
          result.result = read();
          result.onsuccess?.();
          if (--pending === 0) setTimeout(() => tx.oncomplete?.(), 0);
        });
        return result;
      }
      function objectStore(name: string) {
        const values = stores.get(name)!;
        return {
          get: (key: string) => request(() => values.get(key)),
          getAllKeys: () => request(() => [...values.keys()]),
          getAll: () => request(() => [...values.values()]),
          put: (value: { key: string }) => request(() => values.set(value.key, value)),
          delete: (key: string) => request(() => values.delete(key)),
        };
      }
      return tx;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open() {
        const request = { result: db, onsuccess: null as (() => void) | null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
  try {
    const old = new Blob(["old"]);
    const fresh = new Blob(["fresh"]);
    const unrelated = new Blob(["unrelated"]);
    await getOrCreateCachedTTSAudioBlob("legacy", async () => old, ["legacy-text"]);
    for (const identity of ["source-a", "source-b"])
      await getOrCreateCachedTTSAudioBlob("persistent", async () => old, ["persistent-text"], identity);
    await getOrCreateCachedTTSAudioBlob("untouched", async () => unrelated, [], "other");
    __resetTTSMemoryCacheForTests();
    await deleteCachedTTSAudioKeys(["legacy", "legacy-text", "persistent", "persistent-text"]);
    for (const values of stores.values()) {
      assert.equal(values.size, 1, "persistent deletion preserves only the unrelated clip and its metadata");
      assert.ok([...values.keys()][0]?.includes("untouched"));
    }
    assert.equal(await getCachedTTSAudioBlob("legacy"), null, "legacy raw keys are deleted too");
    assert.equal(
      await getOrCreateCachedTTSAudioBlob(
        "untouched",
        async () => assert.fail("unrelated clip was purged"),
        [],
        "other",
      ),
      unrelated,
    );

    let start!: () => void;
    let finish!: (blob: Blob) => void;
    const started = new Promise<void>((resolve) => (start = resolve));
    const pending = getOrCreateCachedTTSAudioBlob(
      "pending-family",
      () => {
        start();
        return new Promise<Blob>((resolve) => (finish = resolve));
      },
      ["pending-alias"],
      "source-a",
    );
    await started;
    await deleteCachedTTSAudioKeys(["pending-family", "pending-alias"]);
    const replacement = await getOrCreateCachedTTSAudioBlob(
      "pending-family",
      async () => fresh,
      ["pending-alias"],
      "source-a",
    );
    finish(old);
    await pending;
    assert.equal(replacement, fresh, "a caller after the purge does not join the old in-flight synthesis");
    __resetTTSMemoryCacheForTests();
    assert.equal(
      await getOrCreateCachedTTSAudioBlob(
        "pending-family",
        async () => assert.fail("fresh clip is missing"),
        [],
        "source-a",
      ),
      fresh,
      "late completion cannot resurrect old audio in persistent storage",
    );

    let startEarly!: () => void;
    let finishEarly!: (blob: Blob) => void;
    const earlyStarted = new Promise<void>((resolve) => (startEarly = resolve));
    const early = getOrCreateCachedTTSAudioBlob(
      "early-family",
      () => {
        startEarly();
        return new Promise<Blob>((resolve) => (finishEarly = resolve));
      },
      ["early-alias"],
      "source-b",
    );
    await deleteCachedTTSAudioKeys(["early-family", "early-alias"]);
    await earlyStarted;
    await getOrCreateCachedTTSAudioBlob("early-family", async () => fresh, ["early-alias"], "source-b");
    finishEarly(old);
    await early;
    __resetTTSMemoryCacheForTests();
    assert.equal(
      await getOrCreateCachedTTSAudioBlob(
        "early-family",
        async () => assert.fail("early purge lost fresh audio"),
        [],
        "source-b",
      ),
      fresh,
      "a purge during initial asynchronous lookup fences later registration and persistence",
    );
  } finally {
    if (originalIndexedDB) Object.defineProperty(globalThis, "indexedDB", originalIndexedDB);
    else delete (globalThis as Record<string, unknown>).indexedDB;
  }

  const config = ttsConfigSchema.parse({ source: "openai", connectionId: "connection-a", voice: "same-voice" });
  const alternate = { ...config, connectionId: "connection-b" };
  const line = [{ text: "Native line.", voice: "same-voice" }];
  check(
    withTTSVoiceRequestCacheKeys(line, config, "message")[0]?.cacheKey !==
      withTTSVoiceRequestCacheKeys(line, alternate, "message")[0]?.cacheKey,
    "native chat keys distinguish otherwise-identical speech connections",
  );
  for (const [file, names] of [
    ["GameNarration.tsx", ["hashVoiceKey", "buildVoiceConfigSignature", "buildVoiceLineTextCacheKey"]],
    ["GameCombatUI.tsx", ["buildCombatVoiceConfigSignature"]],
  ] as const) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(`../../packages/client/src/components/game/${file}`, import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const code = names.map((name) => {
      const node = source.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
      assert.ok(node, name);
      return node.getText(source);
    });
    const signature = file === "GameNarration.tsx" ? "buildVoiceConfigSignature" : "buildCombatVoiceConfigSignature";
    const compiled = ts.transpileModule(code.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
    const api = new Function(
      `${compiled.outputText};return {signature:${signature}${file === "GameNarration.tsx" ? ",textKey:buildVoiceLineTextCacheKey" : ""}};`,
    )() as {
      signature: (value: typeof config) => string;
      textKey?: (value: typeof config, job: { chunk: string; voice: string }) => string;
    };
    check(api.signature(config) !== api.signature(alternate), `${file} invalidates local entries on connection change`);
    if (api.textKey)
      check(
        api.textKey(config, { chunk: "Same chunk.", voice: "same-voice" }) !==
          api.textKey(alternate, { chunk: "Same chunk.", voice: "same-voice" }),
        "Game narration persistent aliases distinguish connections",
      );
  }
  assert.deepEqual(failures, [], `Cache identity failures: ${failures.join("; ")}`);
  console.log("TTS sequence cache identity: source, voice, aliases, cleanup and native chat/Game controls passed");
} finally {
  ttsService.stop();
  __resetTTSMemoryCacheForTests();
  globalThis.fetch = originalFetch;
  if (originalAudio) Object.defineProperty(globalThis, "Audio", originalAudio);
  else delete (globalThis as Record<string, unknown>).Audio;
}
