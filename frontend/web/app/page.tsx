'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { appName, type Task } from '@todo-list/shared';
import { createBrowserSupabaseClient } from '../lib/supabase';
import { createTask, deleteTask, listTasks, updateTask } from '../lib/tasks';

const supabase = createBrowserSupabaseClient();

type Draft = {
  title: string;
  description: string;
};

const emptyDraft: Draft = {
  title: '',
  description: '',
};

function normalizeDraft(draft: Draft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function Page() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === 'completed').length,
    [tasks],
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
      setUserEmail(data.session?.user.email ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      setUserEmail(session?.user.email ?? null);
      setTasks([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    listTasks(accessToken)
      .then(setTasks)
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !email.trim()) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setSaving(false);
    setMessage(error ? error.message : 'Check your email for the sign-in link.');
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setMessage('Sign in before creating tasks.');
      return;
    }

    const input = normalizeDraft(draft);

    if (!input.title) {
      setMessage('Task title is required.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const task = await createTask(accessToken, input);
      setTasks((current) => [task, ...current]);
      setDraft(emptyDraft);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task could not be created.');
    } finally {
      setSaving(false);
    }
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditingDraft({
      title: task.title,
      description: task.description ?? '',
    });
  }

  async function saveEdit(taskId: string) {
    if (!accessToken) {
      return;
    }

    const input = normalizeDraft(editingDraft);

    if (!input.title) {
      setMessage('Task title is required.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const task = await updateTask(accessToken, taskId, input);
      setTasks((current) => current.map((item) => (item.id === taskId ? task : item)));
      setEditingId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(task: Task) {
    if (!accessToken) {
      return;
    }

    const status = task.status === 'completed' ? 'active' : 'completed';
    setMessage(null);

    try {
      const updated = await updateTask(accessToken, task.id, { status });
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task status could not be updated.');
    }
  }

  async function removeTask(taskId: string) {
    if (!accessToken) {
      return;
    }

    setMessage(null);

    try {
      await deleteTask(accessToken, taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Task could not be deleted.');
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-[#f4f6f2] text-[#17211b] md:grid-cols-[280px_minmax(0,1fr)]">
      <aside
        className="grid content-start gap-8 bg-[#173524] p-6 text-[#f7fbf5] md:p-8"
        aria-label="Primary navigation"
      >
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-[#75b78d]">
            Todo List
          </p>
          <h1 className="text-3xl font-bold leading-tight">{appName}</h1>
        </div>
        <nav className="grid gap-2">
          <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#tasks">
            Tasks
          </a>
          <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#active">
            Active
          </a>
          <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#done">
            Done
          </a>
        </nav>
      </aside>

      <section className="grid content-start gap-5 p-5 md:p-7" aria-labelledby="tasks-heading">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="m-0 text-[#536258]">
              {supabase ? 'Supabase auth connected' : 'Supabase env pending'}
            </p>
            <h2 id="tasks-heading" className="text-3xl font-bold leading-tight">
              Tasks
            </h2>
          </div>
          {accessToken ? (
            <button
              type="button"
              className="min-h-10 rounded-md bg-[#e8eee5] px-4 py-2 text-[#21342a]"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          ) : null}
        </header>

        {!supabase ? (
          <section className="grid max-w-[820px] gap-4 rounded-lg border border-[#dfe7db] bg-white p-6">
            <p className="m-0 text-xs font-bold uppercase tracking-normal text-[#75b78d]">
              Configuration
            </p>
            <h3 className="m-0 text-xl font-bold">Add Supabase environment values</h3>
            <p className="m-0 text-[#536258]">
              Supabase project URL and anon key are required before account-backed tasks can load.
            </p>
          </section>
        ) : null}

        {supabase && !accessToken ? (
          <section className="grid max-w-[820px] gap-4 rounded-lg border border-[#dfe7db] bg-white p-6">
            <p className="m-0 text-xs font-bold uppercase tracking-normal text-[#75b78d]">
              Account
            </p>
            <h3 className="m-0 text-xl font-bold">Sign in to manage tasks</h3>
            <form className="grid gap-2" onSubmit={handleSignIn}>
              <label className="text-sm font-bold text-[#425149]" htmlFor="email">
                Email
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="min-w-0 rounded-md border border-[#cdd8c8] bg-white px-3 py-2"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
                <button
                  className="min-h-10 rounded-md bg-[#2f6f4e] px-4 py-2 text-white disabled:opacity-65"
                  type="submit"
                  disabled={saving}
                >
                  Send link
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {accessToken ? (
          <>
            <section
              className="grid max-w-[820px] grid-cols-1 gap-3 sm:grid-cols-3"
              aria-label="Task summary"
            >
              {[
                ['Total', tasks.length, undefined],
                ['Active', tasks.length - completedCount, 'active'],
                ['Done', completedCount, 'done'],
              ].map(([label, count, id]) => (
                <div
                  key={String(label)}
                  id={id as string | undefined}
                  className="grid gap-1 rounded-lg border border-[#dfe7db] bg-white p-4"
                >
                  <span className="text-sm text-[#536258]">{label}</span>
                  <strong className="text-3xl leading-none">{count}</strong>
                </div>
              ))}
            </section>

            <section className="grid max-w-[820px] gap-4 rounded-lg border border-[#dfe7db] bg-white p-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-normal text-[#75b78d]">
                  Signed in
                </p>
                <h3 className="m-0 text-xl font-bold">{userEmail ?? 'Current user'}</h3>
              </div>
              <form className="grid gap-2" onSubmit={handleCreate}>
                <label className="text-sm font-bold text-[#425149]" htmlFor="task-title">
                  Title
                </label>
                <input
                  className="rounded-md border border-[#cdd8c8] bg-white px-3 py-2"
                  id="task-title"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Add a task"
                  maxLength={120}
                />
                <label className="text-sm font-bold text-[#425149]" htmlFor="task-description">
                  Description
                </label>
                <textarea
                  className="rounded-md border border-[#cdd8c8] bg-white px-3 py-2"
                  id="task-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Optional details"
                  rows={3}
                />
                <button
                  className="min-h-10 justify-self-start rounded-md bg-[#2f6f4e] px-4 py-2 text-white disabled:opacity-65"
                  type="submit"
                  disabled={saving}
                >
                  Create task
                </button>
              </form>
            </section>

            <section className="grid max-w-[820px] gap-3" id="tasks" aria-label="Tasks">
              {loading ? (
                <p className="rounded-lg bg-[#eef4eb] px-4 py-3 text-[#536258]">Loading tasks...</p>
              ) : null}
              {!loading && tasks.length === 0 ? (
                <p className="rounded-lg bg-[#eef4eb] px-4 py-3 text-[#536258]">
                  No tasks yet. Create the first one above.
                </p>
              ) : null}
              {tasks.map((task) => (
                <article
                  className="grid gap-3 rounded-lg border border-[#dfe7db] bg-white p-5"
                  key={task.id}
                >
                  {editingId === task.id ? (
                    <div className="grid gap-2">
                      <input
                        className="rounded-md border border-[#cdd8c8] bg-white px-3 py-2"
                        value={editingDraft.title}
                        onChange={(event) =>
                          setEditingDraft({ ...editingDraft, title: event.target.value })
                        }
                        maxLength={120}
                      />
                      <textarea
                        className="rounded-md border border-[#cdd8c8] bg-white px-3 py-2"
                        value={editingDraft.description}
                        onChange={(event) =>
                          setEditingDraft({ ...editingDraft, description: event.target.value })
                        }
                        rows={3}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="min-h-10 rounded-md bg-[#2f6f4e] px-4 py-2 text-white"
                          type="button"
                          onClick={() => saveEdit(task.id)}
                          disabled={saving}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="min-h-10 rounded-md bg-[#e8eee5] px-4 py-2 text-[#21342a]"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                        <button
                          type="button"
                          className={`relative h-6 min-h-6 w-6 rounded-full border-2 p-0 ${task.status === 'completed' ? 'border-[#2f6f4e] bg-[#2f6f4e]' : 'border-[#86a191] bg-white'}`}
                          onClick={() => toggleStatus(task)}
                          aria-label={`Mark ${task.title} ${task.status === 'completed' ? 'active' : 'completed'}`}
                        >
                          {task.status === 'completed' ? (
                            <span className="absolute left-1/2 top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-[62%] rotate-45 border-b-2 border-r-2 border-white" />
                          ) : null}
                        </button>
                        <div>
                          <h3 className="m-0 overflow-wrap-anywhere text-lg font-bold">
                            {task.title}
                          </h3>
                          <p className="m-0 text-sm text-[#536258]">
                            Updated {formatDate(task.updatedAt)}
                          </p>
                        </div>
                      </div>
                      {task.description ? (
                        <p className="m-0 text-[#536258]">{task.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-10 rounded-md bg-[#e8eee5] px-4 py-2 text-[#21342a]"
                          onClick={() => startEditing(task)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="min-h-10 rounded-md bg-[#8f2f2f] px-4 py-2 text-white"
                          onClick={() => removeTask(task.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </section>
          </>
        ) : null}

        {message ? (
          <p className="max-w-[820px] rounded-lg bg-[#fff8dc] px-4 py-3 text-[#65551f]">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
