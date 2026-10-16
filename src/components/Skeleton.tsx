/** Calm placeholder shown while a page loads its data. */
export default function Skeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 pt-4 ${wide ? "max-w-[1200px]" : "max-w-[430px]"}`} aria-busy="true" aria-label="Loading">
      <div className="h-10 w-32 animate-pulse rounded-xl bg-track" />
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-track" />
      <div className="h-40 animate-pulse rounded-[22px] bg-track" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-44 animate-pulse rounded-[22px] bg-track" />
        <div className="h-44 animate-pulse rounded-[22px] bg-track" />
      </div>
    </div>
  );
}
