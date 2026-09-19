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
  let pendingZsh: { timestamp: number; parts: string[] } | null = null;

  for (const line of lines) {
    // Multi-line zsh commands are written with a trailing backslash before
    // each embedded newline, so a continuation line is not itself a valid
    // history line and must be captured before any of the other checks
    // (including the blank-line skip below) get a chance to run on it.
    if (pendingZsh !== null) {
      const { text, continues } = splitZshContinuation(line);
      pendingZsh.parts.push(text);
      if (continues) {
        continue;
      }
      entries.push({
        command: pendingZsh.parts.join("\n").replace(/\s+$/, ""),
        timestamp: pendingZsh.timestamp,
        source: "zsh",
      });
      pendingZsh = null;
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    const zshMatch = line.match(ZSH_EXTENDED);
    if (zshMatch) {
      const { text, continues } = splitZshContinuation(zshMatch[3] ?? "");
      if (continues) {
        pendingZsh = { timestamp: Number(zshMatch[1]), parts: [text] };
        continue;
      }
      entries.push({
        command: text.replace(/\s+$/, ""),
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

  // An unterminated trailing backslash means the file was truncated
  // mid-command; flush what we have rather than lose it.
  if (pendingZsh !== null) {
    entries.push({
      command: pendingZsh.parts.join("\n").replace(/\s+$/, ""),
      timestamp: pendingZsh.timestamp,
      source: "zsh",
    });
  }

  return entries;
}

function normaliseCommand(line: string): string {
  return line.replace(/\s+$/, "");
}

// zsh extended history escapes each embedded newline in a multi-line command
// as a backslash immediately before the real newline. A doubled backslash at
// the end of a line is a literal backslash in the command, not a
// continuation marker, so continuation is only true on an odd run of
// trailing backslashes.
function splitZshContinuation(line: string): { text: string; continues: boolean } {
  let count = 0;
  while (count < line.length && line[line.length - 1 - count] === "\\") {
    count++;
  }
  if (count % 2 === 1) {
    return { text: line.slice(0, -1), continues: true };
  }
  return { text: line, continues: false };
}
