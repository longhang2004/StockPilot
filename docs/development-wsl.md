# Development in Ubuntu WSL2

Run the Linux toolchain in Ubuntu rather than mixing Windows Node, pnpm, or
`node_modules` with Linux processes. This repository requires Node 24 and pins
pnpm 10.13.1 in `package.json`.

From a Windows terminal, launch actual commands with:

```powershell
wsl.exe --distribution Ubuntu --cd /mnt/c/Users/hi/src/personal_repos/StockPilot --exec bash -lc 'node --version && pnpm --version'
```

The repaired local environment installs the official Linux Node distribution in
`~/.local/opt/node24` and pnpm in `~/.local/bin`. `~/.profile` prepends these
directories so `bash -lc` resolves Linux binaries. Verify before installing:

```bash
node -p 'process.platform + " " + process.execPath'
command -v pnpm
docker version
```

`process.platform` must be `linux`. A Node or pnpm path under `/mnt/c/Program Files`
or `/mnt/c/Users/.../AppData` indicates a Windows toolchain leaking into the shell.
Install a supported Linux Node 24 release from the
[official downloads](https://nodejs.org/en/download), verifying its signed checksums
with the [Node release keys](https://github.com/nodejs/release-keys). Install the
repository's exact pnpm version with that Linux npm.

## Dependencies on a Windows checkout

Writing thousands of dependency files through `/mnt/c` is slow. pnpm can choose a
store on the checkout's drive even when launched by Linux Node. Place both its
content-addressable store and virtual store on WSL's native filesystem:

```bash
pnpm install --frozen-lockfile --store-dir "$HOME/.local/share/pnpm/store" --virtual-store-dir "$HOME/.local/share/stockpilot/pnpm-virtual-store"
```

Use the same two arguments for subsequent installs in this checkout. For
`pnpm update`, pass the virtual-store location as a config option instead:

```bash
pnpm update --store-dir "$HOME/.local/share/pnpm/store" --config.virtual-store-dir="$HOME/.local/share/stockpilot/pnpm-virtual-store"
```

Do not assume `node_modules/.modules.yaml` replaces those options. The repaired
local account also sets the native content store as a user-level pnpm default;
`pnpm store path` from the repository must resolve under `/home/`, not `/mnt/c/`.
These locations are machine specific and are intentionally absent from the
committed `.npmrc`. Do not reuse these Linux dependencies from Windows Node.

Next.js Turbopack resolves files within its project root. An external virtual
store requires either a checkout inside the WSL home directory with the normal
workspace-local virtual store, or the Webpack CLI option when running Next from
this mounted checkout (`pnpm --filter @stockpilot/web exec next dev --webpack`
and `pnpm --filter @stockpilot/web exec next build --webpack`). Prefer the native
Linux checkout for the standard build. Do not broaden `turbopack.root` to `/`
just to include an external dependency store. See the bundled Next.js guide or
the [Turbopack root documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory).

For an NTFS checkout that shows only executable-bit changes after running WSL:

```bash
git config --local core.filemode false
```

This is a repository-local interoperability setting; it does not change files.

## PostgreSQL through Docker Desktop

In Docker Desktop, enable the WSL2 backend and Ubuntu under **Settings → Resources
→ WSL Integration**. Docker must then resolve to a Linux client such as
`/usr/bin/docker` inside Ubuntu. See the
[Docker WSL integration instructions](https://docs.docker.com/desktop/features/wsl/).
Do not install a second Docker Engine in the same Ubuntu distribution alongside
Docker Desktop integration.

Start only the local database service:

```bash
docker compose up -d --wait postgres
docker compose exec -T postgres pg_isready -U stockpilot_admin -d stockpilot
```

The Compose database and `.env.example` use the same development-only URLs:

```bash
export DATABASE_URL=postgresql://stockpilot_app:stockpilot_app@localhost:5432/stockpilot
export MIGRATION_DATABASE_URL=postgresql://stockpilot_admin:stockpilot_admin@localhost:5432/stockpilot
pnpm db:generate
pnpm --filter @stockpilot/api exec prisma migrate deploy
pnpm db:seed
pnpm test:unit
```

Keep production credentials separate. The integration-test database contains
disposable local test data; inspect each test's setup before pointing it at any
other database. Leave the named Compose volume intact between runs unless a
deliberate reset is needed.

## Playwright ports

The E2E server checks that its API and web ports are free before starting. If
your usual development servers already use ports 4000 and 3000, run Playwright
on alternate ports:

```bash
E2E_API_PORT=4400 E2E_WEB_PORT=3300 pnpm test:e2e
```

The selected ports are passed through the API, web rewrites, and browser origin.
Without these variables, the harness keeps the standard 4000 and 3000 ports.
