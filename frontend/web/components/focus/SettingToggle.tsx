type SettingToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 py-2">
      <span>
        <span className="block text-sm font-medium text-dashboard-text">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-dashboard-muted">{description}</span> : null}
      </span>
      <input className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-dashboard-border-strong transition peer-checked:bg-dashboard-accent/80 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}
