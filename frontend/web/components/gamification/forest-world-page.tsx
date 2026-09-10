'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getForestScene,
  onGrowthReward,
  placePlant,
  type ForestSceneResponse,
  type UserPlant,
} from '../../lib/gamification';
import { EditableForestName } from './editable-forest-name';
import { EditablePlantName } from './editable-plant-name';
import { PlantVisual } from './plant-visual';

const ForestScene3D = dynamic(
  () => import('./forest-scene-3d').then((mod) => mod.ForestScene3D),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[min(70vh,640px)] place-items-center rounded-xl border border-dashboard-border bg-[#87c7f5] text-dashboard-muted">
        Loading forest world...
      </div>
    ),
  },
);

export function ForestWorldPage() {
  const [scene, setScene] = useState<ForestSceneResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingPlantId, setPlacingPlantId] = useState<string | null>(null);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rotationDraft, setRotationDraft] = useState(0);

  const loadScene = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getForestScene({ signal });
      if (signal?.aborted) return;
      setScene(data);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load forest scene.',
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadScene(controller.signal);
    return () => controller.abort();
  }, [loadScene]);

  useEffect(
    () =>
      onGrowthReward(() => {
        void loadScene();
      }),
    [loadScene],
  );

  const selectedTree = useMemo(
    () => scene?.trees.find((tree) => tree.id === selectedId) ?? null,
    [scene, selectedId],
  );

  const unplacedTrees = useMemo(
    () => scene?.trees.filter((tree) => !tree.is_placed_in_forest) ?? [],
    [scene],
  );

  useEffect(() => {
    if (selectedTree?.position) {
      setRotationDraft(selectedTree.position.rotation_y ?? 0);
    } else {
      setRotationDraft(0);
    }
  }, [selectedTree?.id, selectedTree?.position?.rotation_y]);

  async function persistPlacement(
    plantId: string,
    position: { x: number; z: number; rotation_y?: number; rotation_x?: number },
  ) {
    setBusy(true);
    setError(null);
    try {
      const updated = await placePlant(plantId, {
        position_x: Math.max(-40, Math.min(40, position.x)),
        position_z: Math.max(-40, Math.min(40, position.z)),
        rotation_x: position.rotation_x ?? 0,
        rotation_y: position.rotation_y ?? rotationDraft,
      });
      setScene((current) =>
        current
          ? {
              ...current,
              trees: current.trees.map((tree) => (tree.id === updated.id ? updated : tree)),
            }
          : current,
      );
      setSelectedId(updated.id);
      setPlacingPlantId(null);
      setRotationDraft(updated.position?.rotation_y ?? 0);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to place that tree.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePlaceAt(position: { x: number; z: number }) {
    if (!placingPlantId) return;
    await persistPlacement(placingPlantId, {
      x: position.x,
      z: position.z,
      rotation_y: rotationDraft,
    });
  }

  async function handleRotate(nextRotation: number) {
    if (!selectedTree?.position || !selectedTree.is_placed_in_forest) {
      setRotationDraft(nextRotation);
      return;
    }
    setRotationDraft(nextRotation);
    await persistPlacement(selectedTree.id, {
      x: selectedTree.position.x,
      z: selectedTree.position.z,
      rotation_x: selectedTree.position.rotation_x ?? 0,
      rotation_y: nextRotation,
    });
  }

  function beginPlace(tree: UserPlant) {
    setPlacingPlantId(tree.id);
    setSelectedId(tree.id);
    setRotationDraft(tree.position?.rotation_y ?? 0);
  }

  if (isLoading && !scene) {
    return (
      <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
        Opening your forest...
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6">
        <p className="text-dashboard-text">{error || 'Forest scene unavailable.'}</p>
        <button
          className="mt-4 rounded-lg bg-dashboard-accent px-4 py-2 text-sm font-medium text-dashboard-bg"
          onClick={() => void loadScene()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  const isEmpty = scene.trees.length === 0;

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-dashboard-muted">3D Forest</p>
          <EditableForestName
            className="mt-2"
            name={scene.forest_name}
            onRenamed={(next) => {
              setScene((current) => (current ? { ...current, forest_name: next } : current));
            }}
          />
          <p className="mt-2 max-w-2xl text-sm text-dashboard-muted">{scene.supportive_message}</p>
          {error ? <p className="mt-2 text-sm text-[var(--red-light)]">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-dashboard-border bg-dashboard-surface px-4 py-2 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent/50"
            onClick={() => setCameraResetKey((value) => value + 1)}
            type="button"
          >
            Reset camera
          </button>
          <Link
            className="rounded-lg bg-dashboard-accent px-4 py-2 text-sm font-medium text-dashboard-bg"
            href="/gamification"
          >
            Back to growth
          </Link>
        </div>
      </section>

      {isEmpty ? (
        <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-8 text-center shadow-panel">
          <PlantVisual size={140} stage="seedling" />
          <h2 className="mt-4 text-xl font-semibold text-dashboard-text">Your forest is waiting</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-dashboard-muted">
            Choose a plant on the Personal Forest page, then return here to plant the seedling and
            watch it grow with every effort.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-dashboard-accent px-4 py-2.5 text-sm font-medium text-dashboard-bg"
            href="/gamification"
          >
            Choose a plant
          </Link>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative">
            <ForestScene3D
              cameraResetKey={cameraResetKey}
              onPlaceAt={(position) => {
                void handlePlaceAt(position);
              }}
              onSelectTree={setSelectedId}
              placingPlantId={busy ? null : placingPlantId}
              selectedId={selectedId}
              trees={scene.trees}
            />
          </div>

          <aside className="space-y-4">
            <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-4 shadow-panel">
              <h2 className="text-base font-semibold text-dashboard-text">Tree details</h2>
              {selectedTree ? (
                <div className="mt-3 space-y-2">
                  <PlantVisual
                    size={96}
                    speciesKey={selectedTree.species.image_key}
                    stage={selectedTree.growth_stage}
                  />
                  <EditablePlantName
                    name={selectedTree.display_name}
                    onRenamed={(next) => {
                      setScene((current) =>
                        current
                          ? {
                              ...current,
                              trees: current.trees.map((tree) =>
                                tree.id === selectedTree.id
                                  ? { ...tree, display_name: next, custom_name: next }
                                  : tree,
                              ),
                            }
                          : current,
                      );
                    }}
                    plantId={selectedTree.id}
                  />
                  <p className="text-sm text-dashboard-muted">
                    {selectedTree.species.name} · {selectedTree.growth_stage_label}
                  </p>
                  <p className="text-xs text-dashboard-subtle">
                    {selectedTree.is_placed_in_forest
                      ? 'Growing in your forest — same plant as your 2D companion'
                      : 'Not planted yet — pick a peaceful clearing'}
                  </p>
                  <label className="mt-3 block text-xs font-medium text-dashboard-muted">
                    Rotate
                    <input
                      className="mt-2 w-full accent-dashboard-accent"
                      max={6.28}
                      min={0}
                      onChange={(event) => {
                        setRotationDraft(Number(event.target.value));
                      }}
                      onPointerUp={(event) => {
                        void handleRotate(Number(event.currentTarget.value));
                      }}
                      step={0.05}
                      type="range"
                      value={rotationDraft}
                    />
                  </label>
                  <button
                    className="mt-2 rounded-lg border border-dashboard-border px-3 py-2 text-sm text-dashboard-text hover:border-dashboard-accent/50"
                    disabled={busy}
                    onClick={() => beginPlace(selectedTree)}
                    type="button"
                  >
                    {selectedTree.is_placed_in_forest ? 'Move in forest' : 'Plant in Forest'}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-dashboard-muted">
                  Click a tree to inspect it, or plant an unplaced seedling below.
                </p>
              )}
            </section>

            <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-4 shadow-panel">
              <h2 className="text-base font-semibold text-dashboard-text">Ready to plant</h2>
              {unplacedTrees.length === 0 ? (
                <p className="mt-2 text-sm text-dashboard-muted">
                  Every plant is already nestled in the forest.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {unplacedTrees.map((tree) => (
                    <li key={tree.id}>
                      <button
                        className="flex w-full items-center justify-between rounded-lg border border-dashboard-border px-3 py-2 text-left text-sm transition hover:border-dashboard-accent/50"
                        onClick={() => beginPlace(tree)}
                        type="button"
                      >
                        <span className="truncate text-dashboard-text">
                          {tree.display_name}
                          <span className="ml-2 text-xs text-dashboard-muted">
                            {tree.growth_stage_label}
                          </span>
                        </span>
                        <span className="text-dashboard-accent">Plant</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
