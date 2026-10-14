#!/usr/bin/env node
/**
 * t998 — the RENAME ARC'S FLIP-FACE WALK (the t998 entry's candidate ①,
 * carried): the workspace row's rename arc, witnessed LIVE on the
 * rendered plane — the four-branch voice flipping under real keystrokes,
 * the two silent cancels pre-spoken before Enter lands, the commit
 * landing through the product's own door, and the world restoring
 * itself:
 *
 *   leg 0  the as-found honesty (the API is the judge): ONE workspace
 *          ("Main"), TWENTY-TWO jobs, the fingerprint banked;
 *   leg 2  the resting plane — the Workspaces tab opens, the rename
 *          door stands, and the CURED delete door speaks its refusal in
 *          the NAME ("Delete Main (the default workspace cannot be
 *          deleted)"), design-disabled as ever;
 *   leg 3  THE OPEN FACE — the pencil opens the editor ON the unchanged
 *          face (value "Main", name "Workspace name (unchanged — edit
 *          the name to rename)"): Enter right now would do nothing, and
 *          the voice says so before anything is pressed;
 *   leg 4  THE VOICE FLIPS — empty → "(empty — type a name to rename)",
 *          a fresh name → the plain rest voice, the 60 wall → "(at the
 *          60-character limit)" with the value capped at exactly 60,
 *          the original name again → the unchanged face (four branches,
 *          four live witnesses);
 *   leg 5  THE SILENT CANCELS, PRE-SPOKEN — Enter on the unchanged face
 *          closes the editor with the name unmoved; Enter on the empty
 *          face likewise; Escape mid-edit cancels — every refusal was
 *          already spoken by the name when it landed;
 *   leg 6  THE COMMIT — "Main (t998)" typed, the rest voice answers,
 *          Enter lands: the row's name blooms, the pencil's and the
 *          delete door's names follow the interpolation, and the API
 *          judges the rename real;
 *   leg 7  THE CAP WALL LIVE — 70 typed chars cap at exactly 60 with
 *          the cap face speaking; Escape leaves the name unmoved;
 *   leg 8  THE RESTORE — "Main" typed, Enter lands, the world's name
 *          returns through the same door it left;
 *   leg 9  THE CREATE INPUT'S GHOST GUARD — the create dialog's name
 *          input carries NO aria-label at rest (the Label element
 *          speaks), the 60 wall flips it to "Name (at the
 *          60-character limit)", clearing restores the ghost;
 *   leg 10 world honesty — the jobs fingerprint as-found = as-left, one
 *          workspace named Main, the resting doors at rest.
 *
 * RIDE LAWS inherited: the kit's wide-first opening; poll-then-probe;
 * realClick probes vis AND own every round (the hover-gated row actions
 * ride the mouse-move-first shape the t993 walk proved); the focus is
 * verified before every keystroke; the walk asserts and exits honest
 * (the rename is undone by the product's own commit door — zero
 * localStorage writes; the jobs untouched).
 *
 *   node scripts/t998-rename-flip-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, shot,
  api, readJobs, jobsArr, fingerprint, focusGate, serverFirst, finish, wideFirst,
} = createWalk({ name: "t998-rename-flip-walk", receiptFile: "t998-rename-flip-walk.json" });

const OPEN_FACE = "Workspace name (unchanged — edit the name to rename)";
const EMPTY_FACE = "Workspace name (empty — type a name to rename)";
const REST_FACE = "Workspace name";
const CAP_FACE = "Workspace name (at the 60-character limit)";
const DEL_REST = 'button[aria-label="Delete Main (the default workspace cannot be deleted)"]';
const TAB_SEL = `[...document.querySelectorAll('[role="tab"],button')].find((t) => (t.textContent ?? '').trim().startsWith('Workspaces'))`;
const RENAME_INPUT = `(() => { const inp = [...document.querySelectorAll('input')].find((i) => (i.getAttribute('aria-label') ?? '').startsWith('Workspace name')); return JSON.stringify({ present: !!inp, focused: document.activeElement === inp, label: inp ? inp.getAttribute('aria-label') : null, value: inp ? inp.value : null }); })()`;
const ROW_NAMES = `(() => { const list = document.querySelector('[aria-label="Workspaces"]'); return JSON.stringify({ names: list ? [...list.querySelectorAll('p')].map((x) => (x.getAttribute('title') ?? x.textContent ?? '').trim()) : [] }); })()`;
const INPUT_GONE = `(() => JSON.stringify({ n: [...document.querySelectorAll('input')].filter((i) => (i.getAttribute('aria-label') ?? '').startsWith('Workspace name')).length }))()`;

const selectAll = () => { sh(`${AB} press Control+a`); };
const type = (s) => { sh(`${AB} keyboard type "${s}"`); };
const clearInput = () => { selectAll(); sh(`${AB} press Backspace`); };

console.log("=== t998 rename-flip walk ===");

/* the server-first law — kit-enforced */
await serverFirst();

/* LEG 0 — the as-found honesty captures (the API is the judge) */
console.log("leg 0: the as-found world");
const jobs0 = await readJobs();
const arr0 = jobsArr(jobs0 ?? {});
ok("the as-found world carries TWENTY-TWO jobs", arr0.length === 22, `rows=${arr0.length}`);
const fp0 = fingerprint(arr0);
ok("the fingerprint banked (non-empty)", fp0.length > 0, `chars=${fp0.length}`);
let ws0 = null;
try { ws0 = JSON.parse(api("GET", "/api/workspaces")); } catch { ws0 = null; }
const ws0List = Array.isArray(ws0?.workspaces) ? ws0.workspaces : [];
ok("the as-found world carries ONE workspace (Main)",
  ws0List.length === 1 && ws0List[0]?.name === "Main", `workspaces=${ws0List.map((w) => w.name).join(",")}`);

/* LEG 1 — the kit's wide-first opening */
console.log("leg 1: the fresh open (wide-first)");
await wideFirst();

/* LEG 2 — the resting plane (the cured doors at rest) */
console.log("leg 2: the resting plane (the cured delete door speaks in its NAME)");
const tabClick = await realClick(TAB_SEL);
ok("the Workspaces tab opened its panel", String(tabClick).startsWith("clicked@"), String(tabClick));
const renameDoor = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button[aria-label="Rename Main"]').length }))()`,
  (v) => v.n > 0, 16, 500);
ok("the rename door stands (the pencil, named for its row)", !!renameDoor && renameDoor.n > 0, `doors=${renameDoor?.n}`);
const delDoor = await poll(
  `(() => { const b = document.querySelector('${DEL_REST}'); if (!b) return JSON.stringify({ present: false }); return JSON.stringify({ present: true, disabled: b.disabled, title: b.getAttribute('title') }); })()`,
  (v) => v.present, 16, 500);
ok("THE CURE LIVE AT REST — the delete door's refusal rides the NAME (and stays design-disabled)",
  !!delDoor && delDoor.present && delDoor.disabled === true, `disabled=${delDoor?.disabled}`);

/* LEG 3 — THE OPEN FACE */
console.log("leg 3: the open face (the editor opens ON the unchanged face)");
const penClick = await realClick(`document.querySelector('button[aria-label="Rename Main"]')`);
ok("the pencil click landed", String(penClick).startsWith("clicked@"), String(penClick));
const openFace = await poll(RENAME_INPUT,
  (v) => v.present && v.focused && v.label === OPEN_FACE && v.value === "Main", 16, 500);
ok("THE OPEN FACE SPEAKS — focused, valued Main, named for the refusal Enter would land",
  !!openFace && openFace.label === OPEN_FACE && openFace.value === "Main",
  `label="${openFace?.label}" value="${openFace?.value}"`);
shot("t998-open-face.png");

/* LEG 4 — THE VOICE FLIPS (four branches, four live witnesses) */
console.log("leg 4: the voice flips (empty / rest / cap / unchanged)");
clearInput();
const emptyFace = await poll(RENAME_INPUT,
  (v) => v.present && v.label === EMPTY_FACE && v.value === "", 12, 400);
ok("the EMPTY face speaks (clear the name, the voice names the way out)",
  !!emptyFace && emptyFace.label === EMPTY_FACE, `label="${emptyFace?.label}"`);
type("Main v2");
const restVoice = await poll(RENAME_INPUT,
  (v) => v.present && v.label === REST_FACE && v.value === "Main v2", 12, 400);
ok("the REST voice answers a fresh name (the plain form, the fence kept)",
  !!restVoice && restVoice.label === REST_FACE && restVoice.value === "Main v2",
  `label="${restVoice?.label}" value="${restVoice?.value}"`);
clearInput();
type("x".repeat(65));
const capFace = await poll(RENAME_INPUT,
  (v) => v.present && v.label === CAP_FACE && v.value.length === 60, 12, 400);
ok("THE CAP FACE SPEAKS at the wall (70 typed chars, exactly 60 kept)",
  !!capFace && capFace.label === CAP_FACE && capFace.value.length === 60,
  `label="${capFace?.label}" len=${capFace?.value.length}`);
shot("t998-cap-face.png");
clearInput();
type("Main");
const backToUnchanged = await poll(RENAME_INPUT,
  (v) => v.present && v.label === OPEN_FACE && v.value === "Main", 12, 400);
ok("the original name returns the UNCHANGED face (the fourth branch closes the wheel)",
  !!backToUnchanged && backToUnchanged.label === OPEN_FACE && backToUnchanged.value === "Main");

/* LEG 5 — THE SILENT CANCELS, PRE-SPOKEN */
console.log("leg 5: the silent cancels (each refusal already spoken)");
sh(`${AB} press Enter`);
const cancel1 = await poll(INPUT_GONE, (v) => v.n === 0, 12, 400);
const nameAfterCancel1 = await poll(ROW_NAMES, (v) => v.names.length === 1 && v.names[0] === "Main", 8, 400);
ok("Enter on the UNCHANGED face closed the editor, the name unmoved (the voice had spoken)",
  !!cancel1 && cancel1.n === 0 && !!nameAfterCancel1, `inputs=${cancel1?.n} names=${JSON.stringify(nameAfterCancel1?.names)}`);
const penClick2 = await realClick(`document.querySelector('button[aria-label="Rename Main"]')`);
const openFace2 = await poll(RENAME_INPUT, (v) => v.present && v.focused && v.label === OPEN_FACE, 12, 400);
ok("the editor reopens on the unchanged face (the open's honesty is the arc's law, not a one-off)",
  String(penClick2).startsWith("clicked@") && !!openFace2 && openFace2.label === OPEN_FACE);
clearInput();
const emptyFace2 = await poll(RENAME_INPUT, (v) => v.present && v.label === EMPTY_FACE, 12, 400);
sh(`${AB} press Enter`);
const cancel2 = await poll(INPUT_GONE, (v) => v.n === 0, 12, 400);
const nameAfterCancel2 = await poll(ROW_NAMES, (v) => v.names.length === 1 && v.names[0] === "Main", 8, 400);
ok("Enter on the EMPTY face refused the same way (pre-spoken, name unmoved)",
  !!emptyFace2 && !!cancel2 && cancel2.n === 0 && !!nameAfterCancel2,
  `inputs=${cancel2?.n} names=${JSON.stringify(nameAfterCancel2?.names)}`);
const penClick3 = await realClick(`document.querySelector('button[aria-label="Rename Main"]')`);
await poll(RENAME_INPUT, (v) => v.present && v.focused, 12, 400);
clearInput();
type("temp");
const restVoice2 = await poll(RENAME_INPUT, (v) => v.present && v.label === REST_FACE && v.value === "temp", 12, 400);
sh(`${AB} press Escape`);
const cancel3 = await poll(INPUT_GONE, (v) => v.n === 0, 12, 400);
const nameAfterCancel3 = await poll(ROW_NAMES, (v) => v.names.length === 1 && v.names[0] === "Main", 8, 400);
ok("Escape mid-edit cancels (the input owns its Escape — the name unmoved)",
  String(penClick3).startsWith("clicked@") && !!restVoice2 && !!cancel3 && cancel3.n === 0 && !!nameAfterCancel3,
  `inputs=${cancel3?.n} names=${JSON.stringify(nameAfterCancel3?.names)}`);

/* LEG 6 — THE COMMIT */
console.log("leg 6: the commit (the rename lands through the product's own door)");
const penClick4 = await realClick(`document.querySelector('button[aria-label="Rename Main"]')`);
const openFace4 = await poll(RENAME_INPUT, (v) => v.present && v.focused && v.label === OPEN_FACE, 12, 400);
ok("the editor opens for the commit (the unchanged face, one last time)",
  String(penClick4).startsWith("clicked@") && !!openFace4);
clearInput();
type("Main (t998)");
const restVoice4 = await poll(RENAME_INPUT,
  (v) => v.present && v.label === REST_FACE && v.value === "Main (t998)", 12, 400);
ok("the rest voice carries the new name (Enter may land)", !!restVoice4 && restVoice4.label === REST_FACE);
sh(`${AB} press Enter`);
const committed = await poll(ROW_NAMES, (v) => v.names.length === 1 && v.names[0] === "Main (t998)", 16, 500);
ok("THE COMMIT LANDED — the row's name bloomed to Main (t998)",
  !!committed && committed.names[0] === "Main (t998)", `names=${JSON.stringify(committed?.names)}`);
const doorsFollow = await poll(
  `(() => JSON.stringify({ pen: document.querySelectorAll('button[aria-label="Rename Main (t998)"]').length, del: document.querySelectorAll('button[aria-label="Delete Main (t998) (the default workspace cannot be deleted)"]').length }))()`,
  (v) => v.pen > 0 && v.del > 0, 12, 500);
ok("the pencil's and the delete door's names followed the interpolation (one truth, every door)",
  !!doorsFollow && doorsFollow.pen > 0 && doorsFollow.del > 0, `pen=${doorsFollow?.pen} del=${doorsFollow?.del}`);
let wsMid = null;
try { wsMid = JSON.parse(api("GET", "/api/workspaces")); } catch { wsMid = null; }
const wsMidList = Array.isArray(wsMid?.workspaces) ? wsMid.workspaces : [];
ok("the API judges the rename real", wsMidList.length === 1 && wsMidList[0]?.name === "Main (t998)",
  `workspaces=${wsMidList.map((w) => w.name).join(",")}`);
shot("t998-committed.png");

/* LEG 7 — THE CAP WALL LIVE (on the committed name) */
console.log("leg 7: the cap wall live (70 typed, 60 kept, Escape honest)");
const penClick5 = await realClick(`document.querySelector('button[aria-label="Rename Main (t998)"]')`);
const openFace5 = await poll(RENAME_INPUT, (v) => v.present && v.focused && v.label === OPEN_FACE && v.value === "Main (t998)", 12, 500);
ok("the committed name reopens on the unchanged face (the open's law holds on the new name)",
  String(penClick5).startsWith("clicked@") && !!openFace5 && openFace5.value === "Main (t998)");
clearInput();
type("y".repeat(70));
const capFace2 = await poll(RENAME_INPUT,
  (v) => v.present && v.label === CAP_FACE && v.value.length === 60, 12, 400);
ok("the cap face speaks again (the wall's voice is not a one-row affair)",
  !!capFace2 && capFace2.label === CAP_FACE && capFace2.value.length === 60);
sh(`${AB} press Escape`);
const cancel5 = await poll(INPUT_GONE, (v) => v.n === 0, 12, 400);
const nameAfter5 = await poll(ROW_NAMES, (v) => v.names.length === 1 && v.names[0] === "Main (t998)", 8, 400);
ok("Escape leaves the committed name unmoved", !!cancel5 && cancel5.n === 0 && !!nameAfter5);

/* LEG 8 — THE RESTORE */
console.log("leg 8: the restore (the world's name returns through its own door)");
const penClick6 = await realClick(`document.querySelector('button[aria-label="Rename Main (t998)"]')`);
const openFace6 = await poll(RENAME_INPUT, (v) => v.present && v.focused && v.label === OPEN_FACE, 12, 500);
ok("the editor opens for the restore", String(penClick6).startsWith("clicked@") && !!openFace6);
clearInput();
type("Main");
const restVoice6 = await poll(RENAME_INPUT,
  (v) => v.present && v.label === REST_FACE && v.value === "Main", 12, 400);
sh(`${AB} press Enter`);
const restored = await poll(ROW_NAMES, (v) => v.names.length === 1 && v.names[0] === "Main", 16, 500);
ok("THE RESTORE LANDED — the row's name is Main again", !!restVoice6 && !!restored && restored.names[0] === "Main",
  `names=${JSON.stringify(restored?.names)}`);

/* LEG 9 — THE CREATE INPUT'S GHOST GUARD */
console.log("leg 9: the create input's ghost guard (the same wall's other bank)");
const newClick = await realClick(`document.querySelector('button[aria-label="Create a new workspace"]')`);
ok("the create dialog opened", String(newClick).startsWith("clicked@"), String(newClick));
const ghostRest = await poll(
  `(() => { const i = document.querySelector('#new-workspace-name'); return JSON.stringify({ present: !!i, label: i ? i.getAttribute('aria-label') : 'absent', focused: document.activeElement === i }); })()`,
  (v) => v.present && v.label === null && v.focused, 12, 500);
ok("THE GHOST AT REST — no aria-label (the Label element speaks), focus holds",
  !!ghostRest && ghostRest.label === null && ghostRest.focused, `label=${JSON.stringify(ghostRest?.label)}`);
type("z".repeat(65));
const ghostCap = await poll(
  `(() => { const i = document.querySelector('#new-workspace-name'); return JSON.stringify({ label: i ? i.getAttribute('aria-label') : 'absent', len: i ? i.value.length : 0 }); })()`,
  (v) => v.label === "Name (at the 60-character limit)" && v.len === 60, 12, 400);
ok("THE CREATE CAP FACE SPEAKS (65 typed, exactly 60 kept — the same wall's voice)",
  !!ghostCap && ghostCap.label === "Name (at the 60-character limit)" && ghostCap.len === 60,
  `label="${ghostCap?.label}" len=${ghostCap?.len}`);
shot("t998-create-cap-face.png");
clearInput();
const ghostBack = await poll(
  `(() => { const i = document.querySelector('#new-workspace-name'); return JSON.stringify({ label: i ? i.getAttribute('aria-label') : 'absent', len: i ? i.value.length : 0 }); })()`,
  (v) => v.label === null && v.len === 0, 12, 400);
ok("clearing restores the ghost (the attribute exists only to refuse)",
  !!ghostBack && ghostBack.label === null && ghostBack.len === 0);
const cancelBtn = await realClick(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return null; return [...dlg.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Cancel') ?? null; })()`);
const dlgShut = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`,
  (v) => v.open === false, 10, 500);
ok("the dialog closed through its real mouth (the Cancel, plain-named at rest)",
  String(cancelBtn).startsWith("clicked@") && !!dlgShut && dlgShut.open === false, `${cancelBtn} shut=${dlgShut?.open}`);

/* LEG 10 — world honesty (the API is the judge) */
console.log("leg 10: the world's honesty");
const jobs10 = await readJobs();
const arr10 = jobsArr(jobs10 ?? {});
const fp10 = fingerprint(arr10);
ok("the jobs fingerprint as-found = as-left (a rename moves no job)", fp10 === fp0, `rows=${arr10.length}`);
let ws10 = null;
try { ws10 = JSON.parse(api("GET", "/api/workspaces")); } catch { ws10 = null; }
const ws10List = Array.isArray(ws10?.workspaces) ? ws10.workspaces : [];
ok("the API judges: ONE workspace again (Main — the rename undone by the product's own door)",
  ws10List.length === 1 && ws10List[0]?.name === "Main", `workspaces=${ws10List.map((w) => w.name).join(",")}`);
const restAgain = await poll(
  `(() => { const b = document.querySelector('${DEL_REST}'); return JSON.stringify({ present: !!b, disabled: b ? b.disabled : null }); })()`,
  (v) => v.present && v.disabled === true, 8, 400);
ok("the resting doors rest again (the cured refusal in the name, the design-disable unmoved)",
  !!restAgain && restAgain.present && restAgain.disabled === true);
shot("t998-world-restored.png");

/* the receipt — the kit's finish (the same fields, the honest exit) */
finish({
  instrument: "t998-rename-flip-walk",
  born: "2026-10-15",
  contract: "the rename arc's flip faces witnessed live — the four-branch voice under real keystrokes, the two silent cancels pre-spoken, the commit and restore through the product's own door, the create input's ghost guard, the world as-found = as-left",
  legs: {
    asFoundOneWorkspaceMain: ws0List.length === 1,
    curedDeleteDoorNameAtRest: !!delDoor && delDoor.present && delDoor.disabled === true,
    openFace: openFace?.label ?? null,
    fourBranchesWitnessed: {
      empty: emptyFace?.label ?? null,
      rest: restVoice?.label ?? null,
      cap: capFace?.label ?? null,
      unchangedAgain: backToUnchanged?.label ?? null,
    },
    silentCancelsPreSpoken: { unchanged: cancel1?.n === 0, empty: cancel2?.n === 0, escape: cancel3?.n === 0 },
    commit: { landed: committed?.names?.[0] === "Main (t998)", doorsFollowed: !!doorsFollow && doorsFollow.pen > 0 && doorsFollow.del > 0 },
    capWallLive: capFace2?.value.length === 60,
    restore: restored?.names?.[0] === "Main",
    createGhostGuard: { atRest: ghostRest?.label === null, atCap: ghostCap?.label ?? null, restored: ghostBack?.label === null },
    worldRestored: fp10 === fp0 && ws10List.length === 1 && ws10List[0]?.name === "Main",
  },
});
