# FeyaGate Desktop

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-33-blueviolet.svg)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

The cross-platform desktop client for **FeyaGate** — a smart-home MCP gateway that lets AI agents (Claude Code, Cursor, Cline, etc.) control your Xiaomi / Tuya / Midea / eWeLink devices through a local MCP server.

This repository contains only the **Electron + React** desktop shell. The MCP server itself is a separate C++ binary that this app downloads and supervises automatically.

---

## ✨ Features

- 🎛 **Unified dashboard** for Xiaomi, Tuya, Midea and eWeLink devices
- 🔐 **One-click OAuth** for each platform (QR / browser flows)
- 📷 **Live camera streams** with snapshot, vision-AI tagging and motion-trigger rules
- 🤖 **MCP server lifecycle** — auto-launch, port discovery, health checks, log viewer
- 📅 **Schedules, memories, skills** — manage everything the server exposes
- 📊 **Token / trigger / device usage** stats with charts
- 🌙 **Dark / light themes**, system tray, native notifications

> The desktop app talks to the MCP server over `localhost:38090` (configurable). All credentials and device data stay on your machine.

---

## 🚀 Quick start (for users)

Pre-built installers are published on the [Releases](../../releases) page:

- macOS: `FeyaGate-Desktop-<ver>-mac-<arch>.dmg`
- Windows: `FeyaGate-Desktop-<ver>-win-x64.exe`
- Linux: `FeyaGate-Desktop-<ver>-linux-x86_64.AppImage` / `.deb`

The installers bundle the MCP server binary, so nothing else is required.

---

## 🛠 Development

### Prerequisites

- Node.js **≥ 20**
- npm or pnpm
- (optional) `ffmpeg` if you want to test camera snapshot fallback paths

### 1. Install dependencies

```bash
npm install
```

The `postinstall` hook will automatically download the matching MCP server binary into `resources/server/`. You can re-run it manually any time:

```bash
npm run server:fetch
```

The version of the server is pinned in `package.json` under `feyagate.serverVersion`. To upgrade:

```bash
npm run server:fetch -- --version 1.2.16
```

### 2. Run the app

```bash
npm run dev
```

This starts Vite (renderer) and launches Electron with the bundled server.

### 3. Build installers

```bash
npm run dist            # current platform
npm run dist:mac        # macOS dmg + zip
npm run dist:win        # Windows nsis + zip
npm run dist:linux      # AppImage + deb
```

Output ends up in `release/`.

---

## 🧱 Architecture

```
┌────────────────────────────┐
│   AI Agent (Claude / IDE)  │
└────────────┬───────────────┘
             │  MCP / HTTP
             ▼
┌────────────────────────────┐
│  miloco-mcp-server (C++)   │  ← downloaded from GitHub Releases
│  http://localhost:38090    │
└────────────┬───────────────┘
             │  Vendor OpenAPIs
             ▼
   Xiaomi · Tuya · Midea · eWeLink
```

The Electron main process (`electron/main.ts`) supervises the server child process: it picks a free port, rewrites `config.yaml` into the per-user data directory, exposes IPC for the renderer to call, and shows a tray icon.

---

## 🔌 The C++ MCP server

The server lives in a separate repository (binary releases only by default). The desktop app declares which release it expects via `package.json`:

```json
{
  "feyagate": {
    "serverVersion": "1.2.15",
    "serverRelease": "https://gitee.com/panzuji/miloco-mcp-server/releases/download"
  }
}
```

`scripts/download-server.js` reads those fields, picks the right archive for your `platform-arch`, verifies the SHA-256, and unpacks into `resources/server/`. The archive must contain at least:

```
miloco-mcp-server[.exe]    # the binary
config.yaml                # default config (no secrets)
skills/                    # built-in skill packs (optional)
```

If you want to point at a fork or local build, set `FEYAGATE_SERVER_URL` before running the script.

---

## 🤝 Contributing

PRs and issues are welcome. A few rules of thumb:

1. Keep the desktop shell **stateless**; persistent state belongs in the server.
2. Don't commit anything under `resources/server/` — it's downloaded at install time.
3. Don't commit credentials, tokens, OTA URLs or other deployment-specific values. Use environment variables or per-user config.
4. UI strings should be i18n-ready (Chinese is the default; English fallbacks are welcome).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

---

## 📜 License

[MIT](LICENSE) © 2025 FeyaGate Contributors

The bundled MCP server binary is distributed under its own license; see the server repository for details.
