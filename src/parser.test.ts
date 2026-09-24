import test from "node:test";
import assert from "node:assert/strict";
import { parseHistory } from "./parser.js";

test("plain bash line with no timestamp", () => {
  const entries = parseHistory("ls -la\n");
  assert.deepEqual(entries, [{ command: "ls -la", timestamp: null, source: "plain" }]);
});

test("bash extended history: #<epoch> line applies to the line after it", () => {
  const entries = parseHistory("#1690000000\ngit status\ncd ..\n");
  assert.deepEqual(entries, [
    { command: "git status", timestamp: 1690000000, source: "bash" },
    { command: "cd ..", timestamp: null, source: "plain" },
  ]);
});

test("zsh extended history: single-line entry", () => {
  const entries = parseHistory(": 1690000000:0;git status\n");
  assert.deepEqual(entries, [{ command: "git status", timestamp: 1690000000, source: "zsh" }]);
});

test("zsh extended history: multi-line command joined on continuation backslash", () => {
  const raw = ": 1690000000:0;echo hello \\\nworld\n";
  const entries = parseHistory(raw);
  assert.deepEqual(entries, [
    { command: "echo hello \nworld", timestamp: 1690000000, source: "zsh" },
  ]);
});

test("zsh extended history: a continuation line that is only a backslash contributes an empty segment", () => {
  const raw = ": 1690000000:0;echo hello \\\n\\\nworld\n";
  const entries = parseHistory(raw);
  assert.deepEqual(entries, [
    { command: "echo hello \n\nworld", timestamp: 1690000000, source: "zsh" },
  ]);
});

test("zsh extended history: a literal trailing backslash pair is not a continuation", () => {
  const entries = parseHistory(": 1690000000:0;echo done\\\\\n");
  assert.deepEqual(entries, [
    { command: "echo done\\\\", timestamp: 1690000000, source: "zsh" },
  ]);
});

test("zsh extended history: three trailing backslashes is still a continuation (odd count)", () => {
  const raw = ": 1690000000:0;echo a\\\\\\\nb\n";
  const entries = parseHistory(raw);
  assert.deepEqual(entries, [{ command: "echo a\\\\\nb", timestamp: 1690000000, source: "zsh" }]);
});

test("zsh extended history: an unterminated continuation at end of file is flushed", () => {
  const entries = parseHistory(": 1690000000:0;echo hello \\\n");
  assert.deepEqual(entries, [{ command: "echo hello", timestamp: 1690000000, source: "zsh" }]);
});

test("fish history: cmd followed by when", () => {
  const entries = parseHistory("- cmd: git status\n  when: 1690000000\n");
  assert.deepEqual(entries, [{ command: "git status", timestamp: 1690000000, source: "fish" }]);
});

test("fish history: a cmd with no when line is flushed once the next cmd starts", () => {
  const raw = "- cmd: git status\n- cmd: npm test\n  when: 1690000000\n";
  const entries = parseHistory(raw);
  assert.deepEqual(entries, [
    { command: "git status", timestamp: null, source: "fish" },
    { command: "npm test", timestamp: 1690000000, source: "fish" },
  ]);
});

test("fish history: a trailing cmd with no when line is flushed at end of input", () => {
  const entries = parseHistory("- cmd: git status\n");
  assert.deepEqual(entries, [{ command: "git status", timestamp: null, source: "fish" }]);
});

test("blank lines are dropped", () => {
  const entries = parseHistory("\n\nls\n\n");
  assert.deepEqual(entries, [{ command: "ls", timestamp: null, source: "plain" }]);
});

test("mixed formats in one file are each tagged with their own source", () => {
  const raw = [
    "ls",
    "#1690000000",
    "cd /tmp",
    ": 1690000100:0;git status",
    "- cmd: npm test",
    "  when: 1690000200",
  ].join("\n");
  const entries = parseHistory(raw);
  assert.deepEqual(entries, [
    { command: "ls", timestamp: null, source: "plain" },
    { command: "cd /tmp", timestamp: 1690000000, source: "bash" },
    { command: "git status", timestamp: 1690000100, source: "zsh" },
    { command: "npm test", timestamp: 1690000200, source: "fish" },
  ]);
});
