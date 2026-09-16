# CryoFlow mock cluster

A tiny SSH server that emulates an HPC **cluster login node** so CryoFlow's
*remote RELION* feature can be tested without a real cluster. It speaks real
SSH (via the `ssh2` package, already installed in `/home/z/cryoflow/node_modules`),
runs commands through a real `/bin/bash`, and fakes just enough of a cluster:
an Lmod-style `module` tool and a `/projects` scratch filesystem.

## Quick start

```bash
cd /home/z/cryoflow/services/mock-cluster

bun run start          # plain run
bun run dev            # hot-reload run (bun --hot) — survives code edits
# background:  nohup bun run start > /tmp/mock-cluster.log 2>&1 &
```

On first start it generates a 2048-bit RSA host key into `keys/host_key_rsa`
(no passphrase, PKCS#1 PEM — ssh2 does not parse PKCS#8) and reuses it
afterwards. Startup log line: `[mock-cluster] mock cluster listening on :3022`.

**In this sandbox** the tool-call reaper kills any process that is still a
descendant of the tool shell when a call ends, so use the orphaning launcher
and wait for readiness in the same call:

```bash
bash /home/z/cryoflow/services/mock-cluster/launch.sh; sleep 2; \
  node /home/z/cryoflow/services/mock-cluster/test-client.mjs 'echo ok'
# hot mode:  bash launch.sh dev
```

The server runs fine under both bun and node (ESM, no bun-specific APIs);
multiple concurrent exec channels per connection are supported.

## Connect from the CryoFlow app

| Setting      | Value             |
| ------------ | ----------------- |
| Host         | `localhost` (binds `0.0.0.0:3022`) |
| Port         | `3022`            |
| Username     | `cryo`            |
| Auth method  | `password`        |
| Password     | `demo`            |
| remoteRoot   | `/projects/cryoflow` |

Only password auth is accepted; every other method is rejected with a
`password` hint. `sftp` is intentionally **not** supported (subsystem request
is refused) — the app syncs files via exec/tar.

## Fake filesystem & path translation

The mock cluster's filesystem root is `services/mock-cluster/fs/`:

```
fs/
├── home/cryo/        # $HOME on the "cluster" (.bashrc, .bash_profile, .lmod/)
├── opt/bin/module    # fake Lmod-style module tool (executable)
└── projects/         # scratch space — the app creates /projects/cryoflow/…
```

Because spawned bash runs with `cwd = fs/`, **absolute cluster paths in the
command string are rewritten** before execution:

- `/projects/…`  → `<…>/services/mock-cluster/fs/projects/…`
- `/home/cryo/…` → `<…>/services/mock-cluster/fs/home/cryo/…`

So `mkdir -p /projects/cryoflow/x` really creates
`fs/projects/cryoflow/x` on this machine. Configure the app with
`remoteRoot=/projects/cryoflow` and everything just works — no other setting
needed. (Reverse translation is not needed: the app reads files back through
the same exec channel.)

## The `module` tool

`fs/opt/bin/module` is on `PATH` for every command and emulates Lmod:

- `module avail` / `module spider` → prints `relion/4.4.1  relion/5.0.1  relion/5.0-beta` (to stderr, like real Lmod)
- `module load relion/5.0.1|relion/4.4.1|relion/5.0-beta` → exit 0, recorded in `~/.lmod/loaded`
- `module load cuda/*` → exit 0 (no-op)
- `module list` / `module purge` / `module help` behave like Lmod
- anything else → Lmod-style error on stderr, exit 1

RELION itself is **not** shipped here: the server puts
`/home/z/relion-build/bin` and `/home/z/relion-build/deps/mpich/bin` first on
`PATH`, so once the sandbox's real RELION build exists there,
`module load relion/5.0.1 && relion_refine …` runs the real binaries.
`bash -lc '…'` (login shell) works too — `/etc/profile` resets `PATH`, so
`fs/home/cryo/.bash_profile` re-exports it from `CRYOFLOW_MOCK_PATH`.

## Behavior notes

- **exec**: `bash -c <cmd>` with `cwd=fs/`, `HOME=fs/home/cryo`, the mock PATH.
  stdout/stderr stream back; the channel closes with the real exit code.
- **shell**: spawns a login shell (`bash -l`) reading commands from the channel.
- **Background jobs**: `setsid bash -c '…' >log 2>err < /dev/null & echo CRYOFLOW_PID:$!`
  works like on a real node — the detached grandchild survives channel close
  and even a server restart; `$!` is a real pid the app can `kill` later.
- **Signals**: client signals (Ctrl-C etc.) are forwarded to the running
  process. On channel close the direct child gets `SIGHUP` (nohup/setsid jobs
  survive), matching real sshd behavior on connection drop.
- **Logging**: every exec command is logged with a `[mock-cluster]` prefix to
  the server's stdout — check `/tmp/mock-cluster.log` when running backgrounded.

## Test client

No system `ssh`/`sshpass` needed (this sandbox has neither):

```bash
node test-client.mjs                            # full self-test suite (15 steps)
node test-client.mjs 'uname -a && module avail relion'   # run one command
node test-client.mjs --shell                    # exercise the shell channel
```

The suite covers: password auth (+ rejection of wrong passwords),
`module avail/load/list/purge/help` + unknown-module errors, login-shell
(`bash -lc`) PATH handling, exit-code propagation, HOME, path translation,
background jobs with `CRYOFLOW_PID:$!` surviving channel close, SSH signal
forwarding, foreground-job SIGHUP on connection drop, the shell channel, and
sftp refusal.

## Caveats

- One connection user only (`cryo`/`demo`); no agent/key auth.
- No sftp, no direct-tcpip forwarding, no pty (pty requests are accepted
  protocol-wise but the channel itself acts as the pipe).
- Host key is auto-generated and never checked against known_hosts — dev only.
