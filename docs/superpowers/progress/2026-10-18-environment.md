# Verification environment preflight

Date: 2026-10-18  
Repository: `/mnt/c/Users/hi/src/personal_repos/StockPilot`  
Purpose: determine whether a local container verification environment is available. No source files, Docker settings, existing containers, or application processes were changed.

## Result

Docker Desktop is installed and ready. The official executable is `C:\Program Files\Docker\Docker\Docker Desktop.exe`. It was not running at the start of the preflight; it was launched hidden with Windows `Start-Process -WindowStyle Hidden`, as authorized. WSL interop is available, and the Docker Desktop WSL distribution reports `Running`.

At first, the Linux Docker CLI's `desktop-linux` context returned `Failed to initialize: protocol not available`; the Windows CLI at `C:\Program Files\Docker\Docker\resources\bin\docker.exe`, invoked from WSL, successfully reached the daemon at server version **29.8.2**. After Docker Desktop finished initializing WSL integration, the coordinator confirmed the native Linux CLI now works through `/var/run/docker.sock` and reports `29.8.2 Docker Desktop`. Prefer the native Linux CLI and Compose inside WSL for repository verification; no Windows wrapper or path conversion is needed. The earlier `docker.exe ps` showed no running containers. No container was started, stopped, or removed during this preflight.

Ports required by the existing Compose file are already occupied in WSL:

| Port | Listener      |   PID |
| ---- | ------------- | ----: |
| 3000 | `java`        | 49467 |
| 4000 | `next-server` | 49836 |

These are host processes, not Docker containers. They were only inspected with `ss -ltnp` and remain untouched. The preflight did not inspect their command-line arguments or environment. A verification stack must use alternate host ports or explicitly disable host publication and use an isolated Compose project/network; do not bind the default 3000/4000 ports.

## Commands and limits

All ordinary inspection ran inside Ubuntu WSL Bash. Windows-specific checks used WSL interop for the installed Windows executable/process inventory and the native Windows Docker CLI. No `.env` files, connection strings, or secrets were read or printed. Docker settings were not modified. Docker Desktop remains running after the authorized launch.

The local environment is now suitable for image builds and an isolated Compose-backed acceptance run using the native Linux Docker CLI, subject to using non-conflicting ports. The coordinator later noted that Docker Desktop forwarding on this host failed for a backend worker's first host bind; that worker retried on **55433**, where `stockpilot-redesign-db` is now running. Leave this container and its port untouched. The operations runners reserve 3000/4000, check that their own configured port is free, bind loopback only, and clean up only a unique Compose project. No operations stack has been started by this lane yet.

Latest read-only inventory at handoff: Docker Desktop server **29.8.2**; `stockpilot-redesign-db` binds `127.0.0.1:55433->5432`; application ports **3000** and **4000** remain occupied by existing Java/Next.js processes. A 3307 listener was also observed and was not inspected further or changed. The operations lane uses only port 4300 by default and will abort if it is already occupied. Do not change Docker settings or port-forwarding/security controls to work around Desktop behavior.
