import { useEffect, useState } from "react";
import { readThemeWeatherTokens, resolveThemeWeatherLook } from "../lib/theme-weather";
import { STOCK_WEATHER_LOOK, type WeatherLook } from "../lib/weather-renderer";

/**
 * The active theme's weather look (`--mari-weather-*` tokens), kept current when the theme, its CSS or the
 * colour scheme changes. Event driven: one computed-style read after a change settles, and a new look only
 * when the tokens actually differ.
 */
export function useThemeWeatherLook(enabled = true): WeatherLook {
  const [look, setLook] = useState<WeatherLook>(STOCK_WEATHER_LOOK);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const root = document.documentElement;
    let lastKey = "";
    let generation = 0;
    let timer: number | null = null;

    const read = () => {
      timer = null;
      const tokens = readThemeWeatherTokens(getComputedStyle(root));
      const key = JSON.stringify(tokens);
      if (key === lastKey) return;
      lastKey = key;
      const mine = ++generation;
      void resolveThemeWeatherLook(tokens).then((next) => {
        if (mine === generation) setLook(next);
      });
    };
    const schedule = () => {
      if (timer === null) timer = window.setTimeout(read, 150);
    };

    read();
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
    };
  }, [enabled]);

  return enabled ? look : STOCK_WEATHER_LOOK;
}
