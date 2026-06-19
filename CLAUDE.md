# Path Construction
Always use relative paths (`.`, `./`, `../`) or `~` for the home directory.
The current user is `zachvp`. Never hardcode `/Users/<anything>` — use `~/` instead.

# General Guiding Principles
Where tasks are independent and long-running, run them in parallel. For example, a transcoding command (ffmpeg, etc), package installs (pip, npm), test suite runs, etc.

# Versioning
Format: `M.D.YY.BUILD` — month, day, 2-digit year, daily build number (no leading zeros).
Example: `6.18.26.0` = first build on June 18, 2026.
Use the `/release` skill to bump the version and tag.
