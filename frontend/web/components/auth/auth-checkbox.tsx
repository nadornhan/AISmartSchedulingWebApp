type AuthCheckboxProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function AuthCheckbox({ id, label, checked, onChange }: AuthCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#f4f7f6]" htmlFor={id}>
      <input
        checked={checked}
        className="peer sr-only"
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex size-5 shrink-0 items-center justify-center rounded-[10px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] ${
          checked
            ? 'bg-[var(--accent)]'
            : 'border border-[var(--accent)] bg-transparent'
        }`}
      >
        {checked ? <span className="size-2 rounded-[10px] bg-[#040c14]" /> : null}
      </span>
      <span>{label}</span>
    </label>
  );
}
