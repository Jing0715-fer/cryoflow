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
   (`module avail` + `--show_hidden` + `module spider` — beta/hidden
   modules included), resolves each install's binaries, `mpirun`,
   `ctffind`, and whether Slurm is present. GPUs: `nvidia-smi` on the
   login node when it has any, otherwise the **Slurm inventory via
   `sinfo`** (partition → GPUs per node → node count) — the honest answer
   for clusters whose GPUs live on the compute nodes only.
3. **New project → Data location** — pick **This machine** (the classic
   local project) or **Cluster (SSH)** and choose one of your SAVED
   connections (the dropdown lists every login node you added — the
   project is bound to that cluster). On a remote project the import
   browser lists the CLUSTER's filesystem (pick movies / STAR files where
   the data actually lives — nothing is downloaded), and the primary Run
   button dispatches to that cluster directly. The header and the project
   list badge the project with its cluster (`user@host`).
4. Click a job → **Run on cluster (SSH)** (the server icon next to Re-run) →
   pick the connection + the relion module for THIS run + the run mode
     (**direct** nohup, or **Slurm sbatch**) — in Slurm mode also the
   **node / partition** (the detected node groups from `sinfo`, each with
   its GPU-per-node figure and hostnames — e.g. `brain2 · 8 GPU/node ·
   brain2`) and the **GPU count** (one MPI rank per GPU, capped by the
   chosen group's width) → *Send to cluster*. Every run can use a different
   version, node and width — that was the whole point.
5. Watch it live: the card gets a cluster chip, the inspector shows
   `user@host · module · pid` (direct) or `Slurm <jobid> · N GPU(s) ·
   queued/running` (sbatch), progress parses the cluster log, and the
   **Log tab streams the run output over SSH**.
6. On completion, outputs sync back into the local mirror (STARs rewritten
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

**Slurm mode (sbatch).** When the run dialog picks *Slurm — sbatch to the
scheduler*, the same argv is wrapped into a submission script modeled on
the classic `sbatch6gpu.sh` idiom, at a GPU width the user chooses (1–8,
default 6):

```bash
#SBATCH --job-name=cf_<type>_<id>
#SBATCH --partition=<connection's partition, if set>
#SBATCH --nodes=1
#SBATCH --ntasks=<gpus>          # one MPI rank per GPU
#SBATCH --cpus-per-task=<threads>
#SBATCH --gres=gpu:<gpus>
# (deliberately NO --mem — see below)
#SBATCH --output=<workdir>/run.out   # the SAME files direct mode uses —
#SBATCH --error=<workdir>/run.err    # log tailing + progress parsing ride on
… module load relion/<ver> …
mpirun -n <gpus> relion_* … --gpu 0:1:…:<gpus-1>
```

**No `--mem`, deliberately (t311).** A node's schedulable RealMemory is
invisible from the login node, so any explicit size is a guess the
controller may refuse AT SUBMIT TIME — the live report that started this
fix was exactly that: `sbatch: error: Memory specification can not be
satisfied` + `Batch job submission failed: Requested node configuration
is not available` (a `--mem=16+12×gpus` formula crossing 64 GB nodes).
The user's own working `sbatch6gpu.sh` requests no memory — the node /
partition defaults apply — and so does the generated script (a commented
`#SBATCH --mem=…` example stays in the script for clusters that want a
pinned size). When a submission IS refused, the error now separates
Slurm's own verdict from the login shell's `~/.bashrc` noise (a broken
`source` line in your dotfiles prints to the same stderr and reads like
the cause — it is named for what it is, so you fix your `.bashrc`, not
us). The GPU width is also clamped server-side to the picked group's
`gpusPerNode` from the last probe — a 5-GPU partition can never receive a
`--gres=gpu:6` request (the other shape of "node configuration not
available").

`run.out` / `run.err` / `.cf-exit` keep their direct-mode contracts, so the
poll sweep, log tab and sync-back work unchanged; liveness comes from
`squeue -j <id>` (the state word — PENDING/RUNNING — rides the record so
the inspector can say *queued* honestly), and **stop is `scancel`**. A
cancelled job writes exit 143 (the TERM trap); a SIGKILL or node loss
leaves no exit file and surfaces as the honest "interrupted remotely"
failure. MPI-parallel types submit one job with N ranks (RELION splits
particles across ranks — global statistics survive); single-GPU types
request `--gres=gpu:1`; CPU types request no GPUs at all.

**Data staging.** Local inputs (and every file a STAR references — both
absolute paths and RELION's project-relative `micrographs/x.mrc` form) are
uploaded before the run; STAR files are rewritten so the cluster sees a
consistent tree. External files (e.g. movies on your laptop) land under
`<remoteRoot>/_staged/<hash>/` and the STAR references follow them. Upstream
outputs that already ran on the SAME cluster are reused in place — no
re-upload. Staging is idempotent: identical-size files are skipped, so an
interrupted staging continues where it left off on re-run.

**Imports enumerate EVERYTHING (t311).** The browser's listing caps at
400 rows per folder (payload sanity — it says so, and shows the folder's
REAL total via a counted `find` pass). The IMPORT itself has no such cap:
picking the folder (or a wildcard pattern) enumerates up to 20,000 images
(`CF_REMOTE_IMPORT_MAX`) on the cluster and writes them all into
`micrographs.star` — the earlier shared 400-entry cap silently imported
only the first 400 of a 2,341-photo shoot. Long picked-file lists render
as a compact summary card in the params tab (`N files · M folders` + the
first two paths, *show all* to edit) instead of a wall of paths.

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
| defaultModule | the `module load` target preselected in the Run dialog — probed, or verified by hand (see §4a) |
| envLines | extra shell lines sourced before every run (other modules, `export`s) |
| useSlurm | preselect sbatch mode in the Run dialog (direct stays one click away) |
| slurmPartition | `#SBATCH --partition` for submissions (empty = the cluster default) |
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
auto-starts inherit the SAME remote target (connection + module + mode —
and, in slurm mode, the same GPU width). Engine-native steps (Import,
Select, ManualPick…) always run locally in milliseconds — their outputs
stage to the cluster automatically when a remote consumer needs them. A
mixed local/remote graph works: each job runs where it was sent, and the
data follows.

## 4a. Beta & hidden modules ("why can't I see relion 5?")

Two honest reasons a relion version the cluster clearly has never shows
up in the module list, both handled:

1. **The parser used to drop it.** OpenHPC-style module names carry
   toolchain suffixes (`relion/beta_5.0_gpu_ompi5_cuda118`,
   `relion/4.0_gpu_ompi4_cuda101`) and the old plausibility filter only
   accepted digit-led versions — a `beta_…`-prefixed name was silently
   discarded even while it sat right there in `module avail` output. The
   filter now accepts pre-release prefixes (beta/alpha/rc/…) and any
   digit-bearing dotted/underscored token, and `beta_5.0_…` sorts as 5.0.
2. **Lmod hides beta modules.** `module load` works for a hidden module
   while `module avail` never lists it. The probe now also asks
   `module avail --show_hidden` (Lmod ≥7 / Environment Modules 4.4+) and
   `module spider`.

Still not listed (admin hid it harder, nonstandard name)? The cluster
manager has a **verify door**: type the exact name
(`relion/beta_5.0_gpu_ompi5_cuda118`), hit *Verify & pin* — the server
loads it in a login shell, requires `relion_refine` on PATH afterwards,
and on success merges the module into the probe's list and pins it as the
default. The Run dialog's module picker also accepts a free-typed name
(the run's module-load guard reports an honest exit-127 with the module
tool's own words when the name is wrong).

## 4b. GPUs: login node vs compute nodes

`nvidia-smi` runs on the LOGIN node — on real HPC clusters there are no
GPUs there (the batch nodes own them), so an empty GPU line is normal,
not a defect. When Slurm is present, the probe reads the scheduler's own
inventory (`sinfo -o '%P|%G|%D|%T|%N'` — the `%N` tail carries the node
hostnames, hostlist-expanded: `brain[2-4]` → `brain2, brain3, brain4`)
and the probe card shows what the compute nodes actually offer (e.g.
`brain2: 8 GPU/node × 1 node (brain2)`). That figure also caps the Run
dialog's GPU stepper. In slurm mode the GPU flags and `--gres` width
describe the COMPUTE node's devices, so a GPU-strategy job gets its `--gpu`
flags even when the login node's nvidia-smi was silent.

## 4c. Local vs remote projects

A project's DATA has a location, chosen at creation (**New project →
Data location**):

- **This machine** — the classic contract: the import browser walks the
  local drives (and WSL distros), jobs run on the local RELION or dispatch
  per-run to any SSH cluster (the ▾ menu keeps both doors).
- **Cluster (SSH)** — the project is BOUND to one saved connection (the
  dropdown lists them; a connection saved in the nested manager becomes
  selectable the moment it closes). The binding is stored per project
  (`projects.json` → `remote.connectionId`), projected secret-free onto
  every project DTO, and shown as a violet `user@host` badge in the header
  and the project list. `PATCH /api/projects/[id]` with
  `remoteConnectionId: <id> | null` re-binds or un-binds (a re-bind is a
  data-location move in intent — paths picked on the old cluster only
  live there; the door exists for the early mistake and for unbinding).

On a remote project:

- **Every path parameter browses the cluster.** The params tab's Browse
  button (violet, server icon) opens the same file browser pointed at the
  CLUSTER's filesystem over SSH (`GET /api/remote/connections/[id]/browse`—
  roots view with `/`, `$HOME` and the remote root, one-level listings
  with sizes/types, wildcard pattern preview `…/*.mrc`, capped at 400
  rows — with the folder's REAL total shown when truncated, and an
  *Import this whole folder* shortcut that bypasses the cap; `~` expands
  cluster-side). Picked paths are CLUSTER-ABSOLUTE.
- **The import writes cluster-absolute STARs.** Import (an engine-native,
  local bookkeeping step) validates and enumerates the picked cluster
  path over SSH — folder and pattern enumerations go to 20,000 entries
  (`CF_REMOTE_IMPORT_MAX`), far past the browser's 400-row preview — and
  writes `micrographs.star` with the cluster paths —
  the data never leaves the cluster, not one movie byte is uploaded. When
  a downstream job dispatches to the SAME cluster, the staging walk finds
  the refs already present and the argv references them exactly as
  written (zero-upload staging).
- **The primary Run button IS the cluster dispatch** (its inputs are
  cluster paths — a local spawn would only fail on files this machine
  does not have), pre-locked to the bound connection. Bookkeeping types
  (import, select, symexpand…) still run locally — they ARE the local
  half of a remote project. The ▾ menu keeps the local door open for
  everything.
- **The run dialog offers the detected nodes.** In Slurm mode the
  "Node / partition" picker lists the probe's sinfo inventory — every GPU
  node group with its per-node figure and hostnames; picking one pins the
  submission (`#SBATCH --partition=<group>`, plus `#SBATCH
  --nodelist=<host>` when the group resolves to a single hostname — the
  literal "submit onto brain2"). "Auto" leaves the choice to the
  scheduler (the connection's default partition applies).

A remote project whose connection was deleted degrades honestly: the
badge disappears (the binding is resolved fresh from the live registry),
the browse/run doors name the missing cluster, and re-adding the
connection restores everything (the binding itself never silently
unbinds).

## 5. Honest failure catalog

| Failure | What you see |
| --- | --- |
| wrong credentials / unreachable host | probe fails with the SSH error, old probe data kept |
| `module load` broken for a version | wrapper guard: `relion_refine not found on PATH after module load` (exit 127) |
| module name wrong (free-typed) | the same 127 guard + the module tool's own complaint in the result line |
| sbatch refused (partition, quota, limits) | `sbatch refused the submission: <slurmd's stderr>` — nothing is lost, re-send after fixing |
| cluster disk full / bad path | upload failure names the exact remote path |
| job killed (OOM, admin) | exit code + stderr tail in the result line, logs sync back |
| job cancelled (scancel) | exit 143, "stopped by user" accounting — checkpoints sync back |
| node reboot / hard kill | "interrupted remotely (no exit status)" — re-run resumes refine-family from checkpoints |
| ssh drops mid-run | the job KEEPS RUNNING on the cluster; polling resumes when the connection returns |
| outputs too big for caps | result line lists what stayed on the cluster and where |
| local node_modules out of date | boot warning `node_modules is out of date — missing ssh2` + `/api/remote/*` fails with `Can't resolve 'ssh2'` — re-run `npm install` (or `bun install`) and restart |

## 6. Testing without a cluster: the mock cluster

`services/mock-cluster/` is a tiny ssh2-based login node with a fake Lmod
(`relion/4.4.1`, `relion/5.0.1`, `relion/5.0-beta` — plus the Lmod-HIDDEN
`relion/beta_5.0_gpu_ompi5_cuda118`, loadable but absent from plain
`module avail`), stub `relion_*` binaries that produce realistic STAR/MRC
outputs, and a mini Slurm (`sbatch`/`squeue`/`scancel`/`sinfo` — the sinfo
answers the 5-field hostlist grammar and its inventory mirrors a real
user cluster: `brain`/`brain3` 6 GPU, `brain2`/`brain4`/`normal02` 8 GPU,
`normal` 5 GPU — one node each — plus the shared `gpu` partition, with
PENDING→RUNNING transitions and honest purge-on-finish) so the whole
remote-Slurm path is testable without a real scheduler. `/data2/…` paths
translate into its fs root the same way `/projects/…` and `/home/cryo/…`
always have, so remote projects can rehearse against `/data2/movies/…`-shaped
input paths:

```bash
cd services/mock-cluster && bun run dev     # listens on :3022
# In CryoFlow: host 127.0.0.1 · port 3022 · user cryo · password demo
#             remoteRoot /projects/cryoflow
```

The whole remote machinery (probe, staging, spawn, polling, sync-back, stop,
resume) runs against it — this is how the feature is regression-tested
without a real HPC system.

## 7. Roadmap

- ~~**Slurm submission** (`useSlurm`)~~ — **shipped**: sbatch generation
  with a user-chosen GPU width, squeue-based liveness, scancel stop,
  downstream passthrough. Array-mode submissions (per-micrograph
  `--array` sharding through the scheduler) are the remaining stretch —
  the HPC dialog already generates such scripts for manual use.
- ~~**Remote projects** (data lives on the cluster)~~ — **shipped**: the
  project's Data location binds it to a saved connection; the import
  browser walks the cluster's filesystem over SSH; imports write
  cluster-absolute STARs (zero-upload staging); the run dialog pins the
  submission to a detected node group (+ `--nodelist` for single-node
  groups).
- **rsync/tar-based bulk staging** for multi-TB movie sets.
- **Cluster-side GPU reservation awareness** (only dispatch GPU jobs when
  the scheduler actually has one free — `squeue -t R` GRES accounting).
- **Node-level (not partition-level) picking on multi-host groups** — the
  picker currently offers the group; a wide `gpu` partition with idle-node
  awareness could offer the individual host.
