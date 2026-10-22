type BrandedLoadingScreenProps = {
  fullScreen?: boolean;
  className?: string;
};

export function BrandedLoadingScreen({
  fullScreen = false,
  className = '',
}: BrandedLoadingScreenProps) {
  return (
    <div
      aria-label="Loading"
      className={`${fullScreen ? 'fixed inset-0 z-[9999] min-h-dvh bg-dashboard-bg' : 'w-full'} grid place-items-center ${className}`}
      role="status"
    >
      <span className="sr-only">Loading</span>
      <span
        aria-hidden="true"
        className={`chrono-loader-icon ${fullScreen ? 'chrono-loader-icon--large' : ''}`}
      />
    </div>
  );
}
