export function VolumeSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-sm text-dashboard-text"><span>Alert volume</span><span className="text-dashboard-muted">{value}%</span></span>
      <input aria-label="Alert volume" className="w-full accent-[var(--dashboard-accent)]" max="100" min="0" onChange={(event) => onChange(Number(event.target.value))} type="range" value={value} />
    </label>
  );
}
