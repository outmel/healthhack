import LogoutButton from "./LogoutButton";

export default function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">Teman</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-stone-600">{subtitle}</p>}
        </div>
        <LogoutButton />
      </header>
      {children}
      <footer className="mt-auto border-t border-stone-200 pt-3 text-sm text-stone-500">
        Teman flags trends; it doesn&apos;t diagnose. In an emergency, call <strong className="text-red-700">995</strong>.
      </footer>
    </div>
  );
}
