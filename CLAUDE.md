# Path Construction
Always use `~/` to construct paths for tool calls.
For files/directories in your CWD, always use relative paths (`.`, `./`, `../`).

# General Guiding Principles
Where tasks are independent and long-running, run them in parallel. For example, a transcoding command (ffmpeg, etc), package installs (pip, npm), test suite runs, etc.

