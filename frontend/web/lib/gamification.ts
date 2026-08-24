import { apiRequest } from './api';

export const GROWTH_REWARD_EVENT = 'chrono:growth-reward';

export type GrowthStage = 'seedling' | 'growing' | 'mature';

export type ForestPosition = {
  x: number;
  y: number;
  z: number;
  rotation_x: number;
  rotation_y: number;
};

export type PlantSpeciesSummary = {
  id: string;
  name: string;
  description: string;
  image_key: string;
  required_growth_points: number;
  unlocked: boolean;
  unlock_hint: string | null;
  is_default: boolean;
};

export type UserPlant = {
  id: string;
  species: PlantSpeciesSummary;
  display_name: string;
  custom_name: string | null;
  current_growth_points: number;
  required_growth_points: number;
  growth_stage: GrowthStage | string;
  growth_stage_label: string;
  status: string;
  progress_ratio: number;
  next_stage_at: number | null;
  supportive_message: string;
  tasks_contributed: number;
  focus_sessions_contributed: number;
  started_at: string;
  completed_at: string | null;
  position: ForestPosition | null;
  is_placed_in_forest: boolean;
};

export type StreakSummary = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  message: string;
};

export type GrowthStageThresholds = {
  seedling: number;
  growing: number;
  mature: number;
};

export type AchievementProgress = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlocked_at: string | null;
  progress_value: number;
  requirement_value: number;
  requirement_type: string;
};

export type AchievementCategoryGroup = {
  id: string;
  label: string;
  achievements: AchievementProgress[];
};

export type GamificationProfile = {
  total_growth_points: number;
  unassigned_growth_points: number;
  total_trees_grown: number;
  streak: StreakSummary;
  current_plant: UserPlant | null;
  needs_plant_selection: boolean;
  stage_thresholds: GrowthStageThresholds;
  recently_unlocked_achievements: AchievementProgress[];
};

export type ForestResponse = {
  forest_name: string;
  unassigned_growth_points: number;
  current_plant: UserPlant | null;
  completed_plants: UserPlant[];
  needs_plant_selection: boolean;
  total_trees_grown: number;
  supportive_message: string;
};

export type ForestSceneResponse = {
  forest_name: string;
  trees: UserPlant[];
  total_trees_grown: number;
  supportive_message: string;
};

export type PlantCatalogResponse = {
  plants: PlantSpeciesSummary[];
};

export type AchievementsResponse = {
  achievements: AchievementProgress[];
  categories: AchievementCategoryGroup[];
};

export type RewardFeedback = {
  awarded: boolean;
  growth_points: number;
  message: string | null;
  plant_message: string | null;
  stage_changed: boolean;
  previous_stage: string | null;
  new_stage: string | null;
  plant_completed: boolean;
  unlocked_achievements: AchievementProgress[];
  profile: GamificationProfile | null;
};

export type PlacePlantInput = {
  position_x: number;
  position_y?: number;
  position_z: number;
  rotation_x?: number;
  rotation_y?: number;
};

type RequestOptions = {
  signal?: AbortSignal;
};

export function emitGrowthReward(reward: RewardFeedback | null | undefined) {
  if (typeof window === 'undefined' || !reward?.awarded) return;
  window.dispatchEvent(
    new CustomEvent(GROWTH_REWARD_EVENT, {
      detail: reward,
    }),
  );
}

export function onGrowthReward(listener: (reward: RewardFeedback) => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const custom = event as CustomEvent<RewardFeedback>;
    if (custom.detail) {
      listener(custom.detail);
    }
  };

  window.addEventListener(GROWTH_REWARD_EVENT, handler);
  return () => window.removeEventListener(GROWTH_REWARD_EVENT, handler);
}

export function getGamificationProfile(options: RequestOptions = {}) {
  return apiRequest<GamificationProfile>('/gamification/profile', {
    signal: options.signal,
  });
}

export function getForest(options: RequestOptions = {}) {
  return apiRequest<ForestResponse>('/gamification/forest', {
    signal: options.signal,
  });
}

export function getForestScene(options: RequestOptions = {}) {
  return apiRequest<ForestSceneResponse>('/gamification/forest/scene', {
    signal: options.signal,
  });
}

export function getPlantCatalog(options: RequestOptions = {}) {
  return apiRequest<PlantCatalogResponse>('/gamification/plants', {
    signal: options.signal,
  });
}

export function selectPlant(speciesId: string, options: RequestOptions = {}) {
  return apiRequest<GamificationProfile>('/gamification/plants/select', {
    method: 'POST',
    body: JSON.stringify({ species_id: speciesId }),
    signal: options.signal,
  });
}

export function renamePlant(
  plantId: string,
  customName: string,
  options: RequestOptions = {},
) {
  return apiRequest<UserPlant>(`/gamification/plants/${plantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ custom_name: customName }),
    signal: options.signal,
  });
}

export function renameForest(forestName: string, options: RequestOptions = {}) {
  return apiRequest<ForestSceneResponse>('/gamification/forest', {
    method: 'PATCH',
    body: JSON.stringify({ forest_name: forestName }),
    signal: options.signal,
  });
}

export function placePlant(
  plantId: string,
  input: PlacePlantInput,
  options: RequestOptions = {},
) {
  return apiRequest<UserPlant>(`/gamification/forest/${plantId}/position`, {
    method: 'PATCH',
    body: JSON.stringify({
      position_x: input.position_x,
      position_y: input.position_y ?? 0,
      position_z: input.position_z,
      rotation_x: input.rotation_x ?? 0,
      rotation_y: input.rotation_y ?? 0,
    }),
    signal: options.signal,
  });
}

export function getAchievements(options: RequestOptions = {}) {
  return apiRequest<AchievementsResponse>('/gamification/achievements', {
    signal: options.signal,
  });
}
