// ── Particle types ──
export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  type:
    | "rain"
    | "snow"
    | "leaf"
    | "firefly"
    | "star"
    | "fog"
    | "dust"
    | "petal"
    | "ember"
    | "ash"
    | "sand"
    | "hail"
    | "aurora";
  wobble: number;
  life: number;
  maxLife: number;
  /** Pre-computed fill colour (ash, sand) to avoid Math.random() in draw */
  color: string;
}

type WeatherCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface WeatherRenderConfig {
  type: WeatherParticle["type"];
  count: number;
  overlay: string;
  lightning: boolean;
  tint: string;
  addFireflies: boolean;
  addStars: boolean;
  celestial: CelestialBody;
  hour: number;
  sunRays: boolean;
  sunsetGlow: boolean;
  isClearSky: boolean;
}

// ── Map weather string → effect config ──
function parseWeather(weather?: string | null): {
  type: WeatherParticle["type"];
  count: number;
  overlay: string;
  lightning: boolean;
} {
  if (!weather) return { type: "dust", count: 0, overlay: "", lightning: false };

  const w = weather.toLowerCase();

  // Thunderstorm / lightning
  if (w.includes("thunder") || w.includes("lightning")) {
    return { type: "rain", count: 120, overlay: "rgba(50,80,120,0.10)", lightning: true };
  }
  if (w.includes("hail")) {
    return { type: "hail", count: 40, overlay: "rgba(180,200,230,0.06)", lightning: false };
  }
  if (w.includes("blizzard")) {
    return { type: "snow", count: 90, overlay: "rgba(200,220,255,0.10)", lightning: false };
  }
  if (w.includes("snow") || w.includes("sleet")) {
    const isHeavy = w.includes("heavy");
    return { type: "snow", count: isHeavy ? 75 : 35, overlay: "rgba(200,220,255,0.06)", lightning: false };
  }
  if (w.includes("frost") || w.includes("cold") || w.includes("freez")) {
    return { type: "snow", count: 12, overlay: "rgba(180,210,240,0.06)", lightning: false };
  }
  if (w.includes("fog") || w.includes("mist") || w.includes("haze")) {
    return { type: "fog", count: 12, overlay: "rgba(180,180,200,0.12)", lightning: false };
  }
  if (w.includes("sand") || w.includes("dust storm") || w.includes("sirocco")) {
    return { type: "sand", count: 65, overlay: "rgba(180,150,100,0.12)", lightning: false };
  }
  if (w.includes("ash") || w.includes("volcanic") || w.includes("smoke")) {
    return { type: "ash", count: 30, overlay: "rgba(80,60,60,0.10)", lightning: false };
  }
  if (w.includes("ember") || w.includes("fire") || w.includes("inferno")) {
    return { type: "ember", count: 24, overlay: "rgba(120,40,10,0.08)", lightning: false };
  }
  if (w.includes("wind") || w.includes("breez") || w.includes("gust")) {
    return { type: "leaf", count: 18, overlay: "", lightning: false };
  }
  if (w.includes("cherry") || w.includes("blossom") || w.includes("petal")) {
    return { type: "petal", count: 22, overlay: "rgba(255,180,200,0.04)", lightning: false };
  }
  if (w.includes("aurora") || w.includes("northern light") || w.includes("polar light")) {
    return { type: "aurora", count: 6, overlay: "rgba(20,60,40,0.08)", lightning: false };
  }
  if (w.includes("rain") || w.includes("storm") || w.includes("downpour")) {
    const isHeavy = w.includes("heavy") || w.includes("storm") || w.includes("downpour");
    return {
      type: "rain",
      count: isHeavy ? 120 : 55,
      overlay: "rgba(50,80,120,0.08)",
      lightning: isHeavy && w.includes("storm"),
    };
  }
  if (w.includes("clear") || w.includes("sunny") || w.includes("bright")) {
    return { type: "dust", count: 8, overlay: "", lightning: false };
  }
  if (w.includes("cloud") || w.includes("overcast") || w.includes("grey") || w.includes("gray")) {
    return { type: "dust", count: 6, overlay: "rgba(100,100,120,0.05)", lightning: false };
  }

  return { type: "dust", count: 8, overlay: "", lightning: false };
}

// ── Map time of day → tint + fireflies ──
type CelestialBody = "sun" | "moon" | "none";

function parseTime(
  timeOfDay?: string | null,
  baseType?: WeatherParticle["type"],
): {
  tint: string;
  addFireflies: boolean;
  addStars: boolean;
  celestial: CelestialBody;
  hour: number; // 0-24, -1 if unknown
  sunRays: boolean;
  sunsetGlow: boolean;
  isClearSky: boolean; // derived later; default false here
} {
  const base = {
    tint: "",
    addFireflies: false,
    addStars: false,
    celestial: "none" as CelestialBody,
    hour: -1,
    sunRays: false,
    sunsetGlow: false,
    isClearSky: false,
  };

  if (!timeOfDay) return base;

  const t = timeOfDay.toLowerCase();

  // Try to extract a numeric hour from the time string ("14:30", "2 PM", "1400", etc.)
  const hour = extractHour(t);
  base.hour = hour;

  if (t.includes("night") || t.includes("midnight")) {
    return {
      ...base,
      tint: "rgba(10,10,40,0.15)",
      addFireflies: baseType !== "rain" && baseType !== "snow",
      addStars: baseType !== "fog" && baseType !== "snow",
      celestial: "moon",
      hour: hour >= 0 ? hour : 0,
    };
  }
  if (t.includes("dusk") || t.includes("sunset") || t.includes("twilight") || t.includes("evening")) {
    return {
      ...base,
      tint: "rgba(80,30,20,0.10)",
      addFireflies: baseType !== "rain",
      addStars: false,
      celestial: "sun",
      hour: hour >= 0 ? hour : 18,
      sunsetGlow: true,
    };
  }
  if (t.includes("dawn") || t.includes("sunrise") || t.includes("morning")) {
    return {
      ...base,
      tint: "rgba(120,80,40,0.06)",
      celestial: "sun",
      hour: hour >= 0 ? hour : 7,
      sunRays: true,
    };
  }

  // Numeric hour fallback — determine time period from hour
  if (hour >= 0) {
    if (hour >= 21 || hour < 5) {
      return {
        ...base,
        tint: "rgba(10,10,40,0.15)",
        addFireflies: baseType !== "rain" && baseType !== "snow",
        addStars: baseType !== "fog" && baseType !== "snow",
        celestial: "moon",
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        ...base,
        tint: "rgba(80,30,20,0.10)",
        addFireflies: baseType !== "rain",
        celestial: "sun",
        sunsetGlow: hour >= 17,
      };
    }
    if (hour >= 5 && hour < 9) {
      return {
        ...base,
        tint: "rgba(120,80,40,0.06)",
        celestial: "sun",
        sunRays: true,
      };
    }
    // Daytime (9-17)
    return {
      ...base,
      celestial: "sun",
      sunRays: true,
    };
  }

  // If it just says "afternoon", "day", "noon", etc.
  if (t.includes("noon") || t.includes("midday") || t.includes("afternoon") || t.includes("day")) {
    return {
      ...base,
      celestial: "sun",
      hour: t.includes("afternoon") ? 15 : 12,
      sunRays: true,
    };
  }

  return base;
}

/** Try to extract an hour (0-23) from a time string. Returns -1 if not found. */
function extractHour(t: string): number {
  // "14:30", "2:00 PM", "14h30", "1400"
  const match24 = t.match(/\b(\d{1,2})[:.h](\d{2})\b/);
  if (match24) {
    let h = parseInt(match24[1]!, 10);
    if (t.includes("pm") && h < 12) h += 12;
    if (t.includes("am") && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  // "2 PM", "11 AM"
  const matchAmPm = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1]!, 10);
    if (matchAmPm[2] === "pm" && h < 12) h += 12;
    if (matchAmPm[2] === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24) return h;
  }
  // Military "1400", "0800"
  const matchMil = t.match(/\b(\d{4})\s*(?:hours?|hrs?)?\b/);
  if (matchMil) {
    const h = parseInt(matchMil[1]!.slice(0, 2), 10);
    if (h >= 0 && h < 24) return h;
  }
  return -1;
}

export function resolveWeatherRenderConfig(weather?: string | null, timeOfDay?: string | null): WeatherRenderConfig {
  const weatherConfig = parseWeather(weather);
  const timeConfig = parseTime(timeOfDay, weatherConfig.type);
  const isClearSky =
    !weather ||
    /clear|sunny|bright/i.test(weather) ||
    !/(rain|storm|snow|blizzard|fog|mist|haze|hail|sand|ash|smoke|overcast|cloud|grey|gray)/i.test(weather);
  return { ...weatherConfig, ...timeConfig, isClearSky };
}

// ── Create particle ──
export function createWeatherParticle(
  type: WeatherParticle["type"],
  w: number,
  h: number,
  fromTop = false,
): WeatherParticle {
  const base: WeatherParticle = {
    x: Math.random() * w,
    y: fromTop ? -10 : Math.random() * h,
    vx: 0,
    vy: 0,
    size: 2,
    opacity: 0.5,
    type,
    wobble: Math.random() * Math.PI * 2,
    life: 0,
    maxLife: 600 + Math.random() * 400,
    color: "",
  };

  switch (type) {
    case "rain":
      base.vy = 8 + Math.random() * 6;
      base.vx = -1 + Math.random() * -2;
      base.size = 1.5;
      base.opacity = 0.25 + Math.random() * 0.2;
      base.maxLife = 200;
      break;
    case "snow":
      base.vy = 0.5 + Math.random() * 1.2;
      base.vx = -0.3 + Math.random() * 0.6;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 800;
      break;
    case "leaf":
      base.vy = 0.8 + Math.random() * 1;
      base.vx = 1.5 + Math.random() * 2;
      base.size = 4 + Math.random() * 3;
      base.opacity = 0.5 + Math.random() * 0.3;
      base.maxLife = 500;
      break;
    case "petal":
      base.vy = 0.4 + Math.random() * 0.8;
      base.vx = 0.5 + Math.random() * 1;
      base.size = 3 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 600;
      break;
    case "firefly":
      base.vy = -0.2 + Math.random() * 0.4;
      base.vx = -0.3 + Math.random() * 0.6;
      base.size = 2 + Math.random() * 2;
      base.opacity = 0;
      base.maxLife = 300 + Math.random() * 300;
      break;
    case "star":
      base.vy = 0;
      base.vx = 0;
      base.size = 1 + Math.random() * 1.5;
      base.opacity = 0;
      base.maxLife = 400 + Math.random() * 400;
      base.y = Math.random() * h * 0.4; // upper portion
      break;
    case "fog":
      base.vy = 0;
      base.vx = 0.2 + Math.random() * 0.4;
      base.size = 60 + Math.random() * 80;
      base.opacity = 0.03 + Math.random() * 0.04;
      base.maxLife = 1000;
      break;
    case "dust":
      base.vy = -0.1 + Math.random() * 0.2;
      base.vx = -0.1 + Math.random() * 0.2;
      base.size = 1 + Math.random() * 2;
      base.opacity = 0.15 + Math.random() * 0.15;
      base.maxLife = 600 + Math.random() * 400;
      break;
    case "ember":
      base.vy = -1.5 + Math.random() * -1.5;
      base.vx = -0.5 + Math.random() * 1;
      base.size = 2 + Math.random() * 2;
      base.opacity = 0.6 + Math.random() * 0.3;
      base.maxLife = 300 + Math.random() * 200;
      base.y = h + 10; // rise from bottom
      break;
    case "ash":
      base.vy = 0.3 + Math.random() * 0.6;
      base.vx = -0.4 + Math.random() * 0.8;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.2 + Math.random() * 0.2;
      base.maxLife = 700 + Math.random() * 300;
      base.color = `rgba(${(100 + Math.random() * 40) | 0},${(90 + Math.random() * 30) | 0},${(90 + Math.random() * 30) | 0},0.6)`;
      break;
    case "sand":
      base.vy = 0.5 + Math.random() * 1;
      base.vx = 4 + Math.random() * 4;
      base.size = 1 + Math.random() * 2;
      base.opacity = 0.3 + Math.random() * 0.3;
      base.maxLife = 250 + Math.random() * 150;
      base.x = -10; // enter from left
      base.color = `rgba(${(200 + Math.random() * 30) | 0},${(170 + Math.random() * 30) | 0},${(110 + Math.random() * 20) | 0},0.7)`;
      break;
    case "hail":
      base.vy = 10 + Math.random() * 6;
      base.vx = -1 + Math.random() * -1;
      base.size = 2 + Math.random() * 3;
      base.opacity = 0.4 + Math.random() * 0.3;
      base.maxLife = 150;
      break;
    case "aurora":
      base.vy = 0;
      base.vx = 0.1 + Math.random() * 0.2;
      base.size = 80 + Math.random() * 120;
      base.opacity = 0.04 + Math.random() * 0.03;
      base.maxLife = 1200 + Math.random() * 600;
      base.y = Math.random() * h * 0.35; // upper sky
      break;
  }

  return base;
}

// ── Draw helpers ──
export function drawWeatherParticle(ctx: WeatherCanvasContext, p: WeatherParticle) {
  const fadeIn = Math.min(p.life / 60, 1);
  const fadeOut = Math.max(1 - p.life / p.maxLife, 0);
  const alpha = p.opacity * fadeIn * fadeOut;
  if (alpha <= 0) return;

  ctx.globalAlpha = alpha;

  switch (p.type) {
    case "rain": {
      ctx.strokeStyle = "rgba(180,210,255,0.8)";
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
      ctx.stroke();
      break;
    }
    case "snow": {
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "leaf": {
      ctx.fillStyle = `hsl(${100 + Math.sin(p.wobble) * 30}, 60%, 45%)`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "petal": {
      ctx.fillStyle = `hsl(${340 + Math.sin(p.wobble) * 15}, 80%, 80%)`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "firefly": {
      const pulse = Math.sin(p.life * 0.05) * 0.5 + 0.5;
      ctx.globalAlpha = alpha * 0.28 * pulse;
      ctx.fillStyle = "rgba(180,255,80,0.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * (0.65 + pulse * 0.35);
      ctx.fillStyle = "rgba(220,255,130,0.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "star": {
      const twinkle = Math.sin(p.life * 0.04 + p.wobble) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,255,240,${twinkle * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // cross sparkle
      ctx.strokeStyle = `rgba(255,255,240,${twinkle * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - p.size * 2, p.y);
      ctx.lineTo(p.x + p.size * 2, p.y);
      ctx.moveTo(p.x, p.y - p.size * 2);
      ctx.lineTo(p.x, p.y + p.size * 2);
      ctx.stroke();
      break;
    }
    case "fog": {
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = "rgba(200,200,220,0.08)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 1.5, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "dust": {
      ctx.fillStyle = "rgba(255,240,220,0.6)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ember": {
      const emberPulse = Math.sin(p.life * 0.08) * 0.3 + 0.7;
      ctx.globalAlpha = alpha * 0.32 * emberPulse;
      ctx.fillStyle = "rgba(255,80,20,0.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * emberPulse;
      ctx.fillStyle = "rgba(255,205,70,0.92)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ash": {
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "sand": {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "hail": {
      ctx.fillStyle = "rgba(230,240,255,0.85)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "aurora": {
      // Tall vertical ribbon of colour that sways gently
      const hue = (p.wobble * 60 + p.life * 0.3) % 360;
      const auroraGrad = ctx.createLinearGradient(p.x, p.y - p.size, p.x, p.y + p.size);
      auroraGrad.addColorStop(0, `hsla(${hue},80%,60%,0)`);
      auroraGrad.addColorStop(0.3, `hsla(${hue},80%,60%,0.08)`);
      auroraGrad.addColorStop(0.5, `hsla(${(hue + 40) % 360},70%,55%,0.12)`);
      auroraGrad.addColorStop(0.7, `hsla(${(hue + 80) % 360},80%,60%,0.08)`);
      auroraGrad.addColorStop(1, `hsla(${(hue + 80) % 360},80%,60%,0)`);
      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      const ribbonW = p.size * 0.6;
      const sway = Math.sin(p.life * 0.008 + p.wobble) * 30;
      ctx.moveTo(p.x + sway - ribbonW, p.y - p.size);
      ctx.quadraticCurveTo(p.x + sway * 0.5, p.y, p.x + sway + ribbonW, p.y + p.size);
      ctx.lineTo(p.x + sway - ribbonW, p.y + p.size);
      ctx.quadraticCurveTo(p.x + sway * 0.5, p.y, p.x + sway + ribbonW, p.y - p.size);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.globalAlpha = 1;
}

// ── Celestial drawing helpers ──

/** Get sun/moon X position based on hour. Maps 6:00→left edge, 12:00→center, 18:00→right edge. */
export function weatherCelestialX(hour: number, w: number): number {
  // Sun arc: 6h = 0%, 12h = 50%, 18h = 100% of width
  const t = Math.max(0, Math.min(1, (hour - 6) / 12));
  return w * 0.08 + t * w * 0.84; // 8%-92% of width
}

/** Get sun Y position — arc from bottom-ish up to top and back down. */
export function weatherCelestialY(hour: number, h: number, isMoon: boolean): number {
  if (isMoon) {
    // Moon arc: highest at midnight (hour 0/24), lower at 21h and 5h
    const t = hour >= 12 ? (hour - 21) / 7 : (hour + 3) / 7; // normalized 0-1
    const arc = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
    return h * 0.05 + (1 - arc) * h * 0.2;
  }
  // Sun: lowest at 6h/18h, highest at noon
  const t = Math.max(0, Math.min(1, (hour - 6) / 12));
  const arc = Math.sin(t * Math.PI); // 0 at edges, 1 at noon
  return h * 0.05 + (1 - arc) * h * 0.25; // 5%-30% from top
}

export function drawWeatherSun(
  ctx: WeatherCanvasContext,
  x: number,
  y: number,
  radius: number,
  w: number,
  h: number,
  sunRays: boolean,
  sunsetGlow: boolean,
  frameCount: number,
) {
  ctx.save();

  if (sunsetGlow) {
    // Warm gradient sky wash at bottom
    const glowGrad = ctx.createRadialGradient(x, y, radius, x, y + radius * 6, radius * 12);
    glowGrad.addColorStop(0, "rgba(255,140,50,0.12)");
    glowGrad.addColorStop(0.4, "rgba(255,80,30,0.06)");
    glowGrad.addColorStop(1, "rgba(255,40,20,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Outer glow
  const outerGlow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 4);
  outerGlow.addColorStop(0, sunsetGlow ? "rgba(255,120,40,0.15)" : "rgba(255,240,180,0.12)");
  outerGlow.addColorStop(0.5, sunsetGlow ? "rgba(255,80,20,0.05)" : "rgba(255,240,180,0.04)");
  outerGlow.addColorStop(1, "rgba(255,240,180,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
  ctx.fill();

  // Sun disc
  const discGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  if (sunsetGlow) {
    discGrad.addColorStop(0, "rgba(255,200,100,0.9)");
    discGrad.addColorStop(0.7, "rgba(255,120,40,0.7)");
    discGrad.addColorStop(1, "rgba(255,80,20,0.3)");
  } else {
    discGrad.addColorStop(0, "rgba(255,250,220,0.8)");
    discGrad.addColorStop(0.7, "rgba(255,240,180,0.5)");
    discGrad.addColorStop(1, "rgba(255,230,150,0.2)");
  }
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Animated light rays
  if (sunRays) {
    const rayCount = 12;
    const rotOffset = frameCount * 0.002;
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + rotOffset;
      const pulse = 0.8 + Math.sin(frameCount * 0.01 + i * 1.5) * 0.2;
      const rayLen = radius * (3.5 + pulse * 2);
      const spread = 0.08;
      ctx.fillStyle = sunsetGlow ? "rgba(255,160,60,0.5)" : "rgba(255,250,200,0.4)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle - spread) * rayLen, y + Math.sin(angle - spread) * rayLen);
      ctx.lineTo(x + Math.cos(angle + spread) * rayLen, y + Math.sin(angle + spread) * rayLen);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawWeatherMoon(ctx: WeatherCanvasContext, x: number, y: number, radius: number, _frameCount: number) {
  ctx.save();

  // Soft moonlight glow
  const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 5);
  glow.addColorStop(0, "rgba(180,200,255,0.10)");
  glow.addColorStop(0.4, "rgba(150,180,255,0.04)");
  glow.addColorStop(1, "rgba(150,180,255,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
  ctx.fill();

  // Moon disc (bright side)
  const discGrad = ctx.createRadialGradient(x - radius * 0.15, y - radius * 0.15, 0, x, y, radius);
  discGrad.addColorStop(0, "rgba(230,235,255,0.85)");
  discGrad.addColorStop(0.8, "rgba(200,210,240,0.6)");
  discGrad.addColorStop(1, "rgba(180,190,220,0.3)");
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Crescent shadow (dark side) — offset circle to create crescent shape
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(x + radius * 0.45, y - radius * 0.1, radius * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Subtle crater hints
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "rgba(150,160,190,1)";
  ctx.beginPath();
  ctx.arc(x - radius * 0.25, y - radius * 0.15, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - radius * 0.4, y + radius * 0.25, radius * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - radius * 0.05, y + radius * 0.35, radius * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
