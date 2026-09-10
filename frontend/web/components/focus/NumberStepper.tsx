export function NumberStepper({ label, value, onChange, min = 1, max = 10 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-dashboard-text">{label}</span>
      <div className="flex items-center overflow-hidden rounded-lg border border-dashboard-border">
        <button className="h-9 w-9 text-dashboard-muted hover:bg-white/5 hover:text-dashboard-text" onClick={() => onChange(Math.max(min, value - 1))} type="button">−</button>
        <span className="grid h-9 min-w-10 place-items-center border-x border-dashboard-border text-sm text-dashboard-text">{value}</span>
        <button className="h-9 w-9 text-dashboard-muted hover:bg-white/5 hover:text-dashboard-text" onClick={() => onChange(Math.min(max, value + 1))} type="button">+</button>
      </div>
    </div>
  );
}
