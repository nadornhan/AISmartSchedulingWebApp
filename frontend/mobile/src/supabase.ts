import { createTodoListSupabaseClient } from '@todo-list/supabase';

export function createMobileSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createTodoListSupabaseClient({ url, anonKey });
}
