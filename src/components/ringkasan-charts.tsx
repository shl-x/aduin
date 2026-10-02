"use client";

/**
 * src/components/ringkasan-charts.tsx
 *
 * Grafik dashboard pimpinan (Recharts):
 *   - CategoryTrendChart : batang bertumpuk aduan per kategori per hari/minggu.
 *     Warna seri tetap per kategori (var(--series-N), urutan CATEGORIES) —
 *     tidak pernah berganti saat rentang waktu diubah. Legend selalu ada,
 *     tooltip per batang, dan tabel data (wajib: 3 slot < 3:1 di light mode).
 *   - KecamatanBarChart  : batang horizontal satu seri (total aduan) per kecamatan.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { CATEGORIES } from "@/lib/constants/categories";
import type { RegionCount, Trend } from "@/lib/analytics/dashboard";

const SERIES = CATEGORIES.map((c, i) => ({
  slug: c.slug,
  label: c.label,
  color: `var(--series-${i + 1})`,
}));

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />;
}

function TrendTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
  const rows = [...payload].filter((p) => Number(p.value) > 0).reverse();
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md text-popover-foreground">
      <p className="font-medium mb-1">
        {label} · {total} aduan
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Tidak ada aduan</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((p) => (
            <li key={String(p.dataKey)} className="flex items-center gap-1.5">
              <Swatch color={String(p.color)} />
              <span className="text-muted-foreground">{p.name}</span>
              <span className="ml-auto pl-3 tabular-nums font-medium">{p.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CategoryTrendChart({ trend }: { trend: Trend }) {
  const data = trend.points.map((p) => ({ label: p.label, total: p.total, ...p.counts }));
  const grandTotal = trend.points.reduce((s, p) => s + p.total, 0);
  const lastSlug = SERIES[SERIES.length - 1].slug;

  if (grandTotal === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Belum ada aduan terkategori dalam {trend.days} hari terakhir.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda kategori">
        {SERIES.map((s) => (
          <li key={s.slug} className="flex items-center gap-1.5 text-muted-foreground">
            <Swatch color={s.color} />
            {s.label}
          </li>
        ))}
      </ul>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={TrendTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
            {SERIES.map((s) => (
              <Bar
                key={s.slug}
                dataKey={s.slug}
                name={s.label}
                stackId="kategori"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={1}
                radius={s.slug === lastSlug ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Lihat sebagai tabel
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 pr-3 text-left font-medium">Periode</th>
                {SERIES.map((s) => (
                  <th key={s.slug} className="py-1 px-2 text-right font-medium whitespace-nowrap">
                    {s.label}
                  </th>
                ))}
                <th className="py-1 pl-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {trend.points.map((p) => (
                <tr key={p.label} className="border-b last:border-0">
                  <td className="py-1 pr-3 whitespace-nowrap">{p.label}</td>
                  {SERIES.map((s) => (
                    <td key={s.slug} className="py-1 px-2 text-right">
                      {p.counts[s.slug] || "–"}
                    </td>
                  ))}
                  <td className="py-1 pl-2 text-right font-medium">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function RegionTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as RegionCount;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md text-popover-foreground">
      <p className="font-medium">Kec. {row.kecamatan}</p>
      <p className="text-muted-foreground">
        {row.total} aduan · {row.active} belum selesai
      </p>
    </div>
  );
}

export function KecamatanBarChart({ regions }: { regions: RegionCount[] }) {
  if (regions.every((r) => r.total === 0)) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Belum ada aduan pada rentang ini.</p>;
  }

  return (
    <div className="w-full" style={{ height: Math.max(160, regions.length * 44) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={regions} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="kecamatan"
            tick={{ ...AXIS_TICK, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <Tooltip content={RegionTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Bar dataKey="total" name="Aduan" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList dataKey="total" position="right" fill="var(--muted-foreground)" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
