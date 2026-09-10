'use client';

import Link from 'next/link';

import type { DashboardForestSummary } from '../../lib/dashboard';
import { PlantVisual } from './plant-visual';

type ForestWidgetProps = {
  forest?: DashboardForestSummary | null;
};

export function ForestWidget({ forest }: ForestWidgetProps) {
  if (!forest) {
    return (
      <article className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
        <p className="text-sm font-medium text-dashboard-muted">Personal Forest</p>
        <p className="mt-2 text-dashboard-text">Your forest is waiting.</p>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-dashboard-accent hover:underline"
          href="/gamification"
        >
          View Forest
        </Link>
      </article>
    );
  }

  const needsSelection = Boolean(forest.needs_plant_selection);
  const displayName = forest.display_name || forest.species_name || 'Choose a plant';
  const stage = forest.growth_stage || 'seedling';
  const gp = forest.current_growth_points ?? 0;
  const next = forest.next_stage_at;

  return (
    <article className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="flex items-start gap-4">
        <PlantVisual
          size={72}
          speciesKey={forest.species_name?.toLowerCase().replace(/\s+/g, '_')}
          stage={needsSelection ? 'seedling' : stage}
          locked={needsSelection}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-dashboard-muted">Personal Forest</p>
          <p className="mt-1 truncate text-xl font-semibold text-dashboard-text">{displayName}</p>
          <p className="mt-1 text-sm text-dashboard-muted">
            {needsSelection
              ? forest.supportive_message || 'Choose a plant to begin.'
              : `${forest.growth_stage_label || stage} · ${gp} GP${
                  next != null ? ` · next at ${next}` : ''
                }`}
          </p>
          <Link
            className="mt-3 inline-flex text-sm font-medium text-dashboard-accent hover:underline"
            href="/gamification"
          >
            View Forest
          </Link>
        </div>
      </div>
    </article>
  );
}
