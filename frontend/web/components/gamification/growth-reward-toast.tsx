'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  onGrowthReward,
  type AchievementProgress,
  type RewardFeedback,
} from '../../lib/gamification';

type ToastItem = {
  id: string;
  title: string;
  body: string;
  achievements: AchievementProgress[];
};

const TOAST_DURATION_MS = 3000;

export function GrowthRewardToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return onGrowthReward((reward: RewardFeedback) => {
      if (!reward.awarded) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const stageTitle = reward.stage_changed
        ? reward.plant_completed
          ? 'Tree matured'
          : 'Stage growth'
        : reward.growth_points > 0
          ? `+${reward.growth_points} Growth Points`
          : 'Forest update';
      const body =
        reward.stage_changed && reward.plant_message
          ? reward.plant_message
          : reward.plant_message || reward.message || 'Your forest appreciated that.';
      setToasts((current) => [
        ...current,
        {
          id,
          title: stageTitle,
          body,
          achievements: reward.unlocked_achievements ?? [],
        },
      ]);
      window.setTimeout(() => {
        dismissToast(id);
      }, TOAST_DURATION_MS);
    });
  }, [dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-[240] flex w-[min(92vw,360px)] flex-col gap-3"
    >
      {toasts.map((toast) => (
        <button
          aria-label={`Dismiss ${toast.title} notification`}
          className="pointer-events-auto w-full cursor-pointer rounded-xl border border-dashboard-accent/40 bg-[#071923]/95 p-4 text-left shadow-panel backdrop-blur-md transition hover:border-dashboard-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent"
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          type="button"
        >
          <p className="text-sm font-semibold text-dashboard-accent">{toast.title}</p>
          <p className="mt-1 text-sm text-dashboard-text">{toast.body}</p>
          {toast.achievements.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {toast.achievements.map((item) => (
                <li className="text-xs text-dashboard-muted" key={item.id}>
                  Achievement unlocked: {item.name}
                </li>
              ))}
            </ul>
          ) : null}
        </button>
      ))}
    </div>
  );
}
