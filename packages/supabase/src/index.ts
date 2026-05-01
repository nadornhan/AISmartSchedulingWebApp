import { createClient } from '@supabase/supabase-js';

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export function createTodoListSupabaseClient(config: SupabaseConfig) {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
