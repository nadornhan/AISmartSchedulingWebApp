import { appName, initialTaskFields } from '@todo-list/shared';
import { createBrowserSupabaseClient } from './supabase';

const supabaseConfigured = Boolean(createBrowserSupabaseClient());

export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div>
          <p className="eyebrow">Todo List</p>
          <h1>{appName}</h1>
        </div>
        <nav>
          <a href="#today">Today</a>
          <a href="#upcoming">Upcoming</a>
          <a href="#garden">Garden</a>
        </nav>
      </aside>

      <section className="workspace" aria-labelledby="setup-heading">
        <div className="topbar">
          <p>{supabaseConfigured ? 'Supabase connected' : 'Supabase env pending'}</p>
          <button type="button">New task</button>
        </div>

        <div className="panel">
          <p className="eyebrow">Chunk 1</p>
          <h2 id="setup-heading">Application foundation is ready</h2>
          <p>
            Web, mobile, shared TypeScript packages, and Supabase wiring are scaffolded for
            account-backed task tracking.
          </p>
          <ul>
            {initialTaskFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
