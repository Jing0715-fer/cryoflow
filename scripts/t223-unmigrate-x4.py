#!/usr/bin/env python3
"""t213 X4 un-migration — the thead override is BACK to its original
arrow shape (the stray-th lesson: the Shape th lives in the TR override,
so thead returns the Provider directly again and X4's original pin is
true again). Byte surgery, not hand-typing."""
import pathlib

p = pathlib.Path("scripts/t213-e2e.mjs")
src = p.read_text(encoding="utf-8")
lines = src.split("\n")
idx = next((i for i, l in enumerate(lines) if l.startswith("const theadBlock = DLG.slice")), None)
assert idx is not None, "migrated X4 block not found"
# the migrated block: theadBlock line, must( line, label line, "); line
blk = lines[idx:idx + 4]
assert "X4 the thead NEUTRALIZES" in blk[2] and blk[3].strip().endswith('");'), f"unexpected block: {blk}"
original = 'must(/thead: \\(\\{ node, children, \\.\\.\\.rest \\}: TheadProps\\) => \\(\\s*\\n\\s*<InventoryTableContext\\.Provider value=\\{false\\}>/.test(DLG), "X4 the thead NEUTRALIZES the context — a head row is a label, not a door (and node is destructured out, never leaked to the DOM)");'
lines[idx:idx + 4] = [original]
p.write_text("\n".join(lines), encoding="utf-8")
print("X4 restored to original pin")
