"use client";

/**
 * src/components/triage-override-form.tsx
 *
 * Form override untuk operator — mengoreksi kategori, OPD, atau jalur
 * penanganan hasil AI. Setiap submit tercatat di triage_overrides
 * (POST /api/triage/[id]/override).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants/categories";
import { OPD_SHORT_NAMES } from "@/lib/langflow/schemas";

const FIELD_OPTIONS = [
  { value: "category", label: "Kategori" },
  { value: "opd", label: "OPD" },
  { value: "handling_path", label: "Jalur Penanganan" },
] as const;

const HANDLING_PATH_OPTIONS = [
  { value: "quick_fix", label: "Quick Fix" },
  { value: "bertahap", label: "Bertahap" },
  { value: "butuh_data", label: "Butuh Data Lanjutan" },
];

export function TriageOverrideForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [field, setField] = useState<string>("category");
  const [value, setValue] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valueOptions =
    field === "category"
      ? CATEGORIES.map((c) => ({ value: c.slug, label: c.label }))
      : field === "opd"
        ? OPD_SHORT_NAMES.map((o) => ({ value: o, label: o }))
        : HANDLING_PATH_OPTIONS;

  async function handleSubmit() {
    if (!value) {
      setError("Pilih nilai baru terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/triage/${complaintId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value, note: note || undefined }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Gagal menyimpan override.");
      setSubmitting(false);
      return;
    }

    setValue("");
    setNote("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select
          value={field}
          onValueChange={(v) => {
            setField(v ?? "category");
            setValue("");
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Field yang dikoreksi">
            <SelectValue>
              {(v: string | null) => FIELD_OPTIONS.find((f) => f.value === v)?.label ?? "Pilih field"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value} onValueChange={(v) => setValue(v ?? "")}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Nilai baru">
            <SelectValue>
              {(v: string | null) => valueOptions.find((o) => o.value === v)?.label ?? "Pilih nilai baru"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {valueOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan alasan override (opsional)"
        className="min-h-16"
      />

      {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}

      <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Menyimpan…" : "Simpan Override"}
      </Button>
    </div>
  );
}
