/** Only locally built assets belong here. Never interpolate room/peer content. */
export function multiplayerGuestDocument(assets: { javascript: string; css: string }, nonce: string) {
  if (!/^[A-Za-z0-9+/=_-]{16,128}$/u.test(nonce)) throw new Error("Invalid guest document nonce");
  const script = assets.javascript.replace(/<\/script/giu, "<\\/script");
  const css = assets.css.replace(/<\/style/giu, "<\\/style");
  return {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy":
        "camera=(), microphone=(), display-capture=(), geolocation=(), clipboard-read=(), clipboard-write=(), payment=(), usb=(), serial=()",
      "Content-Security-Policy": [
        "sandbox allow-scripts",
        "default-src 'none'",
        `script-src 'nonce-${nonce}'`,
        `style-src 'nonce-${nonce}'`,
        "connect-src 'none'",
        "img-src 'none'",
        "font-src 'none'",
        "media-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self'",
      ].join("; "),
    },
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style nonce="${nonce}">${css}</style></head><body><div id="multiplayer-root"></div><script nonce="${nonce}">${script}</script></body></html>`,
  };
}
