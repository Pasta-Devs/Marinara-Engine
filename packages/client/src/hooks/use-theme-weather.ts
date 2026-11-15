import { useEffect, useState } from "react";
import { readThemeWeatherTokens, resolveThemeWeatherLook } from "../lib/theme-weather";
import { STOCK_WEATHER_LOOK, type WeatherLook } from "../lib/weather-renderer";
import { afterNextPaint } from "../lib/after-paint";

// The look the last reader settled on: a chat tab mounting later starts from it instead of the stock look.
let lastLook: { key: string; look: WeatherLook } | null = null;

/**
 * The active theme's weather look (`--mari-weather-*` tokens), kept current when the theme, its CSS or the
 * colour scheme changes. Event driven: one computed-style read after a change settles, and a new look only
 * when the tokens actually differ.
 */
export function useThemeWeatherLook(enabled = true): WeatherLook {
  const [look, setLook] = useState<WeatherLook>(() => lastLook?.look ?? STOCK_WEATHER_LOOK);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const root = document.documentElement;
    let lastKey = lastLook?.key ?? "";
    let generation = 0;
    let timer: number | null = null;
    let cancelPaint = () => {};

    const read = () => {
      timer = null;
      const tokens = readThemeWeatherTokens(getComputedStyle(root));
      const key = JSON.stringify(tokens);
      if (key === lastKey) return;
      lastKey = key;
      const mine = ++generation;
      void resolveThemeWeatherLook(tokens).then((next) => {
        lastLook = { key, look: next };
        if (mine === generation) setLook(next);
      });
    };
    // Reads wait for a painted frame: a computed-style read right after a chat tab mounted made Safari
    // restyle the whole page on the spot (about 0.1-0.3 s on a tablet, Nov 15).
    const schedule = () => {
      if (timer === null)
        timer = window.setTimeout(() => {
          cancelPaint = afterNextPaint(read);
        }, 150);
    };

    cancelPaint = afterNextPaint(read);
    const rootObserver = new MutationObserver(schedule);
    rootObserver.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-custom-theme"],
    });
    // Theme CSS lives in <style> elements in <head>; editing a theme rewrites their text.
    const headObserver = new MutationObserver(schedule);
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      generation += 1;
      rootObserver.disconnect();
      headObserver.disconnect();
      if (timer !== null) window.clearTimeout(timer);
      cancelPaint();
    };
  }, [enabled]);

  return enabled ? look : STOCK_WEATHER_LOOK;
}
