# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open-sourced under the MIT license.
- `scripts/download-server.js` to fetch the MCP server binary from GitHub Releases at install time.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, GitHub issue/PR templates.
- CI workflow that builds installers for macOS, Windows, and Linux on tag push.

### Changed
- The MCP server binary and its built-in skills are no longer vendored in this repository. They are downloaded into `resources/server/` during `npm install`.
- `electron-builder.yml` continues to bundle `resources/server/` as `extraResources`, but expects the directory to be populated by the download script before packaging.
- 平台账号登录页与授权中心文案梳理：把「平台授权」改为「平台登录」，避免与设备授权（License / 订阅授权码）混淆；Hero、StatTile、Toast、Modal、步骤提示等均已更新。

### Fixed
- 托盘图标在 macOS 26.5 (Tahoe) 上「已创建但不显示」：系统把第三方状态项排到屏幕外（实测 frame `y=-17`，窗口 `onScreen=false`），现会检测状态项位置并在不可见时重建（有限次，最多 2 次），显示器变化后复核，并打出诊断日志。系统层面无法由应用强制恢复位置，参见 oMLX #1497 与 CodexBar #998。

### Removed
- Hard-coded vendor API keys, internal OTA hostnames, and corporate email addresses from the entire git history.

## [1.2.15] and earlier

History prior to the open-source release lives in this repository's commit log. Pre-1.2.15 versions were distributed as part of an internal monorepo.
