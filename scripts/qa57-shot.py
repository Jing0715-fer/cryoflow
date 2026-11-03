import json, subprocess, time
AB = "agent-browser"
sh = lambda c: subprocess.run(c, shell=True, capture_output=True, text=True, timeout=120).stdout.strip()
ev = lambda e: sh(f"{AB} eval --stdin <<'QAEOF'\n{e}\nQAEOF")

snap = {"id": "x", "name": "view X", "ts": int(time.time() * 1000),
        "snapshot": {"mode": "camera", "fov": 0.876, "position": [1, 2, 3], "up": [0, 1, 0],
                     "target": [0, 0, 0], "radius": 5, "radiusMax": 10, "fog": 0, "clipFar": 0,
                     "minNear": 0, "minFar": 0},
        "view": {"sigma": 3, "sign": 1, "slice": {"on": True, "axis": "Z", "pos": 0.5},
                 "clip": {"on": False, "x": 1, "y": 1, "z": 1, "invert": False}}}
arr = [dict(snap, id=f"p{i}", name=f"qa57 header demo {i+1}") for i in range(3)]

# seed host = 6 saved views (room 2), wipe local lists, open viewer
bm = [dict(snap, id=f"h{i}", name=f"qa57 pre {i+1}") for i in range(6)]
put = 'curl -s -X PUT "http://localhost:3000/api/jobs/cmts0qoho0003p8da75rvxycc/camera-bookmarks" -H "Content-Type: application/json" -d ' + sh("printf %q " + '"')  # placeholder replaced below
payload = json.dumps({"bookmarks": bm})
import os
os.system(f'curl -s -X PUT "http://localhost:3000/api/jobs/cmts0qoho0003p8da75rvxycc/camera-bookmarks" -H "Content-Type: application/json" -d \'{payload}\' > /dev/null')

sh(f"{AB} open http://localhost:3000"); time.sleep(6)
ev("(()=>{const n=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('cryoflow.mol-camera-bookmarks'))n.push(k);}n.forEach(k=>localStorage.removeItem(k));return 'wiped';})()")
sh(f"{AB} open http://localhost:3000"); time.sleep(6)

for i in range(10):
    r = ev("(()=>{const el=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Enlarge Half-map 1 (iter 1)');if(el){const b=el.getBoundingClientRect();return JSON.stringify({x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)});}return 'null';})()")
    if r and "x" in r and r != '"null"':
        c = json.loads(r.strip('"'))
        sh(f"{AB} mouse move {c['x']} {c['y']}"); sh(f"{AB} mouse down"); sh(f"{AB} mouse up")
        break
    time.sleep(2)
time.sleep(2)
ev("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('View in 3D'));if(b)b.click();return 'ok';})()")
for i in range(60):
    time.sleep(2)
    pr = ev("({m:typeof window.__molstar,s:!!document.querySelector('[role=slider]')})").replace("\\", "").replace('"', "")
    if "object" in pr and "true" in pr:
        break
print("viewer ready")

payload_f = json.dumps(json.dumps(arr))
for attempt in range(4):
    ev(f"(()=>{{const input=document.querySelector('input[type=file][multiple]');if(!input)return 'NO-INPUT';const dt=new DataTransfer();const file=new File([{payload_f}],'qa57-demo.json',{{type:'application/json'}});dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{{bubbles:true}}));return 'dropped';}})()")
    for i in range(6):
        time.sleep(1)
        dlg = ev("(()=>{const c=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Import views'));return c?'dialog':'none';})()")
        if "dialog" in dlg:
            break
    if "dialog" in dlg:
        break
    # viewer may have closed — reopen it
    ev("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('View in 3D'));if(b)b.click();return 'ok';})()")
    time.sleep(6)
print("dialog:", dlg)
time.sleep(1)
sh(f"{AB} screenshot agent-ctx/qa57-import-headers.png")
print("shot1 done")
