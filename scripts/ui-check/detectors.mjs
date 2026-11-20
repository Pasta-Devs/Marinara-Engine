// ──────────────────────────────────────────────
// UI check: the layout detectors, run inside the page
// ──────────────────────────────────────────────
// One self-contained function (no imports, no closures over this file), so Playwright can pass it to
// page.evaluate and the WebKit driver can send its source through WebDriver. It looks at what is on screen now and
// returns every layout problem it can prove from the DOM alone:
//
//   clipped      a box with overflow hidden cuts off content taller/wider than itself, with nothing to scroll
//   unreachable  a button, field or line of text sits outside the window and nothing can scroll it into view
//   sideways     the page itself scrolls sideways
//   offscreen    a popup, menu or window pokes out of the window
//   picture      a picture is far bigger than the box it belongs in (the "giant avatar" family)
//   stretched    a row or button is mostly empty space: many times taller than what is in it (Home's giant links)
//   covered      a button is under something else, so a tap lands on the wrong thing
//   greeting     Home's buttons sit beside the greeting (over the hero's art) instead of under it
//   off-center   an icon tile's icon is off the tile's middle (Things to try with large text)
//   heading      a Library table's column heading is off its column's middle (Connections' Models, Nov 19)
//   sticky-gap   a sticky header stops short of its scroller's top edge, so scrolled content shows above it
//
// Every finding names the element (a short CSS path) and the numbers, so a report reads without a screenshot.
// An element (and everything in it) is skipped when it or an ancestor has data-ui-check="ignore"; pass
// `allow` (CSS selectors) to skip known, intended cases per check.

export function detectLayoutProblems(options = {}) {
  const allow = options.allow ?? {};
  const scope = options.scope ? document.querySelector(options.scope) : document.body;
  const findings = [];
  if (!scope) return [{ check: "missing", where: options.scope, detail: "scope element is missing" }];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const cssPath = (el) => {
    const parts = [];
    for (let node = el; node && node !== document.body && parts.length < 4; node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      const component = node.getAttribute("data-component");
      if (node.id && !/\d{3,}|:/.test(node.id)) part += `#${node.id}`;
      else if (component) part += `[data-component="${component}"]`;
      else {
        const classes = [...node.classList].filter((c) => !/[:[\]/!]/.test(c)).slice(0, 2);
        if (classes.length) part += `.${classes.join(".")}`;
      }
      parts.unshift(part);
      if (node.id || component) break;
    }
    return parts.join(" > ");
  };
  const label = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  };
  const ignored = (el, check) => {
    if (el.closest('[data-ui-check="ignore"]')) return true;
    const own = el.closest("[data-ui-check-allow]");
    if (own && own.getAttribute("data-ui-check-allow").split(/\s+/).includes(check)) return true;
    for (const selector of allow[check] ?? []) {
      try {
        if (el.closest(selector)) return true;
      } catch {
        /* A bad selector in the allow list skips nothing. */
      }
    }
    return false;
  };
  const styleCache = new Map();
  const styleOf = (el) => {
    let style = styleCache.get(el);
    if (!style) {
      style = getComputedStyle(el);
      styleCache.set(el, style);
    }
    return style;
  };
  /** Drawn, takes room, and not faded out or hidden for assistive tech only. */
  const shown = (el) => {
    if (!el.getClientRects().length) return false;
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const style = styleOf(node);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.05) return false;
      if (node.inert || node.getAttribute("aria-hidden") === "true") return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= 2 && rect.height >= 2;
  };
  const add = (check, el, detail, rect = el.getBoundingClientRect()) => {
    if (ignored(el, check)) return;
    findings.push({
      check,
      where: cssPath(el),
      text: label(el),
      detail,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    });
  };
  const scrolls = (style, axis) => {
    const value = axis === "y" ? style.overflowY : style.overflowX;
    return value === "auto" || value === "scroll" || value === "overlay";
  };
  const all = [scope, ...scope.querySelectorAll("*")].filter(
    (el) => el instanceof HTMLElement || el instanceof SVGElement,
  );
  const visible = all.filter((el) => el instanceof HTMLElement && shown(el));
  const visibleSet = new Set(visible);

  // ── sideways: the page itself scrolls sideways ──
  const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (pageWidth > vw + 1) {
    findings.push({
      check: "sideways",
      where: "html",
      text: "",
      detail: `page is ${pageWidth}px wide in a ${vw}px window`,
    });
  }

  // ── clipped: overflow hidden cuts off content and nothing scrolls ──
  for (const el of visible) {
    const style = styleOf(el);
    const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
    if (!clipsY || el.clientHeight < 40 || style.webkitLineClamp !== "none") continue;
    const hidden = el.scrollHeight - el.clientHeight;
    if (hidden <= 4) continue;
    // Only content that is really there counts: something shown that starts below the box's bottom edge or runs
    // past it. Decorations (absolutely placed art, glows) are skipped.
    const box = el.getBoundingClientRect();
    const bottom = box.top + el.clientTop + el.clientHeight;
    let cut = null;
    for (const child of el.querySelectorAll(
      "button, a[href], input, textarea, select, [role=button], [role=tab], [role=option], h1, h2, h3, h4, p, li, label",
    )) {
      if (!visibleSet.has(child)) continue;
      const childStyle = styleOf(child);
      if (childStyle.position === "absolute" || childStyle.position === "fixed") continue;
      const rect = child.getBoundingClientRect();
      if (rect.bottom > bottom + 2 && rect.height > 0) {
        // Clipped by this box and not by a scroller between them (that one scrolls).
        let scroller = false;
        for (let node = child.parentElement; node && node !== el; node = node.parentElement) {
          if (scrolls(styleOf(node), "y")) scroller = true;
        }
        if (!scroller) {
          cut = child;
          break;
        }
      }
    }
    if (cut) add("clipped", el, `shows ${el.clientHeight} of ${el.scrollHeight}px; "${label(cut)}" is cut off below`);
  }

  // ── unreachable: outside the window and no scroller can bring it in ──
  const reachable = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = styleOf(node);
      if (
        (scrolls(style, "y") && node.scrollHeight > node.clientHeight + 1) ||
        (scrolls(style, "x") && node.scrollWidth > node.clientWidth + 1)
      )
        return true;
      if (style.position === "fixed") return false;
    }
    const root = document.scrollingElement ?? document.documentElement;
    return (
      root.scrollHeight > vh + 1 &&
      styleOf(document.documentElement).overflowY !== "hidden" &&
      styleOf(document.body).overflowY !== "hidden"
    );
  };
  const targets = visible.filter((el) =>
    el.matches(
      "button, a[href], input:not([type=hidden]), textarea, select, [role=button], [role=tab], [role=option], [role=menuitem], h1, h2, h3",
    ),
  );
  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    // Visually hidden helpers (1px boxes) and things parked far away on purpose.
    if (rect.width < 4 || rect.height < 4 || rect.right < -2000 || rect.left > vw + 2000) continue;
    const below = rect.top > vh - 2;
    const right = rect.left > vw - 2;
    const partly = rect.bottom > vh + 2 || rect.right > vw + 2 || rect.left < -2 || rect.top < -2;
    if (!below && !right && !partly) continue;
    // Bars that slide away on purpose (the auto-hiding top bar, closed drawers): their fixed frame is itself
    // mostly out of the window, and it comes back on hover or a swipe.
    let slidAway = false;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const position = styleOf(node).position;
      if (position !== "fixed" && position !== "sticky") continue;
      const r = node.getBoundingClientRect();
      const visibleArea =
        Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) *
        Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visibleArea < r.width * r.height * 0.5) slidAway = true;
      break;
    }
    if (slidAway) continue;
    // A clipping ancestor already hides it: that box is reported under "clipped" (or the clipping is a carousel).
    let clippedAway = false;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = styleOf(node);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") {
        const r = node.getBoundingClientRect();
        if (
          rect.top >= r.bottom - 1 ||
          rect.bottom <= r.top + 1 ||
          rect.left >= r.right - 1 ||
          rect.right <= r.left + 1
        )
          clippedAway = true;
        break;
      }
    }
    if (clippedAway || reachable(el)) continue;
    add(
      "unreachable",
      el,
      `at ${Math.round(rect.left)},${Math.round(rect.top)} (${Math.round(rect.width)}x${Math.round(rect.height)}) in a ${vw}x${vh} window, nothing scrolls to it`,
      rect,
    );
  }

  // ── offscreen: an open popup, menu or window pokes out of the window ──
  for (const el of visible) {
    if (
      !el.matches(
        "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=tooltip], [data-radix-popper-content-wrapper] > *, [data-floating-window]",
      )
    )
      continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    const out = Math.max(-rect.left, -rect.top, rect.right - vw, rect.bottom - vh);
    if (out > 2) add("offscreen", el, `pokes ${Math.round(out)}px out of the ${vw}x${vh} window`, rect);
  }

  // ── picture: far bigger than the box it belongs in ──
  for (const el of visible) {
    if (!el.matches("img, video, canvas, picture")) continue;
    const rect = el.getBoundingClientRect();
    const frame = el.parentElement?.closest(":not(picture):not(a):not(span)") ?? el.parentElement;
    if (!frame) continue;
    const f = frame.getBoundingClientRect();
    if (f.width < 4 || f.height < 4) continue;
    const spill = Math.max(f.left - rect.left, f.top - rect.top, rect.right - f.right, rect.bottom - f.bottom);
    // Cropping inside a clipped frame is how cropped avatars work; a picture only counts as giant when it is
    // also much bigger than its frame and more than a quarter of the window (what people actually saw).
    const giant = rect.width * rect.height > vw * vh * 0.25 && rect.width * rect.height > f.width * f.height * 4;
    const frameStyle = styleOf(frame);
    const frameClips = frameStyle.overflowX !== "visible" || frameStyle.overflowY !== "visible";
    if (giant || (!frameClips && spill > 24 && styleOf(el).position !== "absolute")) {
      add(
        "picture",
        el,
        `${Math.round(rect.width)}x${Math.round(rect.height)} in a ${Math.round(f.width)}x${Math.round(f.height)} box`,
        rect,
      );
    }
  }

  // ── stretched: a row or button that is mostly empty space ──
  for (const el of visible) {
    if (!el.matches("a[href], button, [role=button], [role=option], [role=menuitem], li")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height < 120) continue;
    if (el.querySelector("img, video, canvas, textarea, [role=img], svg[width='100%']")) {
      // Picture tiles are tall on purpose; only flag when even the picture is small.
      const media = [...el.querySelectorAll("img, video, canvas, [role=img]")].filter((m) => visibleSet.has(m));
      if (media.some((m) => m.getBoundingClientRect().height > rect.height * 0.35)) continue;
    }
    let top = Infinity;
    let bottom = -Infinity;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (!r.height) continue;
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    for (const child of el.querySelectorAll("img, svg, video, canvas")) {
      if (!visibleSet.has(child) && !(child instanceof SVGElement)) continue;
      const r = child.getBoundingClientRect();
      if (!r.height) continue;
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    if (!Number.isFinite(top)) continue;
    const used = bottom - top;
    if (used * 3 < rect.height) {
      add("stretched", el, `${Math.round(rect.height)}px tall for ${Math.round(used)}px of content`, rect);
    }
  }

  // ── covered: a button you can see but cannot tap ──
  if (options.covered !== false) {
    const modal = [...document.querySelectorAll("[role=dialog][aria-modal=true], [role=alertdialog]")]
      .filter((d) => shown(d))
      .at(-1);
    for (const el of targets) {
      if (!el.matches("button, a[href], [role=button], [role=tab], input, select, textarea")) continue;
      if (modal && !modal.contains(el)) continue;
      if (styleOf(el).pointerEvents === "none") continue;
      const rect = el.getBoundingClientRect();
      // A whole-card click area under the card's own buttons (Home's Recent chats card) is meant to be covered.
      const parentRect = el.parentElement?.getBoundingClientRect();
      if (
        styleOf(el).position === "absolute" &&
        ((parentRect && rect.width * rect.height >= parentRect.width * parentRect.height * 0.9) ||
          ["top", "right", "bottom", "left"].every((side) => styleOf(el)[side] === "0px"))
      )
        continue;
      if (rect.width < 12 || rect.height < 12) continue;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      // Only what is inside its own scroller's visible part (a list scrolled past the edge is fine). A middle within
      // a pixel of the scroller's edge is a row half scrolled out, not inside: the omnibar's last result, its middle exactly
      // on the list's bottom edge at some scroll positions, read as covered by the panel below it (Nov 19).
      let inView = true;
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = styleOf(node);
        if (style.overflowX !== "visible" || style.overflowY !== "visible") {
          const r = node.getBoundingClientRect();
          if (x < r.left + 1 || x > r.right - 1 || y < r.top + 1 || y > r.bottom - 1) inView = false;
        }
      }
      if (!inView) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || el.contains(hit) || hit.contains(el)) continue;
      // Wholly behind one panel (a drawer over the page) is out of sight, not a trap: only a button you can still
      // see part of, with something lying over its middle, is.
      const inset = 2;
      const corners = [
        [rect.left + inset, rect.top + inset],
        [rect.right - inset, rect.top + inset],
        [rect.left + inset, rect.bottom - inset],
        [rect.right - inset, rect.bottom - inset],
      ].filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < vw && cy < vh);
      if (
        corners.every(([cx, cy]) => {
          const at = document.elementFromPoint(cx, cy);
          return at && !el.contains(at) && !at.contains(el);
        })
      )
        continue;
      // Something drawn over the button on purpose (a label wrapping it, its own tooltip).
      if (hit.closest("label")?.contains(el)) continue;
      const over = hit.closest(
        "button, a, [role=button], [role=dialog], [role=menu], [role=listbox], header, nav, aside, section, div",
      );
      add("covered", el, `a tap in its middle lands on ${cssPath(over ?? hit)}`, rect);
    }
  }

  // ── greeting: Home's buttons sit under the greeting, never beside it out over the hero's art (Nov 19) ──
  const hero = scope.querySelector(".mari-home-hero");
  const heroButtons = hero?.querySelector(":scope > .ov-home-hero-buttons, :scope > .ov-home-modes");
  const greeting = hero?.querySelector("h1");
  if (heroButtons && greeting && visibleSet.has(heroButtons) && visibleSet.has(greeting)) {
    const buttons = heroButtons.getBoundingClientRect();
    const title = greeting.getBoundingClientRect();
    if (buttons.top < title.bottom - 2)
      add(
        "greeting",
        heroButtons,
        `the buttons start ${Math.round(title.bottom - buttons.top)}px above the greeting's bottom edge (beside it, not under it)`,
        buttons,
      );
  }

  // ── off-center: an icon tile (a small square box holding one icon) whose icon is off its middle ──
  // Things to try's tiles with large text: the symbol sat 8px above the middle (Nov 19).
  for (const el of visible) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 20 || rect.width > 72 || Math.abs(rect.width - rect.height) > rect.width * 0.15) continue;
    if (el.children.length !== 1 || el.textContent.trim()) continue;
    const icon = el.firstElementChild;
    if (!(icon instanceof SVGSVGElement || icon instanceof HTMLImageElement)) continue;
    const style = styleOf(el);
    // A tile is drawn: a fill, a border or a rounded shape. A bare wrapper around an icon is not.
    const drawn =
      (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") ||
      parseFloat(style.borderTopWidth) > 0 ||
      style.backgroundImage !== "none";
    if (!drawn) continue;
    const box = icon.getBoundingClientRect();
    if (box.width < 6 || box.width > rect.width * 0.9) continue;
    const dx = box.left + box.width / 2 - (rect.left + rect.width / 2);
    const dy = box.top + box.height / 2 - (rect.top + rect.height / 2);
    if (Math.max(Math.abs(dx), Math.abs(dy)) > Math.max(3, rect.width * 0.1))
      add("off-center", el, `its icon sits ${Math.round(dx)}px across, ${Math.round(dy)}px down from the middle`, rect);
  }

  // ── heading: a Library table's column heading off the middle of its column ──
  // Every Library table centers its headings (Nov 19); a page rule aligning a column's cells must not catch the
  // heading too (Connections' MODELS sat at the left of its column).
  for (const th of scope.querySelectorAll(".ov-table th")) {
    if (!th.textContent.trim() || ignored(th, "heading") || !shown(th)) continue;
    const range = document.createRange();
    range.selectNodeContents(th);
    const text = range.getBoundingClientRect();
    if (text.width < 1) continue;
    const rect = th.getBoundingClientRect();
    const style = styleOf(th);
    const left = rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    const right = rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
    // A heading wider than its column can't be centered; that's a width problem, not this one.
    if (text.width >= right - left) continue;
    const dx = text.left + text.width / 2 - (left + right) / 2;
    if (Math.abs(dx) > 3) add("heading", th, `the heading sits ${Math.round(dx)}px from its column's middle`, rect);
  }

  // ── sticky-gap: a header stuck to the top of a scrolled box, with a strip above it where the content shows ──
  // A phone's Chat settings section page: the scroller's top padding left 8px of settings above its header (Nov 19).
  for (const el of visible) {
    const style = styleOf(el);
    if (style.position !== "sticky" || style.top === "auto") continue;
    let scroller = el.parentElement;
    while (scroller && scroller !== document.body && !scrolls(styleOf(scroller), "y"))
      scroller = scroller.parentElement;
    if (!scroller || scroller === document.body || scroller.scrollTop < 8) continue;
    const box = scroller.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const stuckAt = box.top + scroller.clientTop + parseFloat(style.top);
    // Only while stuck (it would sit higher without sticky), with real content passing through the gap.
    if (Math.abs(rect.top - (stuckAt + parseFloat(styleOf(scroller).paddingTop))) > 1) continue;
    const gap = rect.top - (box.top + scroller.clientTop);
    if (gap < 2 || parseFloat(styleOf(scroller).paddingTop) < 2) continue;
    add(
      "sticky-gap",
      el,
      `it sticks ${Math.round(gap)}px below its scroller's top edge; scrolled content shows above it`,
      rect,
    );
  }

  // Duplicates (the same box reported twice through two of its children) read as noise.
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.check}|${f.where}|${f.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
