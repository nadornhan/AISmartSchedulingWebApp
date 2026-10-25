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

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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

export function FlameIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 16 16" {...props}>
      <path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15" />
    </svg>
  );
}

export function LightningIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 16 16" {...props}>
      <path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09zM4.157 8.5H7a.5.5 0 0 1 .478.647L6.11 13.59l5.732-6.09H9a.5.5 0 0 1-.478-.647L9.89 2.41z" />
    </svg>
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
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 16 16" {...props}>
      <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
    </svg>
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

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </IconBase>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="5" fill="currentColor" r="1" stroke="none" />
      <circle cx="12" cy="12" fill="currentColor" r="1" stroke="none" />
      <circle cx="12" cy="19" fill="currentColor" r="1" stroke="none" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9 11v6" />
      <path d="M15 11v6" />
      <path d="m6 7 1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </IconBase>
  );
}

export function MoveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v18" />
      <path d="m8 7 4-4 4 4" />
      <path d="m8 17 4 4 4-4" />
      <path d="M3 12h18" />
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </IconBase>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h6" />
      <path d="M14 6h6" />
      <circle cx="12" cy="6" r="2" />
      <path d="M4 12h10" />
      <path d="M18 12h2" />
      <circle cx="16" cy="12" r="2" />
      <path d="M4 18h2" />
      <path d="M10 18h10" />
      <circle cx="8" cy="18" r="2" />
    </IconBase>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 10a9 9 0 1 1 2.6 8.4" />
      <path d="M3 4v6h6" />
    </IconBase>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20V4" />
      <path d="m6 10 6-6 6 6" />
    </IconBase>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 4v16" />
      <path d="m4 8 4-4 4 4" />
      <path d="M16 20V4" />
      <path d="m12 16 4 4 4-4" />
    </IconBase>
  );
}
