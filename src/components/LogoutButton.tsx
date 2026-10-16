"use client";

export default function LogoutButton({ label = "Log out" }: { label?: string }) {
  return (
    <button
      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600"
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" });
        window.location.href = "/login";
      }}
    >
      {label}
    </button>
  );
}
