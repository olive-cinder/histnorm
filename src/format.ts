import type { HistoryEntry } from "./parser.js";

export function formatJson(entries: HistoryEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      command: entry.command,
      timestamp: entry.timestamp,
      time: entry.timestamp !== null ? new Date(entry.timestamp * 1000).toISOString() : null,
      source: entry.source,
    })),
    null,
    2,
  );
}

export function formatHuman(entries: HistoryEntry[]): string {
  if (entries.length === 0) {
    return "(no entries)";
  }

  const rows = entries.map((entry) => ({
    time: entry.timestamp !== null ? new Date(entry.timestamp * 1000).toISOString() : "-".repeat(20),
    source: entry.source,
    command: entry.command,
  }));

  const timeWidth = Math.max(...rows.map((r) => r.time.length));
  const sourceWidth = Math.max(...rows.map((r) => r.source.length));

  return rows
    .map((r) => `${r.time.padEnd(timeWidth)}  ${r.source.padEnd(sourceWidth)}  ${r.command}`)
    .join("\n");
}
