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
     (**direct** nohup, or **Slurm sbatch** — two side-by-side cards, t326)
   — in Slurm mode also the
   **node / partition** (the detected node groups from `sinfo`, each with
   its GPU-per-node figure and hostnames — e.g. `brain2 · 8 GPU/node ·
   brain2`) and the **GPU count** (one MPI rank per GPU, capped by the
   chosen group's width) → *Send to cluster*. Every run can use a different
   version, node and width — that was the whole point. The dialog's
   **submission preview** (t326) shows the sbatch directives these knobs
   produce (`--partition`, `--nodelist`, `--gres`, `--ntasks`,
   `--array`, `mpirun -n`) — every flag it shows is one the dispatch
   actually writes; the lifecycle strip under it says what happens after
   Send (stage inputs → load module → run → sync key files back; bulky
   maps and stacks stay on the cluster, fetchable from Results on demand).
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

**The node-pin pre-flight (t337).** The width clamp above used to key
ONLY on the picked partition — which left two silent holes straight into
the controller's submit-time refusal `Requested node configuration is
not available`: an explicit `--nodelist` pin suppresses the partition
(and nothing clamped against the NODE's own GPUs — pinning the 5-GPU
`normal` at the default width 6 composed the refusal verbatim), and
"auto" (no picked partition) still carried the CONNECTION'S default
partition with no clamp at all. Now every Slurm dispatch with a node pin
runs ONE extra SSH round (`scontrol show node <pin> -o`, the same pure
parser the usage panel rides) BEFORE a byte stages: an unknown node, a
DOWN/DRAIN node, or a 0-GPU node under a GPU job refuses with the cause
named and the fix taught (pick another node / release the pin); a
narrower node clamps the width to its own GPUs. With no pin, the width
clamps to the partition the script will actually carry — picked OR the
connection's default. A probe that cannot run (SSH blip, no `scontrol`)
degrades to the old behavior — monitoring never blocks a dispatch — and
the residual drift window (a node that goes down between the pre-flight
read and the controller's own decision) is covered by a TRANSLATED
refusal: the error names what was requested (pin · partition · GPU
width) and the three moves that fix it, instead of quoting Slurm's
one-liner.

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

**Imports enumerate EVERYTHING (t311/t312).** The browser's listing
itself carries the WHOLE folder (t312 retired the 400-row preview cap:
the shared browser ceiling is 20,000 entries by default, `CF_BROWSER_MAX`
tunable, and the dialog virtualizes the rows so a 2,054-image session
scrolls like a 40-row one — every image visible, every image selectable).
The IMPORT has the same world view: picking the folder (or a wildcard
pattern) enumerates up to 20,000 images (`CF_REMOTE_IMPORT_MAX`) on the
cluster and writes them all into `micrographs.star` — the earlier shared
400-entry cap silently imported only the first 400 of a 2,341-photo
shoot. Long picked-file lists render as a compact summary card in the
params tab (`N files · M folders` + the first two paths, *show all* to
edit) instead of a wall of paths.

**The CTF door reads BYTES, not names (t314, replacing t312's smell test).**
The first cut refused any ctffind input whose rows *smelled* like EPU
movie naming — and the Beijing follow-up proved the false positive:
that session's `Micrographs/` folder held MotionCor2 OUTPUTS (motioncor2
keeps the movie's basename, so `xxx_Fractions.mrc` + `xxx_Fractions_DW.mrc`
are summed single-section micrographs, 64 MB float32 apiece — a raw stack
never matches its sum's size). The current gate smells the resolved
STAR's rows only to find candidates worth verifying, then reads the
flagged files' own MRC headers over SSH (one round trip, three spread
files: NX/NY/NZ/MODE at offsets 0/4/8/12):

* **NZ > 1** — a verified frame stack → the honest pre-staging refusal,
  now carrying the header's own numbers as evidence (run MotionCorr
  first: `Import → MotionCorr → CTF`);
* **NZ = 1** — a summed micrograph → through (the receipt rides the
  submitted script's `CRYOFLOW_NOTE` line and run.out, so the Log tab
  shows *why* the gate let movie-shaped names pass);
* **unreadable / TIFF** — through with an advisory note (the user is the
  authority on their own data; never twice the same wrong block);
* **`.eer` (≥50 %)** — refused without any bytes crossing the wire: an
  event-record file is raw frames by definition.

The import job sniffs the same way and says what the bytes are in its
receipt (`headers (3 sampled): single-section MRCs 4096×4096 (mode 2) —
motion-corrected micrographs, CTF-ready`, or the frame-stack warning).
If a CTF job still fails on every micrograph at once, the failure strip
and the Log tab's diagnosis order the honest suspects: single-section
check (`head -c 16 <file>.mrc | od -An -td4` on the cluster reads
NX NY NZ MODE), the ctffind build's file-mode support (float16 / MRC
mode 12 needs a recent ctffind), the Import pixel size, then the
ResMin/ResMax range.

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
| syncPolicy / keyFileMb | what finalize copies home: `key-files` (default) — text outputs always, binaries under the cap, and for the per-micrograph image producers (extract, motioncorr, polish) TEXT ONLY (§4q, t339); `everything` — every file under the caps |

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

**t315 — the project's binding is the second source of remote-ness.** The
import of a REMOTE project is engine-native: it runs locally by design,
so its own run record carries no remote target. The auto-start passthrough
used to hand those downstream jobs `{}` — and a ctffind wired to a
cluster-path import would run on THIS machine (through the WSL bridge on
Windows, with a star full of cluster-absolute rows it cannot open — every
file fails instantly). Now the passthrough falls back to the project's
cluster binding (module + mode from the connection's saved defaults);
only when neither the trigger's record NOR the project speaks does a
consumer run locally. The manual "Run on this machine" door got the same
honesty: a star whose rows are absolute paths that do not exist locally
(≥50% of them) is refused BEFORE any spawn, with the error naming the
cluster door instead of a 195-file failure parade.

**t317 — the bare POST speaks the project's binding too (the side doors
close).** Every secondary run door — the job card's context-menu "Run
job", the command palette, the failure toast's "Retry", the inspector's
"Start again" — POSTs `/api/jobs/[id]/run` with no body, and in a
remote-bound project that bare POST now dispatches with the project's
binding (the same shared target the auto-start passthrough uses:
`projects.projectRemoteTarget`). Before t317 those doors fell into the
LOCAL lane — the exact Beijing symptom through the side door: a class2d
fed by a Particles import spawned through `wsl -d Debian -- bash -c {…}`
with stack refs the machine does not have. The EXPLICIT local choice
survives as `{ local: true }` (the panel's ▾ "Run on this machine"):
it meets the cluster-resident refusal — which now covers the particles
family too (class2d/class3d/refine3d/…: a particles star whose
`_rlnImageName` refs are ≥50% cluster-absolute-and-missing is refused
with the same teaching error, before any spawn).

Two smaller doors hardened in the same pass: the ghost-guard in the
auto-start passthrough is now a hard fork (a trigger's remote record only
wins while ITS connection is alive — a dead record falls to the project's
live binding instead of resurrecting the deleted connectionId), and a
module-less connection's passthrough falls back to the FIRST PROBED
module (`defaultModule ?? lastProbe.relionModules[0]` — the run dialog's
own default), so a module-less sbatch never dies 127 after a full
staging round. The preview door also learned honesty at the edges: a
RELATIVE star row is refused (it would `cat` against the SSH home), a
file over the 512 MB fetch cap is refused with the "import the summed
micrographs instead" lesson, and the cluster strip's `total` is the FULL
row count (mixed stars included).

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

### The LoG picker is CPU-only (t320)

One pick method refuses GPUs outright: RELION's `autopicker.cpp` hard-errors
when `--gpu` rides `--LoG` — *"The Laplacian-of-Gaussian picker does not
support GPU acceleration. Please remove --gpu option."* — and it dies at
argv-parse time, before touching a micrograph. Because every GPU decision
in CryoFlow was TYPE-driven (Auto-picking → 1 GPU), a default LoG dispatch
carried exactly that forbidden pair. The pick METHOD now decides:

- **Laplacian-of-Gaussian** (the default) — no `--gpu`, no `--gres`,
  `gpusRequested: 0`, and the Run dialog's GPU row states the CPU contract
  instead of offering a width the dispatch would never send. The GPU queue
  stays free for jobs that can use it.
- **References** (template matching) and **Topaz** (the CNN wrapper) —
  keep their GPU: `--gpu 0` + `--gres=gpu:1` on sbatch, exactly as before.

The contract lives in one pure predicate (`src/lib/relion/log-autopick.ts`)
shared by the remote dispatch, the sbatch dry-run export, and the dialog;
the mock cluster's `relion_autopick` refuses the pair with the same
verbatim text as the real binary, so a regression that re-adds `--gpu` to a
LoG dispatch fails the e2e loudly. The failure catalog (§5) also knows the
signature now — an old or hand-edited script that still carries the pair
gets a named diagnosis instead of a bare exit 1.

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
  with sizes/types, wildcard pattern preview `…/*.mrc` — t312: the whole
  folder up to the shared browser ceiling (20,000 default, virtualized
  rows; the REAL total is still shown when a listing goes past it, with
  an *Import this whole folder* shortcut); `~` expands
  cluster-side). Picked paths are CLUSTER-ABSOLUTE.
- **The import writes cluster-absolute STARs.** Import (an engine-native,
  local bookkeeping step) validates and enumerates the picked cluster
  path over SSH — folder and pattern enumerations go to 20,000 entries
  (`CF_REMOTE_IMPORT_MAX`), matching the browser's own ceiling — and
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

**t315 additions on a remote project:**

- **Import has a Node type** (micrographs / movies / particles — RELION's
  own import dialog semantics). The card's OUTPUT port follows it:
  Micrographs → the CTF/picking family consumes it directly; Movies →
  only MotionCorr accepts the wire (CTF's port refuses the movies kind —
  the pipeline typing teaches the order); Particles → an existing
  particles `.star` (read over SSH on a remote project, cluster-absolute
  image refs kept verbatim; local copies rebase RELATIVE refs against the
  source star's own directory, so the copy never dangles). The import
  receipt cross-checks the node type against the BYTE sniff: "Node type
  says Micrographs but the sampled headers say FRAME STACKS" (and the
  reverse) — a receipt-level heads-up, the CTF byte gate stays the
  enforcement.
- **The import gallery samples five random micrographs over SSH.** A
  cluster-resident import's star rows are cluster-absolute — nothing is
  on this machine — so the gallery shows a random sample of five with
  thumbnails fetched through the SSH preview door (`GET
  /api/jobs/[id]/micrographs?preview=<cluster-path>` — the path must be a
  row of THAT job's own star; the fetched .mrc is deleted after the PNG
  render, only kilobyte thumbnails persist). The **re-sample** button
  rolls five new ones; the lightbox's full view pulls the large render.
- **A ctffind that fails with the all-at-once signature gets an ACTIVE
  diagnosis.** When the log says "cannot get CTF values" for every file
  and "failed to estimate CTF parameters for any micrograph", the
  finalize SSH-stats the FIRST named file on the login node: readable
  there → "the failure happened where the job RAN — if this went through
  Slurm, the compute node may not mount <dir> (microscope data disks are
  often login-node-only) — try direct mode, or copy the data to a
  cluster-wide path"; unreadable → "the cluster itself CANNOT read the
  file — re-import". The Beijing ticket's ~199 instant per-file failures
  had exactly this shape.

## 4d. Progress: RELION's own bar is the ground truth (t319)

The progress parser reads the SAME dialects RELION itself prints (verified
against the sources — `src/time.cpp`'s `progress_bar`, the runners, and
`ml_optimiser.cpp`):

- **The time bar** (`ctffind` / `motioncorr` / `extract` / `autopick`): one
  GLOBAL `elapsed/total` estimate, rewritten in place with `\r`
  (`3.53/53.72 min ...~~(,_,"> [oo]`, ` yum!` when finished; the unit flips
  sec → min → hrs). The ctffind/MotionCor2 subprocess output never reaches
  run.out (the runners redirect it to per-micrograph logs), so the bar is
  unpolluted — and `elapsed/total` self-adapts to any number of images.
- **Iteration headers** (the refine family): ` Expectation iteration 3 of
  25` (initialmodel: ` Gradient optimisation iteration N of M`) combined
  with the in-iteration bar: `((iter-1) + barRatio) / total`.
- **n/N counters** (the mock cluster's dialect): `Micrograph 5/1034` — a
  direct ratio, denominator included.

Two contracts ride on top:

- **Monotonic** — a RUNNING job's progress never regresses. The sweeps read
  a sliding 4096-byte tail; a parse miss keeps the stored value (parsed
  beats stored, stored beats null) and the value is persisted
  (status-guarded) so every poll agrees. A re-dispatch resets to 0 and
  climbs again.
- **The import reports its own phases** — per stat batch (200 files/round),
  the header sniff, the star write — instead of a dead 0% for the whole
  listing marathon.

## 4e. The queue is a status, not a silence (t322)

A Slurm job that is **PENDING is not "Running"**. The sweep has spoken the
scheduler's own word since t297 (`runRemote.slurmState`, live-patched from
`squeue -o %T` every 4s); every STATUS SURFACE now renders it through one
shared predicate (`isSlurmQueued` — DB status still `running`, mode slurm,
slurmState PENDING):

- the card badge says **Queued** (amber, the pending dialect) — never teal
  "Running" over compute that has not started;
- **no progress bar, no ETA** — 0% would be a claim; the queue wait speaks
  instead (`queued · waits on 124589` when an `--dependency=afterok` holds
  it, `queued · waiting for the scheduler` otherwise);
- the hover peek's clock says **"4m in queue"**, the panel and the roster
  row speak the same sentence, the inspector's timeline step is **Queued**
  (amber "wait" tone) and its result card says **"Waiting in the Slurm
  queue — Slurm job 124590 is held until 124589 lands"**;
- the recent-activity feed carries a slim `runRemote` (mode + slurmState +
  the upstream ids) so the dashboard feed agrees with the roster.

When the scheduler starts the job the badge flips to Running and the bar
wakes up — the DB status was honest all along; only the rendering had been
merging two states into one word.

## 4f. Cluster thumbnails: decimate on the cluster, cache locally (t322)

The import gallery never pulls a whole .mrc again. The preview door runs a
**decimation ladder** over SSH:

1. **python3, pure stdlib** (no numpy demand on a login node): parses the
   MRC header, nearest-neighbour-thins BOTH axes on the cluster, streams
   ~0.5 MB of base64 voxels for a 64 MB micrograph (a 4096² float32 thumb
   at 384 px ≈ 121× less wire). Frame stacks preview via their MIDDLE frame
   (one frame of a 32 MB 8-frame movie travels, not the stack).
2. **GNU dd strided rows** (no python3 on the node): `od` reads the header,
   one `dd iflag=skip_bytes,count_bytes` per kept row — full-width rows
   travel, the columns thin locally with the same step math.
3. **The whole-file pull** (FETCH_CAP 512 MB + its teaching refusal) — only
   for shells that speak neither dialect.

All three tiers pick the SAME pixels (the step math mirrors `downsample()`
exactly — the ladder smoke proves byte-identical PNGs against full-file
renders), the contrast stretch is the same 2–98% pipeline as every local
thumbnail, and the rendered PNG persists in `data/remote-preview` — the
second visit is served from disk, byte-identical (`X-CF-Preview-Tier:
python | dd | full | cache` speaks which tier answered, `X-CF-Preview-Bytes`
the wire bill).

The sample of five is **deterministic per job** (seeded by job id + a reroll
counter; the re-sample button advances and remembers it in localStorage) —
the old Math.random re-roll meant five fresh cluster paths every visit, so
the cache never hit. Responses carry `Cache-Control: public, max-age=86400`
so the browser stops re-asking too.

## 4g. Two LoG autopick contracts (t323)

**The warning chorus is paid off at the source.** On large micrographs whose
FFT sizes carry a big prime (the user's 4096-px data: `4096/2+1 = 2049 =
3×683`), RELION's `getGoodFourierDims` rescales to a friendlier size
(4048, prime 23) and prints four warning lines — the last one is literally
*add `--skip_optimise_scale` to your autopick command to prevent rescaling*.
CryoFly generates the command, so the dispatch now always carries the flag
for Laplacian-of-Gaussian picking: no rescale, no chorus, calculations at
exactly the requested resolution (the flag is a global argv option in
autopicker.cpp `read()`; References/Topaz keep their own lowpass-driven
sizes and stay untouched). The mock cluster's `relion_autopick` prints the
chorus verbatim whenever the flag is ABSENT — a dispatch regression fails
the e2e loudly instead of re-teaching users to read warnings.

**A silent exit 1 is an external kill, not a RELION error.** Verified
against RELION master: every in-code death NARRATES itself — a `RelionError`
puts `ERROR: …` + `in: … .cpp, line N` + a backtrace on stderr (the t320
receipt was exactly that shape), and the pipeline-control exit wrapper
writes `exiting with an error/abort` to stdout. So a run that dies mid-bar
with exit 1 and NO error text in either stream was killed from outside:
the login node's CPU-job reaper (multi-hour `direct` runs), the OOM killer,
or a walltime. The receipt now says exactly that (and points at
`sacct -j <jobid>` / the job directory), the Log tab's failure diagnosis
grows the matching `silent-run-death` signature, and the t318 evidence
rescue fires whenever the local `run.err` is empty — run.out alone is not
evidence that run.err is empty (a mid-run stderr error used to stay
invisible whenever run.out had content).

## 4h. The cluster is the truth for a remote chain (t324)

**A completed remote job whose key output stayed on the cluster still
unblocks downstream cluster jobs.** The sync-back is capped by design
(per-file, per-run, and a policy that leaves bulky maps and stacks on the
cluster), and a download can fail mid-way — an extract on 576 micrographs
writes a many-MB `particles.star` beside hundreds of `.mrcs` stacks. The
old readiness gate was LOCAL-ONLY (`existsSync` on the synced copy), so the
downstream 2D Classification PENDING-ed forever with *"run Extract first"* —
over a run that had already succeeded, with the file sitting right there on
the cluster the downstream job was about to run on. Four blades closed it:

- **finalize probes the cluster** for chainable outputs the sync-back left
  behind (one SSH round, exact names + iteration globs) — the record carries
  VERIFIED `remoteOutputs` twins, and the receipt says where the file lives
  (*"particles.star stayed on the cluster (verified there) — downstream
  cluster jobs chain off the cluster copy in place"*) instead of *"no
  expected outputs appeared"*;
- **the remote dispatch resolves through twins**: a downstream job sent to
  the SAME connection consumes the cluster copy in place — no re-upload, no
  local copy, `--i` is the cluster path (a twin from a DIFFERENT connection
  is refused with the cross-cluster story);
- **the lazy heal recovers pre-t324 records**: when a dispatch still comes
  up short, one batched probe over the lineage's completed remote records
  re-discovers what the old finalize never recorded — existing stuck
  pipelines unblock on the next attempt, no re-run needed;
- **the pending retry gives the promise a heartbeat**: "runs automatically
  once ready" is re-attempted every ~20 s through completed upstreams, so a
  consumer that missed its one-shot trigger (an SSH blip at the exact
  moment the upstream landed) no longer waits for a server restart.

The LOCAL lane stays honest, not stuck: a job you run on THIS machine with
cluster-resident inputs pendings with the actionable message (*"…its
particles.star stayed there (over the sync caps) — send this job to the
cluster, or raise the connection's sync caps and re-run the upstream"*)
instead of advice to run something that already ran.

## 4i. The cluster is a host, not a connection id (t325)

**A re-created connection to the SAME cluster still chains.** Every twin
gate in t324 compared the bare `connectionId` — delete the connection while
debugging (re-add the same host later, a new id lands) and the retry sweep
dispatches with the NEW id: the lazy heal refuses the old record, the twin
is refused, and a pending consumer waits FOREVER over a file sitting on the
very cluster it was about to run on, wearing the generic *"Waiting for
upstream output"* message. Cluster identity is now **(connectionId, host)**
— `sameClusterTarget()` is the one shared predicate behind resolveInputs'
twin acceptance, the lazy heal's eligibility, and the staging plan's
identity-twin map, so the three cannot drift apart. A genuinely different
host keeps the cross-cluster refusal.

Two more durability blades ride along:

- **the wire outlives its mirror** — an edge lives in the DB (the ENGINE's
  only view: lineage + the pending-retry sweep) AND the sidecar file (the
  CANVAS' view). The self-heal rewrite used to filter a FRESH file through
  a STALE keep-set — an edge connected during an in-flight GET was evicted;
  with a silently-failed DB mirror the pair ended connected nowhere (the
  canvas wire gone, the lineage empty). Writes are now atomic
  (tmp + rename — no torn reads across processes), the keep-set is derived
  from a fresh read (concurrent additions always survive), and every read
  BACKFILLS missing DB mirrors — the engine's view can never silently
  diverge from the canvas;
- **the pending dialects stopped lying** — an empty lineage (the lost edge)
  speaks *"No upstream job is wired that produces particles.star — connect
  one…"* instead of promising an auto-start that cannot fire without an
  edge, and a completed remote run with an unaccounted key (the pre-t324
  record) speaks *"…where its particles.star lives is not on record — send
  this job to the cluster (the dispatch probes the upstream's workdir
  there)…"* instead of *"run Extract first"* over a run that succeeded.

The auto-start round also survives its worst member: one throwing consumer
(aborted the whole round's siblings) is now caught, logged with the job's
name, and skipped.

**t325-a (the review's residuals, closed):** the registry-stale dialect
only fires for provider types the probe can actually serve (types with
`REMOTE_OUTPUT_CANDIDATES` entries for an accepted key — a remote
select/import wired to a particles.star consumer keeps the generic
message instead of promising a heal that cannot fire); "accounted" is
`existsSync`-aware, agreeing with the heal's own worklist (a
recorded-but-deleted file counts as unaccounted); host identity is
NORMALIZED (case / trailing FQDN dot — an IP-vs-DNS alias deliberately
fails closed); the sidecar tmp file is reaped on every exit path; a
failing mirror backfill is spoken; and **the poll sweep itself honors the
host identity** — a RUNNING record whose connection was deleted mid-flight
is polled through a re-created same-host connection instead of being
failed at `exitCode -1` (which would have permanently disqualified the
heal). Remaining id-only surfaces are deliberately fail-closed and
documented as scope: the anti-ghost liveness pre-check (skips the check
on drift — the sweep finalizes within one poll), the sbatch
`--dependency=afterok` gate (an in-flight re-run under the old id
contributes no slurmId — the consumer runs without the dependency), and
log tailing / stop for pre-drift records (degrade honestly).

## 4j. The occupancy table sits in the submit path (t327)

**The user's `show_free_gpu.sh`, promoted into the Run-on-cluster dialog.**
Their script greps `Gres` (totals) and `AllocTRES` (what is spoken for) out of
`scontrol show nodes` — one line per node, checked BEFORE submitting. The
dialog now renders exactly that, one SSH exec behind it:
`GET /api/remote/connections/[id]/usage` runs `scontrol show nodes -o` and
feeds it to ONE pure parser (`src/lib/hpc/slurm-usage.ts`, the t326 gpu-width
recipe: zero imports, client/server/test share it — the panel cannot drift
from the cluster's own words). The panel sits between the partition picker
and the GPU width — the occupancy informs the pick, not the other way round.

The contract, blade by blade:

- **one exec, one cache** — the result is cached in-process for 15s so the
  panel's 30s auto-refresh (and two dialogs open at once) never storms the
  login node; the manual refresh button rides `?refresh=1` and bypasses it;
- **the bars show USED, the free count carries the meaning** — the free
  number is colored by what THIS submission needs (enough = emerald, less
  than the ask = amber with the honest consequence spelled out — *"the job
  will queue until GPUs release"* —, none = rose). The ask line derives
  from the SAME width truth as the sbatch (`slurmWidthFor`) × the array's
  `%4` concurrency, and compares it to the picked partition's free GPUs (a
  single task's GPUs must sit on ONE node — the app never spans nodes);
- **usage is INFORMATIONAL, never a gate** — a cluster without `scontrol`
  (or an SSH hiccup) degrades to a rose note that names exactly what
  failed; the Send button's predicate is untouched (the diag pins it);
- **the parser speaks both dialects** — the `-o` one-liners the app runs
  AND the long form the user's script greps (records re-united on their
  `NodeName=` boundaries), with the field grammars handled: `gpu:A100:5`,
  `gpu:5(S:0-1)`, multi-segment Gres sums, `gres/gpu:type=2` shares, empty
  `AllocTRES=` (nothing allocated — the user's own idle rows), `CPUAlloc`
  fallback, `IDLE+DRAIN` state words;
- **the mock's `scontrol` accounts LIVE jobs** — the mock `sbatch` journals
  each submission's request (`job-<id>.req`: partition | gres | ntasks |
  concurrency) and the mock `scontrol` adds every RUNNING job onto its
  partition's node, so a dispatched class2d @ 3 GPUs on brain2 is VISIBLE
  in the panel (4/8 held) while it runs and releases when it lands — the
  e2e pins both edges. PENDING jobs hold nothing (they wait, they do not
  allocate).

The user's own numbers are the fixture of record: their table (normal 80
CPU/5 GPU, brain 64/6, normal02 80/8, brain2 128/8, brain4 128/8, brain3
48/6 — with brain2 `cpu=2,gres/gpu=1` and brain3 `cpu=4,gres/gpu=2` as the
live-sample baselines) is asserted node-for-node in both dialects.

### t332 — the rows became PICKS

**「增加支持从检测到的节点使用情况的列表中直接选择相应的节点」** —
the usage list is no longer read-only: clicking a node pins the submission
to it (`--nodelist`), the one pick the partition dropdown could never
express (a single node inside a multi-host group — `node03` out of `gpu`'s
eight). Four layers, one doctrine:

- **the panel's rows are buttons** — `aria-pressed` speaks the pin, the
  keyboard comes native, the pinned row wears it (ring + map-pin + primary
  name), and DRAIN/DOWN rows refuse the click honestly (a doomed sbatch is
  never composed from this list). The hint names the mechanism; the ask
  line RE-SCOPES to the pinned node's own free GPUs ("6 GPU(s) pinned to
  node03 — only 5 free there; the job will queue until GPUs release"), and
  a 0-GPU node gets the contradiction named, not a silent queue;
- **the dialog follows the pick** — the GPU stepper's ceiling becomes the
  NODE's own GPUs (scontrol's word, not the group's widest), the preview
  shows the real `--nodelist`, the submit body carries it, and a later
  partition change that would strand the pin RELEASES it (the UI never
  composes a `--partition`/`--nodelist` contradiction — a real controller
  refuses that combo at submit time);
- **the engine honors it server-side** — `target.nodelist` sanitized with
  the partition charset gate, the explicit pick WINS over the t300
  single-host derivation, and an explicit pin with NO picked partition
  SUPPRESSES the connection's default partition (`--partition=normal` +
  `--nodelist=brain3` is a submit-time refusal; the node's own partition
  is where it lands — `--nodelist` alone says exactly that);
- **the mock accounts the pin** — `sbatch` journals it as the `.req` file's
  5th field and `scontrol` holds the job's CPUs/GPUs on THAT node (a
  pinned class2d on node03 shows 3/6 GPUs while it runs — wherever its
  partition would have routed it).

Still informational: the Send button's predicate never consults the pick
(the diag pins it unchanged), and usage degradation never touches it.

## 4k. Cleaning intermediates — both sides of the wire (t331)

**The eraser in the job inspector's toolbar.** A RELION project's disk hogs
are not the results — they are the intermediate process files: every
iteration's `run_it###_*` copies (the final one carries the science), the
array shards a parallel run leaves behind, the per-micrograph CTF spectra,
and — the real terabytes — the corrected movies and particle stacks that
outlive the STAR files indexing them. One dialog, one preview, one
confirmed click — and the cleanup runs on the LOCAL mirror AND the cluster
workdir in the same action:

- **the keep-set is the contract** (everything else is negotiable).
  Chainable outputs survive by name (the record's own `outputs`, the
  REMOTE_OUTPUT_CANDIDATES winners, and the FINAL iteration of every
  `run_it###_<family>` — that last one is the `--continue` resume point);
  cluster twins survive (t324: downstream remote jobs chain off the copy
  in place); the witnesses survive (`run.out`/`run.err` — the diagnosis
  layer reads them, `.cf-exit`/`.cf-pid` — the poll's verdict, the
  dispatch scripts, the manifest ledger); symlinks are doors to the user's
  raw data, never candidates; and **anything the planner cannot name is
  UNKNOWN, and unknown means keep** — a new RELION output shape degrades
  to "stays", never to "silently deleted".
- **three tiers, two of them opt-in** — *safe* (beaten iterations, array
  scratch, merge temps — default-checked: nothing downstream or
  resume-critical can miss them), *diagnostics* (CTF spectra + FSC/Guinier
  plots — the numbers stay in the STARs, the rendered curves do not), and
  *bulk* (corrected movies / particle stacks, offered only for the
  producers: motioncorr, extract, polish — with the downstream
  consequence spelled out and the not-yet-run consumers named when they
  exist).
- **the preview and the deletion share one brain** — the dialog never
  sends a file list: the POST carries only scopes + tiers, and the server
  RE-WALKS / RE-LISTS live both times (GET plan and POST execute call the
  same pure classifier, `src/lib/hpc/cleanup.ts`). The listing rides a 10s
  in-process cache so re-opening the dialog never re-dials the login node;
  the manual refresh (`?refresh=1`) and the POST itself always go live.
- **a cluster that cannot answer is not a blocked cleanup** — the remote
  side degrades to a note naming exactly what failed (SSH error, a
  `find` without `-printf`, a connection that is gone with no same-host
  sibling) while the LOCAL side still cleans. Cluster identity is the
  t325 doctrine: a re-created connection to the same host carries the
  cleanup of old records.
- **running jobs are untouchable** — a live local pid or a remote
  staging/PENDING/RUNNING record answers 409 with its reason: deleting a
  live run's iteration files corrupts the run (the t318 respect).
- **the ledger stays honest** — after a cluster cleanup the local
  `.cf-remote-manifest.json` is rewritten minus every deleted path, so
  the Files tab lists what the cluster HOLDS, not what it held (t289).

Freed space is measured, not estimated: the local side sums the sizes it
deleted; the cluster side diffs its own before/after `find` byte totals
(the cluster's word, never the plan's).

## 4l. Re-run / reset / delete — what happens to the files (t333)

**「reset&，re-run或者delete任务时会先清除之前已生成的文件吗？」** —
the question arrived with a crash attached: a re-run of an extraction job
(changed box size) died inside `relion_preprocess` at `image.h:1534` —
`write: target and source objects have different size` — because the
previous run's `.mrcs` particle stacks still sat in the stable run
workdir (`<root>/<type>_<jobid8>`), and RELION writes into whatever sits
at its output paths. A NEW extraction job (empty workdir) sailed. The
doctrine that fixes it: **a fresh start is a fresh directory** — RELION
GUI's "Overwrite" answer, given automatically:

- **Re-run = clear the previous generation, then run.** Every fresh
  dispatch (a completed job re-run, a failed job retried, a reset job
  run again — anything that is not the `--continue` resume below) wipes
  the previous run's recognized products from the run directory FIRST,
  on BOTH sides: the local workdir (or the local mirror of a cluster
  run) and the cluster workdir itself, pre-submit. One shared pure
  classifier decides (`classifyRerunWipe` in `src/lib/hpc/cleanup.ts`,
  the t331 keep-set's fresh-run dialect): products, ALL iterations (a
  fresh start has no resume contract), `.cf-*` scratch/scripts/verdict
  dotfiles and `run.out`/`run.err` die; **symlinks (input doors),
  `note.txt`, the manifest ledger and anything UNRECOGNIZED survive**
  (unknown still means keep). The Files-tab ledger is pruned
  entry-by-entry, and the 10s listing cache is dropped so the next
  cleanup plan re-lists live.
- **The resume contract is untouched.** An INTERRUPTED refine-family job
  (class2d/class3d/refine3d/initialmodel/multibody) with a usable
  checkpoint still re-runs via RELION `--continue` from its newest
  complete iteration — that path never wipes (the checkpoints ARE the
  state). Only genuinely fresh starts clear the directory.
- **Honest refusals, honest degradations.** If the cluster cannot run
  the pre-submit `rm` (permissions, a wedged NFS mount), the re-run is
  REFUSED with the reason — proceeding into stale outputs is the exact
  crash this feature exists to kill. If the pre-wipe LISTING fails (a
  `find` without `-printf`), the dispatch proceeds with a logged warning
  (the pre-t333 behavior; the submit re-tests the wire).
- **Reset clears STATE, not files.** "Reset & edit" stops any live
  process, clears the run record (so the next Run starts fresh instead
  of resuming) and returns the row to idle. The run directory survives
  until the next Run — which then wipes and regenerates it. The tooltip
  says exactly this.
- **Delete keeps the files for Undo.** Deleting a job removes the row
  and its wires; the workdir (local + cluster) stays on disk so the
  toast's Undo (and Ctrl+Z) restores the job under the same id with
  every output re-attached. The t331 eraser dialog and the re-run wipe
  are the disk-hygiene doors; delete is the canvas door.


## 4m. One micrograph, one stack — the names must not collide (t334)

The follow-up field report: a **copied** extraction job (fresh workdir,
t333 wipe live) still died 83% through 1034 micrographs at the same
`image.h:1534` — `write: target and source objects have different size`.
The RELION mechanics (verified against the 3.1 → master sources) explain
why a fresh directory alone is not the whole story: extraction writes
**one `.mrcs` stack per micrograph** at
`--part_dir + <micrograph name minus its extension> + ".mrcs"`, the
**first** particle of each micrograph REPLACES that path blindly, and
every later particle **APPENDS** — the append reads the file already on
disk and refuses on a dimension mismatch. One run has one box size, so a
mid-run clash always means the stack path was occupied by *another
writer*, and the input STAR's row geometry decides whether the paths are
unique:

- **the same micrograph listed twice** — in an array split (the
  round-robin slices by ROW) the two copies land in different shards and
  two processes write the same `.mrcs` at the same moment, overwrites
  racing appends until a header read catches the file mid-rewrite
  (single-process it "only" doubles the particles in the output star —
  a silent data-integrity bug);
- **two names that compose the same stack** — RELION strips the extension
  and appends `.mrcs`, so `X.mrc` and `X.mrcs` (and `X.tif`, and a bare
  `X`) ALL write `<part_dir>X.mrcs`; a dataset holding both extensions
  under one base name collides by construction.

Both are knowable from the STAR text before one byte is staged. t334
adds three blades:

- **The pre-dispatch collision scan** (remote + local lanes, the CTF
  byte-gate's lane position): `scanExtractCollisions` in
  `src/lib/relion/extract-collide.ts` (pure, zero-import) reads the
  micrographs STAR and refuses the dispatch naming the colliding rows.
  A twin-resolved star (cluster-only, no local copy) skips the scan with
  a logged note — a degradation, never a silent guarantee.
- **The array split's block contract**: the sbatch slicer passes every row
  of data blocks BEFORE the second `data_` block to EVERY shard (that is
  how the optics block reaches all shards) and splits the rest. A
  single-block STAR (a hand-made list, an old dialect) would hand EVERY
  row to EVERY shard — the same concurrent-writer bomb. The dispatch now
  refuses the split (`starIsArraySplittable`) with the remedy named:
  run with the Array split at 1.
- **The slice fallback is honest**: the shard script's old
  `awk … || cp <whole star>` fallback silently duplicated every row into
  every shard whenever the awk could not read its input. It now fails
  the task with a `CRYOFLOW_ERR` line in `run.err` and an rc in the
  tally file — the count gate turns it into `.cf-exit=111`, a spoken
  verdict instead of a 20-minute race.

The failure catalog (§5) and the Log tab's diagnosis strip know the
`image.h` size-clash signature: the failed job's card now explains the
mechanism (stack path occupied by another generation / a concurrent
writer), the remedy (re-run — the wipe clears the previous generation's
stacks — or a fresh job), and where the half-written stack stayed (the
job's Results/Files tab, on the cluster).

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
| ctffind all-failed (cluster) | ACTIVE diagnosis: the first named file is SSH-stat'd on the login node — readable → "the compute node may not mount the data disk (try direct mode / copy the data)"; unreadable → "re-import" |
| "Run on this machine" with cluster-resident inputs | refused BEFORE the spawn: "N of M rows live on the CLUSTER — dispatch to the cluster instead" (≥50% absolute-and-missing rows; nothing spawns, nothing lands) |
| LoG picker + `--gpu` (old/hand-edited script) | named diagnosis: RELION refuses the pair outright ("does not support GPU acceleration") — remove the `--gpu` line or switch Picking method to References/Topaz; dispatches never send the pair (t320) |
| LoG autopick rescale warnings | extinct at the source: the dispatch carries `--skip_optimise_scale` (RELION's own advice), picking runs at the requested resolution (t323) |
| exit 1 with NO error text in run.out/run.err | the silent-death verdict: "RELION printed no error — the run ended silently mid-job" + the external-kill suspects (login-node CPU reaper / OOM / walltime) + `sacct -j <jobid>`; multi-hour jobs belong in Slurm mode (t323) |
| downstream job pending forever over a completed upstream | the readiness gate was local-only: the key star stayed on the cluster (sync caps) — the finalize probe records the verified twin, remote dispatches chain off it in place, pre-t324 records self-heal on the next attempt, and the ~20s retry re-fires the auto-start (t324) |
| downstream pending forever after re-creating the connection | cluster identity is (connectionId, host): the re-created connection to the SAME host still heals the old records and chains off their twins (t325) |
| the wire between two jobs disappears (canvas) | the sidecar self-heal no longer evicts edges connected during an in-flight read; writes are atomic; every read backfills a lost DB mirror; an empty lineage speaks "connect one" instead of the auto-start promise (t325) |
| live node usage unavailable | the panel's rose note names the exact failure (no `scontrol` on the login node / SSH error) and says the submit still works — usage is informational, never a gate (t327) |
| pinned node unreachable in the UI | DRAIN/DOWN rows refuse the click ("not taking jobs right now") — the pin is never composed into a doomed sbatch; the mismatch guard releases a pin a later partition change would strand (t332) |
| sbatch refused — `Requested node configuration is not available` | extinct at the source for app-composed submissions: the node-pin pre-flight (t337) reads the pinned node's own `scontrol` row before staging — unknown / DOWN / DRAIN / 0-GPU nodes refuse with the cause and the fix named, narrower nodes clamp the width; "auto" clamps to the connection's default group; **the pin now NAMES the node's own partition** (t340 — the t332 bare-pin suppression fell to the cluster's default partition, where the node does not live: the exact receipt reproduced and healed); a picked partition the node does not live in is refused pre-staging; when the controller still refuses (the drift window), the error is TRANSLATED — it names the pin · partition · GPU width the script carried, the no-partition trap ("the cluster's DEFAULT partition decided"), and the three moves that fix it. The `~/.bashrc` line in the same stderr is noise, labeled as noise |
| local node_modules out of date | boot warning `node_modules is out of date — missing ssh2` + `/api/remote/*` fails with `Can't resolve 'ssh2'` — re-run `npm install` (or `bun install`) and restart |
| cleanup of a running job | refused with its reason (409): a live run's iteration files are being written — stop it first, then clean (t331) |
| cleanup plan vs cluster reality drift | impossible by design: the POST never trusts the preview's file list — it re-lists the cluster live and deletes only what still classifies; the 10s listing cache is bypassed by the manual refresh and by the POST itself (t331) |
| cluster unreachable at cleanup time | the remote side degrades to a note naming the failure; the LOCAL side still cleans (one side's outage never blocks the other) (t331) |
| re-run into stale outputs (`image.h:1534` — "write: target and source objects have different size") | extinct at the source: every fresh dispatch wipes the previous run's recognized products from the workdir (local mirror + cluster, pre-submit) before the job starts; only unknown files, input doors, notes and the ledger survive (t333) |
| pre-submit wipe fails on the cluster (`rm` error) | the re-run is refused with the cluster's own error — running into stale outputs is the crash the wipe exists to prevent (t333) |
| pre-submit wipe cannot LIST (BSD `find` without `-printf`) | warn-and-proceed (the pre-t333 behavior); the submit itself re-tests the wire (t333) |
| `image.h:1534` mid-run on a FRESH job (duplicate rows / `X.mrc`+`X.mrcs` in one STAR) | extinct at the source: the dispatch scans the micrographs STAR and refuses naming the colliding rows — RELION names each stack after the micrograph (extension swapped to `.mrcs`), so colliding names write the same file (t334) |
| array split over a single-block STAR | refused before staging: the slicer would hand EVERY row to EVERY shard (the optics pass-through is per-block) — run with the Array split at 1 (t334) |
| shard cannot slice its input (`awk` unreadable) | the old silent whole-STAR `cp` fallback is dead: the task fails with `CRYOFLOW_ERR: could not slice the input STAR …` in run.err and `.cf-exit=111` — a spoken verdict, not a 20-minute write race (t334) |
| 2D/3D classification dies at `readMRC: Image number N exceeds stack size M` | the upstream extraction COMPLETED with a lying star (same-stem rows in ITS input wrote one stack; the later writer truncated the earlier's images) — the consumer-side gate (t338) now refuses such a star at dispatch with the exact numbers and the remedy; the Log tab's diagnosis names the mechanism for the runs that already died |
| the run freezes at `Expectation iteration 1` with `WARNING: Ignoring required free GPU memory amount of 800 MB` and every rank banner says `devices 0` | extinct at the source (t342): the sbatch script CLAMPS the MPI rank count to the GPUs the node actually exposes at launch (a `--gres` width is a request; a node without gres accounting never enforces it — two ranks on one card exhaust its memory), and a card below 1000 MB free BEFORE RELION starts is refused with the holder PIDs printed (`nvidia-smi --query-compute-apps`) — exit 98, one second, names, instead of an hour of frozen iterations; the Log tab's diagnosis reads RELION's own warning line for the runs that already died |
| extraction stacks filling the laptop | by design, not a failure: under key-files, extract/motioncorr/polish sync TEXT ONLY — the stacks stay on the cluster (listed in Results, fetchable on demand, downstream cluster jobs chain in place); the receipt says so; switch the connection to "everything" to bring them home, or run the inspector's local-only Bulk cleanup on mirrors from before t339 (t339) |
| a long cs → star / import first flips FAILED (`stale running state (no engine record)`) then COMPLETED, with no log mid-run | extinct at the source (t340): the marathon natives write an IN-FLIGHT run record from second zero (pid = the server, the sweep's liveness word) and speak phase lines into `run.out` as they go — the row stays RUNNING with a live log until the completion overwrite lands |
| a remote job dies "file not found" on its input star while the local mirror copy exists | the cross-cluster twin hole is closed: an upstream that ran on a DIFFERENT cluster no longer skips the upload — the twin map's pair entries carry the same-cluster gate the identity entries always had (t343), so the local mirror takes the upload lane (the one copy this connection can reach) and the run consumes the uploaded bytes |

## 6. Testing without a cluster: the mock cluster

`services/mock-cluster/` is a tiny ssh2-based login node with a fake Lmod
(`relion/4.4.1`, `relion/5.0.1`, `relion/5.0-beta` — plus the Lmod-HIDDEN
`relion/beta_5.0_gpu_ompi5_cuda118`, loadable but absent from plain
`module avail`), stub `relion_*` binaries that produce realistic STAR/MRC
outputs, and a mini Slurm (`sbatch`/`squeue`/`scancel`/`sinfo`/`scontrol` —
the sinfo answers the 5-field hostlist grammar and its inventory mirrors a
real user cluster: `brain`/`brain3` 6 GPU, `brain2`/`brain4`/`normal02` 8 GPU,
`normal` 5 GPU — one node each — plus the shared `gpu` partition, with
PENDING→RUNNING transitions and honest purge-on-finish; the `scontrol`
speaks the user's own `show_free_gpu.sh` dialect — `Gres=`/`AllocTRES=`
per node, with the CPU totals of their real table — and accounts RUNNING
jobs onto their nodes live, t327; a submission's explicit `--nodelist`
pin rides the journal's 5th field and holds the job on THAT node, t332;
the sbatch stub keys its submission gates on the NODE's own row when a
pin rides — unknown names get real Slurm's `Invalid node name`, a width
beyond the node's GPUs gets the user's exact refusal bytes, and the
`~/.slurm/node-override` file ("name STATE" lines) flips a node DOWN for
scontrol, the usage panel AND the gate at once — the drained-node world
the t337 pre-flight refuses before staging; a probe-blind 4-GPU
`debugx` partition exists solely to exercise the residual refusal
translation, t337) so the whole
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
- ~~**Cluster-side GPU reservation awareness**~~ — **shipped for
  VISIBILITY (t327)**: the run dialog's Live node usage panel shows every
  node's GPU/CPU occupancy from `scontrol show nodes` (the user's
  `show_free_gpu.sh`), live-refreshed, with an ask line comparing the
  submission's need to the picked partition's free GPUs. The remaining
  stretch is dispatch-side (auto-narrowing the width or picking the node
  with the most free GPUs) — deliberately NOT done: usage is
  informational, the user keeps the pick.
- **Node-level (not partition-level) picking on multi-host groups** — the
  picker currently offers the group; a wide `gpu` partition with idle-node
  awareness could offer the individual host (the usage panel already
  shows per-node free counts — the picker could follow).
- ~~**Intermediate-file cleanup**~~ — **shipped (t331)**: the job
  inspector's eraser previews and deletes intermediates on BOTH sides
  (local mirror + cluster workdir) behind a keep-set contract (chainable
  outputs, cluster twins, final iterations, witnesses; unknown = keep),
  with the manifest ledger rewritten after cluster deletions. The
  remaining stretch is a PROJECT-WIDE bulk pass (every job at once) —
  deliberately not done: cleanup is a per-job decision with per-job
  consequences, and the user reads them one dialog at a time.
- ~~**Re-run hygiene** (stale outputs crashing fresh starts)~~ —
  **shipped (t333)**: every fresh dispatch wipes the previous run's
  recognized products from the run directory on both sides before the
  job starts (§4l) — the `image.h:1534` "target and source objects have
  different size" crash is extinct at the source. The remaining stretch
  is a per-file "Continue vs Overwrite" question on re-run — deliberately
  not done: CryoFlow already auto-answers it (interrupted refine-family
  resumes via `--continue`; everything else starts fresh, and the confirm
  dialog says exactly what will happen).
- ~~**Local disk footprint of remote jobs**~~ — **shipped (t339)**: the
  local mirror of a remote run is for METADATA — under the key-files
  policy the per-micrograph image producers (extract, motioncorr,
  polish) sync text only, their stacks stay on the cluster whatever
  their size (§4q), listed in Results and fetchable on demand. The
  remaining stretch is a per-connection disk budget meter (bytes the
  mirrors hold vs bytes the cluster holds) — deliberately not done:
  the cleanup dialog already accounts both sides per job, and the
  policy change keeps the inflow at zero.

## 4n. The extract frame census + the twin-star closure (t335)

The complement to §4m's name-only collision scan: a `.mrcs` row whose
header says `nz>1` is a FRAME STACK, not a micrograph — RELION reads it as
an `(x,y,1,N)` volume (`parseMRCHeader`: `isStack → _nDim = nz`) and
windows frame 0 of it: garbage particles even when the names never collide.
The mixed-import shape (the `*_Fractions_DW.mrc*` glob sweeping in the
corrector's `.mrcs` aligned movie stacks beside the `.mrc` sums — the
Beijing report's 865 .mrcs + 169 .mrc arithmetic) is invisible to a
name-only scan when the stems are distinct.

`src/lib/relion/extract-gate.ts` (PURE, the t326/t327 recipe) samples the
`.mrcs` rows through the header sniffer: `nz>1` → refusal carrying the
header's own numbers; single-section → allowed with a note; unverifiable →
the note, never a block (the t313 philosophy). It runs on both lanes after
the t334 scan.

The **twin-star closure**: §4m's scan used to skip a twin-resolved star
(cluster-only, no local copy) with a console note — the same t324-a blind
spot the CTF gate once had. The dispatch now `cat`s the star in place over
SSH and re-runs the t334 collision scan on the cluster's own text, so a
cluster-only star earns the SAME refusal, not a softer one.

The import receipt also carries the **extension census** (the 6-file header
sniff can miss the minority kind in a mixed folder): `⚠ mixed extensions:
N .mrc + M .mrcs — … re-import with the exact .mrc pattern`.

For the user's dataset the remedy is on the cluster side: re-import with
`*_Fractions_DW.mrc` (not `.mrc*`) so each micrograph appears once, then
re-run Extract and the downstream chain.

## 4o. The CryoSPARC door (t336)

The user's reference workflow (`upload/cryosmart_relion_trans3.0.sh`) runs
pyem's `csparc2star.py` on the cluster, then symlinks the extract dir's
`.mrc` stacks to `.mrcs` names and sed-edits the star to match — link EVERY
`.mrc` in every extract dir along the way. The `cs2star` job does the whole
workflow inside one job row, natively (no pyem, no Python — the cluster only
serves bytes over SSH):

- **`src/lib/relion/cs-npy.ts`** — a numpy `.npy` structured-array reader:
  the Python-literal header dict, subarray dtypes (`alignments3D/pose` is a
  `(3,)` float field), `<U`/`S` fixed-width strings, LE/BE numbers. The
  `.cs` format is `numpy.save`d records — parseable in TypeScript.
- **`src/lib/relion/cs2star.ts`** — pyem's field table, verified against
  asarnow/pyem master: the uid join with the passthrough, Rodrigues →
  Euler (expmap + Shoemake's rot2euler, RELION's ZYZ convention), CTF
  defocus in Å (field names say `_A` — no scaling), angles rad → deg,
  optics group / class / random-subset lifted 0- → 1-based, coordinates
  normalized → absolute (`micrograph_shape` is `[y, x]` so the axes swap),
  and the RELION 3.1 optics dialect (`_rlnOriginXAngst` = shift × angpix).
  The `--inverty` flag in pyem is argparse `store_false` — the DEFAULT
  inverts Y and the flag DISABLES it; the reference script passes it, so
  `invertY` defaults to false (particles imported INTO cryoSPARC from
  RELION coordinates already speak RELION's convention).
- **THE SELECTIVE LINKS (the requested optimization)** — the star's unique
  `blob/path` values are censused BEFORE any link exists; only those stacks
  get `ln -sfn <CS .mrc> <projectRoot>/micrographs/<name>.mrcs` on the
  cluster (the link NAME carries the `.mrcs` extension RELION requires; the
  target keeps `.mrc`; zero data movement). An `.mrc` in the same extract
  dir that the `.cs` never references stays untouched — the receipt says
  so (`2 of 3 .mrc stack(s) linked — only the ones this star references`).
  Missing referenced stacks refuse the run honestly; the link farm is
  idempotent (`-fn` re-points stale links on re-run).
- **The lanes** — remote projects: SSH discover (J### → newest
  `*particles.cs` + first `*_passthrough_particles.cs`, the reference
  script's own order) → download under the connection's per-file cap →
  convert → verify targets → link → the star's rows speak the link names
  (`1@micrographs/foo_particles.mrcs`). Local projects: the same flow with
  local symlinks. Downstream jobs (class2d/refine3d/…) consume it
  directly: the star stages, the stacks resolve through the cluster's
  micrographs/ tree, not one stack byte uploads.

The key numbers doctrine rides along: the Results strip leads with
`particles converted` + `particle stacks linked`; the receipt carries the
optics, the alignment source (3D/2D/none) and the unmapped-field count.

## 4p. The consumer-side star↔stack gate — a poisoned extraction cannot burn GPU time (t338)

The field report that completed §4m's picture: a 2D classification died
~1 minute in at

```
readMRC: Image number 341 exceeds stack size 340 of image
00000341@…/extract_…/micrographs/…_133825_Fractions_DW.mrcs   (rwMRC.h:178)
```

while the upstream extraction had **COMPLETED** (exit 0). That is §4m's
collision, SILENT variant: two same-stem rows in the extraction's INPUT
star (`X.mrc` + `X.mrcs` — both compose the SAME stack path) made two
writers share one `.mrcs`; RELION's first particle per micrograph replaces
the path blindly, so writer B's first box truncated writer A's 341 images
to 1, B appended its own 2..340 behind — and the merged star kept BOTH
writers' rows. Extract "succeeds"; the poison surfaces only downstream,
~20 GPU-minutes in. (The loud variant — a dimension mismatch on append —
is §4m's `image.h:1534`; same root, different pair of dims.)

§4m/§4n refuse such INPUTS at extraction dispatch — but they cannot see
an output already poisoned by an OLDER dispatch (the user's database:
extract COMPLETED, star lying). `src/lib/relion/particle-ref-gate.ts`
(PURE, the t326/t327 recipe) guards the OTHER side: before a
particles-star consumer stages (class2d / class3d / refine3d /
initialmodel / multibody / polish / ctfrefine / subtract / dynamight —
remote AND local lanes), every `N@path` ref in the star is checked against
the stack's own MRC header, read in ONE batched SSH round trip per ~192
stacks on the remote lane (local reads on the local lane). Refs resolve
the way RELION resolves them — absolute as-is, then the project root (the
run's CWD), then the star's own dir — and the first candidate that exists
is the one judged. A star whose largest image number for a stack exceeds
the stack's `NZ` is refused as a REQUEST error with the exact numbers
RELION would die on (`image 341 in …_133825_Fractions_DW.mrcs but that
stack holds 340 image(s)`), the mechanism (the upstream extraction
COMPLETED but its output is internally inconsistent), and the remedy
(re-run the upstream extraction — its dispatch now refuses colliding
inputs with the rows named — or make a fresh extraction from a
de-duplicated import). Healthy stars pass with a receipt note in the
run's log (`N particle ref(s) verified against their stacks' own MRC
headers`); missing stacks, unparsable bytes and `.eer` refs degrade to
the note, never a block (the t313 conservatism — a wiring guess must not
flip a job row to failed).

The same ticket closed two neighbors:
- **the node box mirrors the pin** — 「从节点使用情况处选择节点后，node框
  还是auto没有变化」: the pin WAS wired (sbatch `--nodelist`, stepper
  ceiling, ask line) but the Node/partition select kept showing "Auto",
  so the pick looked dead. The select now shows the pinned node while a
  pin lives, and picking anything in it (Auto or a group) releases the
  pin — one visible truth for WHERE, never two.
- **extraction's GPU contract, stated** — 「extraction无法用GPU吗？」:
  no; `relion_preprocess` has no GPU code path (box cutting +
  normalization run on the CPU). The dialog's width box says exactly
  that, and names the honest speed knob: the Array split (N CPU shards,
  each extracting its share of the micrographs in parallel).

The mock's `relion_preprocess` grew the missing fidelity the gate
exposed: its star rows now number PER STACK (real RELION's grammar — the
old global counter produced image numbers past every stack's own slice
count, a dialect no real RELION writes). And the local lane's t335 frame
census, which a brace-nesting slip had left INSIDE the t334 scan's catch
clause (dead code on the happy path), now runs where its doctrine says.

## 4q. The local mirror is for metadata — extraction stacks stay on the cluster (t339)

The field report: 「extraction的mrcs也有一些放到本地了，是不是没有必要 …
我希望本地的空间占用尽量小一些」. A remote extraction finalized and
HUNDREDS of per-micrograph `.mrcs` stacks landed in the local mirror —
each stack a few MB, every one of them **under** the t289 key-file cap
(16 MB default). Per-file judgment cannot see an aggregate: 865 "small"
files are gigabytes on the laptop, and none of them are metadata.

The rule (in `src/lib/remote/sync-policy.ts`, PURE — the lane, the
receipt note and the diag suite speak one classification): under the
**key-files** policy, the per-micrograph image producers — the same
`BULK_TYPES` the cleanup planner gates its bulk tier to (extract,
motioncorr, polish; a type that is bulk for DELETION is bulk for SYNC) —
sync **TEXT ONLY**: STAR, logs and plots come home; image stacks stay on
the cluster **whatever their size**. Every other type keeps the t289
doctrine unchanged (text always; binaries under `keyFileMb` — so a
class2d's few-MB class averages still land, and the class gallery keeps
reading their headers locally). **everything** keeps meaning everything
under the caps — the explicit user override (flip it in the connection's
*Results sync-back* setting and re-run).

What stayed is never invisible and never lost:
- the **manifest ledger** (`.cf-remote-manifest.json`) still records the
  FULL listing (written before the planner runs — even a dying sync
  leaves the truth), so the Results/Files tab lists every stack
  `remote: true` with its size;
- any **preview or download** pulls exactly one stack over SSH on demand
  (the t289 lazy leg, byte-count verified — the t298 verdict);
- a **downstream cluster job** chains off the cluster copy in place
  (§4h) — it never needed the local stacks; a downstream job that must
  run LOCALLY needs the override (or a manual fetch) — the t338 consumer
  gate degrades unverifiable refs to a note, never a silent wrong run;
- **stacks that already landed** (this policy's predecessors) are one
  cleanup away: the inspector's eraser, *Bulk image data* tier, local
  side only — the cluster keeps every byte, the mirror keeps the
  metadata (and a re-run wipes the stale mirror generation anyway, §4l).

The receipt says it in words: 「N image file(s) stayed on the cluster —
extract jobs sync metadata only under the key-files policy (STAR, logs
and plots come home; image stacks never do, whatever their size) … open
or download one to fetch it on demand — or switch the connection's sync
policy to "everything" to bring them home」.
## 4r. The pin names its own partition + the native marathon's in-flight record (t340)

Two field reports, one root each.

**The pin's partition.** 「从node使用情况列表选择node时报错，但是从node的
下拉菜单选择node时可以正常运行（两种选择方式即使选同一个node，但是
node框中显示也不一样）」 — the two channels built DIFFERENT sbatch lines
for the SAME node. The dropdown carried `--partition=<group>` (plus
`--nodelist` when single-host); the usage-list pin SUPPRESSED `--partition`
entirely (t332's "the node's own partition is where it lands"), so the job
fell to the cluster's DEFAULT partition — and a GPU node that does not live
there is refused at submit time: `Requested node configuration is not
available`, over and over, with the app's own translation faithfully
describing a composition nobody wanted. The pin now resolves the node's OWN
partition — the pre-flight's `scontrol show node <pin>` row (Partitions=)
first, the probe's sinfo hostlist second — and writes
`--partition=<that> + --nodelist=<node>`: byte-for-byte the dropdown's
composition, one grammar, two doors. A node NEITHER source knows keeps the
bare `--nodelist` (the connection's default must not ride along — a wrong
partition is a guaranteed refusal where a missing one merely lets the
default decide), and the refusal translation now says exactly that when a
no-partition request is refused. Two guards grew with it: a picked
partition the pinned node does not live in is refused pre-staging (the
API door's version of the dialog's mismatch guard — the mock controller
now enforces the membership verdict, so this world is rehearsed, not
assumed), and the DIALOG's own mismatch guard is retired — it fired on the
partition STATE, which auto-initializes to the connection's default, so
pinning any node outside that default killed the pick the instant it
landed (the "dead pick" the field reports kept meeting). While a pin
speaks, the preview and the payload ignore the partition state entirely;
the server resolves the node's home fresh.

**The native marathon's false FAILED.** 「运行时先出现了失败（超时了没有
返回log？），之后又成功了？」 — a 325k-particle cs → star conversion runs
IN-PROCESS for minutes (download the .cs pair, convert, 10k+ selective
links over SSH), and the run record only existed at the very END. The
jobs-GET reconcile sweep flips any "running" row with no engine record
older than 120 s to `stale running state (no engine record) — re-run` —
so the marathon first showed FAILED with no log (none existed yet), then
flipped to COMPLETED when the promise landed. `beginNativeRun` (cs2star +
import, the two marathon natives) writes an IN-FLIGHT record from second
zero — pid = the server process, alive by construction, so the sweep's
liveness word passes — and the runner speaks phase lines into `run.out`
as it goes (`discovered:`, `downloaded: … MB`, `converted: N particles`,
`linking: N stack(s) → …`, a heartbeat every 2500 links), so the Log tab
answers WHILE the job runs instead of after it lands. An honest failure
closes the record without erasing the previous run's outputs; a crashed
runner no longer 500s the route (the dispatch wraps and reports); a
server restart mid-marathon leaves the familiar "interrupted" verdict.

**The dev-server compile storm** (「运行job过程中，页面一直出现热加载编
译」) was the third leg of the same report: the engine writes
`data/engine-state.json` on every progress tick plus job workdirs — all
inside the project tree, which Tailwind v4's automatic content detection
scans AND watches for class candidates. Every write re-triggered the CSS
scan → the dev overlay showed "compiling" for the whole run. The runtime
trees (`data/`, `db/`) are now `@source not`-excluded and gitignored.

The cs → star output question that rode along (「这个job转换的文件存到
本地了？」): yes, by design — the star lands locally under
`<repo>/data/relion/<project>/<job>/particles.star` (the receipt's
`output:` line names it), the particle stacks NEVER move (only
`ln -sfn` links under the cluster's project `micrographs/`), and a
downstream remote job stages the local star up automatically when it
dispatches — the t336 E2E proved the whole chain.

## 4s. One rank per card, and never into a starved card (t342)

The follow-up field report (a 50-class 2D classification, after the OOM
ticket's class-count cut): the job stopped moving at
`Expectation iteration 1 of 20`. RELION's own banner held the whole
story —

```
WARNING: Ignoring required free GPU memory amount of 800 MB,
due to space insufficiency.
```

— and every rank banner read `Will distribute threads over devices 0`:
TWO MPI ranks had landed on ONE card. The `#SBATCH --gres=gpu:2` width
is a REQUEST; on clusters without gres accounting the scheduler never
checks it against the node's real card count, both ranks resolved to
device 0, and the card additionally carried a stale allocation from the
earlier OOM'd attempt. RELION's answer to a card below its 800 MB floor
is to PROCEED (the warning literally says "Ignoring") and then thrash or
deadlock in the first Expectation sweep — a hang with no error tail.

Two blades, both runtime-side where the node's own truth is visible
(inside the sbatch script, after the t341 pin block):

1. **The rank clamp.** The MPI rank count and the `--gpu` device list
   are the script's own `CF_RANKS`/`CF_GPU_LIST` variables. At launch
   the script counts the GPUs the node exposes (`nvidia-smi -L`) and
   clamps the rank count to the card count — two ranks on one card
   becomes structurally impossible, and the clamp narrates itself into
   `run.out` (`CRYOFLOW_NOTE: … clamping the rank count …`). No
   `nvidia-smi` on the node → no clamp, the run proceeds exactly as
   before (unverifiable ≠ refused, the t313 rule).
2. **The starved-card refusal.** Before RELION starts, the script asks
   the devices this job would use (the `CUDA_VISIBLE_DEVICES` grant —
   or devices `0..CF_RANKS-1` where the cluster does not isolate) how
   much memory is free. Below 1000 MB — comfortably above RELION's own
   800 MB floor — the job is REFUSED: the holder PIDs are printed
   (`nvidia-smi --query-compute-apps`), `.cf-exit` carries 98, and the
   Log tab's diagnosis names the move (kill/scancel the holders, then
   re-run). Between 1000 and 2000 MB a note says the card is shared and
   the run may be slow. The refusal rides only jobs whose argv truly
   carries `--gpu` — a CPU job that merely HOLDS a gres grant (extract
   shards, LoG picking) is never refused for a card it would not use.

The reader side grew with it: a resolved input STAR whose local copy is
missing is now read through every honest cluster-side candidate — the
upstream's verified twin, the mirror-mapped path, then the path as-is —
and when all fail, the receipt names the paths TRIED plus the cat's own
failure word (the old note said only "cluster cat failed"; the field
report deserved better).

## 4t. One map, one lane, one address — the consumption-lane star read (t343)

The user's question retired t342's belt-and-suspenders: 「这个前一个 job 的
star 文件的写入地址不是确定的吗？为何还要尝试这么多？集群的任务尽量不用
本地副本，直接在集群上写入和读取更加直接，避免了网络传输」— the write
address IS deterministic, and the codebase already owned it: **the twin map is
the staging's own lane decision** (a hit → the staging uploads nothing, the
argv runs against the cluster twin in place; a miss → the LOCAL file is the
exact bytes that will upload, and the staging refuses the dispatch when they
are missing). The t342 walk — local copy → twin → mirror-mapped → path
as-is — trusted no single address, and in both directions it judged bytes
the job never touches:

- **twin lane, local-first:** a stale local mirror (the sync-back lagged,
  died mid-download, or a cleanup swept the mirror tree) earns a false
  "verified" while relion reads the CLUSTER copy — the exact lie the
  consistency gates exist to prevent, told about the wrong generation.
- **upload lane, cluster-walk:** nothing the cluster holds can change the
  staging's own `input "particles_star" does not exist locally` refusal one
  SSH round trip later — the walk only delayed the same door.

The reader now derives its lane from the same map the staging derives its
own (`readResolvedStarText`): the **twin lane** cats the cluster copy in
place over SSH and never consults the local mirror; the **upload lane**
reads the local copy (the bytes that ship) and never walks the cluster.
The receipts speak the lane — success notes end with WHICH bytes were
judged (`the star was read in place on the cluster at <path> — the copy
this job consumes; nothing uploads for it` / `the star was read from the
local copy this dispatch uploads`), and an unreadable star names THE door:
the lane's own address, the cat's failure word (tail-sliced — the reason
rides AFTER the path, and a head slice on a deep cluster path cuts it off),
and the remedy (re-run the upstream to regenerate it). Unverifiable still
degrades to the note, never a block (the t313 rule).

**The adjacent hole the derivation exposed:** the twin map's PAIR entries
(local mirror path → cluster twin) were built unconditionally, while the
identity entries carried the t325 same-cluster gate. An upstream that ran
on cluster A, its star synced back to the local mirror, then a dispatch to
cluster B: the pair made the staging SKIP the upload and point B's argv at
A's path — relion died "file not found" over a local copy that sat ready
to upload. The whole upstream is gated in one place now; a foreign
upstream takes the upload lane — the one copy this connection can actually
reach (two front-ends of one shared filesystem lose the in-place pass this
way; the safe direction: bytes upload, the run still completes).

**The bonus the unification bought:** the t338 ref resolver's cluster-side
anchor is one formula both lanes share (the twin when the input runs in
place, else the mirror-mapped upload path). The upload lane used to anchor
star-relative refs on the project root alone — refs in the star-relative
dialect degraded to "could not be verified"; now they are judged against
the star's own directory on the cluster, exactly like the twin lane always
did.

Verified by `e2e-review/run-8-star-lane.mjs` (29 assertions, all green):
a poisoned local mirror never earns a verdict (the job completes, the
receipt says the cluster copy was judged); the upload lane refuses on
poisoned LOCAL bytes with the row keeping its state (request-error
contract); a gone twin produces the lane-named note while the job fails
fast at relion's own missing-input door; and a foreign-cluster record
takes the upload lane with a byte-level witness — the marker line from
the local copy lands in the cluster file.

## 4u. The wipe's real budget, and the poison caught before the burn (t344)

Two field reports, one recovery chain:

1. **the 2D classification died mid-run** on
   `readMRC: Image number 383 exceeds stack size 382` (rwMRC.h, inside
   `initialiseSigma2Noise`) — the upstream extraction had COMPLETED, yet
   its particles.star numbers one image past a stack's true NZ. This is
   the t338 gate's exact shape; the gate did not fire because the user's
   build predated t342/t343's lane-aware star read (the receipt said
   `particles star unreadable (no local copy, cluster cat failed)` — the
   retired wording). On current code the twin lane reads the star in
   place, the header sniffer judges every stack ON THE CLUSTER, and the
   dispatch is refused with the exact numbers relion would die on —
   before any queue or GPU time is spent. The refusal's remedy names the
   move: re-run the upstream extraction.
2. **the re-run was then refused** by
   `could not clear the previous run's files … (batch 1: SSH failed
   (timeout after 30000ms))` — the t333 wipe's rm carried a 30s
   per-batch budget, and a login node that had just answered the
   LISTING inside 25s was not broken, merely SLOW (a loaded head
   unlinking hundreds of stacks on network storage). The wipe now rides
   `deleteRemoteFiles`'s new budget + retry ladder:

   - **180s per batch** for the dispatch's pre-run wipe (the interactive
     cleanup dialog gets 120s) — a deletion that takes a minute is a
     deletion, not an outage.
   - **one fresh-wire retry** per batch on SSH-level failures (timeout,
     a channel that died mid-command): the pooled connection is dropped
     and re-dialed before the idempotent `rm -f` re-runs — a half-dead
     TCP session after a GPU storm is the field shape, and the first
     thing a fresh SSH session fixes is exactly that. rm's OWN exit
     codes are never retried (a filesystem complaint does not heal with
     a redial).
   - **no serial grinding**: a batch that exhausts its wire attempts
     stops the pass — the remaining batches are named in the refusal
     (`the remaining N batch(es) were not attempted`). With the old
     loop, ten batches at the new budget would have ground for an hour.

The refusal message itself now says what actually happened: the budget
it waited out, the retry it made, and the hand check to run (`ssh in by
hand and try again in a moment`) — replacing the old "fix the cluster
access", which pointed at a cluster that was fine.

The duplicated log lines in the field report are not an app bug:
`mpirun -n 2` has BOTH ranks print the banner and both hit the same
readMRC error (the backtraces carry different libc addresses — two
processes, two prints).

Verified by `e2e-review/run-9-wipe-budget-poison-gate.mjs` (31
assertions, all green), on two new mock levers (`~/.slurm/rm-slow-ms`
and the one-shot `rm-channel-close`, both witness-logged): a 35s rm —
over the old 30s budget, inside the new one — no longer refuses the
re-run; a channel that dies without a verdict retries on a fresh
connection and completes; a star row bumped past its stack's NZ is
refused at dispatch with `references image 11 … but that stack holds 10
image(s)` and a zero-row slurm accounting; and the user's recovery path
is walked end-to-end — re-run extract (the wipe clears the poisoned
generation), then the SAME class2d dispatch completes with the
`verified against their stacks' own MRC headers` receipt.

## 4v. One rank, one card — pinned by the driver, not parsed by RELION (t345)

The third field report on the same 2D classification, and the star read
that lied about a live file:

1. **every MPI rank landed on device 0** (again — this time at width 6):
   six identical `Will distribute threads over devices 0` banners, the
   shared card bled `156 → 40 → 37 → 34 MB` free across successive rank
   initializations, and the allocator died in `setupTunableSizedObjects`
   (`custom_allocator.cuh:436`). The node had cards to spare, so the
   t342 rank clamp never fired — the failure was the colon list itself:
   `--gpu 0:1:2:…` is RELION's documented per-rank grammar, but the
   field build did not split ranks on it (the t342 ticket's `-n 2` run
   had shown the same signature: both banners `devices 0`). t345 stops
   trusting any `--gpu` parser: the sbatch script writes a per-rank
   launcher (`.cf-rank-launch.sh`) that hands each MPI rank its OWN
   `CUDA_VISIBLE_DEVICES` — one entry of the job's device set, by rank
   index — and relion runs `--gpu 0` inside a world with exactly one
   visible card. Piling N ranks onto one card becomes physically
   impossible: the driver hides the other cards. The runtime device
   set's truth, in order: `CUDA_VISIBLE_DEVICES` when the scheduler (or
   the t341 pin) grants one — never widened; else nvidia-smi's index
   list **quietest-card-first** (free memory descending — a shared
   node's card 0 is everyone's default and the starved one); else the
   BLIND case: ONE rank with a note naming the blindness (a pile-up
   needs two). The clamp survives from t342, now measured against the
   CUDA-visible world instead of the node's physical inventory (a
   cgroup grant of one card runs one rank even on an 8-GPU node). The
   launcher's own contracts fail closed: a rank index it cannot read
   (exit 97) and a multi-rank run with no device to pin (exit 96) are
   refused with their own `CRYOFLOW_ERR` words — every rank guessing 0
   IS the pile-up. Each rank prints a `CRYOFLOW_RANK_BIND` receipt into
   run.out, so the mapping is auditable after the fact. The run dialog's
   preview and chips speak the new truth (`mpirun -n N`, `1 rank → 1
   card (CUDA_VISIBLE_DEVICES)`, `--gpu 0 per rank`) — the t326
   doctrine: every flag the preview shows is one the dispatch writes.
2. **the star preflight read starved on a live file**: the receipt said
   `particles star unreadable … timeout after 15000ms` while relion
   itself parsed the very same bytes on the cluster moments later — the
   file was fine, the WIRE was slow (one exec channel: sshd fork + the
   login shell's profile + a cat off a loaded network filesystem + the
   transfer back; and a pooled connection that silently died hangs its
   first exec until the budget burns — keepalive needs 4×15s to
   notice). `catRemote` now carries a **90s budget and one fresh-wire
   retry** (`dropConnection` → re-dial) on SSH-level failures — a clean
   `No such file` is the file's own verdict and is never retried. And
   the unreadable receipt finally distinguishes the two: a timeout now
   says the read TIMED OUT, the file was NOT reported missing, and the
   move is to run again or check the login node's load — not to
   regenerate a file that exists.

Verified by `e2e-review/run-10-rank-card-pin.mjs` (49 assertions, all
green), on three new mock instruments: the nvidia-smi stub's
`index,memory.free` query with per-card `gpu-free-mb` lists, the mpirun
stub's `mpi-emulate-ranks` lever (runs the command once per rank index
so the bind receipts are provably per-rank), and the cat torture pair
(`cat-slow-ms "<ms> <substring>"` + one-shot `cat-channel-close`,
both substring-scoped so poll traffic is never slowed, both
witness-logged). The field shapes: width 6 over 8 cards → six ranks on
six DISTINCT cards with six receipts; card 1 starved to 100 MB → the
six ranks land on `{0,2,3,4,5,6}` and the starved card is never
picked; 2 cards visible → clamped to 2 with the named note; nvidia-smi
mute → ONE rank with the blind note; a 20s star read (over the old
15s budget, inside the new 90s) verifies in place and the job
completes; a channel that dies without a verdict redials and lands.


## 4w. The minimal wire — one heartbeat, zero star bytes, never a false death (t346)

The user's two-field-report axis, answered at the architecture level
("其实只要保证最小程度和 cluster 的通讯就行 — 任务完全可以在 cluster 上运行"):

1. **The log flood is dead.** The Log tab polled `/api/jobs/[id]/log`
   every 1.5s, and EVERY poll paid its own serialized SSH exec (a
   `wc -l` + a 512KB `tail` + a 64KB stderr tail) on the cluster's
   single wire — stacked behind the poll sweep, the staging and every
   dispatch. On a real login node (exec = sshd fork + shell + a loaded
   `/data03`) the wire saturated: the log tab starved, the UI felt
   stuck, and the receipts said `timeout after 15000ms` about files
   that existed. Now the **poll sweep carries everything** (state +
   `wc -l` + a 4KB `run.out` tail + a 2KB `run.err` tail, batched over
   every job on the connection, one exec per few seconds), and the log
   route is **cache-first**: tail mode reads the record, zero SSH; a
   stale cache (>15s) on a live run falls through to ONE rate-limited
   fetch per 10s; full mode stays on-demand (user-clicked) at the same
   rate limit. E2E: 18s of log-tab polling pays ≤2 fetches (was 12).
2. **The UI never waits on the wire.** `/api/jobs` used to AWAIT the
   sweep — a 15s SSH round trip stalled the whole 4s cadence. The
   route now races the sweep at **1.5s** (the sweep keeps running;
   verdicts land on the next tick), the sweep's own budget grew to
   **45s** (a login-node hiccup no longer eats it), and the throttle
   is adaptive (a sweep that took T seconds buys `max(4s, 1.5×T)` of
   quiet). E2E: with the sweep deliberately sleeping 9s, the GET
   answers in ~1.5s.
3. **The wire heals itself.** keepalive is 10s×3 (≤30s to notice a
   dead peer, was 60s), and **two consecutive exec timeouts drop the
   pooled connection** for a fresh re-dial — a half-dead wire used to
   burn full exec budgets for a whole minute while everything queued
   onto the corpse.
4. **A blip is not a reboot.** One empty `squeue`+`sacct` snapshot
   (age >120s) used to flip a RUNNING row to "interrupted remotely
   (node reboot or hard kill)" while the job was alive. The flip now
   needs **3 consecutive VANISHED verdicts** (`VANISH_STREAK_N`,
   env-tunable for suites); any ALIVE/EXIT/SACCT word resets the
   streak, and the receipt names the count. E2E (knobbed to 4): 2
   blind verdicts keep the row running, the unblinded ALIVE resets
   the streak, the 4th consecutive verdict flips with the count in
   the receipt.
5. **Zero star bytes cross the wire at dispatch.** The t338 gate
   catted the whole `particles.star` home to parse it locally (tens of
   MB on a real extraction — the dispatch stall AND the transfer the
   doctrine forbids). The cluster lane now runs a **census awk pass
   in place**: one row per unique stack path with that stack's max
   image number (`CF_REF\t<path>\t<max>`), POSIX awk, the 90s budget
   + redial ladder. The verdicts, the refusal vocabulary and the
   candidate grammar are byte-identical
   (`particlesRefGateFromRefs`); the upload lane still judges the
   local bytes it is about to upload. Missing files keep the t343
   receipt tail (the door + the remedy + "the check did not run").
6. **The rank launcher survives PRRTE.** OpenMPI 5 (prterun — the
   user's cluster) does not guarantee environment forwarding to a
   non-MPI app: a stripped rank lost PATH/RELION_* and `exec
   relion_refine` died "command not found" before the first banner —
   the field shape "log silent, then failed, cards idle". The sbatch
   script now writes an **`export -p` dump into `.cf-rank-env`**
   (after `module load`, before the run), the launcher sources it
   FIRST (its own self-location is pure bash `${0%/*}` — `dirname`
   dies without PATH), pins its card, resolves the binary through the
   RESTORED environment (`command -v`), and only then execs. E2E:
   with every rank's environment wiped (`env -i`), both ranks still
   pin their own cards and relion runs to completion.
7. **The queue is not a failure.** While Slurm says PENDING the log
   tab now SAYS so ("Queued on Slurm — the log appears the moment the
   job starts on the node") instead of an empty "no log" shrug.

Verified by `e2e-review/run-11-minimal-wire.mjs` (45 assertions, all
green; run with `CF_VANISH_STREAK=4 CF_VANISH_AGE_MS=5000` so the
blind/unblind/reblind choreography cannot race the flip), on three new
mock instruments: the always-on **exec audit** (`~/.slurm/exec-audit.log`,
newline-flattened, 4MB-bounded), the **scheduler-blind pair**
(`squeue-blind`/`sacct-blind`, content = job id or `all`), and
**`mpi-strip-env`** (every rank starts under `env -i`). The generic exec
torture pair (`exec-slow-ms "<ms> <substring>"` + one-shot
`exec-channel-close`) reaches whatever read path the current code
speaks — the census, a header sniff, the sweep itself.

## 4x. The console never blanks — and every surface leads with the count (t347)

The user's UI field reports, answered in kind:

1. **The log console stopped flickering.** The t346 log route had a
   blanking bug of its own: full mode (`?full=1`) polls every 5s but
   the wire budget is one fetch per 10s, so every rate-limited tick
   answered `tail: ""` — the console's whole text vanished on
   alternate refreshes (「文字总是在刷新的过程中消失」). Tail mode
   had the same shape before the first heartbeat (`"(waiting for the
   cluster's next heartbeat…)"` replaced real content). Now the route
   speaks **pending semantics**: an answer that carries no data of its
   own is `{pending: true, note}` — never a placeholder or empty text
   — and a **full-mode cache** (`logFullCache`, 30s, forever on a
   finished run) serves the rate-limited ticks. The UI side completes
   the contract: pending answers KEEP the previous text (a quiet
   amber "syncing" chip whispers why), an HTTP error renders as a slim
   banner ABOVE the log instead of replacing it, a 404 after content
   keeps the last text, a tail↔full switch never clears the console,
   and a cross-mount seed cache (16 jobs LRU, 256KB from the end)
   makes returning to the Log tab paint instantly — no "Reading log…"
   flash. Verified: three back-to-back full-mode polls on a completed
   cluster run all answer with content (the old wire blanked the 2nd
   and 3rd), and run-11's 18s polling window still pays ≤2 fetches.
2. **The submit dialog fits one screen.** The "Run on cluster"
   dialog grew past a viewport (t326's sections + t332's live usage
   list + t306's steppers ≈ 1.4 screens). The compaction pass keeps
   every control and contract: `sm:max-w-2xl` with two-column rows
   (connection+module, GPU width+array split), one-line mode cards,
   one-line helper texts (the full sentences ride `title`s), a
   tightened preview — and the live node list starts **collapsed**
   (header toggle + node count + pinned-node chip; the ask line stays
   always visible, rows one click away, cap 176px when open).
   Measured: 795px total in slurm mode at 1600×900 — zero internal
   scrolling; mobile stacks single-column by design.
3. **The count leads everywhere** (「照片数或颗粒数需要显示得醒目些，
   不仅在任务窗口中，最好也在job的卡片上直接显示出来」). The engine's
   finalize receipts now carry the counted number for the types that
   never had one (refine3d/class3d append `· N particles` beside the
   FSC line, initialmodel/polish/ctfrefine/tomo-picks state theirs) —
   remote runs inherit the same strings through `collectOutputs`. A
   pure parser (`lib/result-counts.ts`) reads the receipt dialect
   (select keeps the KEPT count, symexpand the EXPANDED total,
   autopick both numbers, joinstar the rows), and paints: a **count
   chip on the canvas card** (far right of the status row, teal for
   particles, neutral for micrographs, violet for classes, compact
   82k/1.2M forms), the **KeyNumbers strip at the top of the
   inspector's Overview** (live-counted from the outputs route, the
   receipt as fallback when files are remote-only), and **count chips
   in the inspector's identity row** (visible on every tab). No
   honest number → no chip, never a guess.

Verified by run-11 (45/45) + run-1 (106/106) against the mock cluster,
plus browser-live: canvas cards, inspector strips, tab/mode round-trips
and the collapsed usage panel with a live pin all exercised with zero
console errors.
