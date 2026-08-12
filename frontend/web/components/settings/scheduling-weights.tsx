import { SettingsSection } from './settings-section';

export type SchedulingWeightsValue = {
  aiAssistantEnabled: boolean;
  deadlineUrgency: number;
  priorityLevel: number;
  estimatedDuration: number;
};

type SchedulingWeightsProps = {
  value: SchedulingWeightsValue;
  onChange: (value: SchedulingWeightsValue) => void;
  isDisabled?: boolean;
};

const weights = [
  { label: 'Deadline urgency', key: 'deadlineUrgency' },
  { label: 'Task priority level', key: 'priorityLevel' },
  { label: 'Estimated duration', key: 'estimatedDuration' },
] satisfies Array<{ label: string; key: keyof SchedulingWeightsValue }>;

export function SchedulingWeights({ isDisabled = false, value, onChange }: SchedulingWeightsProps) {
  function updateWeight(key: keyof SchedulingWeightsValue, nextValue: number) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <SettingsSection
      eyebrow="AI scheduling"
      title="Scheduling Weights"
      description="Balance the factors used by the scheduling assistant."
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4 border-b border-dashboard-border pb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-dashboard-text">AI Assistant</p>
            <p className="mt-0.5 text-xs text-dashboard-muted">
              Use scheduling weights when planning tasks.
            </p>
          </div>
          <button
            aria-checked={value.aiAssistantEnabled}
            aria-label="AI scheduling assistant"
            className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${
              value.aiAssistantEnabled
                ? 'border-dashboard-accent bg-dashboard-accent'
                : 'border-dashboard-border bg-[var(--bg-input)]'
            }`}
            disabled={isDisabled}
            onClick={() =>
              onChange({
                ...value,
                aiAssistantEnabled: !value.aiAssistantEnabled,
              })
            }
            role="switch"
            type="button"
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-dashboard-text transition ${
                value.aiAssistantEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
        {weights.map((weight) => (
          <div className="grid gap-2" key={weight.label}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="font-medium text-dashboard-text" htmlFor={weight.key}>
                {weight.label}
              </label>
              <span className="text-dashboard-muted">{value[weight.key]}%</span>
            </div>
            <input
              aria-valuetext={`${value[weight.key]} percent`}
              className="accent-dashboard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              disabled={isDisabled}
              id={weight.key}
              max="100"
              min="0"
              onChange={(event) => updateWeight(weight.key, Number(event.target.value))}
              type="range"
              value={value[weight.key]}
            />
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
