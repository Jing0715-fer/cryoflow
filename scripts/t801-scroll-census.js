(() => {
  const out = [];
  const focusSel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const oy = cs.overflowY, ox = cs.overflowX;
    if (!((oy === 'auto' || oy === 'scroll') || (ox === 'auto' || ox === 'scroll'))) continue;
    const scrollable = el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4;
    if (!scrollable) continue;
    const tabbable = el.tabIndex >= 0;
    const hasFocusChild = !!el.querySelector(focusSel);
    const label = el.getAttribute('aria-label') || el.getAttribute('role') || el.tagName.toLowerCase();
    out.push({label: label.slice(0, 50), tabbable, hasFocusChild, dead: !tabbable && !hasFocusChild});
  }
  const dead = out.filter(r => r.dead).map(r => r.label);
  const covered = out.filter(r => !r.dead && !r.tabbable).length;
  const tabbed = out.filter(r => r.tabbable).length;
  return JSON.stringify({total: out.length, dead, coveredCount: covered, tabbedCount: tabbed});
})()
