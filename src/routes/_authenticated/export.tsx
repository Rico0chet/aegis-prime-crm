import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPORT_DATASETS, downloadCrmWorkbook, type ExportDataset } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/export")({
  component: ExportPage,
  head: () => ({
    meta: [
      { title: "Data Export | Aegis Prime CRM" },
      {
        name: "description",
        content:
          "Export clients, policies, needs analysis questions and answers from your Aegis Prime CRM to an Excel workbook.",
      },
      { property: "og:title", content: "Data Export | Aegis Prime CRM" },
      {
        property: "og:description",
        content: "Download client, policy and needs analysis records as a formatted Excel workbook.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ExportPage() {
  const [selected, setSelected] = useState<ExportDataset[]>(EXPORT_DATASETS.map((d) => d.id));
  const [busy, setBusy] = useState(false);

  function toggle(id: ExportDataset, checked: boolean) {
    setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  async function handleExport() {
    if (!selected.length) {
      toast.error("Select at least one dataset to export.");
      return;
    }
    setBusy(true);
    try {
      const summary = await downloadCrmWorkbook(selected);
      const total = summary.reduce((sum, s) => sum + s.count, 0);
      toast.success(`Workbook downloaded — ${summary.length} sheets, ${total} rows.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const allSelected = selected.length === EXPORT_DATASETS.length;

  return (
    <AppShell
      title="Data Export"
      eyebrow="Records to spreadsheet"
      actions={
        <Button onClick={handleExport} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          Export to Excel
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-brand-accent" />
            Choose what to include
          </CardTitle>
          <CardDescription>
            Each dataset becomes its own worksheet inside a single .xlsx file. You only ever export the
            records you have access to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(allSelected ? [] : EXPORT_DATASETS.map((d) => d.id))}
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>

          <div className="grid gap-3 sm:grid-cols-2">
            {EXPORT_DATASETS.map((dataset) => (
              <label
                key={dataset.id}
                htmlFor={`export-${dataset.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-border p-4 transition-colors hover:bg-brand-surface"
              >
                <Checkbox
                  id={`export-${dataset.id}`}
                  checked={selected.includes(dataset.id)}
                  onCheckedChange={(checked) => toggle(dataset.id, checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{dataset.label}</span>
                  <span className="mt-1 block text-xs text-brand-muted">{dataset.description}</span>
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
