import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="6" rx="1.8" width="6" x="4" y="4" />
      <rect height="6" rx="1.8" width="6" x="14" y="4" />
      <rect height="6" rx="1.8" width="6" x="4" y="14" />
      <rect height="6" rx="1.8" width="6" x="14" y="14" />
    </IconBase>
  );
}

export function TasksIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5" cy="6" r="1.5" />
      <path d="M9 6h11" />
      <circle cx="5" cy="12" r="1.5" />
      <path d="M9 12h11" />
      <circle cx="5" cy="18" r="1.5" />
      <path d="M9 18h11" />
    </IconBase>
  );
}

export function PriorityIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 20V5" />
      <path d="M5 5c3-2 5 2 8 0 2-1.3 4-.8 6 .8v8.6c-2-1.6-4-2.1-6-.8-3 2-5-2-8 0" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <rect height="16" rx="2.5" width="18" x="3" y="5" />
      <path d="M3 10h18" />
    </IconBase>
  );
}

export function FocusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 8v4l2.5 2" />
      <path d="M4.5 4.5 3 6" />
      <path d="m19.5 4.5 1.5 1.5" />
      <path d="M4.5 19.5 3 18" />
      <path d="m19.5 19.5 1.5-1.5" />
    </IconBase>
  );
}

export function InsightsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="17" r="2" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="18" cy="15" r="2" />
      <path d="m7.7 15.8 2.9-7" />
      <path d="m13.7 8.2 2.7 5.2" />
      <path d="M5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M5.6 10.2 10.4 15" />
    </IconBase>
  );
}

export function GamificationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a4 4 0 0 0 4 4" />
      <path d="M17 6h3v2a4 4 0 0 1-4 4" />
    </IconBase>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2.5h7A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19 12a7.3 7.3 0 0 0-.1-1.1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.9-1.1L14.3 3h-4.6l-.3 2.8a7.7 7.7 0 0 0-1.9 1.1l-2.4-1-2 3.5 2 1.5A7.3 7.3 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.9 1.1l.3 2.8h4.6l.3-2.8a7.7 7.7 0 0 0 1.9-1.1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1.1Z" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </IconBase>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconBase>
  );
}
