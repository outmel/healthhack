"use client";

export default function LogoutButton({ label = "Log out", className = "" }: { label?: string; className?: string }) {
  return (
    <button
      className={`text-[15px] font-semibold text-brand underline underline-offset-4 hover:text-brand-dark ${className}`}
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" });
        window.location.assign("/login");
      }}
    >
      {label}
    </button>
  );
}
