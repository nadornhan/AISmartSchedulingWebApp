import { SettingsSection } from './settings-section';

export type SchedulingWeightsValue = {
  deadlineUrgency: number;
  priorityLevel: number;
  estimatedDuration: number;
};

type SchedulingWeightsProps = {
  value: SchedulingWeightsValue;
  onChange: (value: SchedulingWeightsValue) => void;
};

const weights = [
  { label: 'Deadline urgency', key: 'deadlineUrgency' },
  { label: 'Task priority level', key: 'priorityLevel' },
  { label: 'Estimated duration', key: 'estimatedDuration' },
] satisfies Array<{ label: string; key: keyof SchedulingWeightsValue }>;

export function SchedulingWeights({ value, onChange }: SchedulingWeightsProps) {
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
