/**
 * src/app/page.tsx
 * Halaman beranda — redirect ke dashboard sebagai default.
 */
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
