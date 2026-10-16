/** Calm placeholder shown while a page loads its data. */
export default function Skeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 pt-4 ${wide ? "max-w-6xl" : "max-w-2xl"}`} aria-busy="true" aria-label="Loading">
      <div className="h-9 w-32 animate-pulse rounded-full bg-line" />
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-line" />
      <div className="h-32 animate-pulse rounded-3xl bg-line/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-3xl bg-line/70" />
        <div className="h-48 animate-pulse rounded-3xl bg-line/70" />
      </div>
    </div>
  );
}
