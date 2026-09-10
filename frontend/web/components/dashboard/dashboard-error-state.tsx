export function DashboardErrorState({
  message,
  onRetry,
}: Readonly<{
  message: string;
  onRetry: () => void;
}>) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--red-border)] bg-[var(--red-soft)] p-6 text-sm text-[var(--red-light)]"
      role="alert"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>{message}</p>
        <button
          className="h-10 w-fit rounded-[var(--radius-sm)] border border-[var(--red-border)] px-4 font-semibold transition hover:bg-[var(--red-soft)]"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
