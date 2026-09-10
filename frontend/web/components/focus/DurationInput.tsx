type DurationInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function DurationInput({ label, value, onChange }: DurationInputProps) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-dashboard-text">{label}</span>
      <span className="flex items-center gap-2">
        <input className="h-9 w-20 rounded-lg border border-dashboard-border bg-dashboard-bg px-3 text-right text-sm text-dashboard-text outline-none focus:border-dashboard-accent/60" min="1" max="120" onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} type="number" value={value} />
        <span className="w-8 text-xs text-dashboard-muted">min</span>
      </span>
    </label>
  );
}
