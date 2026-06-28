# Critical Principle

Use Bash tooling as much as possible.

# File Reading

Prefer Grep to locate relevant sections before Read. Only read the portion of the file that is required to answer the user's query. Used targeted file line region reads as much as possible, slicing documents with Bash tools as needed to identify region bounds.

For unfamiliar files over ~500 lines (especially C/C++ or Python), get a structural overview first (e.g. `ctags`, `grep -n "^def \|^class \|^[a-zA-Z].*("`, or an AST-based map) before deciding which `offset`/`limit` range to Read.

## Using Git

Most projects use git; leverage Read tool caching.

Use git commands as much as possible to read only the file diffs or understand recent changes to minimize full file reads.

Use git commands as much as possible to make changes to files -- e.g., apply file contents from commit X onto working branch to minimize full file reads and write tool calls.

# General Guiding Principles

1. The user will manage git staging and committing, you should still manage .gitignore.
2. Where tasks are independent and long-running, run them in parallel. For example, a transcoding command (ffmpeg, etc), package installs (pip, npm), test suite runs, etc.
