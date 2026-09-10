#!/usr/bin/env python3
"""Task 107 — re-home the bookmark IMPORT entry (qa42, qa43).

The hidden file input no longer lives inside the camera-bookmarks popover:
Task 54 moved it to the component root (a Radix dialog auto-dismisses the
popover beneath it, killing a popover-scoped input) and imports now land
in the import-preview DIALOG which needs an explicit confirm click. The
old selector returned NO-INPUT and the import silently died.

New flow: inject into the root hidden input (input[type=file][accept*=json])
→ wait for the "Import views" dialog → click its ^Import(\d+)?$ confirm.
"""
import pathlib
import re

BASE = pathlib.Path("/home/z/my-project/scripts")
SUITES = ["qa42", "qa43"]

OLD_HEAD = 'const importViaInput = (payload) =>'
NEW_FN = '''const importViaInput = async (payload) => {
  // the hidden file input lives at the COMPONENT ROOT now (Task 54: a
  // Radix dialog auto-dismisses the popover beneath it, unmounting a
  // popover-scoped input) and imports land in the preview dialog, which
  // needs the confirm click
  const res = evalJs(`(() => {
    const inp = document.querySelector('input[accept="application/json,.json"]');
    if (!inp) return 'NO-INPUT';
    const dt = new DataTransfer();
    const f = new File([JSON.stringify((${JSON.stringify(payload)}))], 'views.json', { type: 'application/json' });
    dt.items.add(f);
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'injected';
  })()`);
  if (!String(res).includes("injected")) return res;
  await sleep(1800);
  return evalJs(`(() => {
    const dlgs = [...document.querySelectorAll('[role=dialog][data-state=open]')];
    const dlg = dlgs.find(d => (d.textContent||'').includes('Import views'));
    if (!dlg) return 'NO-IMPORT-DIALOG';
    const btn = [...dlg.querySelectorAll('button')].find(b => /^Import( \\d+)?$/.test((b.textContent||'').trim()));
    if (!btn) return 'NO-CONFIRM';
    btn.click();
    return 'confirmed';
  })()`);
};'''

for name in SUITES:
    p = BASE / f"{name}-e2e.mjs"
    s = p.read_text()
    if OLD_HEAD not in s:
        print(f"{name}: no importViaInput — skipped")
        continue
    start = s.index(OLD_HEAD)
    # function ends at the first line that is exactly `})();` closing the
    # evalJs template arrow — find the closing of the outer arrow fn
    end = s.index("})()`);", start) + len("})()`);")
    s = s[:start] + NEW_FN + s[end:]
    # call sites: add await
    s = re.sub(r'(console\.log\("  [^"]*:", )importViaInput\(', r'\1await importViaInput(', s)
    p.write_text(s)
    print(f"{name}: importViaInput rehomed + call sites awaited")
