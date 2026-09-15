import { readFileSync } from "node:fs";
import { parseHistory } from "./parser.js";
import { formatHuman, formatJson } from "./format.js";

function printUsage(): void {
  console.error(
    [
      "usage: histnorm [--json] [file]",
      "",
      "Reads a shell history file (bash, zsh extended, or fish) and prints",
      "it back out with one command per line, in a consistent format.",
      "With no file argument, reads from stdin.",
    ].join("\n"),
  );
}

function main(argv: string[]): number {
  let jsonOutput = false;
  let filePath: string | null = null;

  for (const arg of argv) {
    if (arg === "--json") {
      jsonOutput = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      return 0;
    } else if (arg.startsWith("-")) {
      console.error(`unknown option: ${arg}`);
      printUsage();
      return 1;
    } else {
      filePath = arg;
    }
  }

  let raw: string;
  try {
    raw = readFileSync(filePath ?? 0, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`could not read input: ${message}`);
    return 1;
  }

  const entries = parseHistory(raw);
  console.log(jsonOutput ? formatJson(entries) : formatHuman(entries));
  return 0;
}

process.exitCode = main(process.argv.slice(2));
