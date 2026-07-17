export function WorldClockIcon({
  display,
  variant,
  className,
}: {
  display: { hour: number | null; minute: number | null };
  variant: "monochrome" | "accented";
  className?: string;
}) {
  const hasTime = display.hour !== null && display.minute !== null;
  const hour = display.hour ?? 0;
  const minute = display.minute ?? 0;
  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6;
  const rimColor = variant === "accented" ? "var(--muted-foreground)" : "currentColor";
  const minuteColor = variant === "accented" ? "var(--primary)" : "currentColor";

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="8" stroke={rimColor} strokeWidth="1.5" opacity="0.7" />
      <line
        x1="10"
        y1="10"
        x2={hasTime ? 10 + 4.2 * Math.sin((hourAngle * Math.PI) / 180) : 10}
        y2={hasTime ? 10 - 4.2 * Math.cos((hourAngle * Math.PI) / 180) : 5.5}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.95"
      />
      <line
        x1="10"
        y1="10"
        x2={hasTime ? 10 + 5.8 * Math.sin((minuteAngle * Math.PI) / 180) : 14}
        y2={hasTime ? 10 - 5.8 * Math.cos((minuteAngle * Math.PI) / 180) : 10}
        stroke={minuteColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.95" />
    </svg>
  );
}

export function WorldThermometerIcon({
  display,
  variant,
  className,
}: {
  display: { percent: number; color: string; value: number | null };
  variant: "solid-bulb" | "outline-bulb";
  className?: string;
}) {
  const hasValue = display.value !== null;
  const fill = display.percent / 100;
  const fillHeight = 12 * fill + 1;
  const fillY = 1 + 12 * (1 - fill);
  const solidBulb = variant === "solid-bulb";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 20"
      fill="none"
      className={className}
      opacity={!solidBulb && !hasValue ? 0.45 : undefined}
    >
      <rect
        x="3"
        y="1"
        width="4"
        height="13"
        rx="2"
        fill="none"
        stroke={display.color}
        strokeWidth="1.2"
        opacity={solidBulb ? (hasValue ? 1 : 0.3) : undefined}
      />
      <rect
        x="3.8"
        y={fillY}
        width="2.4"
        height={fillHeight}
        rx="1"
        fill={display.color}
        opacity={solidBulb ? (hasValue ? 0.9 : 0.2) : 0.9}
      />
      <circle
        cx="5"
        cy="17"
        r="2.5"
        fill={solidBulb ? display.color : "none"}
        stroke={solidBulb ? undefined : display.color}
        strokeWidth={solidBulb ? undefined : 1.2}
        opacity={solidBulb ? (hasValue ? 1 : 0.25) : undefined}
      />
    </svg>
  );
}
