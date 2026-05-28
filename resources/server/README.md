# resources/server/

This directory is intentionally empty in the source tree.

It gets populated at `npm install` time (or by running `npm run server:fetch`) with:

- `miloco-mcp-server[.exe]` — the C++ MCP server binary
- `config.yaml` — default server config (no secrets)
- `skills/` — built-in skill packs

Source: see `feyagate.serverRelease` and `feyagate.serverVersion` in the project root `package.json`.

If you want to use a locally-built or forked server, drop the files here manually, or set `FEYAGATE_SERVER_URL` to a custom download base URL before running `npm install`.

> ⚠️ Do not commit anything under this directory. The `.gitignore` is already configured to keep it untracked.
