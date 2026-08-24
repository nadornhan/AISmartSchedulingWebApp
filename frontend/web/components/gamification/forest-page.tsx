'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { onTaskDataChanged } from '../../lib/data-events';
import {
  getAchievements,
  getForest,
  getPlantCatalog,
  onGrowthReward,
  selectPlant,
  type AchievementCategoryGroup,
  type ForestResponse,
  type PlantSpeciesSummary,
  type UserPlant,
} from '../../lib/gamification';
import { AchievementsSection } from './achievements-section';
import { EditablePlantName } from './editable-plant-name';
import { PlantVisual } from './plant-visual';

function progressPercent(plant: UserPlant) {
  if (plant.next_stage_at == null) {
    return Math.round(plant.progress_ratio * 100);
  }
  return Math.round(Math.min(1, Math.max(0, plant.progress_ratio)) * 100);
}

export function ForestPage() {
  const [forest, setForest] = useState<ForestResponse | null>(null);
  const [catalog, setCatalog] = useState<PlantSpeciesSummary[]>([]);
  const [categories, setCategories] = useState<AchievementCategoryGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const [forestData, catalogData, achievementsData] = await Promise.all([
        getForest({ signal }),
        getPlantCatalog({ signal }),
        getAchievements({ signal }),
      ]);
      if (signal?.aborted) return;
      setForest(forestData);
      setCatalog(catalogData.plants);
      setCategories(achievementsData.categories);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load your forest.',
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAll(controller.signal);
    return () => controller.abort();
  }, [loadAll]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void loadAll();
      }),
    [loadAll],
  );

  useEffect(
    () =>
      onGrowthReward((reward) => {
        if (reward.stage_changed || reward.plant_completed) {
          setCelebrate(true);
          window.setTimeout(() => setCelebrate(false), 900);
        }
        void loadAll();
      }),
    [loadAll],
  );

  const unlockedCatalog = useMemo(
    () => catalog.filter((plant) => plant.unlocked),
    [catalog],
  );

  async function handleSelect(speciesId: string) {
    setSelectingId(speciesId);
    setError(null);
    try {
      await selectPlant(speciesId);
      await loadAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to select that plant.',
      );
    } finally {
      setSelectingId(null);
    }
  }

  if (isLoading && !forest) {
    return (
      <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
        Growing your forest...
      </div>
    );
  }

  if (error && !forest) {
    return (
      <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6">
        <p className="text-dashboard-text">{error}</p>
        <button
          className="mt-4 rounded-lg bg-dashboard-accent px-4 py-2 text-sm font-medium text-dashboard-bg"
          onClick={() => void loadAll()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!forest) return null;

  const plant = forest.current_plant;
  const needsSelection = forest.needs_plant_selection || !plant;

  return (
    <div className="mx-auto max-w-[1480px] space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium text-dashboard-muted">Personal Forest</p>
        <h1 className="text-3xl font-semibold tracking-normal text-dashboard-text sm:text-4xl">
          Watch your forest grow with every effort
        </h1>
        <p className="max-w-2xl text-sm text-dashboard-muted">{forest.supportive_message}</p>
        <div className="inline-flex items-center gap-3 rounded-lg border border-dashboard-accent/30 bg-dashboard-accent/10 px-4 py-3">
          <span className="text-sm font-medium text-dashboard-muted">
            Available Growth Points
          </span>
          <span className="text-lg font-semibold text-dashboard-accent">
            {forest.unassigned_growth_points} GP
          </span>
        </div>
        {error ? <p className="text-sm text-[var(--red-light)]">{error}</p> : null}
      </section>

      {needsSelection ? (
        <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-dashboard-text">Choose Your First Plant</h2>
          <p className="mt-2 text-sm text-dashboard-muted">
            Pick a companion species. Your {forest.unassigned_growth_points} available GP will be
            applied automatically, and future tasks and focus sessions will help it grow.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unlockedCatalog.map((species) => (
              <button
                className="rounded-xl border border-dashboard-border bg-dashboard-bg/40 p-4 text-left transition hover:border-dashboard-accent/50"
                disabled={selectingId !== null}
                key={species.id}
                onClick={() => void handleSelect(species.id)}
                type="button"
              >
                <PlantVisual size={120} speciesKey={species.image_key} stage="seedling" />
                <p className="mt-3 text-lg font-semibold text-dashboard-text">{species.name}</p>
                <p className="mt-1 text-sm text-dashboard-muted">{species.description}</p>
                <p className="mt-3 text-xs font-medium text-dashboard-accent">
                  {selectingId === species.id ? 'Selecting...' : 'Start growing'}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : plant ? (
        <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-6 shadow-panel">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <PlantVisual
              celebrate={celebrate}
              size={200}
              speciesKey={plant.species.image_key}
              stage={plant.growth_stage}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <EditablePlantName
                name={plant.display_name}
                onRenamed={(next) => {
                  setForest((current) =>
                    current?.current_plant
                      ? {
                          ...current,
                          current_plant: {
                            ...current.current_plant,
                            display_name: next,
                            custom_name: next,
                          },
                        }
                      : current,
                  );
                }}
                plantId={plant.id}
              />
              <p className="text-sm text-dashboard-muted">
                {plant.growth_stage_label} · {plant.species.name}
              </p>
              <p className="text-sm text-dashboard-subtle">{plant.supportive_message}</p>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-dashboard-muted">Growth Points</span>
                  <span className="font-medium text-dashboard-text">
                    {plant.current_growth_points}
                    {plant.next_stage_at != null ? ` / ${plant.next_stage_at}` : ''} GP
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-dashboard-bg/80">
                  <div
                    className="forest-progress-fill h-full rounded-full bg-dashboard-accent"
                    style={{ width: `${progressPercent(plant)}%` }}
                  />
                </div>
              </div>
              <div className="pt-1">
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-dashboard-accent px-4 py-2.5 text-sm font-medium text-dashboard-bg transition hover:brightness-110"
                  href="/gamification/forest"
                >
                  {plant.is_placed_in_forest ? 'Visit in Forest' : 'Plant in Forest'}
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-6 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-dashboard-text">Your Forest Collection</h2>
            <p className="mt-1 text-sm text-dashboard-muted">
              {forest.total_trees_grown > 0
                ? `${forest.total_trees_grown} mature tree${forest.total_trees_grown === 1 ? '' : 's'} grown so far.`
                : 'Plant your seedling early — it will grow in the forest as you earn Growth Points.'}
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-dashboard-border bg-dashboard-bg/40 px-4 py-2.5 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent/50"
            href="/gamification/forest"
          >
            {plant?.is_placed_in_forest ? 'Visit in Forest' : 'Open Forest'}
          </Link>
        </div>
        {forest.completed_plants.length > 0 ? (
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
            {forest.completed_plants.map((tree) => (
              <div
                className="min-w-[140px] rounded-xl border border-dashboard-border bg-dashboard-bg/40 p-3 text-center"
                key={tree.id}
              >
                <PlantVisual size={96} speciesKey={tree.species.image_key} stage="mature" />
                <p className="mt-2 truncate text-sm font-medium text-dashboard-text">
                  {tree.display_name}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-dashboard-text">Plant Catalog</h2>
          <p className="mt-1 text-sm text-dashboard-muted">
            Unlock new companions through steady productivity.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalog.map((species) => (
            <div
              className="rounded-xl border border-dashboard-border bg-dashboard-surface/60 p-4"
              key={species.id}
            >
              <PlantVisual
                locked={!species.unlocked}
                size={110}
                speciesKey={species.image_key}
                stage={species.unlocked ? 'growing' : 'seedling'}
              />
              <p className="mt-3 text-base font-semibold text-dashboard-text">{species.name}</p>
              <p className="mt-1 text-sm text-dashboard-muted">{species.description}</p>
              <p className="mt-2 text-xs text-dashboard-subtle">
                {species.unlocked
                  ? `${species.required_growth_points} GP to mature`
                  : species.unlock_hint || 'Keep growing to unlock'}
              </p>
              {needsSelection && species.unlocked ? (
                <button
                  className="mt-3 text-sm font-medium text-dashboard-accent hover:underline"
                  disabled={selectingId !== null}
                  onClick={() => void handleSelect(species.id)}
                  type="button"
                >
                  {selectingId === species.id ? 'Selecting...' : 'Select plant'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <AchievementsSection categories={categories} />
    </div>
  );
}
