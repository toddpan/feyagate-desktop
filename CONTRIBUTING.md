# Contributing to FeyaGate Desktop

Thanks for taking the time to contribute!

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) v2.1. Be kind, be respectful, assume good faith.

## Workflow

1. **Fork** the repo and create a topic branch from `main`.
2. Run `npm install` (this also fetches the MCP server binary).
3. Make your change. Keep commits focused; conventional-commit prefixes are appreciated (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
4. Run `npm run build` to make sure both the renderer and the Electron main bundle compile.
5. Open a PR with a clear description and screenshots / GIFs for any UI change.

## Reporting issues

When filing a bug, please include:

- OS + version (e.g. macOS 14.5 Sonoma, Windows 11 23H2, Ubuntu 24.04)
- Desktop app version (Help → About)
- MCP server version (Settings → System Info)
- Reproduction steps
- Screenshots or `~/Library/Logs/FeyaGate Desktop/main.log` (path varies per platform)

## Sensitive data

**Never commit:**

- API keys, OAuth client secrets, access tokens
- Personal device IDs, user IDs, account names
- Internal deployment hostnames or paths
- Anything from `resources/server/` other than `.gitkeep` and `README.md`

If you accidentally push a secret, immediately revoke it on the issuing platform, then open an issue — we'll help rewrite history.

## Releasing

Maintainers handle releases. The flow is:

1. Bump version in `package.json` (also bumps `feyagate.serverVersion` if the server contract changed).
2. Update `CHANGELOG.md`.
3. Tag `v<version>`; CI builds and publishes installers automatically.
