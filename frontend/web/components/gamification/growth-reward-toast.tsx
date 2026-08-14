'use client';

import { useEffect, useState } from 'react';

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

export function GrowthRewardToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 5200);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[240] flex w-[min(92vw,360px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          className="pointer-events-auto rounded-xl border border-dashboard-accent/40 bg-[#071923]/95 p-4 shadow-panel backdrop-blur-md"
          key={toast.id}
          role="status"
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
        </div>
      ))}
    </div>
  );
}
