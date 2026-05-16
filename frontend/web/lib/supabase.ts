import { createTodoListSupabaseClient } from '@todo-list/supabase';

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createTodoListSupabaseClient({ url, anonKey });
}
