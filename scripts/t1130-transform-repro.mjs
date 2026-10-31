#!/usr/bin/env node
/**
 * t1130 — the sheet transform's OFFLINE repro: the live ride's cell came
 * back with DEFAULT params (rev 0, geometry null) and the apply error
 * "no sheet geometry" — did the create's params never reach the tree, or
 * did a later update wipe them? Mol*'s state tree runs on pure CPU —
 * build a minimal tree HERE with the same BuiltIn shape and find out.
 */
import { PluginStateObject as SO, PluginStateTransform } from "molstar/lib/mol-plugin-state/objects.js";
import { StateTransformer } from "molstar/lib/mol-state/index.js";
import { Task } from "molstar/lib/mol-task/index.js";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition.js";
import { StateTree } from "molstar/lib/mol-state/tree/immutable.js";
import { State } from "molstar/lib/mol-state/state.js";

const geometry = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  indices: new Uint32Array([0, 1, 2]),
  bandOfTri: new Int32Array([0]),
  bandColors: [0x808080],
  bandLabels: ["0.5 density"],
  stats: { kept: 1, dropped: 0, lattice: 1 },
};

const T = PluginStateTransform.BuiltIn({
  name: "repro-sheet-transform",
  display: { name: "Repro", description: "x" },
  from: SO.Root,
  to: SO.Shape.Provider,
  params: {
    geometry: PD.Value(null),
    rev: PD.Numeric(0),
  },
})({
  canAutoUpdate: () => true,
  apply({ params }) {
    return Task.create("repro", async () => {
      if (!params?.geometry) throw new Error("no sheet geometry");
      return new SO.Shape.Provider({ label: "repro", data: params.geometry }, { label: "repro" });
    });
  },
  update({ oldParams, newParams }) {
    if (!newParams?.geometry) return StateTransformer.UpdateResult.Null;
    if (newParams.rev === oldParams?.rev) return StateTransformer.UpdateResult.Unchanged;
    return StateTransformer.UpdateResult.Recreate;
  },
});

// a minimal state with one Root cell
const state = State.create(new SO.Root({}, { label: "root" }), { runTask: (t, ctx) => t.run() });
const b = state.build().toRoot();
const node = b.apply(T, { geometry, rev: 7 });
console.log("builder params passed:", JSON.stringify({ rev: 7, hasGeometry: !!geometry }));
// run the edit through the state's own task runner (updateTree returns a Task)
const { SyncRuntimeContext } = await import("molstar/lib/mol-task/execution/synchronous.js");
await state.updateTree(b.getTree()).runInContext(SyncRuntimeContext);
// walk the cells
for (const cell of state.cells.values()) {
  const id = String(cell?.transform?.transformer?.id || "");
  if (id.includes("repro")) {
    console.log("cell:", {
      id: id.slice(0, 50),
      status: cell.status,
      rev: cell.transform?.params?.rev,
      hasGeometry: !!cell.transform?.params?.geometry,
      err: cell.status === "error" ? String(cell.errorText || "") : undefined,
    });
  }
}
console.log("state committed");

// === the BROWSER-SHAPED call: .update(Transformer, params) — two args ===
const geometry2 = { ...geometry, stats: { kept: 2, dropped: 0, lattice: 2 } };
const b2 = state.build().to(node.ref);
try {
  b2.update(T, { geometry: geometry2, rev: 8 }); // the exact browser call shape
  await state.updateTree(b2.getTree()).runInContext(SyncRuntimeContext);
  for (const cell of state.cells.values()) {
    const id = String(cell?.transform?.transformer?.id || "");
    if (id.includes("repro")) {
      console.log("after 2-arg update:", { status: cell.status, rev: cell.transform?.params?.rev, hasGeometry: !!cell.transform?.params?.geometry, err: cell.status === "error" ? String(cell.errorText || "") : undefined });
    }
  }
} catch (e) {
  console.log("2-arg update THREW:", e.message?.slice(0, 120));
}
