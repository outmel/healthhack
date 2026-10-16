import { redirect } from "next/navigation";

// proxy.ts normally handles this; kept as a fallback.
export default function Home() {
  redirect("/login");
}
