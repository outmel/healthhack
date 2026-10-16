"use client";

import { LogOut } from "./icons";

export default function LogoutButton({ label = "Log out" }: { label?: string }) {
  return (
    <button
      className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" });
        window.location.assign("/login");
      }}
    >
      <LogOut className="h-4 w-4" />
      {label}
    </button>
  );
}
