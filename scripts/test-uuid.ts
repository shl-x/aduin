import { sid } from "../supabase/seed/uuid";
const cases = ["r-kec-bantaran","opd-dpu","c-ban-001","r-des-sumberasih"];
for (const c of cases) {
  const u = sid(c);
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u);
  console.log(c.padEnd(22), u, ok ? "✅" : "❌ BAD FORMAT");
}
console.log("idempotent:", sid("r-kec-bantaran") === sid("r-kec-bantaran") ? "✅" : "❌");
