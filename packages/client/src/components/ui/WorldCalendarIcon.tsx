export function WorldCalendarIcon({ day, className }: { day: string | null; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line
        x1="6"
        y1="2"
        x2="6"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <line
        x1="14"
        y1="2"
        x2="14"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      {day && (
        <text x="10" y="15.5" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="700" opacity="0.95">
          {day}
        </text>
      )}
    </svg>
  );
}
