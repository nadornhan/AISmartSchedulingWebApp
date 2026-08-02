'use client';

export type NotificationDropdownItem = {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  isRead: boolean;
  onSelect?: () => void;
};

type NotificationDropdownProps = {
  error?: string | null;
  isLoading?: boolean;
  items?: NotificationDropdownItem[];
  onClose: () => void;
};

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

export function NotificationDropdown({
  error = null,
  isLoading = false,
  items = [],
  onClose,
}: NotificationDropdownProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between border-b border-dashboard-border px-2 pb-3">
        <h2 className="text-sm font-semibold text-dashboard-text">Notifications</h2>
        <span className="rounded-full bg-dashboard-raised px-2 py-1 text-xs text-dashboard-muted">
          {items.length}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-2 p-2" aria-busy="true">
          <span className="h-14 animate-pulse rounded-lg bg-dashboard-surface" />
          <span className="h-14 animate-pulse rounded-lg bg-dashboard-surface" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <p
          className="rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="grid min-h-24 place-items-center px-4 text-center">
          <div>
            <p className="text-sm font-medium text-dashboard-text">No notifications yet</p>
            <p className="mt-1 text-xs text-dashboard-muted">New task activity will appear here.</p>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="grid gap-1">
          {items.slice(0, 5).map((item) => (
            <button
              className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-dashboard-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              key={item.id}
              onClick={() => {
                item.onSelect?.();
                onClose();
              }}
              type="button"
            >
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-dashboard-accent data-[read=true]:bg-dashboard-muted"
                data-read={item.isRead}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-dashboard-text">
                  {item.title}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block truncate text-xs text-dashboard-muted">
                    {item.description}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs text-dashboard-subtle">
                  {formatCreatedAt(item.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
