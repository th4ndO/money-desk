/** Shown the moment you tap a link, while the page's numbers load. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-40 rounded bg-border" />
      <div className="h-12 w-56 rounded bg-border" />
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-24" />
        <div className="card h-24" />
      </div>
      <div className="card h-40" />
      <div className="card h-24" />
    </div>
  );
}
