/**
 * t390 — the bare-composition lane bench (bun run scripts/t390-default-partition-lane.ts).
 *
 * The user's field report, verbatim: 「Job failed … sbatch refused the
 * submission: Requested node configuration is not available — what was
 * requested: 6 GPU(s) … gpu的资源应该是充足的」. The composition in the
 * receipt names NO node and NO partition: the submission was BARE, so
 * the cluster's DEFAULT partition decided, and no node there can host 6
 * GPUs — the free GPUs live in other partitions a bare request can never
 * name. (The receipt's .bashrc line is login-shell noise, already labeled
 * as such by t311.) Five contracts:
 *
 *   A  parseDefaultPartition: the one-line scontrol dialect names the
 *      Default=YES record, the long form parses too, no default → null,
 *      empty → null;
 *   B  partitionGpuWidths: nodes grouped by their Partitions= field,
 *      widest gpuTotal per partition, a node in TWO partitions
 *      contributes to each, DOWN/DRAIN nodes still count (the
 *      controller's submit-time check is static config, not state);
 *   C  t390DefaultReadout: the sentinel split, the default partition's
 *      ceiling, widest-first widths; unanswerable reads → null;
 *   D  t390DefaultRefusal: the bare-composition refusal teaches the two
 *      real fixes (name a fitting partition / lower the width) and
 *      pre-empts 「gpu的资源应该是充足的」 — free GPUs elsewhere cannot
 *      be matched to a request that lands in the default partition;
 *   E  t390CfgHelp: the pin branch keeps the t337 wording BYTE-IDENTICAL
 *      (no regression), the bare branch names the default-partition
 *      mechanism, and the enrich arms say the ceiling + the fitting
 *      partitions, or the honest drift verdict (wide enough on paper →
 *      the wide nodes were down/drained);
 *   F  the read script: sentinel exactly once, partitions before it,
 *      nodes after, and the login-shell wrapper parses.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseDefaultPartition,
  partitionGpuWidths,
} from "../src/lib/hpc/slurm-usage";
import { loginShellScript } from "../src/lib/remote/ssh";
import {
  T390_SCONTROL_READ,
  t390SplitScontrolRead,
  t390DefaultReadout,
  t390DefaultRefusal,
  t390CfgHelp,
} from "../src/lib/remote/remote-run";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("A — parseDefaultPartition (both dialects)");
{
  // scontrol show partitions -o — one record per line, the field soup real
  // clusters print (elided but shaped like Slurm's own)
  const oneline = [
    "PartitionName=debug AllowGroups=ALL AllowAccounts=ALL AllocNodes=ALL Default=NO DefaultTime=NONE MaxTime=INFINITE State=UP",
    "PartitionName=normal AllowGroups=ALL AllowAccounts=ALL AllocNodes=ALL Default=YES DefaultTime=NONE MaxTime=7-00:00:00 State=UP",
    "PartitionName=gpu AllowGroups=ALL AllowAccounts=ALL AllocNodes=ALL Default=NO DefaultTime=NONE MaxTime=INFINITE State=UP",
  ].join("\n");
  must(parseDefaultPartition(oneline) === "normal", "Default=YES names the default partition");
  must(
    parseDefaultPartition("PartitionName=gpu Default=NO\nPartitionName=debug Default=NO\n") === null,
    "no Default=YES → null (never a guess)"
  );
  must(parseDefaultPartition("") === null, "empty text → null");
  must(parseDefaultPartition("scontrol: error...\n") === null, "error chatter → null");
  // the long form — records span lines, fields may carry spaces around =
  const longform = [
    "PartitionName=debug",
    "   AllowGroups=ALL Default = NO MaxTime=INFINITE",
    "PartitionName=normal",
    "   AllowGroups=ALL Default=YES MaxTime=7-00:00:00",
    "PartitionName=gpu",
    "   AllowGroups=ALL Default = NO",
  ].join("\n");
  must(parseDefaultPartition(longform) === "normal", "the long form parses (whitespace around = tolerated)");
}

console.log("B — partitionGpuWidths (group, widest, DOWN counts)");
{
  // the user's cluster shape: two 6-GPU nodes in gpu (one DOWN — still
  // counts: the submit check is static config), a CPU node in normal, and
  // a 2-GPU node serving BOTH partitions
  const nodes = [
    "NodeName=gpu05 Arch=x86_64 CoresPerSocket=16 CPUAlloc=0 CPUTot=64 State=IDLE Gres=gpu:6 Partitions=gpu",
    "NodeName=gpu06 Arch=x86_64 State=DOWN+DRAIN Gres=gpu:6 Partitions=gpu",
    "NodeName=brain1 State=IDLE Gres=(null) Partitions=normal",
    "NodeName=brain2 State=MIXED Gres=gpu:2 Partitions=normal,gpu",
  ].join("\n");
  const widths = partitionGpuWidths(nodes);
  const gpu = widths.find((w) => w.partition === "gpu");
  const normal = widths.find((w) => w.partition === "normal");
  must(!!gpu && gpu.maxGpus === 6, "gpu's ceiling is 6 (the 6-GPU nodes)", JSON.stringify(widths));
  must(!!gpu && gpu.nodes === 3, "gpu counts all three nodes serving it (brain2 included)");
  must(
    !!normal && normal.maxGpus === 2 && normal.nodes === 2,
    "normal's ceiling is brain2's 2 (brain1's 0 drags nothing)",
    JSON.stringify(normal)
  );
  must(
    widths[0].partition === "gpu",
    "widest-first ordering (the fitting list the refusals offer is deterministic)"
  );
  must(
    partitionGpuWidths("").length === 0,
    "no nodes → no widths (the caller degrades on an empty read)"
  );
}

console.log("C — t390DefaultReadout (the sentinel split + the verdict inputs)");
{
  const parts = "PartitionName=normal Default=YES State=UP\nPartitionName=gpu Default=NO State=UP\n";
  const nodes =
    "NodeName=gpu05 State=IDLE Gres=gpu:6 Partitions=gpu\nNodeName=gpu06 State=IDLE Gres=gpu:6 Partitions=gpu\nNodeName=brain1 State=IDLE Gres=(null) Partitions=normal\n";
  const stdout = `${parts}CF_PARTS_END\n${nodes}`;
  const r = t390DefaultReadout(stdout);
  must(!!r && r.def === "normal", "the default partition reads out");
  must(!!r && r.defMax === 0, "the default partition's ceiling is 0 (its nodes have no GPUs)");
  must(
    !!r && r.widths.some((w) => w.partition === "gpu" && w.maxGpus === 6),
    "the gpu partition's 6-GPU ceiling reads out"
  );
  must(t390DefaultReadout("no sentinel here") === null, "no sentinel → null (degrade, never guess)");
  must(
    t390DefaultReadout("PartitionName=gpu Default=NO\nCF_PARTS_END\n") === null,
    "no default partition in the read → null"
  );
  const split = t390SplitScontrolRead(stdout);
  must(
    !!split && split[0].includes("Default=YES") && split[1].startsWith("NodeName=gpu05"),
    "the split lands the partitions block first, nodes second"
  );
}

console.log("D — t390DefaultRefusal (teach the fix, pre-empt the confusion)");
{
  const widths = [
    { partition: "gpu", maxGpus: 6, nodes: 2 },
    { partition: "normal", maxGpus: 0, nodes: 1 },
  ];
  const text = t390DefaultRefusal({ def: "normal", defMax: 0, want: 6, widths });
  must(text.includes('DEFAULT partition "normal" decides'), "the default partition is named");
  must(text.includes("this job asks 6"), "the requested width is named");
  must(
    text.includes("GPUs being free elsewhere does not help"),
    "the 「gpu的资源应该是充足的」 confusion is pre-empted head-on"
  );
  must(
    text.includes("queue the job; a width no node there can EVER host is refused outright"),
    "busy-vs-refused is spelled out (free would queue — the refusal is the shape)"
  );
  must(
    text.includes("Partitions that CAN host 6 GPU(s): gpu"),
    "the fitting partitions are named"
  );
  must(
    text.includes("pick one in the run dialog's Node/partition dropdown"),
    "the remedy names the dropdown"
  );
  must(text.includes("Or lower the GPU width to 0."), "the lower-the-width fallback closes the text");
  // the no-fits shape: no partition can host the width
  const narrow = t390DefaultRefusal({
    def: "normal",
    defMax: 5,
    want: 6,
    widths: [{ partition: "normal", maxGpus: 5, nodes: 4 }],
  });
  must(
    narrow.includes("No partition on this cluster offers that width per scontrol"),
    "no fitting partition → the admin sentence, not a fabricated pick"
  );
  must(narrow.includes("lower the GPU width to 5"), "the width fallback names the ceiling");
}

console.log("E — t390CfgHelp (the translation, pin vs bare)");
{
  const PIN_TEXT =
    " — what was requested: node gpu05 · partition gpu · 6 GPU(s). No node on the cluster can satisfy that combination right now (a pinned node may be down, drained, or narrower than the GPU width, or it may not live in the partition the request landed on). Pick a different node in the live usage list, click the pinned row again to release the pin, or lower the GPU width.";
  // (a) the pin branch is BYTE-IDENTICAL to the t337 wording
  must(
    t390CfgHelp({
      nodelistPin: "gpu05",
      composition: "node gpu05 · partition gpu · 6 GPU(s)",
      gresWidth: 6,
      noPartitionNote: "",
      enrich: { def: "normal", defMax: 6, widths: [] },
    }) === PIN_TEXT,
    "a pinned submission keeps the t337 wording byte-for-byte (the enrich never leaks into it)"
  );
  // (b) the bare branch without enrich names the MECHANISM
  const bare = t390CfgHelp({
    nodelistPin: null,
    composition: "6 GPU(s)",
    gresWidth: 6,
    noPartitionNote: "",
    enrich: null,
  });
  must(bare.startsWith(" — what was requested: 6 GPU(s)."), "the composition rides first");
  must(
    bare.includes("named no node and no partition, so the cluster's DEFAULT partition decided"),
    "the bare branch names the default-partition mechanism (no phantom pin talk)"
  );
  must(
    bare.includes("GPUs sitting free in OTHER partitions cannot be matched"),
    "the free-elsewhere confusion is answered"
  );
  must(!bare.includes("a pinned node may be down"), "no pin-flavored guessing on a pinless submission");
  // (c) enrich below the width: the ceiling + the fitting partitions
  const enriched = t390CfgHelp({
    nodelistPin: null,
    composition: "6 GPU(s)",
    gresWidth: 6,
    noPartitionNote: "",
    enrich: {
      def: "normal",
      defMax: 5,
      widths: [
        { partition: "gpu", maxGpus: 6, nodes: 2 },
        { partition: "normal", maxGpus: 5, nodes: 4 },
      ],
    },
  });
  must(
    enriched.includes('the default partition is "normal", offering 5 GPU(s) at most'),
    "the enrich names the default partition's own ceiling"
  );
  must(
    enriched.includes("partitions that can host 6: gpu — pick one now"),
    "the enrich names the partitions that can host the width"
  );
  // (d) enrich at/above the width: the honest drift verdict
  const drift = t390CfgHelp({
    nodelistPin: null,
    composition: "6 GPU(s)",
    gresWidth: 6,
    noPartitionNote: "",
    enrich: {
      def: "gpu",
      defMax: 6,
      widths: [{ partition: "gpu", maxGpus: 6, nodes: 2 }],
    },
  });
  must(
    drift.includes("wide enough on paper, so the refusal is the live state"),
    "a config that CAN host it points at the live state instead"
  );
  must(
    drift.includes("down or drained at submit time"),
    "the drift verdict names down/drained nodes"
  );
}

console.log("F — the read script (sentinel, order, syntax)");
{
  const n = T390_SCONTROL_READ.split("CF_PARTS_END").length - 1;
  must(n === 1, "the sentinel appears exactly once", `got ${n}`);
  must(
    T390_SCONTROL_READ.indexOf("scontrol show partitions") < T390_SCONTROL_READ.indexOf("CF_PARTS_END") &&
      T390_SCONTROL_READ.indexOf("scontrol show nodes") > T390_SCONTROL_READ.indexOf("CF_PARTS_END"),
    "partitions before the sentinel, nodes after"
  );
  must(
    T390_SCONTROL_READ.includes("2>/dev/null"),
    "each scontrol block silences its own errors (one missing command degrades, not poisons)"
  );
  const dir = mkdtempSync(path.join(tmpdir(), "cf-t390-"));
  const f = path.join(dir, "read.sh");
  writeFileSync(f, loginShellScript(T390_SCONTROL_READ));
  const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
  must(r.status === 0, "the login-shell wrapper parses (bash -n)", r.stderr);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nt390 default-partition-lane bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
