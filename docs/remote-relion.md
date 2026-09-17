# Remote RELION over SSH — design & usage

> Run the CryoFlow web UI on your laptop; execute the RELION jobs on your
> cluster — the way you always did it in a terminal (`ssh` → `module load
> relion/<version>` → run), but driven from the workflow canvas with live
> progress, streaming logs and automatic result sync-back.

---

## 1. The 30-second tour

1. **Header → Remote clusters (SSH)** — add your login node: host, port,
   username, and a password / private key / SSH agent. Set the
   **remote root** (the cluster directory that mirrors CryoFlow's local
   `data/relion` workdir tree, e.g. `~/cryoflow` or `/lustre/project/you`).
2. **Test & probe** — CryoFlow logs in, detects the module system
   (Lmod / Environment Modules), lists every `relion/*` module it can find
   (`module avail` / `module spider`), resolves each install's binaries,
   `mpirun`, `ctffind`, and whether Slurm / GPUs are visible.
3. Click a job → **Run on cluster (SSH)** (the server icon next to Re-run) →
   pick the connection + the relion module for THIS run → *Send to cluster*.
   Every run can use a different version — that was the whole point.
4. Watch it live: the card gets a cluster chip, the inspector shows
   `user@host · module · pid`, progress parses the cluster log, and the
   **Log tab streams the run output over SSH**.
5. On completion, outputs sync back into the local mirror (STARs rewritten
   to local paths) — the Results views, galleries and downstream jobs work
   unchanged. Files over the sync caps stay on the cluster and are listed
   in the result line.

## 2. What happens under the hood

```
┌──────────────────────────── laptop ────────────────────────────┐
│ CryoFlow (bun run dev)                                          │
│  lib/remote/ssh.ts ─── pooled ssh2 connections (exec-only)      │
│  lib/remote/probe.ts ─ module avail/spider → relion modules      │
│  lib/remote/remote-run.ts                                       │
│    ├─ stage-in: upload inputs (+ STAR path rewriting)           │
│    ├─ wrapper: module load X; cd root; setsid cmd; exit-file     │
│    ├─ poll sweep: one batched SSH round-trip per connection      │
│    └─ sync-back: download outputs (capped) + STAR rewrite back   │
└──────────────┬──────────────────────────────────────────────────┘
               │ ssh (password / key / agent)
┌──────────────▼──────────────────────────────────────────────────┐
│ cluster login node / GPU workstation                             │
│  <remoteRoot>/<projectId>/<jobdir>/  ← mirror of data/relion/…   │
│  .cf-run.sh (module load + env + setsid spawn)                   │
│  .cf-pid (pid + /proc starttime — recycled-pid-proof liveness)   │
│  .cf-exit (the wrapper's exit status — completion truth)         │
│  run.out / run.err (streamed to the Log tab on demand)           │
└──────────────────────────────────────────────────────────────────┘
```

**Command identity.** The remote run uses the SAME `buildArgv` the local
engine uses — the argv is the single source of truth. Only three things
differ: paths are translated onto the cluster mirror, the binary dir comes
from the probed module install, and MPI-parallel types fall back to the
sequential `--debug_split_random_half` path when the module has no `mpirun`
(and prefix `mpirun -n N` when it does). GPUs: when the probe saw
`nvidia-smi`, `--gpu` flags are appended per the job's GPU strategy.

**Data staging.** Local inputs (and every file a STAR references — both
absolute paths and RELION's project-relative `micrographs/x.mrc` form) are
uploaded before the run; STAR files are rewritten so the cluster sees a
consistent tree. External files (e.g. movies on your laptop) land under
`<remoteRoot>/_staged/<hash>/` and the STAR references follow them. Upstream
outputs that already ran on the SAME cluster are reused in place — no
re-upload. Staging is idempotent: identical-size files are skipped, so an
interrupted staging continues where it left off on re-run.

**Sync-back.** On completion (or stop), the job's cluster workdir is
downloaded into the local mirror (per-file and total caps, defaults
512 MB / 2 GB, configurable per connection). STAR files are rewritten back
to local paths, so visualization and downstream LOCAL runs work unchanged.
Downstream REMOTE jobs consume the cluster-side twins directly.

**Liveness that doesn't lie.** The wrapper records the cluster pid AND its
`/proc/<pid>/stat` starttime; the poll only reports ALIVE when both match —
a recycled pid on a long-lived cluster can never fake a live run. The exit
status comes from the wrapper's own `.cf-exit` file; a node reboot or
`kill -9` of the whole session surfaces as an honest "interrupted remotely"
failure (and refine-family checkpoints sync back for `--continue` resume).

**Bun + ssh2 note.** The app runs under Bun, where ssh2's channel
`end()`/EOF never terminates a remote `cat` and the channel `close` event is
unreliable. Uploads therefore use a self-terminating `head -c <N> > file`
consumer (exit 0 ⇒ exactly N bytes written) and command results resolve on
the `exit` event. No SFTP subsystem is required — hardened clusters that
disable it work fine.

## 3. Connection settings reference

| Field | Meaning |
| --- | --- |
| host / port / username | SSH login node coordinates |
| auth | password · private key file (on the laptop) · SSH agent |
| remoteRoot | cluster mirror of the local workdir tree (`~/cryoflow` default) |
| defaultModule | the `module load` target preselected in the Run dialog |
| envLines | extra shell lines sourced before every run (other modules, `export`s) |
| useSlurm | reserved for sbatch submission (not wired yet — direct mode today) |
| maxFileMb / maxTotalMb | sync-back caps per file / per workdir |

**Security notes (please read):** secrets are stored in
`data/remote-connections.json` with `0600` permissions on YOUR machine and
never leave the server (API responses carry `hasPassword` booleans only).
The API routes are guarded by the same same-origin + host-pinning checks as
the rest of CryoFlow. For clusters with one-time-code MFA, use key auth or
an agent — password auth answers keyboard-interactive prompts with the
stored password only.

## 4. Remote pipelines stay remote

When a job completes on a cluster, the pending downstream jobs it
auto-starts inherit the SAME remote target (connection + module + mode).
Engine-native steps (Import, Select, ManualPick…) always run locally in
milliseconds — their outputs stage to the cluster automatically when a
remote consumer needs them. A mixed local/remote graph works: each job runs
where it was sent, and the data follows.

## 5. Honest failure catalog

| Failure | What you see |
| --- | --- |
| wrong credentials / unreachable host | probe fails with the SSH error, old probe data kept |
| `module load` broken for a version | wrapper guard: `relion_refine not found on PATH after module load` (exit 127) |
| cluster disk full / bad path | upload failure names the exact remote path |
| job killed (OOM, admin) | exit code + stderr tail in the result line, logs sync back |
| node reboot / hard kill | "interrupted remotely (no exit status)" — re-run resumes refine-family from checkpoints |
| ssh drops mid-run | the job KEEPS RUNNING on the cluster; polling resumes when the connection returns |
| outputs too big for caps | result line lists what stayed on the cluster and where |
| local node_modules out of date | boot warning `node_modules is out of date — missing ssh2` + `/api/remote/*` fails with `Can't resolve 'ssh2'` — re-run `npm install` (or `bun install`) and restart |

## 6. Testing without a cluster: the mock cluster

`services/mock-cluster/` is a tiny ssh2-based login node with a fake Lmod
(`relion/4.4.1`, `relion/5.0.1`, `relion/5.0-beta`) and stub `relion_*`
binaries that produce realistic STAR/MRC outputs:

```bash
cd services/mock-cluster && bun run dev     # listens on :3022
# In CryoFlow: host 127.0.0.1 · port 3022 · user cryo · password demo
#             remoteRoot /projects/cryoflow
```

The whole remote machinery (probe, staging, spawn, polling, sync-back, stop,
resume) runs against it — this is how the feature is regression-tested
without a real HPC system.

## 7. Roadmap

- **Slurm submission** (`useSlurm`): submit the generated sbatch script via
  SSH, poll `squeue`/`sacct`, `scancel` for stop. The types and UI affordances
  are already in place; direct mode covers workstations/dev nodes today.
- **rsync/tar-based bulk staging** for multi-TB movie sets.
- **Cluster-side GPU reservation awareness** (only dispatch GPU jobs when
  the node actually has one free).
