import { createTodoListSupabaseClient } from '@todo-list/supabase';

export function createBrowserSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createTodoListSupabaseClient({ url, anonKey });
}
