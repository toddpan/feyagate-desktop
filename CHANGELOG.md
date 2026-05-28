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

### Removed
- Hard-coded vendor API keys, internal OTA hostnames, and corporate email addresses from the entire git history.

## [1.2.15] and earlier

History prior to the open-source release lives in this repository's commit log. Pre-1.2.15 versions were distributed as part of an internal monorepo.
