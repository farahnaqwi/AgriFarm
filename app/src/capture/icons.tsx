// One stroked icon set (24px grid, 2px round strokes) instead of emoji.

const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  home: <path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />,
  route: <><circle cx="5.5" cy="18" r="2" /><circle cx="18.5" cy="6" r="2" /><path d="M7.5 18h6a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-6h6" /></>,
  pencil: <path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2z" />,
  undo: <path d="M9 7L4 12l5 5M4 12h10a5 5 0 0 1 0 10h-3" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  warn: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 20V9M7 13l5-5 5 5M5 4h14" />,
  trash: <path d="M5 7h14M9.5 7V4.5h5V7M7 7l1 13h8l1-13" />,
  retry: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4.5V9h-4.5" />,
  pen: <path d="M14.5 5.5l4 4M4 20l1.2-4.8L15.8 4.6a1.4 1.4 0 0 1 2 0l1.6 1.6a1.4 1.4 0 0 1 0 2L8.8 18.8z" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}
