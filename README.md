# histnorm

Shell history files are not one format. Depending on the shell and its
settings you get some mix of:

- plain bash: just the command, one per line
- bash with `HISTTIMEFORMAT` + extended history: a `#1690000000` line
  holding a Unix timestamp, immediately followed by the command it belongs to
- zsh extended history (`setopt EXTENDED_HISTORY`): lines like
  `: 1690000000:0;git status`
- fish (`~/.local/share/fish/fish_history`): a YAML-ish block per command,
  `- cmd: git status` followed by `  when: 1690000000`

If you've ever tried to grep across a bash and a zsh history file at once,
or write a script that ranks your most-used commands, you've hit this. Each
format needs its own parsing, timestamps are in different places, and some
lines have no timestamp at all.

`histnorm` reads any of these and prints a flat, consistent view: one
command per line, with its timestamp (if any) and which format it came
from.

## Usage

```
$ histnorm ~/.zsh_history
2023-07-22T10:13:20.000Z  zsh  git status
2023-07-22T10:14:05.000Z  zsh  npm test
--------------------  bash  cd ..
```

Or pipe input in:

```
$ cat ~/.bash_history | histnorm
```

### JSON output

```
$ histnorm --json ~/.zsh_history
[
  {
    "command": "git status",
    "timestamp": 1690020800,
    "time": "2023-07-22T10:13:20.000Z",
    "source": "zsh"
  },
  {
    "command": "npm test",
    "timestamp": 1690020845,
    "time": "2023-07-22T10:14:05.000Z",
    "source": "zsh"
  }
]
```

`timestamp` is the raw Unix seconds from the history file (or `null` if the
line carried none), `time` is that same value as an ISO 8601 string for
convenience, and `source` tells you which format the line was parsed as.

## Building

No dependencies to install. Compile with the TypeScript compiler you
already have, or run the source directly with a TypeScript-aware runner:

```
$ npx tsc
$ node dist/index.js ~/.zsh_history
```

## Status

Early skeleton. Detection is per-line and format-specific. zsh's multi-line
command continuations (a trailing backslash before an embedded newline) are
joined back into a single entry. No unit tests yet, and fish's history file
is still handled by matching `- cmd:`/`when:` lines rather than parsing its
actual structure. See the commit history for progress.
