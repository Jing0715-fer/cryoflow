#!/usr/bin/env python3
"""t213 X4 migration — the thead override grew a body (t223: it matches
the inventory's head to mint the wire's Shape th). The SEMANTICS stay
pinned: the context still neutralizes (a head row is a label, not a
door) and node is read from the hast tree but never leaked to the DOM.
Byte-surgery, not hand-typing (the em-dash lesson, third on record)."""
import pathlib

p = pathlib.Path("scripts/t213-e2e.mjs")
src = p.read_text(encoding="utf-8")

lines = src.split("\n")
idx = next((i for i, l in enumerate(lines) if l.startswith("must(/thead:")), None)
assert idx is not None, "X4 line not found"
old_line = lines[idx]
assert "X4 the thead NEUTRALIZES" in old_line, f"unexpected line: {old_line[:80]}"

new_block = (
  'const theadBlock = DLG.slice(DLG.indexOf("thead: ({"), DLG.indexOf("      tr: ({"));\n'
  'must(theadBlock.includes("InventoryTableContext.Provider value={false}") && !/\\{\\.\\.\\.node\\}/.test(theadBlock) && theadBlock.includes("OWNER_HEAD.every"),\n'
  '  "X4 the thead NEUTRALIZES the context — a head row is a label, not a door (t223: the override grew a body to mint the wire\'s Shape th; node is read from the hast tree, never leaked to the DOM)");'
)
lines[idx] = new_block
p.write_text("\n".join(lines), encoding="utf-8")
print("X4 migrated")
