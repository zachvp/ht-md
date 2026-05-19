# Path Construction
Always use relative paths (`.`, `./`, `../`) or `~` for the home directory.
The current user is `zachvp`. Never hardcode `/Users/<anything>` — use `~/` instead.

# General Guiding Principles
Where tasks are independent and long-running, run them in parallel. For example, a transcoding command (ffmpeg, etc), package installs (pip, npm), test suite runs, etc.
