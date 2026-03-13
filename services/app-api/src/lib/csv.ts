import type { Response } from "express";

function escapeCsv(value: unknown): string {
  if (value == null) return "";

  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>
): string {
  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsv(row[column.key])).join(","));
  return [header, ...lines].join("\n");
}

export function setCsvHeaders(res: Response, filename: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}
