export type HistorySource = "zsh" | "bash" | "fish" | "plain";

export interface HistoryEntry {
  command: string;
  timestamp: number | null;
  source: HistorySource;
}

const ZSH_EXTENDED = /^: (\d+):(\d+);(.*)$/;
// bash with `HISTTIMEFORMAT` + extended history writes a `#<epoch>` line
// immediately before the command it belongs to.
const BASH_TIMESTAMP = /^#(\d{9,10})$/;
const FISH_CMD = /^- cmd:\s?(.*)$/;
const FISH_WHEN = /^\s+when:\s?(\d+)$/;

/**
 * Turn a raw shell history file into a flat list of entries with a
 * best-effort timestamp and a tag for which format the line came from.
 * Blank lines are dropped; everything else that isn't a recognised
 * format is kept as a "plain" entry so nothing silently disappears.
 */
export function parseHistory(input: string): HistoryEntry[] {
  const lines = input.split(/\r?\n/);
  const entries: HistoryEntry[] = [];

  let pendingBashTimestamp: number | null = null;
  let pendingFishCommand: string | null = null;

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }

    const zshMatch = line.match(ZSH_EXTENDED);
    if (zshMatch) {
      entries.push({
        command: unescapeZshCommand(zshMatch[3] ?? ""),
        timestamp: Number(zshMatch[1]),
        source: "zsh",
      });
      continue;
    }

    const bashMatch = line.match(BASH_TIMESTAMP);
    if (bashMatch) {
      pendingBashTimestamp = Number(bashMatch[1]);
      continue;
    }

    const fishCmdMatch = line.match(FISH_CMD);
    if (fishCmdMatch) {
      // flush an unterminated fish entry rather than lose it
      if (pendingFishCommand !== null) {
        entries.push({ command: pendingFishCommand, timestamp: null, source: "fish" });
      }
      pendingFishCommand = fishCmdMatch[1] ?? "";
      continue;
    }

    const fishWhenMatch = line.match(FISH_WHEN);
    if (fishWhenMatch && pendingFishCommand !== null) {
      entries.push({
        command: pendingFishCommand,
        timestamp: Number(fishWhenMatch[1]),
        source: "fish",
      });
      pendingFishCommand = null;
      continue;
    }

    entries.push({
      command: normaliseCommand(line),
      timestamp: pendingBashTimestamp,
      source: pendingBashTimestamp !== null ? "bash" : "plain",
    });
    pendingBashTimestamp = null;
  }

  if (pendingFishCommand !== null) {
    entries.push({ command: pendingFishCommand, timestamp: null, source: "fish" });
  }

  return entries;
}

function normaliseCommand(line: string): string {
  return line.replace(/\s+$/, "");
}

// zsh extended history escapes literal newlines in multi-line commands as
// `\` followed by a real newline; by the time we get here that has already
// been split into separate lines, so we only need to drop a trailing
// backslash that would otherwise look like a stray line continuation.
function unescapeZshCommand(command: string): string {
  return command.replace(/\\$/, "").replace(/\s+$/, "");
}
