import assert from "node:assert/strict";
import { executeToolCalls } from "../../packages/server/src/services/tools/tool-executor.js";

// spotify_get_playlists used to read `p.tracks.total` unguarded. Spotify strips
// `tracks.total` (and sometimes the whole `tracks` object) from /me/playlists
// for Development Mode apps, and can send null items, so the tool threw and the
// Music DJ agent could never list playlists. The fetch is stubbed; no network.

const originalFetch = globalThis.fetch;

async function runPlaylists(items: unknown[]): Promise<{ success: boolean; body: Record<string, unknown> }> {
  globalThis.fetch = (async (input: unknown) => {
    assert.match(String(input), /^https:\/\/api\.spotify\.com\/v1\/me\/playlists\?/);
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const [result] = await executeToolCalls(
      [{ id: "call-1", type: "function", function: { name: "spotify_get_playlists", arguments: "{}" } }],
      { spotify: { accessToken: "test-token" } } as never,
    );
    assert.ok(result, "tool returned a result");
    return { success: result.success, body: JSON.parse(result.result) as Record<string, unknown> };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

try {
  const { success, body } = await runPlaylists([
    { id: "a", name: "Full", uri: "spotify:playlist:a", tracks: { total: 12 }, description: "desc" },
    { id: "b", name: "No total", uri: "spotify:playlist:b", tracks: {}, description: null },
    { id: "c", name: "No tracks", uri: "spotify:playlist:c" },
    null,
    { id: "d", name: "Renamed field", uri: "spotify:playlist:d", items: { total: 4 } },
    { id: "e", name: "Null tracks", uri: "spotify:playlist:e", tracks: null },
  ]);

  assert.equal(success, true, `tool should succeed, got ${JSON.stringify(body)}`);
  assert.equal(body.error, undefined);
  const playlists = body.playlists as Array<Record<string, unknown>>;
  assert.equal(body.count, 5, "null item is skipped");
  assert.deepEqual(
    playlists.map((p) => [p.id, p.trackCount]),
    [
      ["a", 12],
      ["b", null],
      ["c", null],
      ["d", 4],
      ["e", null],
    ],
  );
  assert.equal(playlists[0]!.description, "desc");
  assert.equal(playlists[1]!.description, "");

  console.log("server-hunt-b53 regression passed");
} finally {
  globalThis.fetch = originalFetch;
}
