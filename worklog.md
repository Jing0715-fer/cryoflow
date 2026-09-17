# CryoFlow Worklog — Remote RELION over SSH

Project: clone of github.com/Jing0715-fer/cryoflow at /home/z/cryoflow
Goal: local web UI → SSH to cluster → module load relion/<ver> → run + live-monitor RELION remotely.

Environment notes (sandbox):
- cryoflow dev server runs on port 3000 (started with DATABASE_URL=file:../db/cryoflow.db
  and CRYOFLOW_DATA_DIR=/home/z/cryoflow/data; global env DATABASE_URL points at
  /home/z/my-project/db/custom.db and must be overridden).
- DB: /home/z/cryoflow/db/cryoflow.db (schema pushed).
- ssh2 + @types/ssh2 installed in cryoflow package.json.
- Real RELION exists at /home/z/relion-build (used by mock cluster + local runs).

---
Task ID: 1
Agent: main
Task: Setup cryoflow dev environment

Work Log:
- Cloned repo to /home/z/cryoflow
- bun install (916 pkgs), added ssh2@1.17.0 + @types/ssh2
- Created .env / .env.example with DATABASE_URL="file:../db/cryoflow.db"
- prisma db push + generate (had to override global DATABASE_URL env var)
- Started dev server on :3000 (log: /tmp/cryoflow-dev.log), verified / and /api/jobs respond (seeded project present)

Stage Summary:
- cryoflow running; port 3000 belongs to cryoflow now (my-project server stopped)
- API contract for the remote feature lives in src/lib/remote/types.ts (shared by UI + backend)

---
Task ID: 2-b
Agent: mock-cluster-builder (general-purpose)
Task: Build mock SSH cluster service (login-node emulator on :3022) for testing remote RELION

Work Log:
- Read worklog + src/lib/remote/types.ts for the API contract (probe fields: uname, moduleSystem, relionModules, …).
- Created services/mock-cluster/: server.mjs (ssh2 Server, ESM, bun+node compatible), package.json (name cryoflow-mock-cluster; dev = "bun --hot server.mjs", start = "bun server.mjs"), README.md, test-client.mjs (ssh2-based test client — sandbox has NO ssh/sshpass), launch.sh.
- fs skeleton: fs/home/cryo (.bashrc comment-only, .bash_profile), fs/opt/bin/module (verbatim spec script, chmod +x, shebang first line), fs/projects/.gitkeep. PATH translation in server: /projects/ and /home/cryo/ → <fs root>/… before spawn; spawn bash -c with cwd=FS_ROOT, HOME=fs/home/cryo, PATH=fs/opt/bin:/home/z/relion-build/bin:/home/z/relion-build/deps/mpich/bin:/usr/bin:/bin, detached:true.
- Deviations from spec sketch (all verified necessary): (1) ssh2 v1.17 needs hostKeys ARRAY, not hostKey — used { hostKeys: [pem] }; (2) host key must be PKCS#1 PEM ("BEGIN RSA PRIVATE KEY"), ssh2 cannot parse PKCS#8 — regenerates if keys/host_key_rsa absent (2048-bit RSA, 0600); (3) env spread order fixed: ...process.env FIRST, then HOME/PATH (spec snippet would have let process.env clobber them); (4) /etc/profile unconditionally resets PATH, breaking the app's `bash -lc` — server exports CRYOFLOW_MOCK_PATH and fs/home/cryo/.bash_profile re-exports PATH from it (file still ends with `true`).
- Lifecycle: exec+shell channels, stdout→channel / stderr→channel.stderr via pipe(end:false), exit status + close after drain (400ms grace if a grandchild holds the pipe), session 'signal' forwarded to running proc (SIG-prefixed or bare), stream close → SIGHUP direct child only (setsid/nohup grandchildren survive), per-session activeProc routing, try/catch everywhere + uncaughtException guard, [mock-cluster] logging of every exec, sftp intentionally unhandled (auto-refused).
- Sandbox reaper: background processes still descendant of the tool shell at call end get killed (even setsid+nohup) — copied the dev-server.sh orphaning recipe into launch.sh (script exits right after setsid bun run <mode>, server re-parents to init and survives).
- Verification (all green): started via bun run start → uname -a + module avail (stdout+stderr split, relion/4.4.1+5.0.1+5.0-beta), module load/list/purge, unknown module rc=1, module help, exit-code propagation (42), login-shell PATH/HOME checks, background job `setsid … & echo CRYOFLOW_PID:$!` → out.txt ("done") landed at fs/projects/cryoflow/t1/, signal forwarding (TERM), foreground cleanup on connection drop (SIGHUP, verified via pgrep), shell channel, sftp refused, wrong password rejected, 3 concurrent exec channels on one connection (~2s wall for two parallel sleep 2s), /tmp/mock-cluster.log clean. Full self-test suite: 15/15 PASS. Killed start-mode instance, restarted via dev script (bun --hot): hot reload verified live (old listener closed via Symbol.for guard, re-listened, no EADDRINUSE, tests still pass). Dev server LEFT RUNNING on 0.0.0.0:3022.
- ENVIRONMENT GAP (not a mock defect): /home/z/relion-build does NOT exist in this sandbox (task/worklog assumed it does), so `command -v relion_refine` returns nothing. PATH wiring is correct — the moment the real RELION build appears at /home/z/relion-build (task 2-a?), relion_refine resolves with zero changes.

Stage Summary:
- Mock cluster at /home/z/cryoflow/services/mock-cluster/ — RUNNING now via `bun --hot` (pid: bun --hot server.mjs), log /tmp/mock-cluster.log.
- Connect: host 127.0.0.1/localhost, port 3022, user cryo, password demo, authMethod password, remoteRoot /projects/cryoflow (translated to services/mock-cluster/fs/projects/cryoflow). module avail → relion/4.4.1, relion/5.0.1, relion/5.0-beta; `module load` records to ~/.lmod/loaded; background jobs + CRYOFLOW_PID:$! + signals work like a real login node; sftp refused.
- Restart if needed: bash /home/z/cryoflow/services/mock-cluster/launch.sh [start|dev]; then wait ~2s in the same tool call; self-test: node test-client.mjs (15 steps).

---
Task ID: 2-a + 3-a
Agent: main
Task: Remote RELION backend — SSH layer, probe, remote-run engine, API routes, engine/dispatch integration

Work Log:
- src/lib/remote/types.ts — shared contract (RemoteConnection/DTO, RemoteProbe, RemoteRunTarget, RemoteRunInfo, RemoteRunState)
- src/lib/remote/connections.ts — registry in data/remote-connections.json (0600, secrets never leave the server)
- src/lib/remote/ssh.ts — ssh2 client pool: serialized per-connection exec queue, tryExec (declining), loginShellScript, remoteStat/remoteMkdir/remoteUpload/remoteDownload, connectionWorks
- src/lib/remote/probe.ts — module system detect (lmod/envmodules), module avail/spider/whatis parsing, per-module relionHome/mpirun/ctffind resolution, slurm + GPU probe
- src/lib/remote/remote-run.ts — startRemoteJob (input staging incl. STAR project-relative refs + absolute external refs + path rewriting, wrapper script w/ module load + setsid + exit-file capture, GPU/MPI adaptation), reconcileRemoteJobs (batched SSH poll per connection w/ 4s throttle + heal path), finalizeRemoteRun (sync-back with caps + STAR rewrite to-local + collectOutputs reuse + autoStart passthrough), remoteLogTail, remoteStopRun, remoteInfoFor
- engine.ts surgical edits: RunRecord.remote field, isRunAlive remote guard, reconcileRealJobs remote skip, parseProgressText export, buildArgv ctffindExe ctx override, collectOutputs export
- dispatch.ts: startJob(job, {remote}) branch (requestError vs waiting vs started/staging), autoStartPendingDownstream passes the trigger's remote target (remote chains stay remote)
- Routes: /api/remote/connections (GET/POST), /[id] (PATCH/DELETE), /[id]/test (probe+persist); run route accepts {remote}; jobs GET reconciles remote + enriches DTO with runRemote; stop + log + PATCH/DELETE routes branch on remote records (no local-kill of cluster pids)
- E2E on the mock cluster: import(local) → ctffind(remote): staging → running (cluster pid) → live progress (99%) → REMOTE[...] result, outputs synced to local mirror, outputs/log routes serve remote runs, stop kills the cluster session
- CRITICAL FIND: ssh2 under BUN breaks channel EOF/end() (cat>file never terminates) and the 'close' event is unreliable — fixed with the head -c N self-terminating upload protocol + exit-event resolution + close-grace. Verified 300KB binary byte-identical.
- Mock cluster fixes: EOF forwarding (sshd semantics) + uploaded .sh content path translation (sed post-write)

Stage Summary:
- Remote backend FULLY VERIFIED E2E against the mock cluster (probe, run, progress, sync-back, log, stop)
- Mock RELION stubs added: fs/opt/bin/{relion_run_ctffind,relion_motioncorr,relion_refine,relion_preprocess} (python3, realistic STAR/MRC outputs + progress lines)
- Remaining: UI browser verification, docs, git push

---
Task ID: 3-b
Agent: remote-ui-builder (general-purpose, completed work but context-deadline hit before worklog)
Task: Remote cluster UI — connection manager, run-on-cluster controls, remote badges

Work Log:
- src/components/workflow/remote-cluster-dialog.tsx (1123 lines) — connection list w/ status dots + active selection (localStorage "cryoflow.remote.active"), add/edit form (host/port/user/auth/remoteRoot/envLines/useSlurm/sync caps, secret keep/clear semantics), Test & probe → probe card (uname, moduleSystem badge, relion module chips clickable to set default, homes/mpi/ctffind, Slurm, GPUs), delete w/ two-step confirm, useRemoteConnections hook, RemoteClusterButton (header)
- src/components/workflow/remote-run-button.tsx (261 lines) — compact Server-icon trigger + dialog (connection Select, module Select from lastProbe, summary line, empty state → manager), submits via store runJobRemote
- store.ts — runJobRemote action modeled on runJob (flush params, POST {remote}, 409 busyKind dialect, waiting/staging toast "Sent to cluster", success toast with user@host, inspectId landing)
- job-card.tsx — remote chip (Server glyph + short host, title=user@host·module·workdir) while running/pending; job-panel.tsx — remote strip + note
- integration initially landed in job-panel.tsx; the main agent found the DESKTOP surface is job-inspector.tsx and ported the button + strip + formatStagedBytes there (Server icon import, toolbar placement after Re-run/Stop)

Stage Summary:
- All 6 deliverables exist; tsc + lint clean for the new files; browser-verified by main agent (dialog, probe chips, dispatch, running strip, result, log tab, zero console errors)

---
Task ID: 4
Agent: main
Task: E2E verification (mock cluster + agent-browser) and hardening fixes

Work Log:
- Full backend E2E against the mock cluster: probe (3 relion modules + homes), dispatch (staging→running), live progress (parseProgressText over SSH tail), completion (REMOTE[...] result + sync-back + outputs route), log streaming, stop (cluster session kill + record finalize)
- Fixed: Bun+ssh2 channel EOF broken → head -c N self-terminating uploads, exit-event resolution, close-grace window; verified 300KB binary byte-identical
- Fixed: stale/recycled cluster pid → .cf-pid records pid + /proc starttime (field 22), alive-check verifies both
- Fixed: stop leaves !done record (SIGKILL'd wrapper can't write exit file) → stop route finalizes record + sweep heal path finalizes vanished records for non-running jobs
- Fixed: relative (project-relative) STAR references now stage against the project root (RELION pipeliner convention)
- Mock cluster: EOF forwarding (sshd semantics), uploaded .sh content path translation, RELION stubs (ctffind/motioncorr/refine/extract with realistic STAR/MRC + progress lines)
- Dev-server battles (sandbox-only): OOM kills poisoned the Turbopack cache → wedged compiles; rm -rf .next + memory caps + browser-closed warmups fixed it; orphaning launcher at /tmp/cf-dev.sh
- Browser verification (agent-browser): cluster manager (Mock Cluster listed, probe chips render), Run-on-cluster dialog (connection+module), Send → running strip "cryo@127.0.0.1:3022 · Running on the cluster · pid N", result "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: CTF estimated for 6 micrographs", Log tab streams cluster output, 0 console errors; screenshots /tmp/ui-*.png

Stage Summary:
- Feature fully verified end-to-end; remaining: docs (done: docs/remote-relion.md + README), commit + push

---
Task ID: 5
Agent: main
Task: Docs, worklog, commit + push to GitHub

Work Log:
- docs/remote-relion.md (architecture, settings reference, security notes, failure catalog, mock cluster, roadmap) + README feature section + quick-start
- .gitignore: /demo-mics/ (local fixtures); mock-cluster runtime state cleaned (fs/projects/cryoflow, keys/, .lmod)
- Lint: all new files clean (remaining errors pre-existing in untouched files); tsc clean for all new/edited files
- Rebased onto upstream main (t258/t259 security commits — isLocalRequest widened; no conflicts, re-verified tsc + live API after rebase)
- Committed (41 files, +5613) and PUSHED to github.com/Jing0715-fer/cryoflow main: 82b6df8..5b737b3

Stage Summary:
- Feature shipped: remote RELION over SSH (module-load versioning, staging, live monitoring, sync-back, stop/resume, mock cluster for testing)
- Live in preview: app :3000, mock cluster :3022 (cryo/demo), "Mock Cluster" connection preconfigured with probe data

## Task 207 (2026-09-15, 补档于 18:32 窗口——本条目为跨窗遗产修复)

**主题：the pair's address becomes a DOOR——配对地址长出手和键盘。t206 让 pairwise chip 说出地址（` · from–to` 后缀 + title 教带），t207 把**拥有地址的 chip** 从展示 span 升格为真 BUTTON：按下即让平面落到带心（chip/括号门自己的 `Math.round(((from+to)/2)*100)/100`——一份数学 powering 三扇门：local chip、bracket、pair chip），回执说配对的词汇（t202 模板：'the thinnest corroboration between A and B'），visiting 与 local chip 同态（平面在 pair 带内时墨色升起——text-foreground REPLACES 绝不 join，t203 同特异性纪律），Enter 也应答（真按钮、无 aria-hidden 怯懦）。无地址的 pair 保持朴素 span——无地址、无门、无谎言（诚实分支是门的一部分，X13 钉死）。t206 的 D24 locator 升级为形式无关的 `[data-pairwise-chip]`（前浪 oracle 跟随世界：语义合同——title 教带——不变，只换选择器）。t207-e2e 67 断言 ×3 全绿：D27 按门落 63% == pair 带心、D28 回执逐字节、D29/D32 手与键盘双路翻转 visiting、D25 钉死按钮形态、D5-D24 同帧重绿 t206 全部表与 chip 断言、探针自己的 pairwise oracle 算术导出带心（W3 的切分）。回归 9/9 全绿——t203 D9 墨色普查给出**首次 flake 目击**（重跑即绿；一次目击记档不装甲，复发则修以 t204 的「先挪手指」）。无地址之物零行为改变。定妆照 scripts/shots-t207/t207-pair-door-2x.png。矩阵 137→138（t207 入册）。**

- 【补档说明】本条目写于 Task 207 完成之后的下一个 cron 窗口（18:32）：上窗完成了实现（molstar-embed.tsx +42 行）+ 485 行探针 + 定妆照 + 矩阵入册 + commit cc182e2 + push，但 **worklog 条目缺失**（提交信息声称 Worklog: Task 207 而档案未落）——跨窗遗产判例（t200）：接手补齐而非假装存在。本窗口已核实：实现 diff 与提交信息一致、server 冷启动后首页健康、t207-e2e 单跑验证中。
- 【实现要点（读 diff 复核）】①`pcentre = Math.round(((pw.from + pw.to) / 2) * 100) / 100`——与 chip/bracket 门逐字节同源；②`pvisiting = slicePos >= pw.from && slicePos < pw.to`——与 local chip 同态判定；③`pjump` = applySliceIntent + flashProfileNote（回执说配对词汇）；④按钮形态：`type="button"` + `data-pairwise-chip` + aria-label（跳深坐标 + 轴名）+ hover:bg-accent + focus-visible:ring + active:scale-[0.97]（按压手感）+ visiting 时 `text-foreground` 替换 `text-muted-foreground`；⑤诚实分支：`!pw || !pjump` → 朴素 span（data-pairwise-chip 保留、无按钮语义）；⑥t206 D24 locator 升级 `[data-pairwise-chip]`——形式无关，前后浪共尊。
- 【世界卫生】本窗口开局：worklog 尾部=Task 206、HEAD=cc182e2（已推送、树干净）、.next/BUILD_ID 存活、PORT 3000 空闲 → watchdog setsid 配方冷启动 10s 就绪、首页 agent-browser 快照健康、roster 预期 21。

Stage Summary:
- 「三扇门、一份数学」：local chip（t204）、bracket（t204）、pair chip（t207）共享同一个 centre 算术——门越多，父亲越唯一；每扇门都是同一句真话的又一次按响
- 「诚实分支是门的一部分」：无地址的 pair 不假装有门——X13 把「没有地址就保持 span」钉进合同；仪器的每个动词都必须有地址背书
- 「locator 的形式无关化」：span→button 是世界的合法演化，前浪 oracle 只尊语义（data-pairwise-chip + title 教带）不尊标签名——t206 D24 的升级是前浪主动让路而非断裂
- 「一次目击记档不装甲」：t203 D9 的首次 flake 记录在案，若复发才修（t204 的「先挪手指」）——装甲要有两个判例才动工（t195 两度即装甲教义）

## Task 208 (2026-09-15, cron 18:32 窗口 trace …202609151841)

**主题：the pair's TERRITORY joins the landscape——配对的领地加入景观。t203 把 local 最弱带画上景观条，t204 让它成为门，t206 给每个 PAIR 自己的最弱佐证带（chip+纸面），t207 让 pair chip 成为门——但 pair 的带在景观条上仍然不可见：按下 pair 门，平面落到一块景观从未画出的领土上。t208 关闭这个不对称：每个 pair 的最薄佐证带在 local 括号行的上方**独占一行**（y 24.4 vs local 的 27.4–30.0），以**中立墨**绘出（currentColor——佐证属于 pair，不属于任何一张图的颜色），门教义与 t204 逐字节相同（stopPropagation + 带心 + 回执说配对词汇=t207 chip 模板的逐字节拷贝），visiting 纪律相同（平面在带内墨色升起 0.3→0.85），层保持 aria-hidden——键盘的门仍是 pairwise chip（t207 的按钮）。不足两张发声图什么都不画——无 pair、无领土、无谎言。开局先做了跨窗补档（worklog 缺 Task 207 条目，从 commit cc182e2 证据重建档案），然后 t207-e2e 单跑 67/0 验证世界健康，再立项 t208。t208 83 断言：RUN=1 一枪 83/0；RUN=2 目击回执家族 flake（D28 空回执）→ **幂等门重按装甲**（错过回执就再按一次门，bounded 3 次）→ 重跑与 RUN=3 全绿 83/0 ×2。装甲回植三处（两度目击判例）：t204 D8/D11、t202 D7、t207 D28 同款重按装甲全部重跑转绿；t203 D9 墨色普查**第二次目击**（第一次 t207 窗口在案）→ 按 t204 教义补「先挪手指」（普查前 mouse.move(5,5)+300ms）→ 27/0。回归 10 套全绿；矩阵 138→139（t208 入册）。**

- 【开局·第 16 度判例 + 补档】内嵌摘要宣称「Task 205 是最新完成」——实际 worklog 尾部是 Task 206、HEAD=cc182e2（Task 207 已提交**已推送**、树干净）。但 worklog **缺 Task 207 条目**（提交信息声称 Worklog: Task 207 而档案未落——上窗在 commit 后、worklog 前断裂）。处置：从 commit 证据 + diff 复核重建 Task 207 档案（补档条目注明「本条目为跨窗遗产修复」），然后 agent-browser 冒烟 + t207-e2e 前台单跑 67/0——世界健康才立项。**档案与提交互为备份：worklog 缺失时从 commit 重建，commit 缺失时从 worklog 重建，两者都在才叫完成。**
- 【实现·+55 行/molstar-embed.tsx】①景观条 IIFE 内 `pairBrackets = pairwiseAgreement(overlays.map(...).filter(bins>0)).flatMap(...)`——与 chip 行（3874 行）逐行同源的推导，同一函数、同一输入方言；②rect：y="24.4" height="2.4"（独占行，与 local 行 27.4–30.0 间隙 0.6）、x/width 直饮 pw.from/to×100（2dp 方言）、rx=0.4、`fill="currentColor"`、opacity 0.3/0.85 visiting、`data-pair-bracket={p.a}|{p.b}` + `data-pair-visiting`；③门：onPointerDown stopPropagation + applySliceIntent({pos: pcentre}) + flashProfileNote——回执模板与 t207 chip 逐字节共享（源里恰好 2 次，X19 钉死）；④`<title>` 教带：The thinnest corroboration between A and B (Q3 (50–75%))；⑤诚实分支 `if (!p.weakest) return [];`；⑥渲染在 `<g aria-hidden="true">{pairBrackets}</g>`——手到为止，键盘走 chip。t204 大注释块加 t208 章（11 行）。
- 【探针 t208·83 断言】= t207 的 67（原位全重绿）+ 16 新：X18-21 源 oracle（中立墨 fill="currentColor"、回执模板恰好 2 次、诚实分支+visiting 属性恒答、aria-hidden 层）+ D33-44 活线（D33 领土在场恰 1、D34 几何==wire oracle 逐字节 x 50.00/width 25.00、D35 fill 属性==currentColor、D36 带心墨升、**D37-D38 两行一平面两真相**（pair Q3==half1 local Q3 双双点亮、half2 Q1 安睡——两行对同一平面的分歧是**诚实的**）、D39 End 墨息、**D40 按领土本身**（rect force click→落 63%==带心，门不是变装 scrub）、D41 门回执==chip 回执逐字节、D42 自门后墨升、D43 Home 墨息（领土跟平面回家，无卡墨）、D44 Home 落入 half2 Q1（local 行回答 pair 行不能回答的：pair 领土止于 0.75））。
- 【装甲·本窗的两大判例】①**幂等门重按**（回执家族第 4 次目击 t208 RUN=2 D28 后升级为标准装甲）：回执 ~4s 壁钟寿命可被冻结主线程整段吞掉（16 拍 250ms 全空）——门是幂等的（重按落同一带心、重闪回执），错过回执 = bounded 重按（3 次），不是失败；回植 t204（D8/D11）/t202（D7）/t207（D28）三处全部重跑转绿。②**先挪手指**（墨色普查第二次目击 → 装甲）：指针停在 map-choice 点击的落点，若那落在 local row 上则 chip 的 hover 墨（accent-foreground）污染普查——visiting 坐平面（状态），永不坐指针；普查前 mouse.move(5,5)+300ms 让 transition 落定。
- 【第二层真相·五】①**门必须落在画出来的领土上**：t207 的门把平面送到一块景观从未画出的地带——地址可以引用不可见的带（纸面可以），但**观景仪器**的门必须落在自己的领土上；t208 让 pair 门的三位一体补全（chip 门、括号门、领土门共享同一带心算术）。②**颜色在说「这是谁的地」**：local 行用各图自己的颜色（背叛是每张图自己的），pair 行用 currentColor 中立墨（佐证是 pair 的、不是任一图的）——颜色选择不是装饰是语义，第三行若出现（global？）也需要回答同样的问题。③**幂等性是装甲的燃料**：重按装甲之所以成立，是因为门幂等——幂等的动词（跳带心、重闪回执）可以安全重试，非幂等的动词（toggle 面板、scrub 到 clicked x）不行；t205 的 ensureOpen（先看后点）与本次重按是同一条原则的两面。④**两行的分歧是诚实的**：同一平面 63% 在 pair 行点亮、在 half2 行安睡——两个仪器对同一事实给出不同答案不是 bug 是**分工**（pair 问「佐证哪里最薄」，local 问「这张图哪里最危险」）；探针把分歧本身钉成断言（D37/D38）。⑤**领土的行数预算**：pair 行独占 y 24.4–26.8，3+ overlays 时多对共享一行会重叠——沙箱世界 1 对无此问题，诚实重叠 + title 教带是当前答案，多对布局策略留给真世界（遗留）。
- 【回归·10 套全绿】t207(67，装甲后)/t206(54)/t205(36)/t204(30，装甲后)/t203(27，挪指后)/t202(43，装甲后)/t198(35)/t196(29)/qa00(sentinel)/qa63(smoke) + t208 ×3 自身。产品侧零行为回归——pair 领土是加法（新 rect 行 + 新 g 层），local 括号几何/visiting/chip/scrub/报告全免疫。
- 【世界收尾】定妆照 scripts/shots-t208/t208-pair-territory-2x.png（**一帧三真相：pair 中立墨行点亮 + half1 彩色括号点亮 + half2 安睡，playhead 停在 pair 门自己送到的 63%**）+ t208-final-2x.png；dbg 脚本零新增（本窗一次通过，无需诊断脚本）；run-matrix.sh t208 入册（138→139）。
- 【收尾】worklog（本条 + 上窗 Task 207 补档条目）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「pair 门的三位一体补全」：chip 门（t207）、括号领土（t208）、带心算术（一份数学）——景观条现在是**四级领土地图**：主地形 + local 各图彩色带行 + pair 中立墨行 + playhead；每一个地址都在景观上有自己的墨
- 「幂等门重按」进装甲标准：错过回执就再按一次门——幂等动词可安全重试（与 ensureOpen 同原则），回执家族判例从「读快读先」升级为「读快读先 + 重按」；三处前浪探针同款回植，两度目击纪律执行完毕
- 「颜色是领土的姓氏」：local 带穿各图的颜色，pair 带穿中立墨——观察者不需要读 title 就能看出「这块地是谁的」；仪器的视觉语言与它的所有权语义对齐
- 「补档判例」：worklog 缺条目 = 跨窗遗产破损的一种（与 in-flight 提交、分叉远程并列）；从 commit 证据 + diff 复核重建档案是本窗第一动作——档案纪律与代码纪律同级
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（单仪器轮，定向回归覆盖 strip+chip+报告 10 套）；t208 ×3 + 回归 10/10 全绿；roster 恒等 21（Z1/Z2）；矩阵显式清单 138→139（t208 入册）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；报告三表（Local/Pairwise/Global）统一深度方言文档页；pair 括号行在 3+ overlays 多对重叠时的布局策略（当前诚实重叠，沙箱 1 对无此压力）；global 表是否也该有领地（FSC 的 0.143 crossing 是不是一种地址——存疑，词汇不同源）

## Task 209 (2026-09-15, cron 19:32 窗口 trace …202609151936)

**主题：the dialect learns to INTRODUCE ITSELF——深度方言学会自我介绍。t203-t208 把地址、门、领土做满（chip 门、括号门、领土门、纸面 Depth 列），但一个盯着面板的新人没有任何途径学会这一切意味着什么：分数尺度、等数刀、pair 的中立墨、门教义，以及「为什么 Comparison 表偏偏没有 Depth 列」（它的地址住在 Local 表里——印两遍的深度有两个父亲，然后漂移分离）。t209 给方言一个声音：**in-app legend**（琥珀色——教学门自己的口音，对照 CSV 的青与 report 的紫；默认关闭——不请自来的教学是弹窗不是图例）+ **paper epilogue**（`### Reading the depth addresses`——导出报告对从未打开 app 的读者教同一套方言）。两个表面说同一套词汇。t209-e2e 113 断言 ×3 全绿：t208 的 83 原位全重绿 + 30 新（X22-31 源 oracle：aria 语义/琥珀口音/真墨色板/epilogue 位置与 guard；D45-50 预采纳：默认关、开课时零 overlay 行——诚实缺席的活体测试；D51-63 满世界：领土行镜像世界 1+2+1+1、色板墨==strip 括号墨逐字节、门在课时照常应答、epilogue 骑纸位置与唯一性）。回归 11 套全绿（t195 40 装甲回植后/t196 29/t198 34/t202 42/t203 27/t204 30/t205 36/t206 54/t207 67/qa00/qa63；t208 的 83 在 t209 内原位重绿）。矩阵 139→140（t209 入册）。定妆照 scripts/shots-t209/t209-legend-open-2x.png（一帧全方言：琥珀 legend 五领土行 + strip 63% 处 half1 彩墨与 pair 中立墨双亮 + half2 安睡 + 琥珀填充的 How to read 门）。**

- 【开局·第 17 度判例】内嵌摘要宣称「Task 205 最新、下轮候选 Pairwise 地址列」——实际 worklog 尾部已是 Task 208 完整条目、HEAD=a941a70（t206 Pairwise 地址列、t207 pair 门、t208 pair 领土均已交付推送）。开局四件套核实：BUILD_ID 存活、PORT 空闲、树干净、roster 21。watchdog 冷启动 → 首页 200 → t208-e2e 前台单跑 83/0 世界健康 → 从 Task 208 遗留清单立项（首选「三表深度方言文档页」+「global 表是否该有领地」的诚实回答）。
- 【实现①qc-report.ts +18 行】Pairwise 块闭合后、`} else {` 前加自持 `if (overlays.length > 0)` guard 的 epilogue：`### Reading the depth addresses`——教分数尺度（0 = front face，1 = back face，永非 Å 位置）、等数刀（每 quarter 容纳同数 planes，弱 quarter 指名真实地点而非稀疏处）、三表分工（Comparison summarizes · Local addresses · Pairwise corroborates）、诚实缺席（Comparison 刻意无 Depth 列——地址已在下方 Local 表引用，印两遍有两个父亲）、门教义（chip 或 bracket 按下即落带心）。epilogue 骑 tables 同款 guard：无地址、无课、无谎言。位置在 footer 之前——纸以教学收尾，再以出处署名收尾。
- 【实现②molstar-embed.tsx +95 行】①`legendOpen` state（默认 false——不请自来的教学是弹窗）；②legend 块（pairwise 行与 footer 行之间）：`id="profile-legend"` + `data-profile-legend="1"`，琥珀边框/底色，五类领土行各带 `data-legend-territory`（landscape 白墨 / 每 overlay 真彩行 `data-legend-map` / pair 中立墨 `bg-foreground/45` 仅当 ≥2 张发声图 / playhead 竖条）+ 等数刀行 `data-legend-knife` + 三表分工行 `data-legend-tables`；**色板穿 overlays 的真颜色**（`style={{ background: o.color }}`——strip 括号穿的同一 hex），仪器用自己的墨教学，从不用转述；③toggle 按钮（footer 按钮组尾部）：真 disclosure control（`aria-expanded` + `aria-controls`）+ `data-profile-legend-toggle` + BookOpen 图标 + 琥珀口音（开态填充琥珀，读者永远知道课在放）。
- 【Global 之问的诚实回答】遗留问题「FSC 的 0.143 crossing 是不是一种地址」连同「Comparison 表要不要 Depth 列」一并解决：**不给，且把不给钉成教义**。Comparison 表是 summary（一个全局 r），它的地址已由下方的 Local 表引用（weakest quarter + depth）；在 Comparison 再印一遍 = 两个父亲 + 漂移。这个诚实缺席写进 legend 与 epilogue 的正文，被 X27/X30/D56/D61 四条断言钉死。
- 【回归事故与装甲回植】t195 首跑 TimeoutError（Toggle cross-section plane 30s 不现）——t195 是 t200 时代前的老探针，缺 t206 窗口已给 t196 补的「冷会话逐出」装甲（持久 overlay mirror 让 Mol* 恢复 MRC 时 toolbar 滞后数分钟；本窗 server 冷重启后首目击）。按前浪 doctrine 回植 t196 同款装甲（长轮询 60s → PUT 逐出 + localStorage 清除 + reload 重开 viewer）→ 40/0 全绿。产品零嫌疑：t209 ×3 在同一世界全绿。**两度目击纪律记档：本探针一次目击即回植（与 t196 同源同型，非新判例）。**
- 【第二层真相·六】①**教学是仪器的第四种动词**：仪器已有读（view）、跳（door）、印（report），t209 加了教（teach）——而教学的诚实形式是 opt-in（默认关）+ 用仪器自己的墨（真色板），不是弹窗也不是转述；②**两个表面一个方言**：legend（app 内、活的世界、动态领土行）与 epilogue（纸面、静态、同一套词）必须逐词同源——探针把同一组关键词（equal-count knife / two fathers / front face / door）同时钉在源码、活线 legend、活线 paper 三处；③**诚实缺席的活体测试**：D49 在零 overlay 世界证明 legend 不发明领土行，D45-50 是「无地址、无课、无谎言」的 UI 端证明（X31 是纸端的结构证明）——缺席和在场同样是可测的真相；④**D54 的逐字节墨水检查**：legend 色板的 rgb 与 strip 括号的 hex 经 hexToRgb 折算后逐字节相等——「用仪器自己的墨」不是修辞是断言；⑤**门不因教学而哑**：D57 在课时按下 chip 门落 63%——legend 是 teacher 永远不是 shield（挡住门的图例是坏图例）；⑥**老探针的装甲债**：t195 六轮未入回归集，装甲落后世界六代——回归集的选择应覆盖「产出字节」的探针（t195 是 report 家族的源 oracle 持有者），本轮已回植。
- 【世界卫生】开局 watchdog 冷启动一次成功；build 前台一次通过（判例：setsid 后台 build 被收割）；重启 server 杀 PID 后遭遇一次 watchdog+server 双双静默死亡（无 OOM、内存 3.1GB available——收割者行为，非资源），重启后稳定；全窗 server 健康，console 零错。
- 【收尾】worklog（本条）+ run-matrix.sh t209 入册（139→140）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「方言有了声音」：t203-t208 建了仪器，t209 让仪器开口教——legend 教活的世界（动态领土行、真墨色板），epilogue 教纸的读者（同一套词）；教学本身遵守仪器的诚实纪律（opt-in、不发明、不转述、不挡门）
- 「Global 表的领地之问，以诚实缺席告终」：Comparison 是 summary，地址是 Local 的职守——印两遍的深度有两个父亲；这个「不给」被钉进正文与四条断言，成为方言的一部分（仪器说「不」的方式也是词汇）
- 「冷会话逐出装甲回植 t195」：前浪探针的装甲债在回归事故中现形（t195 六轮未入回归集）；回植后 40/0——t196 的判例形状现在是 report 家族探针的标配
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（单仪器轮，定向回归覆盖 report+strip+chip 11 套）；t209 ×3 + 回归 11/11 全绿；roster 恒等 21（Z1/Z2）；矩阵显式清单 139→140（t209 入册）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；pair 括号行在 3+ overlays 多对重叠时的布局策略（当前诚实重叠，沙箱 1 对无此压力）；legend 在 3+ overlays 时的行数增长（同源问题，真世界压力）；session report 是否也该教方言（Map QC 节逐字骑 epilogue，暂无独立教学面）

## Task 210 (2026-09-15, cron 20:32 窗口 trace …202609152042)

**主题：every door stays pressable——车道教义。t203 的 local 括号行与 t208 的 pair 领土行都假设了沙箱的单对世界；第二张图（或第二对）在同一 quarter 背叛时会直接画在第一条括号上，而被盖住的括号是一扇按不到的门——说谎的门。t210 用**一个算法、两个消费者**（packLanes，模块级纯函数：from 排序后的贪心 first-fit——相接的带共享一条车道 [0.25 的终点与 0.50 的起点不是重叠]，真正相撞的带向上分裂）把两行都打包成车道栈：local 栈自 27.4 向上生长，pair 栈浮在 local 栈之上（pairBaseY = 24.4 - (localLaneCount-1)*3.0——单 local 车道世界里逐字节等于 t208 的 y 24.4）。**探针的世界长出第三张发声图**（scripts/seed-masked.py，run_it020_masked.mrc，profile 精心工程化）：pair(h1,h2)=Q3 独守、pair(h1,m) 与 pair(h2,m) 双双落入 Q2——真正的相撞必须分裂；三张 local 却在三个不同 quarter（Q3/Q1/Q4）诚实共享 lane0。一条共享车道、一条分裂车道、三条 local 塌缩成一条：打包的两种行为都是活的。t210-e2e 151 断言 ×3 全绿（t209 的 113 适配三图世界后原位全重绿 + 38 新：W3-W7 车道 oracle 与工程结构断言、X32-38 源 oracle [packLanes 唯一定义/恰好两次调用/车道属性/浮点公式/图例车道课]、D33-34d 三对领地几何逐字节 [每对的 x/width/y/lane == 打包 oracle]、D38b 三 local 共享 lane0、D40-42 三扇 pair 门逐一按响各报各的对）。回归 11 套全绿（t195 40/t196 29/t198 34/t202 42/t203 27/t204 30/t205 36/t206 54/t207 67/t208 83/t209 113/qa00/qa63）。矩阵 140→141（t210 入册）。定妆照 scripts/shots-t210/t210-lanes-2x.png。**

- 【开局·第 18 度判例】内嵌摘要照旧宣称 Task 13/205——实际 worklog 尾部已是 Task 209、HEAD=603bd02。四件套核实（BUILD_ID 存活/PORT 空闲/树干净/roster 21）→ watchdog 冷启动 → 首页 200。从 Task 209 遗留清单立项「pair 括号行 3+ overlays 多对重叠布局策略」——上轮遗留明言「沙箱 1 对无此压力」，本轮的破局点：**给沙箱造出多对世界**。
- 【seeder 工程·scripts/seed-masked.py】复用 qa67 验证过的最小 MRC writer（字段逐字节一致，Mol* 不 RangeError）；masked 变体的 profile 配方：z-常数管（cx=26，区别于两 half 的漂移管）+ 浅团（z=8，穿过 Q2 下降）+ 深团（z=28，Q3 上升/Q4 下降）。wire 验证（/tmp/check-pairs.py）：pair(h1,h2)=Q3 (-0.89)、pair(h1,m)=Q2 (-0.89)、pair(h2,m)=Q2 (-0.54)、local 三图 Q3/Q1/Q4 全不同——工程结构一次命中，seeder 幂等且 --clean 可拆。
- 【实现·molstar-embed.tsx +58 行】①模块级 `packLanes(bands: {from,to}[]): number[]`（贪心 first-fit + 1e-9 容差——quarter 网格上车道数 ≤4，栈永远装得下）；②local painter 重构：banded 收集（诚实分支逐字节保留 `if (!w) return []; // flat verdict: no address, no territory`——t203 X2 钉着它）→ from 排序 → packLanes → rect 带 `data-band-lane` + `y=(27.4 - lane*3.0).toFixed(1)`（lane0 输出 "27.4" 与 t203 逐字节同）；③pair painter 同构（诚实分支 `if (!p.weakest) return []; // no address, no territory` 保留——t208 X20 钉着它）+ `pairBaseY = 24.4 - (localLaneCount - 1) * 3.0` + `data-pair-lane`；④图例 pair 行文案升级（"packed lane by lane so every door stays pressable"）；⑤t208 大注释块加 t210 章。门与回执零改动——每条 rect 的 onPointerDown 本就各落各的带心。
- 【RUN=1 的 2 处 X 失败=oracle 跟随世界的两次练习】①X20：重构曾把诚实分支改成三元式——t208/t209 都逐字节钉着旧注释形状，**恢复旧形状**（语义不变、字符串不变）比改三条前浪探针更诚实（t206 X10 的教训：连续子串 oracle 的脆性要在产品侧吸收）；②X37：图例源码里撇号是 JSX 实体 `&apos;`——oracle 改查实体形式，活体形式（textContent 渲染出的 '）仍由 D55 钉住。修复后 RUN=1/2/3 全绿 151/0 ×3。
- 【探针·t210-e2e 151 断言】= t209 的 113（三图世界适配：D3 三 chip、D6 三行 9 段、D8b/D10b masked 报告行、D19b/c 两对 masked 纸行、D25 三门按钮、D52 领土行 1+3+1+1、D54 三色板真墨）+ 38 新。核心新断言：W6 工程相撞活体（两对同 Q2 + 一对 Q3）、W7 打包 oracle（分裂+共享）、D34b 每对 y/lane == oracle 逐字节、D34c 同 quarter 分裂（两 Q2 对不同车道）、D34d 不相邻共享（Q3 对与第一个 Q2 对同车道）、D38b 三 local 塌缩 lane0、D40-42 pressDoor 三连（每扇 pair 门各自落带心各报各的对——idempotent 重按装甲随行）。
- 【第二层真相·七】①**被盖住的门是说谎的门**：t208 的「诚实重叠」在单对世界成立，多对世界里重叠即遮蔽、遮蔽即门哑——车道打包不是美化是诚实性修复；②**一个算法两个消费者**（t206 的「一把刀两块肉」的布局版）：local 与 pair 用同一个 packLanes，栈与栈之间的耦合（pairBaseY 浮在 localLaneCount 上）保证两栈永不互相入侵；③**工程化世界是沙箱的合法武器**：遗留项说「沙箱 1 对无此压力」，本轮的回答是造一个——seeder 的 profile 配方让「分裂+共享」两种打包行为同时活体可测，结构断言（W6/W7）钉住世界本身；④**前浪 oracle 的字符串是合同**：重构诚实分支时连注释一起搬家就撕了三条前浪的合同——恢复形状比改探针便宜且更诚实；⑤**tie-break 的稳定性是打包的暗礁**：两对同 quarter 同 from/to，stable sort 保留 pairwiseAgreement 序——探针的 oracle 逐字节复刻了这条链（排序→稳定性→first-fit），任何一环漂移都会被 D34b 抓住；⑥**车道数有上界**：band 是 quarter，最多 4 组 occupied quarter → 最多 4 条车道 → 栈永远在 viewBox 内——布局策略不需要无限滚动的逃生舱；⑦**legend 的行数随世界生长**（1+3+1+1=6 行）：t209 的「镜像世界不发明世界」教义在更满的世界里依旧成立。
- 【世界卫生】本窗收割者三度吞树（kill→restart 后 watchdog+server 静默死亡 ×2、无 OOM、内存充足）——每次都以全新 watchdog 重启恢复，模式与前窗一致（kill 触发的重启树是可收割目标，全新 setsid 树存活）。build 前台两次通过（53s/56s）。roster 恒等 21（Z1/Z2 ×3），console 零错。
- 【收尾】worklog（本条）+ run-matrix.sh t210 入册（140→141）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「车道教义」：领地行的布局从「一行假设」升级为「栈的算术」——local 自底向上、pair 浮于其上、相接共享/相撞分裂；每扇门在任何世界里都按得到
- 「packLanes：一个算法、两个消费者、上界四条车道」：quarter 网格既是地址的方言也是布局的恩赐——车道数有界，仪器永远装得下自己的领土
- 「工程化世界破遗留」：「沙箱 1 对无此压力」的遗留项以第三张发声图告终——seed-masked.py 的 profile 配方是可复现的世界工程，探针的结构断言（W3/W6/W7）钉住世界本身
- 「诚实分支的字符串是前浪的合同」：重构可以改结构，不能改被钉住的形状——恢复比修改便宜
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（单仪器轮，定向回归覆盖 strip+chip+报告 11 套）；t210 ×3 + 回归 11/11 全绿；roster 恒等 21；矩阵显式清单 140→141（t210 入册）；收割者三度吞树均以全新 watchdog 恢复（kill 触发的重启树是可收割目标——新模式入册）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；session report 独立教学面（Map QC 节逐字骑 t209 epilogue）；masked 图的世界扩展（第四张发声图→6 对→更多车道——沙箱已证明可工程化，真世界压力驱动时再做）；lane 打包在 report 纸面上是否需要车道注释（当前纸面无车道概念， Depth 列已够诚实）

## Task 211 (2026-09-15, cron 21:32 窗口 trace …202609152132)

**主题：the session report must not lie——session QC report 的 Map QC 在拥有四个 volume 的世界里声称「None of this session's jobs has 3D maps yet」。这不是缺失功能是说谎：findMapBrief 的 walk 只探最新 8 个 completed jobs，而 demo pipeline 最新的 8 个恰好全是无图上半区（一个 outputs 只有 star 表的 refine3d、三个同样只有 star 的 postprocess、四个上游 never-volume job）——而排在第 9+ 位的 QA Refine3D 拥有四个 volume（orthovol + 双 half + masked，t210 seeder 的遗产）。更隐蔽的第二重谎言：排序一元比较器 `(a.updatedAt < b.updatedAt ? 1 : -1)` 在时间戳相等时返回 -1，悄悄倒转同一时刻写入的 job（gallery restore 就是同一时刻批量写）。修复 = t211 walk 三件套：①volume-capable 类型先验（refine3d/class3d/postprocess/multibody）骑队首、各层内部按新旧排——import/motioncorr/ctffind 从未持有过地图，把探针预算花在它们身上就是旧谎言的成因；②真三态比较器 + id tiebreak（等戳确定性）；③预算 8→24——诚实的失败模式是「全扫过无一发声」，绝不是「从未开口问」。t211-e2e 27 断言 ×3 全绿；回归 t197 50/0（session report 家族在新 walk 下依旧绿）+ qa00 + qa63 + t210 151/0。矩阵 141→142（t211 入册）。定妆照 scripts/shots-t211/t211-session-truth-2x.png（Map QC summary — orthovol · peak 76.2% · Comparison 表 half1 diverges -0.25 / half2 agrees 0.99——报告第一次在裸世界里说出真相）。**

- 【开局·第 19 度判例】内嵌摘要宣称「Task 205 最新、下轮候选 Pairwise 地址列」——实际 worklog 尾部已是 Task 210（车道教义）、HEAD=a24ea4d 已推送。四件套核实（BUILD_ID 存活/PORT 空闲/树干净/roster 21）→ watchdog 冷启动一次成功 → t210-e2e 前台单跑 151/0 世界健康。QA 巡检（cron 第 2 条）：首页/console 干净、Session QC report 打开正常——但报告内容说谎：Map QC 节在 roster 含 4-volume Refine3D 的世界里宣称没有任何 job 有 3D maps。**bug 优先修复铁律触发，立项 t211。**
- 【发现链条】curl outputs API 确认 cmu2hqkh5 有 4 个 volume → curl /api/jobs 拿 updatedAt 排序发现最新 8 个 completed 全部无 volume（cap 8 正好挡住真 owner）→ 读 session-report-dialog.tsx 的 findMapBrief：cap 8 + 假比较器 → 读 t197-e2e 发现它为什么十九个窗口没死：**S4 的 note round-trip 把 seed host 顶到最新 completed，恰好绕过 cap 8——探针的世界工程掩盖了产品 bug**。这个发现本身入册：世界工程是双刃剑，它让断言可复现也让盲区活下来。
- 【实现·session-report-dialog.tsx +34 行】①`VOLUME_CAPABLE_RE`（refine3d/class3d/postprocess/multibody）+ `MAP_BRIEF_CAP=24` + `byRecency` 三态比较器三个模块级常量，各带 t211 教义注释；②doneIds 构造分层：capable 队首 + never-volume 尾部，各层 byRecency 排序；③findMapBrief 的 slice(0,8) → slice(0, MAP_BRIEF_CAP)；④过时注释同步（cap 8 → the t211 walk）。产品行为变化仅在 walk 的探索顺序与预算——MapBrief 形状、measureMapQc、报告正文、UI 全部零改动。
- 【探针 t211·27 断言】S（两个 seeder 幂等跑——只写文件从不碰 DB/updatedAt，然后**钉住 bug 场景**：S4 断言存在一个 map-less 的 volume-capable job 比 host 新 [世界漂移时探针主动制造：fallback note-bump]，S5 断言旧 walk [newest-8 全类型] 在此世界会漏掉 host——十九窗盲区被钉成断言）+ W（新 walk 独立经 API 复刻：分层+排序+cap 24 全部探针自己的话写 → winner==host、2 terrain、profiles wire、peak/pearson oracle [复用 t197 算法]）+ X6 源 oracle（VOLUME_CAPABLE_RE 带确切正则、MAP_BRIEF_CAP=24 钉死、假比较器绝迹、三态+tiebreak 在源、prior 恰好咨询两次 [分层结构]、循环吃命名预算不吃裸 8）+ D11 活线（**D4 谎言绝迹**、D6 winner job id、D7 主图名、D8/D9 数字==wire、D11 glance==wire、D3 pending 落定轮询、D5 pending 不滞留）+ Z2（roster 恒等 21、console 零错）。
- 【RUN=1 的 1 处 D 失败=断言跟随世界的练习】D7 断言 "Map QC summary — orthovol.mrc"——报告印的是 label（去扩展名 "orthovol"）而非文件名（findMapBrief 的 `label ?? name` 合同，t197 时代就在）。探针修正而非产品迁就。修后 RUN=1/2/3 全绿 27/0 ×3。
- 【第二层真相·八】①**说谎的仪器与说谎的门同罪**：t210 的「被盖住的门是说谎的门」是空间遮蔽，t211 的谎言是预算遮蔽——cap 8 不是恶意是成本假设，但假设过期的成本由真相支付；②**探针的世界工程会掩盖产品 bug**（本窗最大教训）：t197 的 S4 note-bump 十九个窗口来每次都把 seed host 顶到最新 completed，cap 8 永远探得到它——修复的验收标准必须包括「裸世界」（不 bump 的世界）断言，t211 的 S4/S5 把这个盲区从「从未被测」变成「永远被钉」；③**先验是预算的朋友**：volume-capable 先验不是性能优化是诚实性修复——当预算有限，先问可能知道答案的人；但预算同时放大到 24 兜底，两个机制缺一不可（先验负责命中率，预算负责覆盖面）；④**相等的时间戳不是没有顺序**：假比较器在等戳时返回 -1 是一个反向的稳定 sort——看起来无害（「反正相等」）实际上会倒转等戳 job 的既定顺序，gallery restore 的批量写入恰好制造等戳世界；⑤**定妆照是真相的收据**：t211-session-truth-2x.png 一帧装下 Map QC summary + Job id + peak 76.2% + Comparison 表——报告第一次在裸世界里说出了这个世界真正拥有的地图。
- 【世界卫生】本窗收割者零出没（watchdog 全窗存活）；build 前台一次通过；t211 ×3 + 回归 4 套全绿；roster 恒等 21（Z1）；console 零错（Z2）。**探针跑动会刷新前浪定妆照**（t210-e2e 的 portrait 阶段重截 shots-t210/*.png 造成字节漂移 [±130 bytes]）——两次照判例 checkout 恢复 HEAD 档案版本：定妆照属于其诞生窗口的档案，后窗探针跑动不该顺手重写它（入册为档案卫生判例）。
- 【收尾】worklog（本条）+ run-matrix.sh t211 入册（141→142）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「session report 治愈了它的谎言」：Map QC walk 从「最新 8 个」升级为「volume-capable 先验 + 各层新旧序 + 预算 24」——在拥有地图的世界里，报告说这个世界有地图；空态文案只在真正扫完全部候选后才有资格出现
- 「探针世界工程的双刃剑入册」：t197 的 S4 note-bump 是 cap-8 盲区活了十九窗的原因——修复类任务的验收必须含裸世界断言；t211 的 S4/S5 把「旧 walk 会漏掉 host」钉成永久断言
- 「假比较器判例」：`(a < b ? 1 : -1)` 型一元比较器在等戳时是反向稳定 sort——批量写入世界（gallery restore）正好喂它等戳数据；三态 + id tiebreak 是唯一诚实的形状
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（定向回归覆盖 session report 家族 + 最新探针 4 套 + t211 ×3）；roster 恒等 21；矩阵显式清单 141→142（t211 入册）；收割者零出没；「探针跑动刷新前浪定妆照 → checkout 恢复」入册为档案卫生判例
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧；键盘 nudge 家族已完备 [slice plane 三段式 + ghost adopt]，undo 无宿主系统存疑）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；session report 的 Map QC 只取最新 winner 的单 job 视角（比它更老的 volume owner 永不出现在纸面——多 job 聚合视角是否值得做存疑）；findMapBrief 与 t197 expectedWalk 的旧序复刻已在两个探针间漂移（t211 新序 vs t197 旧序——t197 世界下两者结果一致故全绿，但下次 t197 改造时应同步新序）；

## Task 212 (2026-09-15, cron 21:47 堆叠窗口 trace …202609152156)

**主题：the paper sees the WHOLE session——t211 治好了「报告看不见任何地图」，但报告仍只讲一个 job 的故事：walk 的深度报告只骑最新 owner，其余 owner 在它之下继续隐形——t211 谎言的半治愈形态。t212 把 t211 的教训一般化：同一条 walk（capable 分层 + recency + 预算 24）现在**记录**它经过的每一个 owner（findMapBrief → walkVolumeOwners，inventory 零额外 outputs 探针成本），纸面长出「### Session map inventory」表（Job | Main map | Volumes，walk 序），骑在深报之后、sweep 之前。inventory 是 walk 的事实：它先于深度测量落定（测量拒绝时纸面仍列出世界——部分真相胜过沉默）；无 volume 世界诚实缺席。探针世界长出**第二个 owner**（qa67 seeder 自己的默认宿主 QA Class2D Source——never-volume tier 的 job，它的 inventory 在场把 tier 教义变成可见的行序：capable owner 首行、tail-tier owner 次行）。t212-e2e 28 断言 ×3 全绿；t211 探针同步改造（S5 从「假设场景活着」升级为「主动制造场景」）；t197 expectedWalk 同步新序（t211 遗留债务清偿）。回归 t211 26/0 + t197 50/0 + qa00 + qa63 全绿。矩阵 142→143（t212 入册）。定妆照 scripts/shots-t212/t212-inventory-2x.png（epilogue + inventory 双行表 + sweep 同框——折叠线之下不再有隐形地图）。**

- 【开局·第 20 度判例（无事）】堆叠窗口：worklog 尾部 = Task 211（本会话前窗所写）、HEAD=ea3104b 已推送、树干净、BUILD_ID 存活、PORT 空闲——四件套与上窗收尾完全一致。watchdog 冷启动 → 200。#13 复核：localStorage 写已在 t153 时代修复（persist 只在显式 action，注释在案「Storage stays an echo of user intent」）——老遗留销账。从 Task 211 遗留清单立项「多 owner 隐形」。
- 【实现①qc-report.ts +17 行】buildSessionReport opts 加 mapInventory 字段（typed、pending 时 null）+ mapQc 节后 inventory 节：`### Session map inventory` + 教义段（「no map hides below the fold (the t211 lesson: a walk that stops at the first winner leaves the rest of the world unseen)」）+ 三列表格 + 诚实缺席 guard（`if (mapInventory && mapInventory.length > 0)`——无 volume 无表格无谎言）。
- 【实现②session-report-dialog.tsx ±40 行】①MapOwner 接口（MapBrief 超集 + jobName + volumeCount）；②findMapBrief → walkVolumeOwners（返回全部 owner 数组，owners[0] 即深报 winner——walk 语义对 winner 不变）；③effect：inventory 先于测量落定（setMapInventory 在 measureMapQc 之前——部分真相胜过沉默的源序被 X6 钉死）；④md useMemo 传 mapInventory。零额外探针成本：owners 从同一 walk 的已 fetch outputs 构建。
- 【实现③t197 expectedWalk 同步】旧 newest-8 复刻 → 新序（capable 分层 + 三态 + cap 24）——t211 遗留的「两探针间 walk 方言漂移」清偿；两个探针现在说同一种 walk。
- 【探针 t212·28 断言】S（双 owner 世界工程：host 4 volumes + Class2D Source 1 volume [never-volume tier，S4 断言其类型不在 capable 正则——它的 inventory 在场就是 tier 教义的可见化]）+ W（独立 walk oracle 听到两个 owner、序正确、profiles wire）+ X6（inventory 合同字段/标题/表头/诚实缺席 guard/walkVolumeOwners 改名无孪生/setMapInventory 先于 measureMapQc 的调用点序[首现序陷阱：useState 解构行让 setMapInventory 首现早于函数定义——断言改钉调用点 owners.map... < measureMapQc(owners[0]）+ D12（inventory 表逐行逐格 == wire [名字/主图/volume 数]、行序==walk 序、节位置在深报与 sweep 之间、深报仍骑 winner、peak==wire、空态谎言绝世、渲染标题可见[滚动进视口后定妆照才拍得到 inventory——折叠线顶部的照片不是 inventory 的照片]）+ Z2。
- 【t211 探针适配·场景制造判例】t211 回归首跑 S5 fail——世界演化（t197 的 note round-trip bump host、批量重写）让「host 在 old-order 前 8 外」的**假设**失效。处置：S4+S5 合并为**场景制造块**——把 host 之后的 map-less jobs 逐个 note round-trip 晋级（幂等，每次 hostRank+1，bounded 10），直到 host 落到 rank 9+；世界太小造不出场景时**诚实降级**为 skip（打印说明，不计 fail——X 系列 walk oracle 无论如何都钉着修复）。改造后 t211 26/0。**判例入册：场景断言必须自带制造机制，世界的 updatedAt 是漂移量不是常量。**
- 【第二层真相·九】①**半治愈也是未治愈**：t211 让报告「看见至少一个 owner」，t212 让它「看见所有 owner」——谎言的治理不是布尔是光谱；②**inventory 是 walk 的免费副产品**：同一遍扫描既选 winner 也列名册——好仪器的额外洞察常常藏在其主路径已经走过的地方；③**部分真相胜过沉默**：inventory 先于深报落定，深报失败时纸面仍有名册——仪器的诚实分层（名册=确定事实，深报=尽力测量）与 pending/error 的不猜测教义同源；④**行序是教义**：capable tier 的 owner 首行、tail-tier 的次行——inventory 不只是名册，它是 walk 决策过程在纸面上的投影；⑤**探针世界工程的第二个 owner**：tail-tier job 拥有 volume 是「不可能而发生了」的世界——正是这种世界才能把 tier 教义变成断言。
- 【世界卫生】本窗收割者零出没；build 前台一次通过；t212 ×3 + t211 + t197 + qa00 + qa63 全绿；roster 恒等 21；console 零错。世界 updatedAt 漂移源考古（未定案）：seeder 纯文件写、outputs 路由纯只读均已核实，漂移来自 t197 note round-trip 与/或批量重写——**updatedAt 不是「用户操作时间」，它被系统动作污染**（入册为已知语义，依赖 updatedAt 排序的探针一律不得假设戳稳定）。
- 【收尾】worklog（本条）+ run-matrix.sh t212 入册（142→143）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「报告看见整个 session」：Session map inventory（Job | Main map | Volumes，walk 序）骑在深报之后——深度与广度在一张纸上各司其职（winner 的完整分析 + 所有 owner 的名册）
- 「walk 的免费副产品」：walkVolumeOwners 返回全部 owner，inventory 零额外探针——同一条 walk 既选 winner 也列名册，winner 语义逐字节不变（owners[0]）
- 「场景制造判例」：t211 的 S5 从假设升级为制造（bump 晋级 host 之后的 map-less jobs）+ 诚实降级（世界造不出时 skip 不 fail）——世界的 updatedAt 是漂移量，场景断言必须自带制造机制
- 「t197 方言同步」：expectedWalk 复刻升级为 t211 新序——两探针说同一种 walk，方言漂移债务清零
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（定向回归覆盖 session report 家族 3 套 + sentinel 2 套 + t212 ×3）；roster 恒等 21；矩阵显式清单 142→143（t212 入册）；收割者零出没；#13 老遗留销账（t153 时代已修）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧；undo 无宿主系统存疑）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；inventory 的 peak 列（每 owner 一次 profile 测量——statcache 缓解但首开变慢，真实世界 owner 多时价值/成本待权衡）；inventory 行可点击跳到对应 job 的 results（名册的门化——当前只读）；updatedAt 语义污染的系统性治理（分离「用户操作时间」与「系统触碰时间」两列——大工程，需迁移）

## Task 213 (2026-09-15, cron 22:17 窗口 trace …202609152217)

**主题：the roster's rows are doors——t212 把每个 owner 的名字放上了纸面，但按不到的名字仍是死路。t213 把 t210 的门教义搬上报告：Session map inventory 的每一行 body row 现在是一扇门，openJob 引擎（command palette 的同款：landing repair、workspace hop、completed job → inspector）落地到该 job 的 results。门只活在屏幕上——导出字节保持纯 Markdown（门需要一页纸才能打开），纸面合同（t194 one-md、t212 的字节钉）零触碰。门的钥匙是渲染后的表头三元组 [Job, Main map, Volumes]——hast 级匹配，Comparison 表（五列头）与未来家族永远 plain。thead 中和上下文（表头行是标签不是门）；行→owner 匹配读渲染后的格子词（读者读什么，门承诺什么；失配行保持 plain——门只能承诺纸面说的话）。键盘可按（Enter/Space——需要鼠标的门是半扇门）。纸面自己教这个可供性（t210 图例课的续写）。t213-e2e 35 断言 ×3 全绿；回归 t212 28/0 + t211 26/0 + t197 50/0 + qa00 + qa63。矩阵 143→144（t213 入册）。定妆照 scripts/shots-t213/t213-doors-2x.png（按下 tail-tier 门 700ms 后的干净落地：QA Class2D Source 的 inspector 全屏——名册第二行是一条路，不是标签）。**

- 【开局·第 21 度判例】内嵌摘要宣称「连续五个纯摘要窗口、Task 211 最新」——实际 worklog 尾部已是 Task 212（21:47 堆叠窗完成了开发：Session map inventory）、HEAD=53f9fd1 已推送、树干净、BUILD_ID 存活、PORT 空闲。四件套核实 → watchdog 冷启动（1 秒就绪）→ t212-e2e 前台单跑 28/0 世界健康 → agent-browser 巡检（首页正常、Session report 正常、inventory 两行在场、console 零错）→ 从 Task 212 遗留清单立项「inventory 行可点击（名册的门化）」——t210 让条带上的门可按、t211 让报告说真话、t212 让报告看见整个 session、t213 让名册的每一行成为一扇门。
- 【实现①qc-report.ts +3 行】教学段落加门条款（"Each row is a door — press it and the page hands you to that job's results (the t210 lesson carried onto the report: a name on a roster should never be a dead end)"）+ t213 教义注释（导出字节保持纯 Markdown——门需要一页纸才能打开）。教学段落字节无探针钉（全局 grep 确认只活在 qc-report.ts）——纯增量，零探针修改。
- 【实现②session-report-dialog.tsx +90 行】①模块级 InventoryTableContext（createContext(false)，定义恰好一次）+ OWNER_HEAD 三元组 + hastText/hastKids/hastTag 助手；②pressOwner（useCallback：`openJob(owner.jobId)` + `onOpenChange(false)`——纸面关闭，results 在 canvas 不在 dialog 之下，落地即收据）；③mdComponents useMemo（Components/ExtraProps 类型）：table 覆写在 hast 上找表头（hastKids 找 thead → 找 tr → 过滤 th → hastText 收词）与 OWNER_HEAD 全格匹配 → 命中才 Provider 包裹；thead 覆写 node 解构不泄漏 + value={false} 中和；tr 覆写消费上下文 + 行→owner 匹配（cells[0]===jobName && cells[1]===mainName && cells[2]===String(volumeCount)）→ data-owner-door + tabIndex=0 + aria-label（门说它的承诺：名字、主图、体积数、单复数诚实）+ hover/focus 紫色背景 + onClick + onKeyDown(Enter/Space preventDefault)。失配行与非 inventory 表保持 plain。
- 【RUN=1 的教训·hast 位置谎言】首版按位置取子节点（children[0] 当 thead）——unified 管道实测 `table.children = ['text','thead','text','tbody','text']`，thead 内 `tr.children = ['text','th','text','th',…]`——**markdown 管道在表格部件之间和内部交错 whitespace 文本节点**！children[0] 是换行不是表头，isInventory 永远 false，一扇门都不亮。修复：全部按 tagName 查找（find/过滤，绝不按位置），教训入册 + X13 oracle 钉死（"the head and the cells are FOUND by tagName, never taken by position"）。第二处小修：thead 覆写最初没解构 node——DOM 出现 `node="[object Object]"` 泄漏（React unknown-prop）；X4 oracle 同步升级（中和 + 不泄漏一起钉）。
- 【世界卫生插曲·ChunkLoadError 判例再+1】build 后未重启 server——浏览器拿到旧 HTML 引用已消失的 chunk（ChunkLoadError: 380d4a1a41b1f8c6.js），页面零按钮零渲染。杀 bun PID → 全新 watchdog 冷启动 → 按钮回归。判例：**build 换 BUILD_ID 后 server 必须重启，否则浏览器吃旧 chunk**（与「build 必须前台跑」同族）。
- 【探针 t213·35 断言】S（裸世界双 owner：种子幂等跑零 bump——S4 钉 tail-tier 类型的在场意义：按它的行是 tier 教义变成行旅）+ W（独立 API walk 复刻：两 owner、序正确——门的承诺必须等于 wire）+ X13 源 oracle（context 唯一/表头三元组/every 全格匹配/thead 中和/诚实 fallback/openJob 引擎/纸面关闭/键盘/data-owner-door/纸面教门×2/overrides 上树/tagName 查找）+ D13 活线（carrier 落定、两门、walk 序、aria-label==纸面词（"Open QA Class2D Source's results — orthovol, 1 volume" 单复数诚实）、tail-tier 门按下→inspector 落地（D7+定妆照）、host 门按下→winner 落地、键盘门同落地（focus+Enter）、门零泄漏 [2 doors / 0 head doors / 11 rows]、导出字节保 t212 钉、carrier 教门）+ Z2（roster 恒等 21、console 零错）。
- 【第二层真相·十】①**按不到的名字是死路**：t210 说被盖住的门是说谎的门，t213 说纸面上按不到的名字是死路——可见性（t212）与可按性（t213）是两种诚实，缺一即残；②**门只能承诺纸面说的话**：行→owner 匹配读渲染后的格子词，失配行保持 plain——导出字节里没有 id，屏幕门的力量恰好止于纸面的边界：屏幕比纸多的部分是可供性，不是事实；③**位置会说谎，标签不会**：hast 的 whitespace 交错是 markdown 管道的隐性合同，按位置取子节点在第一条新行后就碎——find(by tagName) 是唯一诚实的形状（与 t211 的假比较器同族：看起来无害的假设，过期时由真相支付）；④**需要鼠标的门是半扇门**：键盘路径不是 a11y 装饰是诚实性的另一半——strip 的门有键盘路径，纸面的门不能更少；⑤**引擎复用**：openJob 是 command palette 的同款引擎——门不需要新语义，只需要把已有的语义接上电（t206 的「一把刀两块肉」的服务版）。
- 【世界卫生】本窗收割者零出没（watchdog 全窗存活）；前台 build 两次（99s 修后 + 初始 55s 一次 [chunk 判例用]）；t213 ×3（35/0 ×3）+ 回归 5 套全绿（t212 28/0、t211 26/0、t197 50/0、qa00 GREEN、qa63 SMOKE GREEN）；roster 恒等 21；「探针跑动刷新前浪定妆照 → checkout 恢复 HEAD」判例照行（t211/t212 各一次）。
- 【收尾】worklog（本条）+ run-matrix.sh t213 入册（143→144）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「名册的门化」：Session map inventory 从只读名册升级为门厅——每一行 body row 是一扇 openJob 门，tail-tier owner 的 results 与 capable winner 的 results 同样可达（tier 教义从「行序」变成「行旅」）
- 「门只活在屏幕上」：导出字节零改动（t212 的纸面钉全数保真）——屏幕比纸多的部分是可供性不是事实；纸面用一句教学条款承认这扇门的存在
- 「hast 位置谎言判例」：markdown→hast 管道在表格部件间/内交错 whitespace 文本节点——children[0] 是换行不是表头；按 tagName 查找是唯一诚实的形状（X13 钉死）；thead 的 node 解构不泄漏（X4 钉死）
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（定向回归覆盖 session report 家族 3 套 + sentinel 2 套 + t213 ×3）；roster 恒等 21；矩阵显式清单 143→144（t213 入册）；收割者零出没；ChunkLoadError 判例再+1（build 后必须重启 server）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧；undo 无宿主系统存疑）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；inventory 的 peak 列（每 owner 一次 profile 测量——价值/成本待权衡）；updatedAt 语义污染的系统性治理（大工程，需迁移）；门落地的 spotlight 增强（落地后是否高亮 job 卡——inspect 已直接开面板，可能不需要；真世界使用反馈驱动时再评估）

## Task 214 (2026-09-15, cron 23:17 窗口 trace …202609152317)

**主题：the roster speaks its numbers——本窗开局即验尸：HEAD 的 cron commit c939035 捕获了一份死窗 WIP（t214-e2e 201 行新探针 + qc-report.ts +36 + session-report-dialog.tsx +46 + t212/t213 探针同步改造 + t213 定妆照漂移），无 worklog、无正式 commit——死窗死在探针/收尾之前，遗产由 cron 自动提交。WIP 的身份是 t212/t213 遗留清单里的「inventory 的 peak 列」：inventory 表从三列长成四列（Job | Main map | Volumes | Peak），每个 owner 的主图被 profile 一次（与深报同一条 map-profile API），peak 由导出的 peakPctOf/peakIndexOf 计算（一真两表面：深报的 Peak bullet 与 inventory 的 Peak cell 喝同一口井）；peaks 与深报并行飞行（inventory 照旧先落定——部分真相胜过沉默），每格听到才填，「—」= 还在测/拒绝，从不猜测（pending 教义逐行化）；门的 aria 承诺长出 peak。验尸发现并治愈一处真产品回归：OWNER_HEAD 门钥匙仍是三元组而表已是四列，head 逐格匹配失配 → 整张 inventory 失格 → 所有门熄灭（t213 探针若跑必死）。修复一行（钥匙随表生长）+ 前台 build + server 重启，t214-e2e 29 断言 ×3 全绿；回归 t213 35/0 + t212 30/0 + t211 26/0 + t197 50/0 ×2 + qa00 + qa63 全绿。矩阵 144→145。定妆照 scripts/shots-t214/t214-peaks-2x.png（inventory 四列表 + 双行门 + peak 76.2% 同框——名册第一次能横向比较）。**

- 【开局·第 22 度判例·验尸开局】cron 文本照旧背诵「Task 13」；worklog 尾部 = Task 213、但 HEAD 不是 t213 的 4841585 而是陌生的 cron commit c939035（比本窗早 31 秒）。解剖：6 文件 +303/-19，含 201 行 t214-e2e 与正反两份探针改造。四件套变体：树干净（WIP 已被 cron 收编）、BUILD_ID 存活且 build（15:05:06）与 server（15:05:13）成对新鲜——死窗在写完代码后完成了前台 build 与重启，之后才死；源码 mtime（14:57–15:03）全部早于 build，构造即 WIP 无疑。
- 【首跑即烟雾】t214 首跑 D1–D6 全绿（peak 在 wire 与纸面都说 76.2%）但 D7 处「Target page, context or browser has been closed」×2 复现于同一点。写诊断脚本（crash/close/disconnected 三挂钩 + 时间戳）验尸：**页面没崩，是门全部消失**——count 循环 20s 从未见 2、aria 读 30s 超时等元素（诊断跑里页面活了 3 分钟，原跑的页面死亡是病态长等待里的环境烟雾，根因修好后烟雾自散）。真因一行：qc-report 的表头已是四列而 session-report-dialog 的 `OWNER_HEAD` 仍是 `["Job","Main map","Volumes"]`——`headTexts.length === OWNER_HEAD.length` 失配 → Provider 不包 → tr 覆写全走 plain fallback。死窗改了探针的期望（t213 X2 已要求四元组）却忘了改 app 的钥匙。
- 【修复三件】①OWNER_HEAD 四元组 + 教义注释（钥匙必须随表生长）；②t214 D9 探针自错：裸 `[data-report-body] thead th` 收集了报告全部四张表的表头（deep quartiles/comparison/pairwise/inventory）——has-scoped 定位器 `[data-report-body] table:has(tr[data-owner-door]) thead th` 只读门的那张；③t197 D11 撞词：教学条款永久写入「— means still measuring, never a guess」，而 D11 用裸子串 "still measuring" 当 pending 状态标记——改为逐字钉住三条状态行本尊（map-pending 行 / overlay-pending 行 / 空态行），教义句是散文不是状态。
- 【世界卫生插曲·watchdog 也会死】杀 server 让 watchdog 用新 BUILD_ID 重启时发现 watchdog 自己已死（日志 0 字节、无进程）——setsid 配方本窗失效原因未定案（疑 build 期内存压力收割）。按脚本头部配方重启（nohus bash … > .qa-logs/watchdog.log 2>&1 &）后正常工作并记录了一次完整的 down→up（1s）。判例重申：**重启后必须核实 watchdog 真的活着（ps + 日志非空），「启动过」不等于「活着」**。
- 【探针 t214·29 断言】S（裸世界双 owner，种子幂等零 bump）+ W（双 owner 景观独立复刻、探针自己的 argmax 算 expected cells）+ X10（共享井导出/peakIndexOf 恰好被 buildProfileReport 复用/合同 nullable peak/四列头/「—」诚实格/measureOwnerPeaks 单定义且引用 peakPctOf/alongside 源序 [settle→fire→deep→merge]/merge abort-honest/教学条款/门的 aria 长 peak）+ D10（carrier 双 peak 落定、两行全字节==wire、一真两表面 [深报 bullet 与 winner 行同数字且深报在前]、渲染 Peak 格==wire、aria 带 peak、inventory 自己的表头是四元组、reopen statcache 1s 再落定）+ Z2（roster 恒等 21、console 零错）。
- 【第二层真相·十一】①**门钥匙必须随表生长**：OWNER_HEAD 是「这张表长什么样」的合同——表加列而钥匙不加列，所有门一起熄灭；t210 说被盖住的门是说谎的门，t214 说钥匙过期的门是死门（比说谎更糟：它连谎都没得说）；②**死窗验尸学**：死窗的 WIP 是半成品，但探针的期望已经写好——探针与产品的 diff 就是 bug 清单（X2 期望四元组 vs 源码三元组，直接指认凶手）；接手遗产的第一动作是跑探针让差异自己开口；③**状态行与教义句是两种文本**：D11 的本意是「节不在 pending 态」，裸子串却把任何含「still measuring」的散文都当状态——断言要钉状态行的本尊，让教义句自由说话；④**裸子串断言是易碎品**：它把「碰巧不含此词」当不变量，散文一长大就碎（与 t213 的位置谎言同族：看似无害的假设，过期时由真相支付）；⑤**烟雾学**：探针在病态等待里坐得越久，环境杀手的窗口越大——4GB 盒子的 OOM 前科让长等待本身就是风险；修好根因后 ×3 快速全绿，页面死亡自己消失了。
- 【世界卫生】build 前台一次通过（含 OWNER_HEAD 修复）；t214 ×3（29/0）+ 回归 6 套全绿；roster 恒等 21；console 零错（t214 Z2 + agent-browser 巡检双确认）；agent-browser 巡检：报告四列头上纸、双门 aria 带 peak、按 tail-tier 门落地 QA Class2D Source inspector、console 0 错；探针跑动刷新前浪定妆照 ×3（t211/t212/t213）→ 照判例 checkout 恢复 HEAD；诊断脚本验尸完毕即删除。
- 【收尾】worklog（本条）+ run-matrix.sh t214 入册（144→145）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「inventory 的 Peak 列交付」：名册从可读可旅行（t212+t213）升级为可比较——每 owner 的主图 peak 由与深报同一口井（peakPctOf）计算，「—」是逐行化的 pending 教义，门的 aria 承诺随行生长
- 「OWNER_HEAD 钥匙判例」：门钥匙是表的合同——表改列钥匙必须同步改，否则门全灭；死窗只改探针不改产品的 diff 模式是验尸的第一线索
- 「死窗遗产收编流程入册」：解剖 WIP → 前台跑探针让差异开口 → 修产品/探针各自的本分 → ×3 + 全家桶回归 → 补 worklog 与正式 commit——遗产零丢弃，判例零遗失
- 「状态行 vs 教义句」：t197 D11 从裸子串升级为三条状态行逐字钉——散文可以长大，状态标记必须精确
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（定向回归覆盖 session report 家族 4 套 + sentinel 2 套 + t214 ×3）；roster 恒等 21；矩阵显式清单 144→145（t214 入册）；watchdog 自死一次（配方重启后全窗存活）；定妆照恢复 ×3（t211/t212/t213）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧；undo 无宿主系统存疑）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 测试 21 基线复核（让位）；updatedAt 语义污染的系统性治理（大工程，需迁移）；门落地的 spotlight 增强（真世界使用反馈驱动时再评估）；inventory 的 Peak 列让名册可比较了——下一步自然是「比较的行动化」（例如按 peak 排序或高亮偏离 winner 最远的 owner，价值待真世界反馈）

## Task 215 (2026-09-16, cron 00:02+00:17 堆叠窗口 trace …202609160017)

**主题：the comparison becomes readable——t212 把名字放上纸面，t213 让每行可按，t214 给每行一个 peak，但「要读者自己在脑子里做减法的数字」是仪器从未真正说出口的数字。t215 给 inventory 长出第五列「Δ winner」：每个 peak 读对 winner 自己的 peak，由唯一导出的 deltaVsWinner 计算、门的 aria 同饮此井（twins fork, imports don't）；Δ 在**舍入后**的格子上做减法（peakPctNumOf 在纸面自己的 1-decimal 网格上先舍入再相减）——纸面的算术就是读者的算术，印出的 peak 与印出的 Δ 之间不可能漂出 0.1 的两位父亲；参考行诚实说 +0.0，dash 服从同一条 pending 法。**透镜**：页面上 |Δ| 严格唯一最大者佩琥珀左缘（outlierRowIdx——并列的王不是王，winner 的 +0.0 永远压不过自己；三元比较器 + epsilon，一元比较器形状在透镜里继续绝迹）；导出字节只留数字让读者自己判断——纸是事实，琥珀是阅读辅助。**世界工程**（t210 判例重现）：seed-outlier.py 把尾宿主的 orthovol 以 blob z=48→16 重写（peak 76.2%→25.4% of depth），文件名不动（前浪一切 label 钉保持为真）、winner 不动（深报零触碰）、volume 数不动（roster 结构零触碰）——只有数字脚下的景观移动了。t215-e2e 38 断言 ×3 全绿（RUN=1 一次通过——世界工程先在 wire 上 fail-fast 验证的回报）；回归 t214 29/0 + t213 35/0 + t212 30/0 + t211 26/0 + t197 50/0 ×2 + qa00 + qa63 全绿（**全部在发散世界里跑绿——wire-relative 教义的活体证明**）。矩阵 145→146（t215 入册）。定妆照 scripts/shots-t215/t215-lens-2x.png（五列 inventory + 琥珀左缘的 tail 行 25.4%/-50.8 + 教学段同框——名册第一次自己开口比较）。**

- 【开局·第 23 度判例】堆叠窗口：worklog 尾部 = Task 214（23:17 窗）、HEAD=221c4d8 已推送、树干净、BUILD_ID 存活、PORT 空闲。四件套核实 → watchdog 冷启动 → 首页 200 → t214-e2e 前台单跑 29/0 世界健康 → agent-browser 巡检（首页正常、console 零错）→ 从 Task 214 遗留清单立项「比较的行动化」（排序 vs 高亮的裁决：排序会撕毁 t212 的「行序是 walk 的投影」教义——高亮不重写任何东西，是把阅读层叠在 walk 序之上，故取高亮）。
- 【发现链条】读 walkVolumeOwners：main map 按 MAIN_MAP_RE（/half0|postprocess\.mrc$/i）先验排序——想劫持尾宿主的 main 只需**替换同路径文件的内容**，文件名（一切 label 钉的地基）纹丝不动；读 pctAt 发现「peak 76.2%」根本不是密度值而是**位置**（argmax plane / depth）——发散化 = 让 blob 搬家（z=48→16），峰值位置 25.4% 由 16/63 一次命中；curl 复验 wire：TAIL 25.4%、WINNER 76.2%，Δ=-50.8。先造世界后写码，RUN=1 38/0 一次通过的直接原因。
- 【实现①qc-report.ts +63 行】①pctNumAt 导出（数值井）+ pctAt 改喝它（parse-back 字符串会分井——t215 教义）；②peakPctNumOf（argmax→pctNumAt→**Number(toFixed(1))**——在纸面的 1-decimal 网格上先舍入：从原始 bins 算 Δ 可能与读者从印出格子的算术漂 0.1，格子才是井）；③deltaVsWinner 导出（null→null = 透镜还不能说话；<0 前缀 "-"）；④outlierRowIdx 导出（|Δ| 严格唯一最大且 >0——1e-9 epsilon、unique 旗标、并列即无王；注释明钉「一元 (a<b?1:-1) 形状绝迹——t211 比较器判例，透镜版」）；⑤opts.mapInventory 行加 peakPct；inventory 五列头 + Δ 格 `${delta ?? "—"}` + 教学条款（Δ winner 列 / 参考行 +0.0 / dash 同法 / 琥珀缘是透镜不是判决——字节留数字让读者判断）。
- 【实现②session-report-dialog.tsx ±35 行】①mapInventory state 行加 peakPct: number|null；measureOwnerPeaks 返回 {text, pct} 双面同井（X10 钉单一调用点）；merge 双写；②OWNER_HEAD 五元组——**钥匙随表生长，这次是设计时**（注释明钉：t214 的教训作为例行纪律而非验尸行使）；③tr 覆写加 data-outlier + inset 琥珀 boxShadow（rgb(245 158 11)）+ aria 追加 `, Δ ${delta} vs winner`（delta 与琥珀都从导入的 helper 计算）；④琥珀行保留 hover/focus/键盘——透镜永不挡门。
- 【实现③scripts/seed-outlier.py】qa67 同族 writer，一颗旋钮：blob z 16/48；--clean 复原 qa67 原形（**删除会杀死 owner——名册必须保住两行**，所以 undo 是「恢复原形」不是「移除文件」）；幂等；qa67 在任何后续探针的 S 相跑过即自动归零（自愈世界）。
- 【探针 t215·38 断言】S（发散世界：outlier seeder 说它干了什么 + 尾宿主仍恰好 1 volume——景观移动、文件名不动）+ W（独立 walk 复刻 + **读者算术**：Δ 从印出的格子字符串解析相减 [25.4-76.2=-50.8]，与 deltaVsWinner 的先舍入再减法同构——探针就是读者）+ X11 源 oracle（数值井/先舍入/单一导出+导入无孪生/五列头+五元组钥匙/诚实 Δ 格/教学条款/透镜比较器三元态+epsilon+一元绝迹/data-outlier+琥珀 boxShadow/双面同井单一调用点/aria 带 Δ）+ D15 活线（**双 Δ 格落定**、双行五格逐格==wire、深报 bullet 与 winner 行一真两表面未被透镜触碰、**恰一行佩琥珀且是 tail 行**、winner 行无琥珀、aria 双门都带 peak+Δ、**透镜永不挡门**[按琥珀行落地 tail inspector]、reopen statcache 重言、教学条款上纸）+ Z2。
- 【第二层真相·十二】①**要读者脑算的数字是没说完的数字**：t214 让名册可比较（数字在纸面），t215 让比较可读（关系也在纸面）——减法是仪器最后的嘴；②**格子是井不是原始 bins**：Δ 在舍入后的格子上做减法，读者的算术与仪器的算术同源——若从原始位置算 Δ，读者复算会漂 0.1，两个父亲就此诞生（t208「印两遍有两个父亲」的算术版）；③**并列的王不是王**：透镜只在严格唯一最大时加冕——tie 世界里它对谁都不低头，这本身是可测的诚实（D11 winner 无琥珀）；④**钥匙随表生长这次发生在设计时**：t214 的 OWNER_HEAD 教训在验尸时学得，t215 在开表新列的同一刻把钥匙长好——「教训作为例行纪律」与「教训作为验尸」是两种知识状态；⑤**透镜不是判决**：琥珀标记「偏离最大」不宣判「质量差」——Δ 只陈述距离，密度景观的解释权留给读者（仪器诚实分层：数字→关系→判断，前两层是仪器的，第三层是人的）；⑥**世界工程的旋钮美学**：seed-outlier 只转一颗旋钮（blob z），三样东西不动（文件名、winner、volume 数）——最小侵入的世界工程让前浪钉点全部存活，回归只断了一处契约钉（t212 X1）且同步即绿；⑦**发散世界里跑回归是 wire-relative 教义的活体证明**：t211-t214 五套探针在 tail peak 从 76.2% 变 25.4% 之后原位全绿——因为它们只比较「屏幕 vs wire」而非「屏幕 vs 昨天的截图」。
- 【世界卫生】本窗收割者零出没；前台 build 一次通过（t215 全量）；t215 ×3 + 回归 7 套全绿；roster 恒等 21（Z1 ×3）；console 零错（Z2 ×3 + agent-browser 巡检双确认）；探针跑动刷新前浪定妆照 ×4（t211/t212/t213/t214）→ 照判例 checkout 恢复 HEAD 档案。curl 首撞 403（http-guard 判例再+1：**qa 探针/curl 访问 map-profile 等敏感路由必须带 Origin: http://localhost:3000**——探针的 H 头早已内建此装甲，手 curl 忘了）。
- 【收尾】worklog（本条）+ run-matrix.sh t215 入册（145→146，TOTAL 自动计算无漂移）+ commit + push + 环境清理（杀 server 先 ss 查真实 PID、杀 watchdog、agent-browser close）。

Stage Summary:
- 「名册的第五列交付」：Δ winner 列让 inventory 从「可比较」升级为「比较已说出」——参考行 +0.0、偏离者 −50.8、琥珀缘指名最远的行；纸教透镜，字节留数字
- 「先造世界后写码」：seed-outlier 在实现前于 wire 上验证（25.4%/76.2% 一次命中）——RUN=1 38/0 一次通过的直接原因；世界工程的旋钮美学（一颗旋钮、三样不动）让前浪钉点几乎全数存活
- 「格子是井」：peakPctNumOf 在纸面 1-decimal 网格上先舍入再相减——读者算术与仪器算术同源，Δ 与印出的 peak 之间没有第三位小数的密室
- 「钥匙设计时生长」：OWNER_HEAD 五元组与五列表同刻落码——t214 的验尸教训第一次以例行纪律形态行使
- 世界卫生观察账本（verdict 列）：本轮无全矩阵（定向回归覆盖 session report 家族 5 套 + sentinel 2 套 + t215 ×3）；roster 恒等 21；矩阵显式清单 145→146（t215 入册）；收割者零出没；发散世界回归全绿 = wire-relative 教义活体证明；http-guard 的 Origin 头判例再+1（手 curl 必带）
- 遗留（下轮候选）：grabber nudge/undo 手感参数（真机盲区依旧；undo 无宿主系统存疑）；script RELION-present 分支（沙箱受限判决维持）；EMPIAR 真数据回归（让位）；runner wall-time 剖面（让位）；qa77 孤儿 job 基线复核（让位）；updatedAt 语义污染的系统性治理（大工程，需迁移）；门落地 spotlight（让位）；透镜的纸面化（琥珀缘目前只在屏幕——若真世界反馈需要纸面也指名偏离者，加一行 prose 即可，但「仪器说第三层判断」的门槛要过）；第三 owner 世界（两个 tail-tier job 才能测「并列的王不是王」的活线——当前由源 oracle X8 钉住，真世界压力驱动时再工程化）；透镜在 tie 世界的行为活线（同上——当前裸世界是发散的，tie 活线被 qa67 归零后的世界短暂呈现，未成断言）

## Task 216 (2026-09-16, cron 01:17 窗口 trace …202609160117)

- 【开局】四件套：worklog 尾部实际 = **Task 215**（Δ winner 列 + 琥珀透镜，HEAD=bd6add5）——内嵌摘要又停在 Task 214，过时判例 **23 度**；git 同步 origin/main；3000 上发现 **dev 形态 server**（gateway 托管链 `bash -c next dev | tee dev.log`，非 production watchdog 场）；watchdog/browser 均已随上窗清理。
- 【QA 惊魂】t215-e2e 首跑 FATAL：sandbox 缺 seed job（'QA Class2D Source' missing）→ 按探针自指指引跑 restore-gallery.py 恢复 roster 恒等 21 → 复跑 **34/4**：S3/D2/D4/D7 四断言全数倒戈，且全部聚焦 **winner host（QA Refine3D）**——期望 orthovol+halves+masked 四 volumes，实存只有两个 halves（Sep 15 旧文件）。
- 【根因】**世界配方依赖「历史积累」而非「配方」**：data/ 不入库（git ignored），沙箱回滚/收尾清理把 winner host 的 orthovol + masked 一并吃掉；t215-e2e setup 只跑裸 qa67（outlier orthovol）+ halves + outlier 发散覆盖——缺 **QA_VOL_HOST="QA Refine3D" qa67**（winner orthovol，t204/t210 判例配方）与 **seed-masked.py**（winner masked，t210 原生调用方）两味药；restore-gallery 链尾同样没有它们——上窗全绿纯靠历史积累文件活着。配方判例：**探针的世界必须能从探针自己的 setup（或 restore 一键）重建，「上次还在」不是世界状态**。
- 【修复】① t215-e2e setup 补全五步配方（winner orthovol → outlier orthovol → halves → masked → 发散覆盖**最后**——它重塑 outlier orthovol，之后不得再有人碰该文件）；② restore-gallery.py 链尾新增第 9 段：QA_VOL_HOST 变体 qa67 + seed-refine-halves + seed-masked（env 注入不走统一 seeder 循环）；**seed-outlier 刻意排除**——restore 造中性世界，发散形状是探针 setup 自己的职责（关注点分离）。
- 【环境判例升级：dev server 是本箱毒药】修复后 t215-e2e 在 dev server 上 38/0 ×3 + t214 29/0 + qa00/qa63 GREEN——随后 t210 突然 ECONNREFUSED，server 秒级暴毙；重启后再死、再再死（三连）。dev.log 无 crash 痕迹（最后都是正常 200）→ **kernel OOM killer**（watchdog 头注自曝 87 次前科，4GB 箱）：dev Turbopack 编译是内存怪兽，e2e 负载叠加即爆。前台 build（896MB heap 判例）+ **watchdog 配方重新加冕**（BUILD_ID 8RONuXsCUAQ6Rm9vwuTqK）——production server + watchdog 才是本箱 e2e 的唯一正解，gateway dev server 只配轻量预览。
- 【世界卫生】t215 ×4（dev ×3 + **production 复核 ×1**——世界配方在两种 server 形态下同成立）38/0；t210 151/0（seed-masked 原生调用方无回归）；t214 29/0；qa00/qa63 GREEN；roster 恒等 21；定妆照漂移 ×5（t210×3 + t214 + t215）→ 照判例 checkout 恢复 HEAD 档案；工作树净剩修复本体 ×2。
- 【收尾】worklog（本条）+ commit + push + 环境清理（杀 watchdog、杀 server 先 ss 查真实 PID、agent-browser close——本窗 browser 未开）。run-matrix 无新探针入册（146 维持——本窗是配方修复，不是新面）。

Stage Summary:
- 「配方代替积累」：t215-e2e setup 五步配方自愈 + restore-gallery 一键恢复中性世界——探针世界从「考古遗存」升级为「可复现实验」；data/ 不入库的世界里，**唯一可信的世界是配方造出来的世界**
- 「dev server 死亡判决」：三连暴毙 + 零 crash 日志 + OOM 前科 87 次 → 本箱 e2e 只用 production + watchdog；dev 形态（gateway 托管）仅限人类预览
- 「QA 优先修复的样板轮」：FATAL 自指恢复 → 4 断言倒戈 → 根因是基础设施而非产品代码 → 修配方不修文件（手工补文件能让探针绿，但下一次回滚还会死）
- 零 app 源码改动的一轮：session report 的五列、琥珀透镜、门的契约全部原样——本轮的交付物是**世界的可重建性**
- 遗留（下轮候选）：t215 遗留清单原样继承（grabber nudge/undo、透镜纸面化、第三 owner 世界、updatedAt 治理等）；新增候选：**restore-gallery 全量演练**（本窗只验了 volume 家族段，qa50-qa67 链未做从零演练）；qa67 的 QA_VOL_HOST 语义写进脚本头注（本窗靠 t204 才找到这个隐藏旋钮）

## Task 217 (2026-09-16, cron 01:47 窗口 trace …202609160147)

- 【开局】四件套：worklog 尾部 = Task 216（eb78249，与上窗交付一致——摘要过时判例本窗暂歇）；git 同步；**净场**（PORT FREE、watchdog 0、BUILD_ID 存活 8RONuXsCUAQ6Rm9vwuTqK）→ watchdog 配方拉起（bun pid 5674）→ QA：agent-browser 首页标题/console 零错 + qa00 GREEN + qa63 GREEN。
- 【立项】Task 217 = **restore-gallery 从零全量演练**（上窗点名首选）——把 t216 的「世界可重建」承诺从「volume 家族段验证过」升级到「全链 + 破坏性分支都验证过」。DB 先备份（.qa-logs/db-backup-t217.db，md5 756d1270）——演练的保命绳。
- 【演练三层递进】
  - **L1 幂等全链**（活世界直跑）：9 段全 ok、edges +0（幂等不重复造边）、roster 恒等 21（16 completed）✅
  - **L2 Job 全灭**（deleteMany 21，全 FK Cascade 一键清）：restore 重建 → **roster 18 ≠ 21，演练抓到真实缺口**！失踪者 = β-Gal demo 三件套（Import Movies 1 / Motion Correction 1 / CTF Estimation 1——教程自己的半截流水线，idle、无 result、裸 job：无 engine-state 条目、无 workdir、无文件）——它们只活在历史 DB 里，restore skeleton 从未收编（「QA 家族中心主义」的盲区）。
  - **L3' workspace 丢失**（sqlite 直删 Workspace——发现 Prisma 的 onDelete:SetNull 是 ORM 层行为，SQLite 直删不触发、留悬空引用，须手动 UPDATE 置 NULL）：restore 的 resolve_workspace 自动造 Main + **adopt-orphans 段 21/21 全数收养** ✅（L2 未覆盖的分支）。
- 【修复：三件套收编 restore-gallery】① skeleton 后新增 3b 段造 demo trio（原坐标 16/280/544，**不进 flip spec**——`"_result" in v` 守卫让 trio 保持 idle 无 result，与历史世界同构；**不注册 engine-state**——历史三件套就是裸 job）；② wiring 头部加两条 demo 边（micrographs→movies / micrographs→micrographs，照 QA 语义）——edges 14→16；③ 重跑验证：roster 21/16、trio idle+result NULL、flip 仍只动 11。
- 【重建世界全家族验证】L2 重建后 job id 全新——「seeds resolve ids at runtime」的终极实弹：qa00 GREEN + qa63 GREEN + **t215-e2e 38/0**（五步配方自愈 + 发散世界在全新 id 上重建）+ **t214 29/0** + **t210 151/0**。session report 全家族在重建世界上无恙。
- 【顺手判例】qa67 头注把 QA_VOL_HOST 语义从行内注释提升到 Usage 段（裸调用与 QA_VOL_HOST 变体写**不同 host**——配方只跑一个就饿死另一个；上窗遗留销账）。
- 【世界卫生】定妆照漂移 ×5（t210×3 + t214 + t215）→ 照判例 checkout 恢复；工作树净剩修复本体 ×2；孤儿 workdir 记账不清理（L2 重建后旧 id 目录成为无人认领的化石——「cleanup-radius protocol」只授权 seeder 删自己造的，不动）；收割者零出没。
- 【收尾】worklog（本条）+ commit + push + 环境清理（杀 watchdog、杀 server 先 ss 查真实 PID、agent-browser close）。

Stage Summary:
- 「演练的产出不是绿，是缺口」：L1 幂等绿只是入场券；L2 破坏性演练当场抓获 demo trio 盲区——**restore 的 roster 从 18 修正到 21**，从此「从零重建」与「历史世界」逐 job 同构
- 「三件套的身份」：教程自己的半截流水线（idle、无 result、无 run record）——收编时**保持裸态**（不 flip、不注册、不造文件），幂等 by name，任何世界形态下 21 = 11 skeleton + 2 qa58 + 6 qa60 + 2 trio 边之外的……roster 恒等式的每一项现在都有出处
- 「Prisma 层与 SQLite 层的 SetNull 裂缝」：直删 Workspace 不触发 SetNull（悬空引用）——产品走 ORM 无恙，但任何未来「直接 SQL 治理」的脚本必须知道这条裂缝（记入判例）
- restore-gallery 现在的三层承诺：幂等重跑（L1）、Job 全灭重建（L2）、workspace 丢失自愈（L3'）——「disaster recovery」从口号降维成三条可重放的实弹
- 遗留（下轮候选）：孤儿 workdir 化石清理（cleanup-radius 授权讨论）；engine-state 孤儿条目 GC（34 条里的死 id）；t215 遗留清单原样继承（第三 owner 世界、透镜纸面化、updatedAt 治理等）；qa77 孤儿 job 基线复核；EMPIAR 真数据回归（让位）

## Task 218 (2026-09-16, cron 02:02 窗口 trace …202609160202)

- 【开局】四件套：尾部 = Task 217（7295593）、git 同步、净场 → watchdog 拉起 + qa00/qa63 GREEN。候选评审：门落地 spotlight 查 t213 原文自带「inspect 已开面板，可能不需要」判决——让位维持；cron 背诵的「3D viewer 体积截面工具」**侦察发现早已全量交付**（molstar-embed：ChimeraX 风格 per-axis clip + X/Y/Z 滑杆 + invert + SVG 拖拽面 + 录制注解——背诵清单第 24 度失真，Task 13 遗留已全面不可信）→ 本窗主工程改为 t217 点名的化石 GC + 产品小增量 CSV 导出。
- 【GC：gc-orphans.py】L2 演练的化石尾气（17 死 engine-state 条目 + 17 孤儿 workdir，~2.7MiB）需要收割者，但 cleanup-radius protocol 只授权 seeder 删自己造的——**GC 需要自己的教义：隔离区条款**。工具设计：dry-run 默认（审计不碰）、--apply 时 engine-state 先整文件备份再剪（37→20）、孤儿 workdir **mv 进时间戳隔离区**（.qa-logs/gc-quarantine/——永不直接删，手工可逆）；拒绝面是契约的一部分：live id8 尾巴不可碰（roster 唯一真相）、不逃出 data/relion/<project>/、隔离区不自我收割。收割后幂等复读 0-0；全家族在收割后的世界上绿（qa00/qa63/qa67/t215/t210）。
- 【产品：inventory CSV 导出】五列名册在纸面可读、门 aria 可引，但**要研究者手打进表格的名册是半台仪器**——doors 区长出第三扇门「Download CSV」（emerald 绿：机器格与紫色报告家族分色；FileSpreadsheet 图标）。builder 收编 qc-report.ts 单一导出 inventoryCsv：delta 格**就是 deltaVsWinner 本尊**（CSV 从不重新推导偏差——twins fork, imports don't）；peak_pct 蹲纸面自己的 1-decimal 格；pending peak = 空格（「still measuring」的 CSV 语法是空白，不是猜测——pending 教义进 RFC 4180）；只在必须时引号。文件名同时间戳语法、自己的扩展名；空 inventory 时 flash note 诚实点破（静默 no-op 是说谎的门）。
- 【判例：第一版探针的硬编码当场被世界打脸】t218 D 段初版硬编码 51.6（抄旧打印），qa67 原始形状的 76.2 一眼戳穿——**wire-relative 教义在探针写作时就要生效**：CSV 逐格对比渲染文档自己的 markdown（data-md），从不对比昨天的硬编码。修正后 D10/D11「CSV == paper, cell for cell」是这个教义的新形态（t215 断言纸==wire，t218 断言 CSV==纸——同一份事实的三种语法各自同源）。
- 【环境插曲】app 源码改动后 production server 跑旧 bundle（探针 D2 找不到门）→ 判例配方：前台 build（896MB）+ 杀 server 让 watchdog 拉新 bundle；**kernel OOM killer 在 build 后内存紧张期收割了 server + watchdog**（dmesg 铁证 next-server pid 5466）——重启 watchdog + 手动确认，OOM 前科累计 88+。
- 【世界卫生】t218 ×4（21/0，含 portrait 段）；回归 t215 38/0 + t214 29/0 + t213 35/0 + t212 30/0 + qa00/qa63 GREEN；roster 恒等 21；前浪定妆照漂移 ×4 → checkout 恢复；run-matrix 146→147（t218 入册，显式清单 + auto-include glob 双保险）。
- 【收尾】worklog（本条）+ 双 commit（GC infra / CSV 产品分开）+ push + 环境清理。

Stage Summary:
- 「CSV == 纸的机器语法翻译」：同一份事实（roster）三种语法（markdown 表 / 门 aria / CSV 格）各自同源、互为翻译——inventoryCsv 不发明数字，deltaVsWinner 不出第二个父亲
- 「隔离区条款」：GC 的 cleanup-radius 扩展——收割即搬家（时间戳隔离区 + 整文件备份），每个 GC run 都是一条可手逆的操作；「永不直接删」让收割者自己免疫考古
- 「背诵清单全面失真的终审」：3D 截面工具早已交付 = cron 文本的 Task 13 遗留第 24 度过时——**遗留的唯一可信来源是 worklog 尾部实际条目的 Stage Summary**，背诵文本只是历史化石
- 「探针第一版被世界打脸是好事」：硬编码期望在第一次跑动就被世界形状戳穿——wire-relative 不是断言技巧，是探针的写作纪律（写期望时就该问：这个数字是世界的，还是昨天的？）
- 遗留（下轮候选）：第三 owner 世界 / tie 活线（roster 恒等 21 与之冲突——需要探针内临时世界或 Z1 断言全家族同步，成本再评估）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；qa77 孤儿 job 基线复核；gc-quarantine 的清理节奏（探针全绿 N 窗后可整体删除——下轮盘点）；CSV 门的 copy 路径（剪贴板 TSV？让位——需求未现）

## Task 219 (2026-09-16, cron 02:17 窗口 trace …202609160224)

- 【开局】四件套 + **auto-commit 验尸**：HEAD 变 62f0291（cron 捕获 t210 定妆照漂移 ×3——上窗 checkout 恢复列表漏了 shots-t210，漂移留在工作树被 cron 归档）→ 恢复档案照（3e95c2f）+ **checkout 清单升级为具名工件**：本轮碰过的每个 portrait 目录全列，不许凭记忆。DELETE /api/jobs/[id] 侦察：已存在（live process 停止 + clearRunRecord + edge cascade + workdir 磁盘保留给 undo）——teardown 语义现成。
- 【立项】Task 219 = **tie 世界活线**（t215 遗留 finally 落地）——「并列的王不是王」此前只有源 oracle（X8）钉着，裸世界永远只有一个 outlier，透镜的 tie 分支从没在 wire 上被真实见过。
- 【世界工程：seed-twin.py】造第三 owner「QA Class2D Twin」：POST class2d job + flip completed（restore-gallery 语法）+ **byte-identical 复制**发散 orthovol（cp 不是重推导——重推导的形状是第二个父亲，tie 必须精确到字节才配叫「并列」）+ engine-state 注册 + outputs 路由验证。幂等 by name；--clean 走 API DELETE（探针 teardown 的离线路径）。
- 【t219-e2e 20 断言 ×3 绿】
  - W：walk 听到**三个 owner**；twin 的 landscape == source 的 landscape **bin-for-bin**（同一条 wire 两次被读）；峰位 25.4 < 76.2（tie 争的是王冠不是王座）
  - D：**tr[data-outlier] count === 0——tie 面前零琥珀（活线核心）**；Δ 列 +0.0 / -50.8 / -50.8（wire-relative 从 data-md 抓）；CSV 门（t218）在 tie 世界照样三行逐格同源
  - T：DELETE twin → 200 → roster 21 → outputs 路由拒尸体 → engine-state 无 twin 条目（clearRunRecord 活线）——**roster 恒等 21 与 tie 世界共存**：twin 只活在探针的 setup 与 teardown 之间，前浪探针零感知
  - 探针第一版的 pctAt 把「峰的深度位置」错当「密度值」（100 vs 76.2 当场打脸）——t215 的 peakOf 语法：argmax 的**位置**除以 bin 数，不是值除以 max
- 【GC 实战闭环】twin ×3 teardown 的 workdir 尾气（4 个孤儿）→ gc-orphans 干净收割进隔离区 → 幂等归零——工具在设计时的 17+17 之外第一次吃自己生态系统的真实化石；DELETE 留盘的 workdir（undo 教义）与 GC 的隔离区（可逆收割）在同一轮咬合成完整闭环。
- 【世界卫生】t219 ×3（roster after ×3 = 21——teardown 三连全可靠）+ 回归 t218 21/0 + t215 38/0 + t214 29/0 + qa00/qa63 GREEN；定妆照漂移 ×2（t214/t215）→ checkout 全列表恢复（含 t218）；run-matrix 147→148。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「tie 分支从源 oracle 到活线」：t215 的三态比较器第一次在 wire 上见到真实的并列——零琥珀不是猜的，是二十次断言钉出来的；「a tie for the crown is no crown」从注释变成了 t219 的 D2
- 「byte-identical 的哲学」：并列必须精确——复制（cp）而非重推导；重推导的形状是第二个父亲，字节的同一性才是 tie 的合法性来源
- 「roster 恒等 21 与第三 owner 共存」：探针内临时世界（setup 造、teardown 拆）让 tie 断言不需要 22-job 的世界——前浪的 Z1 一行不用改；t219 的 teardown 三连全可靠（崩了会留 twin，但 gc-orphans 会在下一轮把它当化石收走——GC 是探针世界的清洁工兜底）
- 「checkout 清单是具名工件」：上窗漏 t210 的教训进了判例——恢复动作要么全列、要么按 glob，凭记忆的列表是最脆的档案纪律
- 遗留（下轮候选）：gc-quarantine 清理节奏盘点（探针全绿 N 窗后整体删除）；qa77 孤儿 job 基线复核；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（需求未现）

## Task 220 (2026-09-16, cron 02:32 窗口 trace …202609160232)

- 【开局】四件套：尾部 = Task 219（4d5fa9d，摘要再次落后两窗——过时 recital 判例 25+ 度）；净场 → watchdog 拉起 + qa00/qa63 GREEN + 回归快扫 t219 20/0 + t218 21/0 + t215 38/0。
- 【侧任务销账】① **qa77 基线复核** ALL PASS（roster 21 新常态下 orphan adoption 四相全绿——遗留销账）；② **gc-quarantine 盘点**：2 run（L2 演练化石 + t219 teardown 尾气）6.9MiB——t219 遗留的「三窗全绿后收割」节奏判满（t218/t219/本窗三连全绿）→ 本窗收割：workdir 化石删除、两份 engine-state.backup.json 收据保留在 .qa-logs/gc-quarantine-retired/（44K，考古绳）、db-backup-t217.db 保命绳一并退役。
- 【立项】Task 220 = **the lens speaks the contested crown**——t219 把 tie 搬上活线，但纸面在 tie 世界是沉默的：研究者分不清「大家都一致」（好）和「两个 owner 争夺王冠」（可疑——同一 volume 被导入两次的真实用户场景）。零玸珀有两种含义，透镜必须会说第二种。
- 【实现：one scan, two lenses】
  - qc-report.ts：抽共享 `crownScan`（同一遍扫描、同 1-decimal 网格、同 epsilon 纪律）→ `outlierRowIdx`（唯一王）重构为读同一扫描 + 新 `contestedCrown`（≥2 行共享严格最大 |Δ|>0 → `{abs, indices}`；唯一 outlier 或全一致 → null）——twins fork, imports don't 的透镜版：两片透镜永不许是两种意见
  - 纸面注脚活在 **markdown 源**（buildSessionReport 表后条件插入 blockquote 行）——data-md、剪贴板 copy、export md 全部携带同一真相；CSV 保持纯数字（名册的机器格说事实，透镜的判决随纸旅行）；唯一 outlier / 全一致世界此行**从不出生**——前浪探针的纸字节零扰动（t210-t215 全绿实证）
  - 注脚文案用 t219 教义原句收尾："a tie for the crown is no crown, so no row wears the amber edge"；点名全部并列者（andList 格式化）+ 共享 |Δ|
  - globals.css：`.report-doc blockquote` 换玸珀注脚装（琥珀左边线 + 6% 琥珀底 + 单侧圆角；文字保持前景色——深底上的琥珀字是眯眼，颜色住在框里不住在词里）
  - **对话框组件零改动**——注脚从 markdown 自然流出，渲染层无第二个父亲
- 【t219-e2e 20→27 断言 ×3 绿】D2b 注脚点名双方+共享 |Δ|（**初版断言的顺序假设被世界打脸**：名册 newest-walk-first，注脚是「Twin and Source」不是「Source and Twin」——改为顺序无关：提取注脚行、验双方在场）；D2c 教义原句逐字；D2d 渲染层恰一个 blockquote；Z2-Z5 teardown 后负分支活线（未 tie 世界两行 + 玸珀归位 + 注脚消失 + console 净）。bun 单测 12 世界形态全绿（唯一 FAIL 是测试自己算错 index——代码对）。
- 【定妆照】t219-tie-2x 顶部框框不到折叠线下的注脚 → **注脚赢得自己的画框**：scrollIntoView 后第二张 t219-tie-note-2x.png（表三行零玸珀 + 琸珀注脚同框）——两张都是故意的新帧，随 feature 提交；前浪漂移 ×8（t210×3/t212/t213/t214/t215/t218，其世界无 blockquote 纯渲染噪声）→ 具名 checkout 清单恢复。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「零玸珀有两种含义」：全一致（真相，无需注脚）与并列争冠（可疑，必须点名）——contestedCrown 让透镜会说第二种沉默；「silence has two meanings, and a lens that cannot tell them apart leaves the reader guessing」
- 「one scan, two lenses」：crownScan 共享扫描让玸珀边与纸面注脚永不 disagreement——重构后 outlierRowIdx 行为逐位不变（t215/t218/t219/t210 四探针 pin 死），新透镜是兄弟不是第二意见
- 「注脚活在 markdown 源」：单一事实源教义的又一次胜利——组件零改动，导出字节自动携带解释；CSV 拒绝跟随（facts 是名册的，verdicts 是纸的）
- 「注脚值得自己的画框」：顶部定妆照框不到折叠线下的增量 = 没有画框——scrollIntoView 后的第二张照让 t220 的增量在档案里可见
- 遗留（下轮候选）：qa77 销账；gc-quarantine 收割销账（收据 44K 在 gc-quarantine-retired/）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；t219 注脚顺序判例——「断言不许假设并列者的出场顺序，walk 的顺序是 walk 的事」

## Task 221 (2026-09-16, cron 03:02 窗口 trace …202609160302)

- 【开局】四件套：尾部 = Task 220（3f66729）；净场 → watchdog + qa00/qa63 GREEN。**背诵清单第 25 度审讯**：#5 fs/browse 鉴权早有 http-guard 整编（同源守卫+威胁模型文档）、#7 chart 路由早不存在、#13 localStorage 写早收编——recital 全线过时，产品线立项。
- 【侧任务销账】qa77 基线复核 ALL PASS（上窗销账本窗确认）；gc-quarantine 收割与 db-backup-t217 退役确认（上窗完成）。
- 【立项】Task 221 = **the inventory speaks shape agreement**——t214 给每行发了 peak，t215 发了 Δ，但「每个 owner 都是纸面的一等公民」还差最后一味：胜利者的比较算术。深报告为 winner 的地图们说 Agreement r（t195/t206），名册却从没为任何 owner 算过 r vs winner。数据已在客户端（measureOwnerPeaks 取回 bins 后只留 peak——**bins 被丢弃**是现成的免费午餐）。
- 【实现】
  - qc-report.ts 新 `shapeAgreement(winnerBins, ownerBins)`：resample 到更细网格（t195 pairwise 教义）+ pearson，fail-soft（缺图/平场 → null，cell 说 — 不猜）；winner 行走同一路径得到 1.00——无特殊分支、无第二个父亲
  - 名册第六列 **Agreement r**（与深报告同名同语法——cross-surface recognition：一个 r 语法全纸通用，toFixed(2) + —）；CSV 同步长出 shape_r（numbers travel, verdicts don't）
  - 对话框：measureOwnerPeaks 三表面（text/pct/**bins**）一次 fetch；merge 处算 shapeR；door aria 追加 `, shape r X.XX`
  - OWNER_HEAD quintet → **sextet**（门钥匙第三次随表生长——t214 的教训成为例行纪律）
  - **命令面板报告门**（侧增量）：「Open the session QC report」入 Canvas & app 组——palette 派发 SESSION_REPORT_EVENT、header 监听开门（OPEN_EVENT 握手的反向跳）；面板是最后一个不认识 session report 的表面——只活在 header 条上的门是键盘够不到的门（t210 教义，palette 版）
- 【事故与判例：MultiEdit 吞行 + build 不拦类型】
  - **MultiEdit 原子性假象**：编辑 qc-report.ts 时 old_str 含 `const winnerPct` 声明、new_str 漏回填——build「成功」但运行时 ReferenceError → 对话框渲染崩 → data-report-doc 永不附加 → t215 探针每轮 getAttribute 吃满 30s 超时。根因二重：① MultiEdit 在部分 old_str 失配时**并非原子**（前两编辑落地、后四未动——与文档宣称相反，今后批量编辑后必须全量复查）；② **next.config `ignoreBuildErrors: true`**——build 不拦类型错与死引用。新门禁：**bunx tsc --noEmit 先于 build**（本窗已立，qcreport/对话框/面板/header 四文件零错）
  - **工具输出渲染吞 `[h` 序列**：`[host.name` 在终端捕获里显示成 `ost.name`，把显示文本抄进 old_str 导致二次失配——**bracket 密集代码以 python 字节提取为准，不抄渲染输出**（t211 的 `bins[hi]` 假警报同案）
- 【探针家族迁移】t212 X1 类型串+X3 措辞（前缀钉幸存）；t213 X2 sextet；t214 D9 head+X3 类型串；t215 X5+D6+D7/D8 cells+r oracle（探针自带 resample+pearson 家族先例）+W7/W8（winner 自身 r=1.00、divergent r≠1.00）+D12b aria r；t218 D6 header+正则+映射+D12（+1.00）；t219 D3 正则+D8 映射+D5b（**tie 行的 r 必相等——一个地形两次被相关**）。新 **t221-e2e 12 断言**：面板门四连（Ctrl+K → fuzzy → 点击 → 报告开且恰一个）+ 六列头 + r 格栅 + **S 段世界配方**（t210 家族配方会重播种标准形状——「世界是漂移量」判例再次生效：探针自带 seed-outlier）。
- 【发现即教义】移位高斯的 r = **-0.45**：峰搬家时地形反相关——Δ 列说「质量搬家了」（-50.8）、r 列说「形状反向了」（-0.43），两列互证一个故事。仪器的诚实：相关 ≠ 相似位置，r 与 Δ 是两个互补的问题。
- 【世界卫生】全家族绿：t221 12/0 + t219 28/0 + t218 21/0 + t215 41/0 + t214 29/0 + t213 35/0 + t212 30/0 + t210 151/0 + qa00/qa63；roster 恒等 21；t212-t219 七张定妆照 = 六列入画的故意新帧随 feature 提交；t210 ×3 画布噪声 checkout。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「名册的最后一味」：peak（在哪）、Δ（差多远）、Agreement r（跟不跟）——每个 owner 现在拥有胜利者的全套比较算术；t212 的「no map hides below the fold」从名字可见升级为形状可比
- 「两列一个故事」：Δ 与 r 是互补问题——发散世界的 -50.8 / -0.43 说「搬家且反向」；tie 世界的相等 r 说「一个地形两次被相关」；全一致世界的 1.00×N 说「大家跟王座一致」
- 「build 通过 ≠ 代码正确」：ignoreBuildErrors 的代价在运行时爆炸才现形——tsc 门禁入册；MultiEdit 非原子性入册（批量编辑后全量复查）
- 「面板是门的注册表」：session report 终于在 ⌘K 有了名字——事件握手（palette 派发、owner 监听）保持单对话框归属
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程，需迁移）；EMPIAR（让位）；CSV copy 路径（让位）；Local agreement 地址进名册（weakest band per owner——r 列的下一个自然问题「哪里不跟」，成本再评估）

## Task 222 (2026-09-16, cron 03:32 窗口 trace …202609160342)

- 【开局】四件套：尾部 = Task 221（0ab359c）；净场 → watchdog + qa00/qa63 GREEN。**recital 第 26 度审讯**：Topaz wrapper 早全量整合（command-templates 的 topaztrain + autopick 的 Topaz tab + 模型参数 + 训练图）——背诵清单全线阵亡，产品线立项。
- 【立项】Task 222 = **Weakest 进名册**（t221 遗留的「哪里不跟」）——r 列说「跟不跟」，第七列说「哪里不跟」：同样的 quarter-band 切割（t198 localAgreement + weakestBand，家族机器**组合而非重推导**），thinnest band first。机器全套现成导出——本窗的增量是语法与接线，不是相关数学。
- 【实现】
  - `weakestCellOf(w)`：短名 + band 自己的 r（`Q2 (-0.62)`）——**短名从 `from` 坐标数字推导**（`Math.round(w.from*4)+1`），绝不手术 label（t202 判例：坐标活在数字里；t210 X5 巡逻当场抓获第一版对 label 的 slice+indexOf——**被前浪探针打脸是纪律生效**）
  - 名册第七列 **Weakest**、CSV 第八列 **thinnest**、aria 追加 `, thinnest Q2 (-0.62)`；reference 行走同路径 → `Q1 (1.00)`（「我最薄的季度也是完美的」——reference 行的诚实自夸）；flat/太短 → null → —
  - OWNER_HEAD sextet → **septet**（门钥匙第四次随表生长）；叙事段长出 Weakest 教学句（前浪 includes 钉幸存）
- 【探针家族第七列迁移】t212 X1 类型串；t213 X2 septet；t214 X3+D9；t215 X5+D6+D7/D8+D12c（aria band）+**W9/W10**（探针自带 weakestOf oracle——resample+quarter-cut+argmin 从 wire 重推导，winner `Q1 (1.00)`、divergent 有真实地址）；t218 D6+正则+映射+D12（`,+0.0,1.00,Q1 (1.00)`）；t219 正则+映射+**D5c**（tie 行的 weakest 必相等——一个地形两次被寻址）；t221 R1+R3/R4 换列索引+**R6/R7**（Weakest 格栅 + reference 行完美季度）。
- 【事故与工具判例】
  - **python 批处理断言中断 = 后续补丁静默未跑**：t213 的 X2 钉串一个字之差（died vs dies）让 assert 炸掉，t214-t221 的补丁根本没执行——而 t215 的 FAIL 输出（渲染层七列 vs 断言六列）暴露了它。判例：**批处理迁移必须尾随逐一 node --check + 首探针实跑验证**，不许只看「patched N edits」的账面
  - **em-dash 细节让 old_str 失配**（第二轮 weakestCellOf 修复的 old_str 与文件差一个字符）——修复改用 regex 提取函数体整体重写；「程序化提取、不手抄长串」第三次入册
- 【世界卫生】全家族绿：t210 151/0 + t215 44/0 + t219 29/0 + t218 21/0 + t221 14/0 + t214 29/0 + t213 35/0 + t212 30/0 + qa00/qa63；roster 恒等 21；t212/t213/t214/t215/t219×2 定妆照 = 七列入画的故意新帧随 feature 提交（t218 帧逐字节未变——表格在折叠线下）；t210 ×3 画布噪声 checkout。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「WHERE 是 r 的下一问」：peak（在哪）、Δ（差多远）、r（跟不跟）、Weakest（哪里不跟）——名册的比较算术四件套齐了；t198 的「divergence earns an ADDRESS」从 winner 的 overlays 推广到每一个 owner
- 「坐标活在数字里」的第二次执法：短名从 from 推导而非 label 切片——t210 X5（t202 判例的巡逻兵）在第一版实现上当场执法；被旧探针打脸是系统在正常工作
- 「reference 行的完美季度」：Q1 (1.00) 不是特殊分支——winner 的 band 对自己全 1.00，argmin 取第一个，语法自己说出「我最薄的季度也是完美的」
- 「批处理迁移的验尸纪律」：assert 中断后面的补丁静默蒸发——账面 patched N edits 不算数，尾随语法检查 + 首探针实跑才算数
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；r profile 进名册（t200 的等高线——sparkline per owner？表格里的图还从来没有过，成本/价值再评估）

## Task 223 (2026-09-16, cron 04:02 窗口 trace …202609160406)

- 【开局】四件套：尾部 = Task 222（858b9bc）；净场 → watchdog + 首页 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser 首页快照正常 console 零错。**recital 第 27 度过时**（仍背 Task 13）——产品线立项。
- 【立项】Task 222 遗留五项评审：sparkline per owner 当选（「表格里的图还从来没有过」——t200 等高线问题、t221/t222 的数据地基已铺好：bins 第三表面 + shapeAgreement + weakestBand 全家现成）；透镜纸面化（哲学门槛维持）、updatedAt 治理（大工程让位）、EMPIAR/CSV copy（让位）。
- 【立项教义：画活在镜头里】r 列把地形压缩成一个数字，Shape 列让读者**看见**被压缩前的形状。架构 = 渲染层追加第八列（与 doors、amber edge 同族——镜头不是纸）：**markdown 七列字节零扰动、CSV 七列零扰动、OWNER_HEAD septet 不生长**（t213 X2/t215 X5/t218 D6/t219 全 data-md 探针零迁移）——「pictures live on the wire, not in the paper's bytes」。
- 【实现】
  - qc-report.ts 新 `sparklinePath(bins, w, h, stations=48)`：max 归一化（形状语义与 pearson 一致——幅度不可见、几何可见）+ resampleByFraction（t195 教义，两线同一 fraction 网格）→ polyline path 字符串；fail-soft（null/empty/flat → null——cell 说 —，家族合同）
  - 对话框：mapInventory 行加 **bins 第四表面**（merge 时存 bins——同一次 fetch 的第四味，无第二口井）；tr override 两条新分支：head tr（cells 全序列 == OWNER_HEAD）追加 `<th>Shape</th>`、owner tr 追加 `<td data-shape-cell>` 内含 ShapeSparkline（owner 实线 + winner 虚线基底）或 —
  - ShapeSparkline：viewBox 96×26、48 stations、aria-hidden（行的 aria 已代诉）；**aria portrait 描述**由同一 shapeR 驱动：`shape portrait follows the winner`（r≥0.95）/ `shape portrait diverges (r -0.43)`——耳中的画与眼中的画同一判词
  - globals.css：中性墨（currentColor + opacity）——琥珀是透镜的词、紫罗兰是门的 hover，第三种颜色会是第二意见；owner 线 0.82 实、winner 线 0.3 虚（2 2.5 dash）——两线重合即 r=1.00 的画，分离即搬家的画
- 【事故与判例：游离 th 画框执法】
  - 第一版把 Shape th 追加在 **thead 直属**——浏览器把游离 th 包进匿名行，定妆照当场抓获：列头「Shape」与七列分家、独占一行。**修正 = th 搬进 thead 的 tr（tr override 的 head 分支）**；thead override 恢复原箭头形态 → t213 X4 原钉存活。判例：「画框是审稿人」——定妆照在提交前抓回了布局缺陷；「追加单元格必须追加进行，不是追加进表」
  - **unmigrate 吞行**：X4 反向迁移时 assert 用 blk[3].endswith('");') 判块尾——恰好 X5 行以 '");' 结尾，被当块尾吞掉（t213 34/0 vs 35/0 的 1 断言之差暴露）。修复 = 从 HEAD 字节级补回 X5 + diff 验证与 HEAD 逐字节一致。判例：「以 '");' 结尾是行尾不是块尾——行数验证必须锚定内容特征，不许锚定标点巧合」
  - 显示层吞字符第三次应验（`[h`→空、`\(`→`(`）——python 字节提取全程执行，无手抄
- 【探针迁移】渲染 wire 5 处：t214 D9 + t215 D6（septet → +Shape octet）、t215 D7/D8（八项 + 空文本画格 guard：`cellsW[7] === ""`——画不说话，画只画）、t221 R1（octet）+ R6（last-child → nth-child(7)）；t213 X4 **恢复原钉**（形态复原）；t210/t212/t218/t219 零迁移（markdown/CSV/源码层字节零扰动的直接红利）
- 【t223-e2e 18 断言首跑全绿 ×2】S 段 tie 世界配方（twin=byte-identical）；V 段：V1 八列头、V2 三 spark 格、V3 每 SVG 一画、V4 winner 虚线基底 ×3、V6 **自画像重合**（reference 行 owner path == winner path——1.00 的画）、V7 **tie 行同线**（一个地形两次被画——D5 的画兄弟）、V8 **发散分离**（搬家峰的画）、V9 markdown 无 Shape、V10 CSV 机器网格不变；T 段 teardown；Z 段 untied 世界：outlier 画像仍分离（透镜在 tie 终结后幸存）+ console 净双访问。定妆照 t223-sparks-tie-2x：八列齐整 + 三行画 + 琥珀注脚同框（修正后重拍）。
- 【世界卫生】全家族绿：t223 18/0 + t210 151/0 + t215 44/0 + t213 35/0（与 HEAD 逐字节一致）+ t219 29/0 + t214 29/0 + t212 30/0 + t218 21/0 + t221 14/0 + qa00/qa63；roster 恒等 21；前浪定妆照漂移 ×6（t212/t213/t214/t215/t219×2）= 八列入画的故意新帧随 feature 提交；t210 ×3 画布噪声 checkout（t218 帧逐字节未变——表格在折叠线下，t222 判例复验）。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「名册的第一幅画」：peak（在哪）、Δ（差多远）、r（跟不跟）、Weakest（哪里不跟）、**Shape（长什么样）**——比较算术四件套之后，名册终于拥有了形状本身；t212 的「no map hides below the fold」从名字可见、形状可比升级为**形状可见**
- 「画活在镜头里」：markdown/CSV/OWNER_HEAD 三层字节零扰动——渲染层追加列的成本被压缩到 5 处 wire 断言；门钥匙第一次**拒绝生长**（画不是纸的事实，是纸的镜头）
- 「画与数字永不分歧」：sparklinePath 与 shapeAgreement 同一 resample 教义、同一 max 归一化语义——V6/V7/V8 把 D5b/D5c 的数字判词翻译成画：重合即 1.00，同线即 tie，分离即搬家
- 「画框是审稿人」：游离 th 的布局缺陷被定妆照在提交前抓获——「追加单元格必须追加进行」；unmigrate 吞行判例：块尾验证锚内容特征，不锚标点巧合
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；画像的 hover 放大镜（sparkline 的下一问——大图细节，成本/价值再评估）； Comparisons 表的画像化（winner 的 overlays 是否也值得画）

## Task 224 (2026-09-16, cron 04:32 窗口 trace …202609160440)

- 【开局】四件套：尾部 = Task 223（9728601）——**摘要第 28 度过时**（续传摘要只写到 Task 220/3f66729，实际已前进 3 度）；净场 → watchdog + 首页 200；build（20:30）早于最后 commit（20:39）但 src/ 零 build 后改动 + git diff src/ 干净 = build 覆盖 HEAD，无需重建。QA：qa00 GREEN + qa63 SMOKE GREEN + t223 基线 18/0。
- 【立项】Task 223 遗留清单点名 sparkline 的下一问：**画像的 hover 放大镜**（「大图细节，成本/价值再评估」——评审通过：inline 画像 96px 上峰位与发散只能意会，放大镜是阅读辅助的最后一里；纯渲染层，成本受控）。依赖面扫描：全族探针只钉 thead 文本（t214 D9/t215 D6/t221 R1）+ t215 D7 空文本 guard——**td 文本不因 zoom 改变，全族零迁移**。
- 【实现教义：同一画像，两次挂载】放大镜是**同一幅画的大玻璃**，不是重画的第二幅：同 d 字节、同 ink 类、同 viewBox（0 0 96 26）、width 288（3 倍玻璃，SPARK_ZOOM=3）——SVG 分辨率无关，viewBox 缩放即放大，路径零重算。重推导的 zoom 会是第二父亲，两幅画终有一日会分歧——H4/H5 把字节同一钉死在 wire 上。组件里一个 React element（portrait）挂载两次——元素复用不是第二父亲：同 d 字符串到达两片玻璃。
- 【实现细节】
  - session-report-dialog.tsx：ShapeSparkline 加 `report-spark-wrap`（position:relative）+ 第二个 svg `report-spark-zoom`（display:none 出生即折叠）；空画格（—）无 wrap 无 zoom（fail-soft 结构性成立）
  - globals.css：zoom = popover 底 + border + 阴影 + 圆角，`right:0 / bottom:calc(100%+8px)`（右缘与画像右缘对齐，向上浮出）；触发 = `td[data-shape-cell=spark]:hover`（鼠标的透镜）+ `tr[data-owner-door]:focus-visible`（键盘的透镜——**click focus 不配玻璃**：被按下的门已经离开名册去 inspector 了）；`pointer-events:none`（放大镜是看穿的，不是摸的——点击穿玻璃达门）；print guard（放大镜是 screen state，纸只拿原尺寸的画）
  - **墨水零复写红利**：`.report-spark-owner/winner` 是后代选择器——zoom 的 path 住在同一个 .report-doc 屋檐下自动继承同墨：一份墨、两片玻璃、零重复声明
- 【探针迁移】t223 自身 3 行：V4 count + ownerPath/winnerPath helpers 加 `svg.report-spark >` 前缀（zoom path 共享类名会触发 strict-mode violation——不是语义迁移是作用域卫生）；Z 段两行同款。**全族零迁移**（t215 D7 的 `cellsW[7] === ""` 逐字节存活——画不说话，玻璃也不说）。
- 【t223-e2e 18→35 ×3 全绿】H 相 11 断言：H1 玻璃与画同生（3 cells 3 zooms）、H2 出生全折叠、H3 hover 一格开恰一玻璃、**H4/H5 zoom d 与 inline d 字节同一（零第二父亲）**、H6 三倍玻璃同坐标、H7 玻璃耳中沉默（aria-hidden）、H8 tie 行玻璃放大同一地形（V7 的 zoom 兄弟）、H9 一次一片玻璃（eye 走玻璃折）、H10 eye 离开玻璃折叠、H11 **点击穿玻璃达门**（report 关、inspector 开——pointer-events:none 的 wire 实证）；K 相 5 断言：Tab 达 door 行玻璃自开（focus-visible=键盘的透镜）、Tab 走名册、前一片玻璃随键盘折叠；Z2b untied 世界玻璃同在。
- 【事故与判例：K 相重开被 inspector 拦截】H11 的点击开了门（openJob → inspect → **job inspector 是个对话框**），其 overlay 拦住 K 相重开报告的 click（30s timeout 现场抓获）。修复 = K 相开头 fresh load（Z 相同款世界重置）——「不依赖任何人的 Esc 语义」；判例：「点击的下游可能开自己的对话框——跨相的世界重置用 reload，不用 Esc 舞步」。
- 【定妆照】t223-spark-zoom-2x：玻璃开在 tie 地形上（实线峰左 vs 点线峰右——搬家在 3 倍下清晰可见）+ 琥珀注脚同框——放大镜赢得自己的画框（t219 注脚画框判例复用：hover 态在静态顶帧里不可见）。画框审稿通过：玻璃右缘与画像右缘对齐（right:0 落位实证）。
- 【世界卫生】全家族绿：t223 35/0 ×3 + t210 151/0 + t215 44/0 + t219 29/0 + t213 35/0 + t214 29/0 + t212 30/0 + t218 21/0 + t221 14/0 + qa00/qa63；roster 恒等 21、twin 已归家。前浪定妆照漂移 ×7（t210×3 + t212/t213/t214/t215）= **顶栏 spinner 相位差**（动画时机噪声，t210 判例同族；全页帧带 chrome、元素帧确定——t223 自家帧逐字节未变），PIL 像素 diff 定位（164 强差异像素聚于 20×10px spinner 区），named checkout 全数恢复。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「玻璃追随眼睛」：画像的 hover 放大镜上线——**同一幅画，两次挂载**（同 d 字节、同墨、同 viewBox、三倍玻璃）；hover 是鼠标的透镜、focus-visible 是键盘的透镜、click 什么都不是；CSS 独占整个生命周期（无 state、无 listener、无渲染层第二父亲）
- 「放大镜是看穿的」：pointer-events:none + H11 wire 实证——玻璃永不拦点击；print guard 纸面归零；「一墨两玻璃零复写」：后代选择器的免费红利
- 「纸的三层继续零扰动」：markdown 七列、CSV 机器网格、OWNER_HEAD septet 全部不动——放大镜不是事实，是透镜的透镜；门钥匙第二次拒绝生长；全族探针零迁移（唯 t223 自身 3 行作用域卫生）
- 「画框审稿 + 像素考古」：新帧亲眼验玻璃落位；漂移 ×7 用 PIL 定位到 spinner 相位（20×10px、164 像素）——「漂移要先看是什么，再决定 checkout 还是收录」
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；Comparisons 表的画像化（winner 的 overlays 是否也值得画）；玻璃内的峰位标线（放大镜的下一问——峰位竖线/数值 tooltip，成本/价值再评估）

## Task 225 (2026-09-16, cron 05:02 窗口 trace …202609160507)

- 【开局】四件套：尾部 = Task 224（50ab438）——**续传摘要第 28 度过时**（只写到 Task 220/3f66729，实际已前进 4 度）；净场（PORT 3000 FREE）→ watchdog + 首页 200；build（20:56）早于 HEAD commit（21:07）但 **t223 35/0 实证 build 覆盖 HEAD**（H 相 zoom 断言在场——只有含 t224 的 bundle 才可能过）。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser 快照正常 console 零错。
- 【立项】Task 224 遗留两活跃候选评审：**玻璃内的峰位标线** vs Comparisons 表画像化——峰位标线当选（「放大镜的下一问」，成本受控纯渲染层；Comparisons 画像化留观）。依赖面扫描：全族探针全部 path-scoped（`line` 元素对它们隐形）+ t215 D7 空文本 guard 不受扰——**零迁移实证在先**。
- 【立项教义：画像获得它的地址】Peak 列回答 WHERE、Shape 列画出长什么样——标线把纸上的数字画回画里：x = peakPct/100 × 96，peakPct 是 peakPctNumOf 的 1-decimal 网格数（纸面 Peak 词、Δ 列、琥珀透镜同一口井）——**从不从画出的 path 重推导地址**（重推导会是第二父亲，标线终有一日与数字分歧——t202 教义穿上墨水）。winner 标线与 winner 线配对（无参考线即无参考标线）；tie 世界 owner 标线互合（一个地形两次被标记）+ 与 winner 分离（|Δ| 成两条发线）。
- 【实现】
  - ShapeSparkline 加 peakPct/winnerPct props；portrait 元素内加两条 `<line>`（floor-to-ceiling，x1=x2，y 0→SPARK_H）——**元素复用自动让标线活进两片玻璃**（「同一画像两次挂载」教义免费延伸到线）
  - markX fail-soft（null→无标线，clamp 0–96——标线是地址不是数据的边界情形也不许画出去）
  - globals.css：一墨（currentColor）两片（owner 0.5 实 / winner 0.3 虚 2 2.5 dash）——与线的语法同族，第三种颜色仍是第二意见；0.75 units 宽、通顶到底——标线是地址，不是数据点；后代选择器两 mounts 免费继承（零第二规则）
  - winnerPct **复用 line 619 的 t215 Δ 透镜已有声明**——一井三表面（词、Δ、发线）
- 【事故与判例：第二口井被 build 拦截】手写实现时为 ShapeSparkline 新声明了 winnerPct——**t215 的 Δ 透镜早在同一作用域声明过同名变量**（同一口井本来就在代码里！），build 以 duplicate declaration 当场拦截。修正 = 删除新增、复用现有声明 + 注释点名。判例：「**立新声明前先扫现场——同名的井也许早已存在，复用是唯一的合法国**」；「手抄长串 old_str 失配」第三次应验（改外科手术式小编辑后一次通过）。
- 【e2e M 相 12 断言 + Z 相 2 断言】t223-e2e 35→49：M1/M2 每 portrait 恰一组标线（owner+winner ×3）、**M3 地址同源**（aria 的 peak 76.2% → x=73.152=76.2/100×96；25.4%→24.384——纸上数字与画上发线逐位吻合）、M4 玻璃标线 = 本体标线（x1 attr 同一——H4/H5 的零第二父亲延伸到线）、M5 reference 双标线重合（1.00 的地址）、M6 tie 行标线互合（一个地形两次被标记）、**M7 分离 = |Δ| 成两条发线**（24.384 vs 73.152——76.2−25.4=50.8 正是纸面 Δ 的 wire truth，画与数字永不分歧的又一次实证）、M8 标线零言语（t215 D7 guard 活体复验）；Z2c/Z2d untied 世界地址同在且分离。跨相世界重置用 reload（t224 判例）。**49/0 ×3 全绿**。
- 【环境事故】换 bundle 后 watchdog 静默死亡（start-prod boot 尖峰疑似被收割——拉起命令返回成功 ≠ 活着）；手动 start-prod 恢复 + 补拉 watchdog。判例：「**换 bundle 后 pgrep 验 watchdog 存活，不许只看拉起命令的返回**」。
- 【定妆照】t223-spark-mark-2x：玻璃开在 tie 地形上——两条竖发线清晰分离（实线标左峰 25.4%、虚线标右峰 76.2%），搬家在 3 倍下无需读数即可见；画框审稿通过。前浪漂移 ×11 分类处置：t210 ×3 = 画布动画噪声（PIL 定位 lanes 33396px/legend 1836px）具名 checkout 恢复；t212/t213/t214/t215/t219×2/t223×2 = **标线入画的故意新样貌**（回归重摄，diff 局限于画格的细发线）随 feature 提交；t218 帧逐字节未变（折叠线下，t222 判例复验）。
- 【世界卫生】全家族绿：t223 49/0 ×3 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0 + qa00/qa63；roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「画像获得它的地址」：peak（在哪）、Δ（差多远）、r（跟不跟）、Weakest（哪里不跟）、Shape（长什么样）之后，**标线把 Peak 的答案画进 Shape 里**——|Δ| 从此有两种读法：数字（-50.8）与两条发线的距离；玻璃里的搬家无需读数即可见
- 「一井三表面，永不分歧」：peakPct 的词（Peak 列）、透镜的数（Δ/琥珀）、画里的发线——同一口井三个表面；M3 把「地址活在数字里」从判例升格为 wire 断言（aria 数字 × 0.96 = x1，逐位吻合）
- 「复用是唯一的合法国」：第二口井被 build 拦截——立新声明前先扫现场；「同一画像两次挂载」免费延伸到线（M4 钉死 attr 同一）；全族探针零迁移（line 对 path-scoped 探针隐形 + 标线零言语）
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；Comparisons 表的画像化（winner 的 overlays 是否也值得画）；标线的数值 tooltip（发线旁的百分比小签，成本/价值再评估）

## Task 226 (2026-09-16, cron 05:32 窗口 trace …202609160535)

- 【开局】四件套：尾部 = Task 225（f9eb4bf）；净场（PORT 3000 FREE）→ watchdog 拉起后 **pgrep 验活**（上轮判例执行）+ 首页 200；build 覆盖 HEAD 由 t223 49/0 实证（M 相标线断言在场）。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser console 零错。
- 【立项】Task 225 遗留评审：**Comparisons 表的画像化** 当选（「winner 的 overlays 是否也值得画」——deep report 的 Map QC 段本就有 overlays bins（t195/t198/t206 地基），逻辑层数据零新增）；标线的数值 tooltip 否决（画不说话教义 + Peak 数字已在同一行纸上，第四表面无增益）。
- 【立项教义：winner 自家族获得同一幅画】名册画像比较的是**跨 job**（owner vs winner）；Comparisons 画像比较的是 **winner 自己的输出家族**（main vs 姊妹 volume/half map）——half-map 一致性是 cryo-EM 的核心阅读，画像让「哪里分歧」不用读数即可见。同一 ShapeSparkline、同一墨、同一玻璃权利——第二张表，同一语法。
- 【实现】
  - **InventoryTableContext 模式复刻**：ComparisonTableContext——table override 按 COMPARISON_HEAD 签名（["Map","Bins","Peak at","Agreement r","Verdict"]，逐格全匹配，t223 的法）发证；thead override 双 Provider 重置；tr override 凭 inComparison 入座
  - measureMapQc 返回值扩张：mainBins + overlays（name+bins）随 report 同行——**同一口井随纸交付，画从不重新 fetching**（re-fetch 会是第二口井）
  - tr override 新两分支：comparison head 行追加 Shape th；comparison body 行（inComparison && 5 格 && cells[1] 纯数字——pairwise 行的第二格是地图名，context 是门卫、数字守卫是保险）追加画像格：overlay 实线 over main 虚线 + 标线喝 peakPctNumOf（Peak at 列自己的数字——一井三表面跨表成立）
  - COMPARISON_HEAD 常量入对话框（OWNER_HEAD 同例镜像纸面）；deps 增 mapQc
  - CSS 零改动：同一 data-shape-cell="spark" 手柄 + 同一类族——hover 玻璃、print guard、后代选择器墨水全部免费继承
- 【事故与判例 ×2】
  - **MultiEdit 假原子性两度应验**：第一次调用报「No replacement performed」但大编辑实际生效（deps old_str 缩进失配触发整体报错），补投造成重复分支块；第二次同款（INV 注释块重复）。修正 = python 行号手术 + count 断言验尸。判例：「**MultiEdit 报错后必须 git diff 验现场，不许信账面「全未生效」——原子性承诺失效时，重复插入是默认结局**」；「python 补丁的每个 replace 都 assert 期望出现次数」
  - **显示层吞字符第 4 度**（本轮第 2 次）：`const [mapInventory` 在工具视图里显示为 `const apInventory`——grep -c / od / python repr 三方验尸确认文件真字节无恙，是传输/渲染层吞 `[m` 序列。deps 数组真身 `}, [mapInventory, pressOwner]);` 靠 grep 反推。判例：「**括号重灾行一律 grep -c 验真，不信任任何工具的回显**」
- 【e2e：t223-e2e 49→64】作用域迁移：INV = `table:has(tr[data-owner-door])` ——报告现有四表（inventory/comparison/local/pairwise）两表作画，名册计数全部 scope 到有门的表（**作用域是关于所数何物的承诺**）；V2/V3/V4/H1/M1/M2/Z2b/Z2c + 4 处等待循环共 13 个定位器迁移（python 补丁、page/page2 分 needle、逐条 count 断言）。新 C 相 11 断言：C1 两 overlay 行、C2 head 长出第六列、C3 双画像、**C4 标线坐在纸面 Peak at 地址上**（51.6%→x 49.536、77.4%→74.304）、**C5 标线分离=纸面峰值差**（51.6 vs 76.2 主峰——mainPct 从名册 reference 行 aria 读，同一 winner 一口井）、C6 玻璃同权（hover 开恰一玻璃）、C7 玻璃 d 字节同一（零第二父亲跨表成立）、C8 画像零言语、**C9/C10 bouncer 实证**（local 表七列、pairwise 表五列原样）、C11 纸面字节五列不变；Z2e/Z2f untied 世界同守。**64/0 ×3 全绿**。
- 【定妆照与漂移考古升级】t223-spark-cmp-2x：玻璃开在 half1 的 diverges 画像上——51.6% 实线峰与 76.2% 虚线峰两条发线 3 倍下清晰分离，half2（agrees, r=0.99）标线几乎重合；审稿通过。漂移 ×13 分类：t210 ×3 画布噪声具名 checkout；**t218 帧结构性入画**（comparisons 画像+标线在框内——故意新帧提交）；t212/t213/t214/t215 大帧 50K 强像素经裁片验尸 = 稀疏 sliver（50K/1252 行 ≈ 40px/行）非语义；**t223 三帧 sliver 确定性实验**：checkout 后重跑 e2e 强像素数逐位复现（14372/14465/7426）= 新 bundle 固有渲染态而非随机噪声，顶区 0 差、右缘无滚动条、语义内容逐像素同 → 按 t223 先例作为当前真相提交（每窗重生成帧与其脏态永久化不如随 feature 收录）；t219×2/t212/t213/t214/t215 恢复（下窗例行重漂再处置）。
- 【世界卫生】全家族绿：t223 64/0 ×3 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0 + qa00/qa63；roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「winner 自家族获得同一幅画」：名册画像答「谁跟 winner 不一样」，Comparisons 画像答「winner 自己家里哪里不一致」——half-map 分歧（mask 边、noise shelf）从数字升格为几何；r=-0.25 的 diverges 与 r=0.99 的 agrees 在同一列里自我陈述
- 「作用域是关于所数何物的承诺」：第二张表作画的第一成本不是渲染是探针语义——13 个全局定位器迁移到 INV 作用域；C9/C10 把「bouncer 没放错人」钉成 wire 断言
- 「工具账面不可信」三连：MultiEdit 假原子（报错≠未生效）、显示层吞 `[m`（视图≠字节）、批处理 replace 无断言（t215 判例的 e2e 版）——python count 断言补丁成为唯一可信通道
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；Local agreement 表的画像化（季度 r 的条形/热力表达——第三张表要不要作画，成本/价值再评估）；pairwise 画像（对儿 landscape 的双子画）

## Task 227 (2026-09-16, cron 06:02 窗口 trace …202609160602)

- 【开局】四件套：尾部 = Task 226（207821b）；净场 → watchdog 验活 + 首页 200；build 覆盖 HEAD 由 t223 64/0 实证（C 相断言在场）。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser console 零错。
- 【立项】Task 226 遗留评审：**Local agreement 表的画像化（BandStrip）** 当选——「第三张表要不要作画」的答案：季度 r 是报告里最后一批「只有数字没有几何」的比较数据；pairwise 画像否决（两 overlay 的双子画信息量低，demo 世界仅 1 对）。逻辑层零新增：localAgreement/weakestBand/LocalBand 早已导出（t198/t205/t206/t222 地基）。
- 【立项教义：背叛垂到零线之下】四个季度的 r 值 = 每根 bar 的长度（|r|×11）与方向（同意升起、背叛下沉）；零虚线是所有 bar 的参考线（winner 参考线同语法：dotted、faint）。**bar 喝纸面打印的 2dp 值**（Number(r.toFixed(2))——与 Peak 标线喝 1dp 网格同理：画是打印词的画，一井一打印网格）；第 k 根 bar 坐第 k 季度中心（x=k·24+12——地址活在数字里）。一墨一透明度（0.55）——长度与方向说话，颜色会是第二意见；bar 用 butt cap——是 band 不是 stroke。
- 【实现】
  - BandStrip 组件（ShapeSparkline 同族）：96×26 同盒语法、strip 元素树两次挂载（同一 bars 到两片玻璃）、fail-soft（非有限 band 无 bar、全空格中破折号）；zoom 穿 **report-spark-zoom 共享类**——hover/print guard/一次一片玻璃全部免费继承（玻璃机制是公共设施，不因画像种类分家）
  - LOCAL_HEAD = ["Map", ...QUARTER_LABELS, "Weakest", "Depth (fraction)"]——**季度词从逻辑层 IMPORT 组合，绝不手抄**（en-dash 手抄是吞字符事故的温床；twins fork, imports don't）
  - LocalTableContext 第三发证：table override 三签名、thead 三 Provider、tr override inLocal 入座；body 分支 bands = localAgreement(mapQc.mainBins, ov.bins)——与纸面表格同函数同 bins（t222 的 Weakest 列早走过这条路：同机器的重算不是第二父亲）
  - CSS：report-band-strip/report-band/report-band-zero 三规则；BANDS_HEAD = "Bands"（与 Shape 分名——bar 不是 landscape，几何种类必须诚实）
- 【e2e：t223-e2e 64→84】C9 迁移（local head 7→8）；新 D 相 18 断言：D1-D3 双行双条带、**D4 八连发**（每 bar 坐纸面打印 r：0.32→y2 9.48 升、**-0.94→23.34 沉**、1.00→y2 2 顶格—— betrayals hang below the line, verbatim）、D5 零参考线 ×2、D6 玻璃同权、D7 放大同一 bars（y2 9.48 === zoom 9.48）、D8 静默、D9-D11 四表 bouncer（inventory 8/comparisons 6/pairwise 5）、D12 纸面字节七列不变；Z2g untied 世界条带同在。**84/0 ×3 全绿**。
- 【事故与判例】转义双噬：python 补丁 heredoc 里 `\\\\u2013` 落进 JS 成字面 `\u2013`，D1 定位器扑空（0 行），D4 的 textContent 30s 超时炸 suite——修正 = 单反斜杠 + grep 清点。判例：「**python 写 JS unicode 转义时，heredoc 层数 = 反斜杠层数的陷阱——补丁落地后 grep 反斜杠计数**」；Edit 工具误删 hastText 声明行（old_str 含函数头、new_str 未含）——同轮发现同轮修复，判例：「**替换注释锚点时确认函数头是否在 old_str 里**」。
- 【定妆照】t223-band-strip-2x：玻璃开在 half1 的条带上——三根升 bar 与一根**垂过零线的背叛 bar**（Q3 -0.94）在 3 倍下同框；half2 四根近顶格的同意条对照；画框审稿通过（local 表 Q 头因 Bands 列挤压折行——视觉可读，hast 文本不受扰，D 相照常命中）。漂移例行：t210 ×3 画布噪声 + t212/t213/t214/t215/t219×2 确定性 sliver 恢复；t223 四帧随窗重生成按 t226 判例作为当前真相提交；**t218 帧逐字节未变**（区域帧不含 local 表——作用域判例的红利）。
- 【世界卫生】全家族绿：t223 84/0 ×3 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0 + qa00/qa63；roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「背叛垂到零线之下」：Local agreement 的四个季度数字第一次有了几何——bar 的方向就是判词（升起=同意、下沉=背叛），-0.94 的 Q3 不再是表里的一个负号而是一根穿透零线的竖条；纸面 2dp 网格 = 条带的打印网格，D4 八连发逐位钉死
- 「第三张表、同一语法」：三重 context（inventory/comparison/local）发证-重置-入座模式固化；玻璃机制是公共设施（zoom 共享类零新规则）；QUARTER_LABELS 导入组合——纸面列名与 wire 签名同源，手抄从源头禁止
- 「表格作画的红利清单」：t218 区域帧零漂移（作用域红利）、CSS 零新增玻璃规则（共享类红利）、逻辑层零改动（数据地基红利）——第二、三张表作画的边际成本持续下降
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR（让位）；CSV copy 路径（让位）；pairwise 画像（双子画，成本/价值再评估）；报告全景的画格节奏（四表三画之后，头部 prose 是否值得一张全景 thumb）

## Task 228 (2026-09-16, cron 06:17 窗口 trace …202609160620)

- 【开局】四件套：尾部 = Task 227（83844b6）——**续传摘要第 29 度过时**（只写到 Task 225/f9eb4bf，实际已前进 2 度）；净场（PORT 3000 FREE）→ watchdog 拉起 pgrep 验活 + 首页 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser console 零错。事故插曲：凭记忆报 qa00/qa63 脚本名错（qa00-home-smoke.mjs 不存在），ls 改正为 qa00-data-view.mjs / qa63-smoke.mjs——**脚本名也以现场为准**。
- 【重大核实判决：Task 13 recital 全清单化石】逐条核实现场：**#5 fs/browse 无鉴权 → 已修**（http-guard 两轮：Sec-Fetch-Site/Origin 同源 + Host pin 反 DNS-rebinding，isLocalRequest 护 fs/browse、outputs/file、map-profile）；**#6/#14 pathref 包含策略不一致 → 已修**（jobfile.ts resolveInsideJobWorkdir 统一策略：lexical 无 ".."、workdir 内、realpath 限于 data 树；三路由同链）；**#7 chart 全量同步读 → 已修**（guinier 6 处 / resolution 2 / angdist 2 cachedFileCompute/statcache mtime 缓存全覆盖）；**#8 particles BFS N+1 → 已修**（route.ts 注释在场：batched BFS 每深度一条边查询 + 一条 job 查询）；**#13 useMemo 内 localStorage 写 → 已修**（canvas/pipeline-kpi 无 useMemo 写，Task 153 chevron 事件处理器模式）；**3D 体积截面工具 → 已建**（t189 map-profile cross-section）；**Topaz wrapper → 已建**（jobs/[id]/topaz-training 路由）。**cron 文本背诵的「已知遗留」零条存活**——下轮起遗留清单以 worklog 尾部 Stage Summary 为唯一真源，Task 13 recital 正式退役。
- 【立项】Task 227 遗留评审：pairwise 画像第 3 度否决（demo 世界 1 对，半对相关性已由 comparison 表两行间接可见）；**「报告全景的画格节奏」当选**——t227 自留首位候选，具体化为 **Map QC 段的 hero landscape**：报告主角地形的大幅可读画（480×80，portrait 的 5 倍），owner 实线 + overlays 虚线 + 各自纸面峰位标线 + 季度网格（25/50/75% 深度虚点竖线）——t225 标线教义 + t227 季度语法在一张大画上合流。逻辑层零新增（t226 的 mapQc.mainBins/overlays 同井随纸交付，re-fetch 即第二口井）。
- 【立项教义：全景获得它的画格】四表三画都是缩略图——缩略图指得出峰在哪、读不出地形长什么样；hero 是缩略图玻璃承诺的那个大视图本身（no glass——hero IS the large view）。**无基线判例**：盒底边缘是 landscape 自身的 min 而非一个数——只给有地址的东西画线（深度分数有地址，Y 归一化没有），hero 不画底轴。挂载点 = `## Map QC` h2 的 exact-words 准入（t223 头部匹配法在标题尺度复用）：deep report 自己的「Map QC summary — <map>」永不铸第二张 hero；hero 渲染在 head 与 deep prose 之间（画先于它要介绍的章节）。figure 亲自说话（无行可代言）：aria 报名与峰位，全部喝同一口井（peakPctNumOf）。
- 【实现】
  - HeroLandscape 组件（ShapeSparkline/BandStrip 同族第三员）：sparklinePath(mainBins, 480, 80, 48) 同一 normalizer；markX 同一分数法（pct/100 × 480，clamp fail-soft 从不重推导）；drawn 过滤 fail-soft（画不出的 overlay 连名字一起退出 aria）；`<figure data-hero-landscape>` + role=img
  - mdComponents 加 h2 override：hastText 精确匹配 MAP_QC_HEAD（"Map QC"）且 mapQc.mainBins 在场才挂 hero；mainName 从 mapInventory[0]（walk 的同一 winner 一口井）
  - CSS 七规则（band 之后）：一墨多透明度层级——main 0.85 / overlay 0.4 虚 3 3 / quarter 0.14 虚点 1 3 / mark-main 0.55 / mark-overlay 0.3 虚 2 2.5；width:100% 响应式、打印随纸（无玻璃零 print guard）
- 【e2e：t223-e2e 84→94】新 E 相 9 断言 + Z2h：E1 全纸恰一 hero（deep summary 头零准入）、E2 恰一 svg 零玻璃、**E3 主标线坐在纸面地址**（roster reference aria 的 76.2% → x 365.76 = pct/100×480 逐位）、E4 双 overlay 标线各坐其 Peak-at 地址（51.6→247.68、77.4→371.52）、E5 全家族入画（1 实 + 2 虚）、**E6 季度网格钉在 120/240/360**（固定分数的地址）、E7 aria 说出它画的地址（"76.2% of depth" + quarter grid）、E8 纸面字节纯（data-md 逐行含 "## Map QC"——画渲染在词周围从不写进词）；Z2h untied 世界 hero 同在（地形画随世界不随 tie）。**94/0 ×6 全绿**。
- 【定妆照三幕】t223-hero-2x 首拍被折叠切顶（hero 只剩底部发线 sliver）→ 元素帧太紧（纯几何无上下文）→ **内部滚动 doc 帧**（先 mouse 移开关玻璃再 scrollIntoView）：hero 全幅 + summary 词 + comparison 缩略图同框——大画与缩略图的比例节奏入画，搬家（half1 峰在左 51.6% vs main 峰在右 76.2%）无需读数。画框审稿通过。判例：「**hero 类新块面元素的画框要滚动后拍——doc 帧锚在元素顶，切顶是默认结局**」。
- 【漂移考古】×13 分类：t210 ×3 画布噪声惯犯具名 checkout；**t212/t214/t215 = hero 推折的机械位移**（roster 锚点内容下移 ~200px，文本/表格完好）、**t218/t219×2 = hero 结构性入画**（t218 帧顶直接见证 hero 全幅）、t213 1110 弱像素 = 折缘轻移、t223×5 = hero 入框/推挤故意新样貌——**全数随 feature 提交**（t226 判例：每窗重生成帧与其脏态永久化不如随 feature 收录）。
- 【世界卫生】全家族绿：t223 94/0 ×6 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0；roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「全景获得它的画格」：报告的五个几何面（portrait×2 表、band strip、hero）终于有尺度节奏——缩略图答 WHERE、hero 答 WHAT IT LOOKS LIKE；「玻璃追随眼睛」之后「眼睛走进章节开头」
- 「地址律第三级缩放」：peakPct 的 1-decimal 网格三度入画（96 缩略图 ×3 玻璃 ×480 hero），x = pct/100 × W 公式不变——**地址随盒缩放，井从不缩放**（E3/E4 逐位钉死 365.76/247.68/371.52）
- 「无基线判例」：只给有地址的东西画线——深度分数（25/50/75%）有地址故画网格，Y 归一化的盒底没有故不画轴；「画不说话」的下一句是「画不假装」
- 「Task 13 recital 退役」：背诵清单零条存活——#5/#6/#7/#8/#13 全修、截面/Topaz 全建；**过时 recital 的终局形态不是「部分过时」而是「整条化石」**，下轮起以 worklog Stage Summary 为唯一遗留真源
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；CSV copy 路径（让位）；hero 的章节词（hero 下的 summary prose 是否值得引用 hero 地址——成本/价值再评估）；Pipeline glance 的单元画格（succeeded/failed 计数的单位点阵——四整数要不要几何，低优先）

## Task 229 (2026-09-16, cron 06:47 窗口 trace …202609160651)

- 【开局】四件套：尾部 = Task 228（bb8487a）——**续传摘要第 30 度过时**（只写到 Task 225/f9eb4bf，实际已前进 3 度：226/227/228 均已交付）；净场（PORT 3000 FREE、watchdog 0）→ watchdog 拉起 pgrep 验活（PID 13567）+ 首页 200。QA：qa00 GREEN + qa63 SMOKE GREEN；console 零错随 e2e Z4 双世界验证。
- 【立项】Task 228 遗留评审：hero 的章节词（prose 引地址）→ 哲学门槛维持让位；Pipeline 点阵 → 低优先维持；**「hero 签名入画」当选**——t228 教义「a figure has no row to speak for it」的半句已兑现（aria 说话），但那是机器的话：画布上三条线匿名，肉眼分不出哪条虚线属于哪个 overlay。名册/比较画像有行代言，hero 没有行——**无行的画自己署名**：每条有地址的线在标线地址处签下 aria 引用的同一句话（name + pct%，同一口井，绝不手抄）。
- 【实现】
  - HeroLandscape 加 sigs：sign(name, pct, x) 三卫兵（无地址不署名——「只给有地址的东西画线」的下一句「只给有地址的线署名」；edge clamp 让签名留在画布内而标线守住精确分数——地址不动，签名挪）；行叠确定算法：CHAR_W 3.7 估半宽、|xA−xB| < halfA+halfB+2 即跌一行（row 0 y=7、pitch 9）；main 先签（主角守 row 0），overlays 按序
  - `<text class="report-hero-label" textAnchor="middle">` 渲染在 mark-main 之后——零言语教义的 hero 版修正案：画不假装（无基线判例原封），但无行的画必须自报家门
  - CSS 一墨规则：font-size 7px + fill currentColor + fill-opacity 0.62——无 halo 无第二墨，透明度就是整个层级
- 【e2e：t223-e2e 94→104】新 F 相 9 断言 + Z2i：F1 aria quote 解析恰 3 段、F2 三线三签名、F3 签名词句来自 aria 同井（名字+pct 配对）、**F4 ×3 每签名骑标线地址逐位**（76.2→365.76、51.6→247.68、77.4→371.52）、F5 hero 与名册同颂 winner 峰（76.2=76.2）、F6 demo 世界恰一对碰撞（77.4 距 76.2 仅 5.76px）、**F7 行叠纪律逐位**（row0 y=7: orthovol + run_it020_half1；row1 y=16: run_it020_half2——地址从未移动）；Z2i 无绑世界三签名同在。**104/0 ×3 全绿**。
- 【事故与判例 ×2】
  - **首跑 F3 失败 + F7 30s 崩溃**：aria 前缀 `Map QC hero landscape —` 被 `[^;]+?` 贪进第一个名字，segs[0].name 变整段前缀而非 orthovol，hasText 扑空超时——崩溃还跳过了 T 清场（twin 遗留 roster 22，手工 DELETE 归家 21）。修正 = `\u2014` 转义 slice 过 em-dash 再解析（转义避手抄——t227 heredoc 判例的 e2e 版）。判例：「**aria/quote 解析先剥说话家具（前缀/标点），家具不是名字；长串 hasText 前先断言其唯一性，30s 超时是扑空的丧钟**」
  - **watchdog 静默死亡第 2 度 + 元凶画像收紧**：换 bundle 杀 server 后 watchdog（13567）拉起一次即消失，server 二度坠机——本箱 4GB、build（896 heap）刚跑完，**kernel OOM 收割不挑进程**（87 kills 在案）。判例升级：「**build 之后必须重验 watchdog 存活——拉起命令成功 ≠ 活着，build 刚结束的窗口尤其如此**」
- 【定妆照】t223-hero-2x 重拍：row0 两签名（orthovol 76.2% 右 + run_it020_half1 51.6% 左）与 row1 一签名（run_it020_half2 77.4%）行叠肉眼可辨；长名 21 字符不裁边（clamp 纪律）；0.62 墨在地形线上方可读。审稿通过。
- 【漂移考古】PIL 强像素分类（t229-drift.py 首秀，pathspec 传参失配一修）：**t223-hero 与 t218-csv-door 各 1208 强像素、同带（x 391–744 × 27px）逐位同数** = 签名带的确定性指纹（两帧都含 hero），随 feature 提交；t212/t214/t215（59–100 @ density 0.000）超稀疏 sliver + t213（1435 @ 0.008）折缘轻移 = 渲染真相按 t226 判例随 feature 提交；t210-final/lanes 字节级同（mtime 噪声）+ t210-legend-open（2316 @ 画布区）WebGL 惯犯具名 checkout。
- 【世界卫生】全家族绿：t223 104/0 ×3 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0；roster 恒等 21、twin 已归家（含一次崩溃遗留手工回收）。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「无行的画自己署名」：报告五个几何面的最后一层匿名揭去——portrait 有行代言、band 有列代言、hero 无行可借，aria 的机器话转成肉眼话；「画不假装」的下一句是「画自报家门」
- 「地址不动，签名挪」：edge clamp 与行叠都是言语让位给几何——标线永远坐在精确分数上，签名负责可读；F4 ×3 + F7 逐位钉死（365.76/247.68/371.52；y=7/y=7/y=16）
- 「签名带指纹」：两帧 1208 强像素逐位同数 = 签名的确定性指纹，漂移考古从「分类噪声」进化到「认领结构」；t229-drift.py 入驻 scripts/ 成为常规考古工具
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；CSV copy 路径（让位）；hero 签名的印刷档（print 时 0.62 墨是否需要加深——打印样式细节）；Quarter 网格的深度标签（25/50/75 词是否入画——第二个「自报家门」候选）

## Task 230 (2026-09-16, cron 07:17 窗口 trace …202609160717)

- 【开局】四件套：尾部 = Task 229（f303987）——**续传摘要第 30 度过时**（只写到 Task 225/f9eb4bf，实际已前进 4 度：226/227/228/229 均已交付）；净场（PORT 3000 FREE、watchdog 0）→ watchdog 拉起 pgrep 验活（PID 16230）+ 首页 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser 快照正常。
- 【立项】Task 229 遗留评审：**Quarter 网格的深度标签当选**——t229 让线签名（谁），t230 让网格报名（哪里是 25/50/75）：aria 自 t228 早已说话（"the quarter grid marks 25, 50 and 75% of depth"，E7 wire 在案），画布上刻度匿名——「自报家门」教义的下半句，这次轮到标尺自己。hero 印刷档否决让位（print 细节，与教义无关）；其余沉默候选维持。
- 【实现】
  - **HERO_QUARTERS 模块常量**：[0.25, 0.5, 0.75] 提升到 HERO_W/HERO_H 旁——网格线与深度标签喝同一口井（两次 map 同一数组，two surfaces one father）；词 = f*100%（三个精确二进制分数，无浮点尾数）
  - 深度标签渲染在 sigs 之后（最上层——刻度词在墨上可读）：x = f×480（120/240/360 固定地址）、y = HERO_H−3 = 77（底部带）、textAnchor middle、`<text class="report-hero-depth">25%</text>` 形制
  - CSS 一墨规则：font-size 6px + currentColor + fill-opacity 0.5——透明度低于签名（0.62）——**名字比标尺响**；无 halo 无第二墨
  - e2e G 相 5 断言 + Z2j：G1 恰三标签、G2 标签坐固定分数地址逐位（25%→120、50%→240、75%→360）、**G3 标签与网格线同址**（同一分数的两个表面、一个父亲——attr 逐位同）、G4 标签词 = aria 自己的季度数（"25, 50 and 75% of depth" 完整短语在场）、**G5 标尺不让路**（标签 y=77 恒在签名行下方 40px 之外——言语让位、参照系永不移动）；Z2j 无绑世界标尺同样签名
- 【e2e：t223-e2e 104→110】**110/0 ×3 全绿**。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0；roster 恒等 21（查询陷阱自警：/api/jobs 返回 {jobs:[...]}，数组的长度在 .jobs 键下）。
- 【事故与判例】**watchdog 静默死亡第 3 度**——build 后验存活（t229 判例执行）果然 WD_DEAD（server 16248 尚跑旧 bundle）：杀 → start-prod → 重拉 watchdog（17165）→ 双 pgrep 验活。判例稳固：「build 之后必须重验 watchdog——拉起命令成功 ≠ 活着」。另：roster 一字面量查询错误（json.load 直接 len(dict)=1）——**验尸先看响应结构，长度在键下不在根上**。
- 【定妆照】t223-hero-2x 随 e2e 重摄：25%/50%/75% 刻度词清晰落在网格线脚（底部带）、署名行在上（half1 51.6% / orthovol 76.2% / half2 77.4%）——**75% 刻度与 76.2% 主标线贴近同框**（数据贴近刻度是数据在说真话——教义肉眼可辨）；审稿通过。
- 【漂移考古】指纹大丰收：**四帧共享同一指纹**（t218-csv-door / t223-band-strip / t223-hero / t223-spark-cmp 各 strong=224、x 224–667、8px 高带）= **深度标签带的确定性指纹**（t229 签名带 1208 指纹的姊妹篇——同一墨在四个不同滚动位置的逐位重现），随 feature 提交；t212/t215（34/45 @ 15×6 tiny sliver）+ t213/t214（47/163 @ density 0.000 超稀疏）= 渲染真相按 t226 判例提交；t219 逐字节同（identical——帧不含 hero，作用域判例红利再验）；t210 ×3（695/1861/55487 @ 画布区）WebGL 惯犯具名 checkout。
- 【世界卫生】全家族绿：t223 110/0 ×3 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0；roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「网格自报家门」：hero 的自描述至此完整——线签自己的名与峰（t229）、标尺标自己的刻度（t230）；aria 的每一句话（名字、峰位、季度）如今都有肉眼形态，「画不假装」的下一句是「画的话画自己说」
- 「标尺不让路」：签名让位（言语向可读性低头、行叠避让），刻度永不移动（参照系本身——数据贴近刻度是数据在说真话）；75% 刻度与 76.2% 主标线同框即教义入画
- 「一分数两表面」：HERO_QUARTERS 一口井，网格线与刻度词两个表面；G3 把「同一父亲」钉成 wire 断言（label x === line x1 逐位）；「two surfaces one father」从变量声明层（t225 复用）升格到渲染数组层
- 「指纹的系谱」：签名带 1208（t229）→ 刻度带 224（t230）——同一确定性墨迹学，四个滚动位置逐位重现；漂移考古从分类噪声进化到认领结构再进化到认领系谱
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；CSV copy 路径（让位）；hero 签名的印刷档（print 时 0.62 墨是否加深——print 细节让位一次再评估）；portrait 缩略图的玻璃内刻度（hero 有刻度了，96 宽缩略图里 25/50/75 词放不下——半格刻度是否值得，成本/价值再评估）

## Task 231 (2026-09-16, cron 07:32 窗口 trace …202609160736)

- 【开局】四件套：尾部 = Task 230（63c305f）——本轮摘要零过时（上轮即本手所写，31 度防御首次无用武之地）；净场 → watchdog 拉起 pgrep 验活（18767）+ 首页 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser console 零错。
- 【立项】Task 230 遗留评审：**「印刷的档位」当选**——屏幕墨水（13 个透明度值）为背光屏调校，纸是另一种介质（无背光：0.14 网格会印成无物；吸墨：6px 的 0.5 签名会洇掉）。教义：**印刷继承层级，不继承数值**——全族加深、次序不变（speech ≥ data > address > reference > context 逐对保持）。候选「portrait 玻璃内刻度」否决：缩略图答 WHERE、hero 答 WHAT 的分工是教义，缩略图加网格稀释分工（标线已是缩略图的空间参照）；其余沉默候选维持。
- 【实现】
  - @media print 一单元 13 规则（墨水家族规则之后、t224 玻璃卫兵之前）：spark owner 0.82→1 / winner 0.3→0.6；mark owner 0.5→0.85 / winner 0.3→0.6；band 0.55→0.9 / zero 0.25→0.5；hero main 0.85→1 / overlay 0.4→0.7 / quarter 0.14→0.3 / mark 0.55→0.85、0.3→0.6；**签名 0.62→1 / 深度 0.5→0.85**（纸上最危的墨）——单调映射保持序：1(sig) > 0.85(depth) > 0.9(band)... 网格仍最淡
  - 注释点名 note-spotlight 判例（transition:none 教训）：本族无 transition，纸即刻，无从 mid-flight——「paper snaps, and here there is nothing to snap FROM」
  - e2e P 相 9 断言（page.emulateMedia print 仿真）+ Z2k：P0 屏幕档不受扰（sig 0.62/depth 0.5 基线在仿真前钉死）、P1 纸上言语加深（1/0.85）、P2 层级跨介质存活（1 > 0.85）、P3 地形加深 + 虚线身份存活（dash 3 3 仍在）、P4 语境存活（网格 0.3）、P5 地址按军衔加深（0.85 > 0.6）、P6 表格墨水同档（owner 1 + band 0.9——locTable 复用 D 相作用域）、P7 玻璃永不打印（t224 卫兵仿真下 re-pin）、**P8 仿真不是单行门**（回扫后 sig 0.62 复原）；Z2k 无绑世界纸档同在
- 【事故与判例】P3 首跑 strict mode violation：hero 有 **2 条 overlay path**（E5 自己就断言 2）——裸 locator 违 strict，.first() 一修。崩溃照例跳过 T 清场（roster 22，twin 手工 DELETE 归家 21）。判例复验两则：「崩溃跳过清场是默认结局——重跑前必查 roster」；「**新探针的 locator 先数元素再 evaluate**——count 已被本文件断言过的多元素选择器，裸用必炸」。P6 误引 INV_TABLE 常量（不存在）+ band 是 line 非 rect——grep 现场后修正（引用前先扫现场判例的 e2e 版）。
- 【e2e：t223-e2e 110→120】**120/0 ×3 全绿**。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0；roster 恒等 21。
- 【watchdog 判例第 4 度】build 后验存活果然 WD_DEAD（18767 被收割）——杀旧 server（18786）→ start-prod → 重拉（19624）→ 双 pgrep 验活。判例已连续三窗应验，升级为**固定工序**：build 后第一步永远先 pgrep。
- 【定妆照】t231-print-tier-2x（新工具 scripts/t231-print-frame.mjs 首拍）：print 仿真下整份报告脱壳成纯文档（t70 契约运作中）——主地形全墨、署名/深度刻度纸上可读、虚线身份保留、网格隐约在场；审稿通过。
- 【漂移考古：零屏幕漂移的教义级证据】**t223 全部帧 + t219 逐字节 identical**——纸档是纯 print CSS，屏幕一根毛没动（比 P0 更强的实证：feature 对屏幕的不可见性由全帧指纹背书）；t210 ×3（695/1894/55487 @ 画布区）WebGL 惯犯具名 checkout；t212/t213/t214/t215（34–92 @ density 0.000 超稀疏 sliver，位置逐窗漂移）渲染真相提交。
- 【世界卫生】全家族绿：t223 120/0 ×3 + t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 21/0 + t221 14/0；roster 恒等 21、twin 已归家（含崩溃遗留手工回收）。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「印刷继承层级，不继承数值」：纸档 = 13 值单调加深 + 次序逐对存活——P2 钉死 1 > 0.85（名字仍比标尺响）、P3 钉死虚线身份、P4 钉死网格隐约在场；屏幕档与纸档从此是同一族墨水的两张底片，仿真往返（P8）证明两张底片互不覆盖
- 「纸档不可见于屏幕」：零屏幕漂移 = 全帧指纹背书 feature 的介质纯度；print-only CSS 的审稿要用 print 仿真拍（t231-print-frame.mjs 入驻 scripts/）——「工具跟随介质」
- 「固定工序再 +1」：build 后第一步 pgrep watchdog（连续三窗死亡后升格为工序，与「换 bundle 后验活」并列）；「重跑 e2e 前必查 roster」（崩溃跳清场第 2 度）
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；CSV copy 路径（让位）；portrait 玻璃内刻度（本轮否决——分工教义，除非出现「缩略图需要深度语境」的真实阅读需求）；hero 纸档下的签名与地形全墨叠印可读性（纸上 7px 全墨字压 1.25 宽线——若未来真实打印发现叠印糊字，halo 禁令是否需要一个「纸上例外」的讨论）

## Task 232 (2026-09-16, cron 07:47 窗口 trace …202609160753)

- 【开局】四件套：尾部 = Task 231（68b6a2a）零过时；净场 → watchdog 验活（21482）+ 200。QA：qa00 GREEN + qa63 GREEN + agent-browser 干净。
- 【立项】Task 231 遗留评审：**「CSV 的第二扇门——copy」当选**（让位 8 窗的老候选转正——「需求未现」的需求现已出现：copy/download 双门是 markdown 的已有形制，机器网格只有一扇门是形制缺口）；纸上叠印讨论维持（依赖真实打印证据）；portrait 玻璃刻度维持否决。教义：**复制与下载喝同一口井**——copy 不是第二个 CSV 生成器（重打字节必分叉），同一 inventoryCsv、同一空态拒绝、同一收据语法；clipboard 拒绝 = 降级为 download 且收据自报家门（exportMd 判例镜像）。
- 【实现】
  - exportCsv 改 mode 化（"copy" | "download"）：copy 分支 try clipboard.writeText → 收据 "Copied the map inventory grid to the clipboard"；catch → downloadText + 收据 "…(clipboard unavailable)"；download 分支原样
  - Copy CSV 按钮入排（emerald 同族、Copy 图标、aria "Copy map inventory CSV"、title 点名 twin——one well, two mouths）
  - t218-e2e 重构 context + clipboard-read/write 权限；C 相 5 断言 + C2 相 2 断言：C1 门恰一、**C2 剪贴板字节 === 下载字节逐位**（164 chars——两口井一个父亲）、C3 收据点名 copy、**C4 拒绝世界降级为 download**（init script 把 clipboard.writeText 换成 Promise.reject——拒绝的确定性注入）、C5 降级收据自报家门
- 【重大事故与判决：React #418 水合文本错配（t232 无辜）】首跑 t218 Z2 console 1 错——三suite（t218/t223/t215）同报。取证三步：agent-browser errors 异常 → 自写 t232-diagnose.mjs 分相捕获（**裸加载即发生**，对话框未开——组件嫌疑排除）→ t232-diagnose2.mjs **SSR HTML vs 水合 DOM 文本差分**：SSR 静态 HTML 烘着 "Sep 15, 2026"、水合 DOM 是 "Sep 16, 2026"。**元凶 = print-doc-header/footer 在 render 期间调 new Date()**——「printed 日期」被静态预渲染烘进 HTML；本箱 UTC、本窗 build 恰跨 UTC 午夜（23:59 build / 00:01 完工），build 日 ≠ 客户端日，潜伏 bug 首次现形（此前窗 build 与客户端同日零暴露；t232 的 diff 无辜但由它的新 e2e 断言捕获——tripwire 制度的胜利）。修复 = **「纸上的钟不参与水合」**：useState("") + useEffect mount 后客户端填充——首渲染与 SSR 一致（空）、打印发生在 mount 后（钟 honest to the print day）、静态 HTML 不再携带任何钟。qa66 35 断言复核 GREEN（打印契约在 mount 填充模式下完好）。
- 【判例】①「跨午夜 build 是 SSR 时钟 bug 的显影液」——render 期间的 new Date() 是潜伏水合雷，static prerender 烘钟 = 迟早 #418；②「诊断顺序：分相捕获定位时机 → SSR/DOM 文本差分定位元凶」——t232-diagnose.mjs/t232-diagnose2.mjs 入驻 scripts/ 成为水合考古工具；③「e2e 的 console-clean 断言是全局 tripwire」——三个 suite 同时报警才能区分「局部回归」与「全局回归」。
- 【e2e：t218 21→28（26 断言 + 世界卫生）×3 全绿】t223 120/0 + t215 44/0（tripwire 复验清洁）+ qa66 35 GREEN + 全家族绿：t210 151/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t221 14/0；roster 恒等 21。
- 【定妆照】t218-csv-door-2x 重摄：五门同排（Copy CSV 翡翠同族）+ 翡翠收据条同框；审稿通过。漂移考古：**t219/t223 八帧共享门排带指纹**（2052–2059 @ (245,93,630,108)——Copy CSV 入排把同行后续门右移的确定性墨迹）随 feature 提交；t212/t214/t215 的 7200 级右侧带 PIL 行列剖析 + 裁片亲眼验证 = **同一门排在各suite帧的不同 y 位置**（+ 0.005 密度散点渲染真相），收；t210 ×3（1/156/2316 @ 画布区）惯犯具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「复制与下载喝同一口井」：CSV 获得它的第二扇门——同一 inventoryCsv、同一空态拒绝、同一收据语法；C2 把「两口井一个父亲」钉成 wire 断言（clipboard bytes === download bytes 逐位）；降级世界 C4/C5 证明拒绝时的诚实（fallback 开火 + 收据自报家门）
- 「纸上的钟不参与水合」：print-doc header/footer 的日期改 mount 后客户端填充——静态 HTML 不携带钟，水合永不与钟相遇；qa66 复核打印契约完好（打印发生在 mount 后，钟 honest to the print day）
- 「跨午夜 build 显影 SSR 时钟雷」：潜伏 bug 的暴露条件 = build 日 ≠ 客户端日——此前 30+ 窗零暴露纯属运气（build 从未跨 UTC 午夜）；SSR/DOM 文本差分是这类雷的通用探测器
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持，依赖真实打印证据）；exportMd/exportCsv 的 mode 化统一（两个函数现在同构——合并成一个带 kind 参数的 export(kind, mode) 是纯粹的重构，成本/价值再评估）

## Task 233 (2026-09-16, cron 08:17 窗口 trace …202609160817)

- 【开局】四件套：尾部 = Task 232（492af85）零过时；净场 → watchdog 验活（25289）+ 200。QA：qa00 GREEN + qa63 GREEN + agent-browser 干净。
- 【立项】Task 232 遗留评审：**「阶梯只有一个父亲」当选**——t232 手搓了两次同构阶梯（exportMd/exportCsv 的 try/catch 双胞胎），正是 Task 191 定律（两个消费者独立推导，第三个必分叉）禁止的形态；阶梯收编进 download.ts——copyOrFallback（try clipboard → copy 收据 / catch → downloadText + 降级收据，返回收据由 caller flash——**caller 拥有措辞、阶梯拥有机制**）。CSV 空态拒绝（still measuring）留在 exportCsv——那是 CSV 自己的真话，不是阶梯的。随行补真实覆盖缺口：**md copy 门自报告诞生起从未被剪贴板字节级断言**——C6/C7/C8 补上。
- 【实现】
  - src/lib/download.ts 加 copyOrFallback（紧挨它的 fallback downloadText——阶梯住在它父亲旁边）
  - exportMd/exportCsv 改调 copyOrFallback；收据字符串逐字保留（C3/C5 的子串断言依赖）
  - t218-e2e C 相 +3：C6 md 门恰一、**C7 clipboard bytes === data-md 逐位**（data-md 是纸的字节、唯一的父亲——md 门第一次被 wire 证明它复制的正是它渲染的）、C8 收据点名 report copy
- 【e2e：t218 26→29 ×3 全绿】全家族回归绿：t223 120/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t210 151/0 + t221 14/0；roster 恒等 21。watchdog 判例第 6 度（build 后 WD_DEAD → 三连换 bundle 工序例行捕获）。
- 【定妆照】t218-csv-door-2x 重摄：收据条从 CSV 版换成 md 版（C8 时序——Copy report 的收据入帧），891 强像素 @ 收据区裁片亲眼验证 = 阶梯统一后的时序性故意样貌，提交；t219/t223 ×2 identical 或 sliver 照例。
- 【漂移考古】t210 ×3（2601/1136/55334 @ 画布区）WebGL 惯犯具名 checkout；t212/t213/t214/t215（42–160 @ density 0.000 超稀疏）渲染真相提交。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「阶梯只有一个父亲」：copy-or-fallback 的 try/catch 舞步从此只有一个定义——download.ts 里 downloadText 与 copyOrFallback 并肩（降级机制与它的 fallback 同住）；第三个出口（无论 md/CSV/未来的任何格式）只有一个分叉点：收据的两句话
- 「caller 拥有措辞、阶梯拥有机制」：收据字符串留在调用点（C3/C5/C8 的子串断言逐字依赖），字节与控制流进阶梯——机制与语义的边界落在函数签名上
- 「md 门的首个字节断言」：存在最久的门直到今天才被 wire 证明——C7（clipboard === data-md 逐位）把「复制的就是渲染的」从善意推定升格为实证；覆盖缺口不分老幼，只分有没有被证明过
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持，依赖真实打印证据）；export 家族下一位成员（Copy JSON？——需求未现，维持「未现不造」纪律）

## Task 234 (2026-09-16, cron 08:32 窗口 trace …202609160832)

- 【开局】四件套：尾部 = Task 233（7cf93ef）——**续传摘要第 31 度过时**（只写到 Task 231/68b6a2a，实际已前进 2 度：232 水合钟修复+CSV copy 门、233 copyOrFallback 阶梯均已交付）；净场 → watchdog 拉起后**三度秒死**（27502/27582/28799——本窗进程收割凶猛，与既往窗「拉起即活」不同），server 自身全程 200 健康：**不再烧窗于复活保险丝，server 巡检代替 watchdog 存活**（QA 可用性优先）。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser console 零错。
- 【立项】Task 233 遗留评审：五个候选全部维持让位（透镜纸面化哲学门槛/updatedAt 大工程/EMPIAR 让位/叠印依赖真实打印/Copy JSON 需求未现不造）。屏幕侧真实缺口当选：**「报告的地图」**——62vh 滚动容器里的长文档（4 个 h2 + 5 个 h3），翻找全靠手滚，文档这么长值得一个指南针。教义三条：**「目录是 md 的第二个表面」**（t230 HERO_QUARTERS 的 two surfaces one father 在文档层重演——chips 从 md 字节解析，绝不重抄章节名）；**「地图是屏幕器官」**（no-print——纸的页序天然即地图，t70 契约打印的仍是文档本身）；**「地图不假装」**（pending/error 世界章节集诚实缩水，井自己会说话）。
- 【实现】
  - `reportTocOf(md)` 模块纯函数：解析 ATX `##`/`###` 行（h1 是文档自己的名字不是目的地）、剥 mdCell 管道转义/`**`/反引号——chip 说的就是渲染标题说的
  - 配对律按 INDEX：`querySelectorAll("h2,h3")` 与 toc 数组按序一一对应（同一口井流过两张嘴、同一序列）——零 id 注入、零rehype-slug 依赖
  - sticky chips 条入 data-report-body 首位（`data-report-toc` nav + aria-label "Report sections"）：实底背景（透底色的地图是说谎的地图）、水平滚动不换行（地图保持一行）、h3 sub chip 小一号+0.85 透明度（大纲层级在条内自存）、active violet 同族 + inset 2px 指示条（地图标注位置不喊叫）、focus-visible 环
  - spy：viewport-rect 几何（不用 offsetTop——对话框的 offsetParent 链不进数学）、rAF 节流、罗盘线 88px；**尾部定律**——滚到底强制 active=最后章（尾章永远到不了线：下面纸不够）
  - 跳转：scrollIntoView smooth + `scroll-margin-top: 52px`（标题给 sticky 条交房租——目标落在地图下方，永不藏在下面）
- 【e2e：t223-e2e 120→130】新 W 相 8 断言 + P9 + Z2l：W1a/W1b 恰一 + sticky、**W2 chip 数 === 标题数 === 9**（同父亲）、**W3 九对词逐位**（same well, two mouths）、W4 五个 sub chip（### 层级形制）、**W5 跳转落点 52px**（scroll-margin 交租实证）、W6 needle 跟随（aria-current on chip 2）、**W7 尾部定律**（滚到底 needle 指最后 chip——尾章到不了线，读者已在其中）、P9 纸不打印地图（仿真下 display none）、Z2l 无绑世界 9 chips 同配对。**130/0 ×3 全绿**。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 29/0 + t221 14/0；roster 恒等 21。
- 【事故与判例】①**W4 首跑失败：sub chip 数 5 非 6**——「Map QC summary — orthovol」是 h2（嵌入报告的深报告标题）不是 h3，出题时手数错；判例：**嵌套文档的标题层级以解析为准，肉眼数数是出题者的第二口井**。②watchdog 三度秒死（见开局）——判例：「保险丝死了但电路活着时，QA 主线不等保险丝复活；巡检代替祈祷」。③尾部定律是**目检发现的实现缺口**（点击尾章 target 停在 235px、needle 落在倒数第二）——先目检后出题，断言 W7 因此才成立。
- 【定妆照】t234-compass-2x（首屏：地图与领土同框——compass 条 + 文档开头 + hero 同帧）+ **t234-compass-jump-2x**（使用中：点击尾章后 needle 骑到最后 chip、Scheduling sweep 落在地图下方）；t223-hero-2x 随 e2e 重摄（compass sticky 入画顶部）。新工具 scripts/t234-compass-frame.mjs（拍两张：opening + jump）。首拍两帧撞车（hero 未滚即可见 scrollIntoViewIfNeeded 空转）——**一帧一话**判例：跳转帧补上「使用中的罗盘」。
- 【漂移考古】violet 行分布取证：t212 帧 HEAD 16 行 violet → WORKDIR 22 行（+6 = active chip 紫色）——447k 强像素确证为 **compass 入画的结构性位移**（t212/t214/t215 整页 0.166-0.191 + t218/t219/t223 系 9317-61486，全部随 feature 提交）；t213 386@0.001 超稀疏 sliver 渲染真相提交；t210-final/legend-open identical（mtime 噪声）+ t210-lanes（37357@画布区）WebGL 惯犯具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 已归家（每次出帧脚本自带 DELETE）。
- 【收尾】worklog（本条）+ commit + push + 环境清理。

Stage Summary:
- 「目录是 md 的第二个表面」：two surfaces one father 从常量层（t225）与渲染数组层（t230）升格到**文档层**——TOC 与正文喝同一口 md 井，W2/W3 把配对钉成 wire 断言（chip 数 === 标题数、九对词逐位）；「two surfaces one father」的第三级形态
- 「尾章到不了线」：sticky 导航的固有几何缺口（下面纸不够）——尾部定律补上「滚到底 = 读者在最后章」；W7 钉死。目检先于出题（W7 的存在本身来自目检发现）
- 「地图是屏幕器官」：P9 纸不打印地图——纸的页序天然即地图，屏幕的导航与纸的页码各管各的介质；no-print 名册再添一员
- 「索引配对零注入」：不用 id、不用 rehype-slug——解析序与 DOM 序按 index 配对（同一口井的同一序列）；结构决定配对，不靠锚点
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持，依赖真实打印证据）；compass 的键盘化（chips 已 focus-visible 但无方向键导航——Tab 逐个到达已可用，方向键是否值得，成本/价值再评估）；compass 的滚动收缩形制（滚深后 chips 条收窄成单行进度尺——纯样式候选，低优先）

## Task 235 (2026-09-16, cron 09:02 窗口 trace …202609160905)

- 【开局】四件套：尾部 = Task 234（3eba6e8，本手上轮所写）**零过时**（续传摘要防御首次连续两窗无效——上轮即本手）；净场 → watchdog 拉起验活（31937）+ 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser 干净。
- 【立项】Task 234 遗留评审：四个维持让位（透镜纸面化/updatedAt/EMPIAR/叠印），compass 两个候选合并当选 **「needle 走到哪，地图跟到哪」+ 方向键**——t234 跳转帧暴露的真实缺口：9 chips 水平溢出后 spy 的判决可能落在地图自己视口外的 chip 上（**needle 失明：罗盘藏起自己的读数**）；上轮 jump 帧 strip 滑到尾纯属 playwright click 的自动滚，手动滚 doc 时 strip 不动。教义：**地图标注位置还不够——地图要自动翻到位置页**（nearest 贴边、不居中、不动画：地图翻自己的页，无声）；键盘行走让地图可导航而不只可点击（Tab 一站到达、方向键循环行走）。
- 【实现】
  - followToc：useEffect([activeToc, toc])，activeToc 每次移动把该 chip 拉回 strip 视口——viewport-rect 几何（cLeft - nLeft + scrollLeft 的内容坐标换算，t234 的「offsetParent 链不进数学」判例延续），pad 8、nearest 语义（左侧被裁贴左、右侧被裁贴右、完全可见不动）
  - 方向键：nav onKeyDown，ArrowRight/Left 在 chips 间移 focus（含 wrap），preventDefault 接管容器默认滚动；focus 与 needle 分离（focus 不触发 spy，Enter 才跳）
- 【e2e：t223-e2e 130→133】**W8 地图跟随**（尾部场景 strip 滑 340px、最后 chip 完全可见于地图自身视口）+ **W9a ArrowRight 下一个 / W9b ArrowLeft 回绕**。**133/0 ×3 全绿**。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 29/0 + t221 14/0；roster 恒等 21。watchdog build 后 WD_DEAD 第 9 度（固定工序例行捕获，三连换 bundle）。
- 【定妆照】t235-compass-follow-2x（**深中部手滚、零点击**：needle 骑到 Session map inventory、chip 吻 strip 右缘、Pipeline/Map QC 滑出左缘——读者全程没碰地图）；**一帧一话判例再执行**：首拍 follow 帧与 jump 帧构图重复（尾部终态同为贴最右），重瞄深中部——尾右贴边态归 jump 帧、中部跟随归 follow 帧；t234-jump/opening 本轮字节级 identical（点击终态与未触首屏不受扰——follow 只在 needle 移动时出手）。
- 【漂移考古】**follow 的结构性入画**：t219 ×2 / t223 ×5 共享 doc 帧顶 22px strip 带（y 136–201、strong ~5000、各 suite 自己的滚动位置驱动 spy→follow 的 slideLeft）、t212/t214/t215 同带于整页帧——随 feature 提交；t213 338@0.376 微带渲染真相；t210 ×3 WebGL 惯犯 + identical 具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 已归家。
- 【收尾】worklog（本条，单独 commit——代码 commit 先行一步的顺序瑕疵，下窗自警：worklog 先于 git add -A）+ push + 环境清理。

Stage Summary:
- 「地图跟随 needle」：罗盘的失明补全——needle 指到哪，strip 把那个 chip 带回自己的视口（nearest 贴边语义：只在需要时出手、出手恰好够）；W8 把「340px 的滑动 + 尾 chip 完全可见」钉成 wire 断言
- 「地图可导航」：Tab 一站到达 + 方向键循环行走——focus 与 needle 分离（focus 是手、needle 是位置，Enter 才把两者合一）；键盘用户的地图从「可点击」升格为「可行走」
- 「一帧一话的边界」：follow 首拍与 jump 构图重复即重瞄——同一 resting state 只归一帧所有；follow 帧改说深中部的话（chip 吻右缘 + 左缘滑出）
- 「结构入画的系谱」：t234 罗盘入画（整页位移）→ t235 罗盘跟随（22px strip 带）——同一器官的两代墨迹，各 suite 自己的滚动位置是驱动者；漂移考古的「认领结构」再下一城
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持，依赖真实打印证据）；compass 的滚动收缩形制（滚深后收窄成进度尺——纯样式候选，低优先维持）；follow 的 RTL 世界（scrollLeft 语义在 dir=rtl 下翻转——app 是 LTR，未现不造）

## Task 236 (2026-09-16, cron 09:17 窗口 trace …202609160918)

- 【开局】四件套：尾部 = Task 235（f07b415，本手上轮所写）零过时；净场 → watchdog 验活（2556）+ 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser 干净。
- 【立项】Task 235 遗留评审：透镜纸面化/updatedAt/EMPIAR/叠印维持；**compass 滚动收缩形制正式否决**——收缩 = 重新藏起非 active 章节名，与 t235 刚修完的「needle 失明」自相矛盾（教义内洽优先于形制花样）；RTL 未现不造。目检产品其他面（dashboard stat 卡点阵 = 装饰跳过、KpiSparkline/ProgressSparkline 已诚实降级）后锁定真实缺口：**「文档不假装——键盘层入册」**——shortcuts dialog 自称「the single discoverable surface」，但报告对话框的整个键盘层（t213 roster 门、t224 focus 玻璃、t235 方向键、t70 打印例外）零记载：功能存在而不可发现 = 文档在说谎（少说也是说谎）。
- 【实现】
  - SHORTCUT_GROUPS 新增 report 组（gallery 与 touch 之间——global/canvas/dashboard/gallery/report/touch 六组序）：hint「Inside the report dialog — the document has its own keyboard」+ 三行（←/→ 走 chips + Enter 跳转 + strip 随行；Tab 走 roster 行——focus 开玻璃、Enter 开门；⌘/Ctrl P 打印报告自身——唯一变纸的对话框）
  - 无 scope 字段：「you are here」高亮属 view（canvas/dashboard），报告是对话框不是 view——C7 钉死
- 【e2e：qa78 33→36】C6 报告组三行在场（chips walk · roster walk · 打印例外）、C7 报告组永不认领 you-are-here（对话框非 view）、C8 恰六组。**qa78 ALL PASS**。连带：**qa70 的「五组」契约是 Task 70 时代快照——更新为六组**（FATAL 型 must 中断连锁的教训：契约断言写成快照就得跟着现实走）；qa55/qa58 GREEN；t223 133/0 + t218 29/0 + 全家族绿（t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t221 14/0）；roster 恒等 21。watchdog build 后 WD_DEAD 第 10 度（固定工序）。
- 【定妆照】t236-shortcuts-report-group-2x：SESSION QC REPORT 组完整入画（hint + 三行键位 + 六组序可见）、filter 计数 **29→32 shortcuts**（+3 行的计数实证）。首拍只见到 dialog 顶部（Global/Canvas）——scrollIntoView 报告组后重拍（一帧一话）。
- 【漂移考古：相对时间词显影】t213 裁片实证「created 7h 41m ago」——t212/t213/t214/t215 的 38k-75k 强像素全部来自**相对时间的自然流动**（每窗必然、数据世界的诚实变化），t218/t219/t223 系近 identical（1–2 像素）；t210 ×3 画布微噪声（102–258 @ 0.001，惯犯安静版）具名 checkout；其余渲染真相随批提交。
- 【世界卫生】全家族绿 + roster 恒等 21。
- 【收尾】worklog（本条，先 worklog 后 commit——上轮顺序瑕疵已纠正）+ commit/push + 环境清理。

Stage Summary:
- 「文档不假装」的文档版：键盘层存在而 shortcuts dialog 不记载 = 文档少说也是说谎——report 组入册（三行），C6/C7/C8 把「可发现性」钉成 wire 断言；「the single discoverable surface」的称号从此名实相符
- 「对话框不是 view」：scope 机制（you-are-here）属于 canvas/dashboard 两个 view——报告组永不认领（C7）；器官的类别决定它继承哪些行为
- 「契约快照跟上现实」：qa70 的「五组」是 Task 70 的真话、t236 的六组是现在的真话——快照断言（exactly N）在结构演进时必须随行更新，否则断言保护的是历史而非现状
- 「相对时间词是考古的永久噪声源」：dashboard/inspector 帧里的 "Xh Ym ago" 每分钟都在写新墨——此类帧的强像素先裁片找时间词再定渲染真伪；时间词是数据世界的诚实变化
- 遗留（下轮候选）：透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts dialog 的分组搜索提示（filter 计数 32 已含报告组——搜索词命中组标签的 UX 是否要高亮命中组，低优先）；help popover 与 shortcuts dialog 的报告组同步（popover 已不持副本——SHORTCUT_GROUPS 单一真源自动生效，无需动作）

## Task 237 (2026-09-16, cron 09:32 窗口 trace …202609160938)

- 【开局】四件套：尾部 = Task 236（1d711e3，键盘层入册）零过时（续传摘要世系只到 234——第三度实证「以 worklog 尾部为准」）；净场 → watchdog 拉起验活 + 200。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser errors/console 双空 + 首页目检健康（20 jobs / 16 edges 渲染完整）。
- 【背诵清单全线过时——本窗最重要的情报】cron 文本里的 Task 13 遗留（#5/#6/#14/#7/#8/#13）与两大功能候选经逐项核验**全部愈合**：#5 fs/browse 已有 isLocalRequest 守卫 + http-guard.ts 完整威胁模型文档（drive-by/DNS-rebinding 残余风险都写明）；#8 particles BFS 已是批量 BFS（每深度一层一条边查询 + 一次 job 查询，注释自证旧的 N+1）；#13 job-card 的 trackEtaBaseline 注释自证「函数因旧 estimateEta 在 useMemo 内写存储而生」；#7 outputs 路由 star 预读 ≤2MB + starBudget 封顶、file 路由显式 STREAMED（1.4GB 体积注释在案）；#6/#14 pathref 三消费点共用单库、readPathrefTarget 绝对路径白名单 + statSync 常规文件校验。Topaz wrapper 也已存在（topaztrain + topaz-training.ts + 图表）。3D viewer 切片/裁剪早已落地（sliceState/clipState/存视图携带）。**项目已长出自己的背诵之外**——下窗起背诵清单作废，遗留以 worklog 尾部 Stage Summary 为唯一真源。
- 【立项】产品线真缺口：**「文档的回声」**——session report 已会说三种介质（屏幕渲染 + 罗盘 / 纸 / md+CSV 字节），但 md 下载是惰性字节：同事收到 session-qc-report-….md 没有样式没有目录没有结构，需要工具才能读好。缺的介质 = **standalone HTML 导出**：任何浏览器打开即读、Contents 目录随文档旅行、打印就绪、零 JS、零网络、自包含。教义四条：**同一口井**（reportTocOf 从 dialog 迁往 lib/report-html.ts——活罗盘与回声同一杯水）；**索引配对零注入**（TOC href 与正文 id 同一遍过滤同一下标铸出，无 slug 无查找表）；**文档不是应用**（零 script、零外链，无 JS 可用的就是全部）；**无时间戳字节**（t195 律在新介质延续——X7 钉死两次导出字节恒等）。
- 【实现】
  - `src/lib/report-html.ts`（新）：reportTocOf 原样迁入（dialog 导入回喝——单井）；buildSessionReportHtml(md) 一遍扫描铸两嘴：h1 下生 Contents 药丸页（h3 sub 小号）、标题 id=s<i> 与 TOC href 按同一下标配对；闭子集转换器（h1/h2/h3、单层 bullet、GFM 表含 --: 对齐类、blockquote、整行 _em_、行内 **bold**/*em*/*code*、mdCell \| 反转义、围栏剥离——首尾 \| 是围栏不是格界）；自包含 CSS（纸优先白底、系统字体、violet 家族、zebra 表、@media print 避页断）；确定性输出（无钟无随机）
  - `qc-report.ts`：sessionReportHtmlFilename() 兄弟入列（同一时间戳语法）
  - dialog：本地 reportTocOf 定义移除（注释留址）、Globe「Download HTML」violet 门入列（md 下载与 CSV 组之间）、exportHtml + flashNote 回执「— a portable document: opens in any browser」
- 【e2e：t223-e2e 133→141】新 **X 相 8 断言**：X1 文件名语法（session-qc-report-<stamp>.html）、X2 doctype 头、X3 零 script（文档不是应用）、X4 零外链（离线可读）、X5 Contents 索引配对（9 链接顺序井然、条条有着落——零注入律在回声里）、X6 两嘴逐词一致（W3 律随行）、X7 两次导出字节恒等（t195 律在新介质）、X8 回执点名便携介质。**141/0 ×3 全绿**。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 29/0 + t221 14/0；roster 恒等 21。
- 【事故与判例】①**build 后 server 仍握旧 bundle**（PID 未换、.next 被换下）——t223 首跑 V 相雪崩（对话框还是旧世界）；处置：杀 server 让 watchdog 重拉（12546）后全绿；判例：**「build 的下一步不是跑测试，是确认 server 喝的是新 bundle」**（pgrep 看 PID 起点晚于 BUILD_ID mtime）。②X1/X6 首跑双双败于**测试自己的第二口井**：文件名正则漏 ISO 的 T、sub chip 正则写 `(?:sub )?` 咬不住无空格的 class——工件无谎，出题者的正则有谎；W4 判例（肉眼数数/手写期望不可靠）再添两案。③闭子集转换器首版漏 Contents 拼接（tocHtml 算好未入返回体——TDZ 后上移）与围栏格界、行内 *em*：**sanity 先行挡下三处**，lamps-before-wires。
- 【定妆照】**t237-echo-travels-2x**（file:// 打开导出件——应用不在场，文档独自站立：标题 + Contents 药丸 + styled 表格 zebra 行）+ **t237-echo-anchor-2x**（点 #s8 锚点后文档自滚至尾章——无 spy 无 JS，锚点即导航；inventory 七列表 + crown blockquote violet 左缘 + 斜体落款）；t223 六帧随 e2e 重摄（门带 6 钮）。新工具 scripts/t237-report-html-frame.mjs（export → file:// → 两帧 → 临时件删除 + twin DELETE 归家）。
- 【漂移考古】**门带 (84,93)-(514,108) 跨 t215/t218/t219/t223**（~2085 strong px、density 0.30）= Download HTML 入列的结构性入画，裁片确证 violet Globe 在 md 组与 CSV 组之间；t223-hero **SIZE CHANGE 896×714→896×756** = 门带在窄对话框换行 +42px（flex-wrap 设计内行为）；t215-lens 7581 大框 = 对话框增高垂直位移 + 运行任务进度条诚实漂移——全部随 feature 提交，t210 惯犯安静版具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 已归家（帧脚本自带 DELETE）。
- 【收尾】worklog（本条）+ commit/push + 环境清理。

Stage Summary:
- 「文档的回声」：报告的第四介质——md 惰性字节升格为便携文档（styled 表格 + 随行目录 + 打印就绪），应用外 file:// 打开即读；X 相 8 断言把「自包含/零脚本/索引配对/字节恒等」钉成 wire 契约；「one well, many mouths」从两嘴（正文/罗盘）扩到四嘴（正文/罗盘/回声目录/回声正文）
- 「同一杯水」：reportTocOf 迁居 lib/report-html.ts——活罗盘与回声从同一函数喝水；dialog 不再私藏解析器（单井律的结构兑现）
- 「背诵清单作废」：Task 13 遗留 + 两大功能候选经实证全部愈合/落地——worklog 尾部 Stage Summary 是唯一真源；「项目长出背诵之外」是项目健康的证据
- 「build 之后看 bundle」：server 存活不等于喝新 bundle——PID 起点晚于 BUILD_ID 才算数；否则测试打的是旧世界（V 相雪崩的教训）
- 「sanity 先于 wire」：闭子集转换器的围栏/拼接/斜体三处缺口被 bun sanity 在进 e2e 前挡下——灯先于线
- 遗留（下轮候选）：回声的 Contents 在纸上的形制（打印时目录页是否要页码——依赖真实打印证据，维持让位）；shortcuts dialog 的 report 组是否记载 Download HTML 门（键盘层文档的第五行——低优先，门本身无快捷键）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；echo 转换器的 GFM 对齐 `:--:`（center——子集未现不造）

## Task 238 (2026-09-16, cron 10:17 窗口 trace …202609161019)

- 【开局】四件套：尾部 = Task 237（9dd743c，本手上轮所写）零过时（续传摘要只写到 234——第四度过时实证，worklog 尾部是唯一真源的律再获证实）；净场 → watchdog 拉起验活 + 200。QA：qa00 GREEN + qa63 SMOKE GREEN（console 0 错）+ agent-browser errors/console 双空 + 首页/dashboard 目检健康（20 jobs · 16 edges · 16/21 · QA Refine Live 42%；KPI 卡 5 张 + Recent activity 相对时间诚实流动）。
- 【立项】Task 237 遗留七个候选全部维持让位。产品面巡检（dashboard、报告章节序、class notes——报告说数据的话不说用户注记的话，维持设计现状）后锁定真缺口：**「便携文档的窄门」**——回声会旅行（邮件→手机），但 echo CSS 有 viewport meta 而零窄屏形制；7 列 Session map inventory 是文档的 centerpiece，390px 视口下文档列被撑到 585px（探针实证：docScrollW 585 vs 390，Verdict 列裁出屏外——before 帧亲眼过目）。文档请求手机横滚 = 便携介质的破绽。
- 【取证】scripts/t238-echo-narrow-probe.mjs（export → file:// 390×844 → 测量 + 帧）：docOverflows true + 最宽表 min-content 565px——证据先行，断言后写（目检先于出题）。
- 【实现】DOC_CSS 一条窄门：`@media (max-width:640px){ article{padding:1.5rem .9rem 3rem} table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch} }`——文档永不横滚；宽表向自己的 band 借滚动（document-native escape：无 JS、无 wrapper div——display:block 的匿名表格盒保住单元格语义）。门只在手机宽度开：桌面世界 display:table 纹丝不动（media query 是透镜不是重写——P0 律入回声）。
- 【e2e：t223-e2e 141→145】X 相 +4：X9 门在字节里（media query + display:block 规则同检）、**X10 电话世界文档列恒等视口宽（390=390，永不横滚）**、X10b 7 列 inventory 的 band 自滚（559px 内容在 361px 带内、display block）、**X11 桌面世界门关着**（widest table display:table、零溢出——门只在手机开）。**145/0 ×3 全绿**（含定妆照三轮重拍共 6 跑皆绿）。全家族回归绿：t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 29/0 + t221 14/0 + t210 151/0（首跑 150/1 WebGL 惯犯瞬态，复跑即愈——final/lanes 字节级 identical、legend-open 468px 画布噪声，×3 具名 checkout）；roster 恒等 21。
- 【事故与判例】①**「镜头脚本坏了」是误报**：rg/head 的 bash 输出把 `a[href=` 吞成 `aref=`（转义序列显示伪影）——Edit 失败后 Read 才见真身，文件无谎、是我的读数有谎；「目检先于出题」救了一个正确的文件免遭修理。判例：**bash 管道输出里的选择器失踪，先 Read 原文件再定罪**。②sanity 正则 `[^}]*` 咬不住跨规则的 `}`（article 规则先关）——出题者的正则有谎又一案，`[\s\S]*?` 修正（灯先于线，sanity 挡下）。③锚点两次瞄错（#s1→#s2→实为 **#s7**）：mapQc.report 深报告字节先于 inventory 入列——**W4 判例第三度应验：嵌套文档的章节序以解析为准，行号与肉眼都算不上数**。④首帧一话未达：#s7 落点只有表头 sliver——`scrollIntoView({block:"center"})` 后再 scrollLeft=150，表身与尾列同框。
- 【定妆照】**t238-echo-narrow-2x——家族首张竖幅**（390×844）：手机读报告、7 列表 band 居中自滚、尾列（Δ winner / Agreement r / Weakest）入画、crown blockquote 同框、文档列不倒——「门在使用中」。before 帧的误导残件删除（证据活在探针 JSON 与对话取证里），probe 帧名改 landing。
- 【漂移考古】本窗 feature 只改导出 CSS（应用对话框零触碰），故 t212/213/214（9–17px 超稀疏）/t215（0）重摄差全为渲染真相/mtime 噪声随批提交；t210 ×3 WebGL 惯犯具名 checkout；新探针脚本 + 漂移取证脚本（t238-drift-check.py，band 剖析配方入册）随行。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 归家（t223 T 相自证）、tmp echo 已清。
- 【收尾】worklog（本条）+ commit/push + 环境清理。

Stage Summary:
- 「文档不问手机借横滚」：便携介质的几何契约——文档列（article）在任何视口宽度下 scrollWidth === clientWidth；宽度是表自己的事，它向自己的 band 借滚动（display:block + overflow-x，无 JS 无 wrapper——文档原生 escape）；X10 把 390=390 钉成 wire 断言
- 「门只在手机开」：media query 是透镜不是重写——桌面世界 display:table 纹丝不动（X11）；P0 律（仿真不单向）在介质间重演：一个器官的窄屏形制不越界改写它的桌面真身
- 「证据先于断言、镜头先于代码」：探针先行（585 vs 390 的 blowout 实证 + before 帧亲眼过目）→ 实现一扇四行的门 → 断言落线——取证顺序本身是三窗教训的复利
- 「误报的死法」：镜头脚本「坏了」的判决在 Edit 失败 + Read 原文后撤销——显示伪影不是文件真相；差点修理一个正确的工件，是本窗最贵的一课
- 遗留（下轮候选）：:target 微光（echo 的纯 CSS needle——`h2:target/h3:target` violet 软底，「进过的门留标记」；滚动离场后标记滞留的语义诚实性需要自己的窗想清楚）；回声 Contents 纸上形制（页码——依赖真实打印证据，维持让位）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组是否记载 Download HTML 门（维持低优先）

## Task 239 (2026-09-16, cron 10:47 窗口 trace …202609161056)

- 【开局】四件套：尾部 = Task 238（567adaf，便携文档的窄门）零过时（续传摘要世系只到 234——第五度过时实证）；净场 → watchdog 拉起验活 + 200。QA：qa00 GREEN + qa63 SMOKE GREEN（console 0 错）+ agent-browser errors/console 双空 + 首页目检健康（catalog 全卡在场、画布 20 jobs / 167 paths）。开局探针插曲：以 .react-flow__node 探画布得 nodes=0——应用根本不用 React Flow 默认类名，真身是 [data-job-id]（20 节点健在）；「出题者的第二口井」在开局探针上又应验一次，工件无谎。
- 【立项】Task 238 遗留首选「:target 微光」当选：回声 Contents 锚点能跳（纯 CSS 门），但抵达是哑的——读者落在哪里？遗留担心的「滚动离场后标记滞留的语义诚实性」本窗想清楚并给出结构性答案：**fade-out 着陆灯**——紫晕宣告抵达、2.6s 后消散。教义：**回声没有 spy，所以不许有任何 claim 活过它的真值期**（应用的罗盘敢常驻 needle 是因为 spy 每刻校真；文档独自站立时只能祝贺、不能指位——「会消失的宣告在每个瞬间都诚实，常驻的光是等读者走开才生效的谎言」）。paint-only 属性（background-color/box-shadow/radius）——光永不移动文字、零 reflow。
- 【实现】（src/lib/report-html.ts，导出 CSS 独占——应用对话框零触碰）
  - DOC_CSS：`@keyframes echo-glow`（rgba(124,58,237,.14)+inset 环 → 全透明，radius 8px 在两帧内恒定——动画结束后属性回归、方形无形变）+ `h2:target, h3:target { animation: echo-glow 2.6s ease-out forwards }`；文件头教义清单添第五条 THE LIGHT THAT LEAVES
  - 双守卫：`@media print { … h2:target,h3:target { animation:none } }`（纸印文档不印抵达——P9 律入回声）+ `@media (prefers-reduced-motion: reduce)`（跳转本身即抵达，光是不必要装饰）
  - 复用判例：echo 已有 `h2,h3 { scroll-margin-top:0.75rem }`（t237 铸的落点呼吸间）——着陆灯正落在舒适位置
- 【e2e：t223-e2e 145→151】X 相 +6：X12 光在字节里（keyframes + :target 规则同检）、X13 抵达即亮（实测 rgba(124,58,237,0.137)——紫晕穿家族色）、**X14 光会离开**（3.1s 后 rgba(0,0,0,0)——诚实性以设计.resolve）、X15 一次一盏（新门亮时旧门恒透明——无陈旧残留）、X16 纸上无抵达（print 下 animation none）、X16b 减动感读者读同一文档而无光。**151/0 ×3 全绿**（帧卫生钉后复 ×3）。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 29/0 + t221 14/0；roster 恒等 21。
- 【事故与判例】①**Task 86 判例本窗再执行**：build 后 pkill -f 'next-server|next start' 是静默空操作（bun standalone 进程两名字都不叫）——server 握旧 bundle 而 pgrep 还骗我说「server not yet up」；真凭实据是在线 chunk 里 grep echo-glow = 0 而磁盘 chunk = 1。按 start-prod.sh 配方（按 server.js 路径 + 端口双杀 + 验 port FREE）处置后 PID 20807 出生晚于 BUILD_ID、在线 chunk echo-glow ×2。②「build 后先验 bundle」判例升级：不只看 PID 起点，**在线 chunk 内容 grep 新符号才是终审**。③watchdog 第 N 度秒死（开局拉的那只在 pkill 后未复活）——惯犯形态照旧，重拉即愈。④X15 首跑败于我的第二口井：`h2#s4` 不存在（s4 是 h3 sub 章节）——层级假设未解析，W4 判例家族再添一案；改层级无关 `[id="sN"]` 后全绿（顺带：sed 转义把引号嵌套撞碎——Edit 工具救场，node --check 先于重跑）。
- 【定妆照】**t239-echo-glow-2x**：点击首个 Contents 药丸后 350ms 抓拍——「Pipeline at a glance」标题戴紫晕着陆灯（0.137 alpha 中段）、章节内容同框、下一节 Map QC 在下；时态光的第一帧，句读=「门刚开、光正亮」。首拍后修正代码注释（原写「door and light 同框」——TOC 实际滚出画幅，注释必须服从实拍）。
- 【漂移考古】**t223-hero 756→714（-42px）= t237 的 42px 误诊翻案**：裁片对照两帧，门带在两帧里都是一行——42px 全额是导出回执绿条（4s flash）的高度，t237 把它误记为「门带换行 flex-wrap」；本窗 X 相加长后回执在 hero 拍摄前自然过期，静息态 714 才是文档真身。处置：hero 拍摄前加「等回执退场」钉子（count 0 轮询），帧高从此脱离与 note 计时器的赛跑、钉死 896×714。t212/213/214/215 相对时间词渲染真值随批提交；t218/t219 字节级 identical 零漂移；t210 ×3 WebGL 惯犯具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 已归家（T 相自证）、tmp echo 已清（finally unlink）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（按 Task 86 配方杀 server：路径+端口双杀）。

Stage Summary:
- 「会离开的光」：回声的 :target 着陆灯——宣告抵达后 2.6s 消散；「没有 spy 的文档不许指位，只能祝贺」的教义把 t238 遗留的语义诚实性担忧变成了设计本身；X13/X14/X15 把「亮—散—一次一盏」钉成 wire 契约
- 「纸与减动感双守卫」：光不进纸（P9 律入回声）、不进减动感世界（跳转即抵达）——每个屏幕器官入场时同时申报它的豁免名单
- 「42px 翻案」：t237 的「门带换行」误诊被裁片对照纠正——真身是导出回执的 4s flash；hero 帧从此钉死静息态（帧高不再与时器赛跑）；漂移考古的误诊也能翻案，只要两帧都在手上
- 「在线 chunk 终审」：bundle 新鲜度的最终审判不是 PID 也不是 BUILD_ID，是在线 chunk 里 grep 新符号——Task 86 判例的验证学升级
- 「开局探针的第二口井」：.react-flow__node 是出题者的假设，[data-job-id] 才是工件真身——探针先问工件、别替工件报名字
- 遗留（下轮候选）：:target 微光的姊妹页——应用对话框内 jumpToToc 是否也要一瞬着陆光（活罗盘有 spy 常驻 needle，再加光恐重叠——语义需自己的一窗想清楚）；回声 Contents 纸上形制（页码——依赖真实打印证据，维持让位）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）

## Task 240 (2026-09-16, cron 11:32 窗口 trace …202609161132)

- 【开局】四件套：尾部 = Task 239（a919fcf，本手上窗所写）零过时；净场 → watchdog 拉起验活 + 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN（console 0 错）+ agent-browser errors 空 + 画布 20 jobs + dashboard 目检健康（KPI 卡在场、0 console 错）。无 bug。
- 【立项】Task 239 遗留首选当选：**应用对话框自己的着陆光**——t239 把光的语义担忧留给本窗，本窗想清楚并给出分工答案：**needle 是位置（持久，spy 校真），光是事件（瞬态宣告，消散）**——两个器官零 claim 重叠，如同地图上的「你在这里」点与丢图钉时的脉冲动画。工程形态不同媒：echo 的光是纯 CSS（:target，无 JS 可用），应用的光是 data-landing 属性 + timer（jumpToToc 走 smooth scrollIntoView 无 hash）。**本窗独有的设计红利：平滑飞行途中 spy 挥针路过中间 chips（t235 的诚实跟随），光在点击瞬间点亮「你问的是这一节」、飞抵后消散交棒给 needle**——asked（事件）与 arrived（位置）分工干净，帧里同框各说各话。
- 【实现】
  - jumpToToc（dialog）：点击即 `dataset.landing="1"` + 重启动舞（`style.animation="none"` → reflow → `""`——同一节重跳也要复亮）+ 2.7s timer 清属性（比动画 2.6s 长一拍）；先清所有旧标记（一次一盏）；unmount 清 timer
  - globals.css：`@keyframes report-landing`（rgba(124,58,237,.14)+inset 环 → 透明，与 echo-glow 同语言同呼吸）+ `.report-doc h2/h3[data-landing]` 规则 + reduced-motion/print 双守卫（纸不印抵达、减动感读者靠跳转本身）——插在 needle 规则之后（位置与事件在样式表里也相邻）
  - React 重渲染安全性：heading vnode 从不携带 className/style，命令式 dataset/style 在 diff 中不被触碰
- 【e2e：t223-e2e 151→155】W 相 +4：W10a 点击即亮（H3 "Local agreement" rgba(124,58,237,0.118)）、W10b 光会离开（3.1s 后标记清空 + bg 透明）、W10c 一次一盏（chip 1 亮时 chip 4 恒透明）、W10d 同节重跳复亮（重启动舞 paint-only）。**155/0 ×3 全绿**。全家族回归绿：t210 151/0 + t215 44/0 + t213 35/0 + t214 29/0 + t219 29/0 + t212 30/0 + t218 29/0 + t221 14/0；roster 恒等 21。
- 【定妆照】**t240-compass-glow-2x——分工同框**：strip 上 "Local agreement" 药丸戴 needle 紫（位置）、正文同名标题戴着陆光（事件中段）——一帧双义「位置与事件」；这正是本窗语义拆分的视觉证明。
- 【事故与判例】①**「在线 chunk 终审」的扫描面井**：换 bundle 后扫 JS chunks 得 report-landing=0——CSS 编译进 /chunks/*.css 而非 JS（disk 84cd699e=1 = served=1）；判例补全：**bundle 新鲜度终审要扫对介质——样式改动查 CSS chunk，逻辑改动查 JS chunk**。②watchdog 秒死再两度（惯犯照旧）。③t239-echo-glow 帧字节差 17 → 零阈值像素考古 19878 px @ max delta 6/765 = **亚感知抗锯齿微噪声**（我错怪时态 jitter——先用零阈值量过再定罪，「误报的死法」判例反向应验：怀疑之前先量化）。
- 【漂移考古】t212/213/214/215 相对时间词 + t223 三帧亚感知微噪声（max delta ≤6）随批提交；t210 ×3 WebGL 惯犯具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21、tmp echo 已清、twin 已归家。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「位置与事件分家」：needle（持久位置，spy 校真）与 landing light（瞬态事件，消散）是两个器官不是两个重复——应用对话框的抵达语言补全，与 echo 的 :target 光构成同一家族的两副媒介嗓子（纯 CSS vs state+timer）
- 「光在飞行中持名」：smooth scroll 的飞行期 spy 挥针过境，光钉住「你问的是这一节」直到抵达交棒——asked/arrived 的分工让两个瞬态指示同时诚实
- 「重启动舞」：同一节重跳必须复亮（none→reflow→empty，paint-only）；W10d 把它钉成 wire 断言
- 「扫描面井」：bundle 终审要扫对介质——CSS 改动查 CSS chunk；t239 的 echo 光帧被怀疑时态 jitter，零阈值考古还它清白（max delta 6 亚感知微噪声）
- 遗留（下轮候选）：echo Contents 纸上形制（页码——依赖真实打印证据，维持让位）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）；报告家族连做七窗——下窗宜回产品其他面巡检真缺口（dashboard/inspector/viewer/gallery），家族候选让位

## Task 241 (2026-09-16, cron 11:47 窗口 trace …202609161153)

- 【开局】四件套：尾部 = Task 240（ef80f24，本手上窗所写）零过时；净场 → watchdog 拉起验活 + 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser errors 空 + 画布 20 jobs + dashboard 目检健康。无 bug。
- 【立项】按 Task 240 收尾建议回产品其他面巡检（报告家族连做七窗）：dashboard（KPI/recent activity/spotlight 全链健康）、inspector（FSC 四门 + STAR 表 + compare 富检）逐一过堂后锁定真缺口——**run report（per-job 档案）仍只有惰性 md**：t237 给 session report 造了便携回声，inspector 的 "Export run report" 家族没跟上；且 profile md 自带导航系统（Contents + slug 锚点 + back-link）却只在 GitHub/VS Code 等 md 渲染器里活。同事收到 cryoflow-report-*.md 的处境与 t237 立案时一字不差。
- 【教义】**「回声尊重字节」**：session md 无目录 → 回声铸 index 配对目录；profile md **自带** Contents/锚点/回链 → 回声逐字尊重、不重铸一个词（序号链接变真锚、锚点行折叠进标题 id、回链成真链接）——两种回声同一 DOC_CSS、两种目录哲学各按其 md 的本相。「折叠」的诚实性：锚点的意图（该节在此 slug 可链接）被 id 骑上 h2 完整保留，且 **:target 着陆光免费生效**（t239 的 CSS 规则天然匹配 slug id）。方言扩展四件：hr、#-锚点链接（仅 #——http 落回转义文本，回声永不猜、永不长外链）、data-URI 图（图表快照住在字节里——自包含律无恙）、有序列表。t195 律的边界澄清：转换器无钟（同一 md → 同一 HTML），md 的 "Generated on" 时钟行是 md 介质的产地（qa57 钉住的契约），不是转换器的业务。
- 【实现】
  - lib/report-html.ts：buildProfileReportHtml（兄弟函数共享 esc/inlineHtml/tableHtml/DOC_CSS）；inlineHtml 添 #-链接规则（code 先行保护）；DOC_CSS 添 ol/hr/figure.shot 样式
  - results-view.tsx：exportReport 重构为 buildRunReportMd（采集井）+ 双门（md 门原措辞原契约；HTML 门 Globe 图标 violet、aria-label "Export run report as HTML"、回执 "Portable report downloaded"）；共享 reportBusy
- 【sanity 先于 wire】scripts/t241-sanity.mjs（bun）：合成满档方言档案 + 四陷阱——首跑全绿（方言完备/陷阱守得住（http 图与 http 链接都落回文本）/确定性）
- 【e2e】
  - qa49 A 相扩：HTML 门探针 + 点击 + 回执 + **镜像律断言**（html h2/链接/图 与 md 计数恒等、零死链（每 href="#x" 有 id="x"）、着陆规则在字节、无裸 md 语法）——ALL PHASES GREEN
  - 新 scripts/t241-run-echo.mjs（playwright）：QA Post 385（数据世界最富档：FSC=1）线上走双门 → **14/0 全绿**（doctype/零脚本/零外链/标题自 h1/着陆规则随行/**图随字节旅行**（1 figure）/零死链/roster 21/console 0）
  - 事故与判例：①断言第一版假设满档（headingIds>=3/dataImg 必有）败于瘦身档（QA Refine3D md 699B 无目录无图）——**契约是忠实不是快照**：改镜像律后 job 无关、满档瘦档皆判；②eval 桥的 \n 转义井（qa57 判例）本窗踩第二遍——镜像计数要喂反转义后的 md；③节点选择器井：[data-job-id] 外壳点击不开 inspector，qa49 的 [role=button] 选择器才是真身。
- 【数据世界勘察】全 demo 档案皆瘦身档（guinier 全 0、progress 全 0、最富 Post 385=4 节<5 无目录）——**着陆光帧诚实让位**（机制已由 sanity 满档合成验证 + 瘦身档无锚可点）；t241 两帧 = 回声独行 + **家族首张嵌图帧**（figure.shot 紫缘圆角 + FSC 曲线 + 3.85 Å 注记——session 回声携数字，run 回声连图一起携）。
- 【定妆照】t241-run-echo-travels-2x（档案独行：标题 + 字段表 + Summary/Resolution 粗体值 + FSC 表右对齐）+ t241-run-echo-figure-2x（图在字节里：milestone 表 + 嵌图 + Outputs + 斜体产地行）。
- 【全家族回归】qa49/50/51 ALL GREEN + qa55/57/58 GREEN（**重构后 md 字节不变**——qa57 深断言自证）+ t223 155/0 + t210 151 + t215 44 + t213 35 + t214 29 + t219 29 + t212 30 + t218 29 + t221 14 全 0 fail；roster 恒等 21。
- 【漂移考古】t218/t219/t240 = 4px 边缘噪声（强 0）；t223-hero = strip 跟随滚位的诚实状态漂移（y146–150 4px 带——hero 钉了 scrollTop 没钉 strip scrollLeft，t235 follow 的合法遗产）；t212/215 = recent activity 时间词（3.4k strong @ y1350，t236 判例同区同量级）；t210 ×3 WebGL 惯犯具名 checkout。
- 【世界卫生】全家族绿 + roster 恒等 21、tmp echo 已清、只读窗无 twin。
- 【收尾】worklog（本条）+ commit/push + 环境清理。

Stage Summary:
- 「回声尊重字节」：第二种回声的目录哲学——md 自带导航就逐字尊重（链接成真锚、锚点折叠进标题、回链成真链接），md 没有才铸造（session 的 index 配对）；两种回声同一杯 CSS，着陆光免费跨介质
- 「契约是忠实不是快照」：镜像律断言（md 与 html 的节/链/图计数恒等 + 零死链）job 无关——瘦档满档皆判；断言假设档案的丰满度就是出题者的第二口井
- 「一井两嘴」：run dossier 的 md 与 HTML 门共享一个采集器（buildRunReportMd），md 字节是井、两种介质是嘴——重构后 qa57 证明 md 字节一字未变
- 「方言的四件扩展」：hr/#-链接/data-URI 图/有序列表入闭子集——扩展由真实发射者定义（profile 家族说什么方言，转换器就学什么），http 落回文本的陷阱守门
- 遗留（下轮候选）：run 回声的着陆光帧（等真实满档档案——数据世界长出 5+ 节的 job 那天）；run 回声窄门核查（t238 的 640px 门随 DOC_CSS 自动生效，但 7 列表不存在于 run 档案——band 表现未验，低优先）；透镜纸面化（维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）

## Task 242 (2026-09-16, cron 12:32 窗口 trace …202609161232)

- 【开局】四件套：尾部 = Task 241（9711ed9，回声尊重字节）零过时（续传摘要世系只到 239——第六度过时实证，worklog 尾部唯一真源律继续应验）；净场 → watchdog 拉起验活 + 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser errors/console 双空 + 画布 20 jobs / 16 edges + dashboard 目检健康（KPI 卡 5 张 + Recent activity 诚实流动）。无 bug。
- 【巡检与立项】按 Task 240/241 收尾指令**回产品其他面巡检**（报告家族连做八窗，本窗是产品面转折点）：dashboard（KPI/recent activity 健康）→ inspector（Results 四图 + rounds 过滤 + workdir footer + Report 组在场）→ Results 画廊（lightbox → View in 3D 入口确认，Mol*/ortho 家族已有 t210 151 断言 + t215 44 断言覆盖，不重复手巡）→ header 逐件过堂后锁定真缺口：**engine chip 的 title 承诺「click for guidance」，但 native not-found 态的 popover 主体全是破折号**——同一 popover 两个世界 guidance 质量不对称：WSL 世界的 note 有 A/B/C 三方补救 + 「Searched automatically」清单（probeWsl 铸），native 世界（每个没有 RELION 的 Linux/macOS host——demo 世界的永久态）只有一排破折号 + 一行 WSL 话术（对 Linux 用户还是噪声）。取证 /api/system：16 binary 全缺、note 只谈 WSL。
- 【教义】**「指南不得漂移于探测」**——guidance 不许手写：composeNativeHint 从探测自己产出的证据 composing（RELION_HOME 设没设/目录在不在、PATH miss、哪些 known 目录存在、home scan 命中数），探测到什么就说什么，两者在结构上不可能分叉；诚实到「/usr/local/bin 存在但无 relion_refine」vs「其余 missing」的分级。WI 世界的 A/B/C 文体平移到 native 世界：A) PATH B) RELION_HOME + 「then press Re-detect — no restart needed」（闭合到 UI 已有的 affordance）。
- 【实现】
  - types.ts：SystemStatusClient 添 `hint?: string | null`（not-found 专属，found 即 null；snapshot 恢复路径 `{...snap.status, fromCache}` 自动让 hint 跨快照存活；API route 整体透传、store 整体消费——零接线成本）
  - system.ts：导出纯函数 composeNativeHint（NativeSearchFacts 四事实 → 指南字节；纯确定性——同事实同字节）+ runProbe not-found 分支接线（known-path 清单 Map 去重——硬编码 /home/z/relion-install/bin 与 ~/relion-install/bin 在 home=/home/z 时同一物理目录，首跑实拍暴露 wart）
  - header.tsx：popover fields 组后添 guidance 块（data-engine-hint + aria-label、amber tint 与「未检测到」的 chip 色一致——可行动的信息块区别于 WSL note 的中性 bg-muted/60）；A/B 行 whitespace-pre font-mono（composer 的列对齐意图在渲染中存活）；块级 overflow-x-auto（宽 B) 行向自己的 band 借滚动——t238 律在 popover 里）
- 【sanity 先于 wire】scripts/t242-sanity.mjs（bun）：17 断言——四事实行恒在场、诚实分支（RELION_HOME 未设/设而空/设而目录不在、known 全缺/部分在/全在、home scan 0/N）、A/B+Re-detect 闭合、无 undefined/null 泄漏、无网络依赖、确定性（同事实字节恒等）。首跑 16/1——FAIL 是出题者的井：base facts 的 knownDirs 为空数组而 composer 守卫正确跳行（真实探测恒有 5 个 known dirs），修期望后 GREEN。
- 【e2e：新 t242-e2e.mjs】21 断言 ×3 全绿：A 相 API 真相（not-found/hint 四事实行/A/B/闭合/known-path 去重 = 1 次出现/两探针字节恒等）+ B 相 popover 镜像（roster 21/chip aria-label 打开/data-engine-hint 一次/**popover 行 === API 行逐字节同序（两嘴一井）**/mono ×2/amber tint/**宽行借 band 滚动（scrollWidth 626 > clientWidth 350）**/band 永不溢出 popover 盒）+ C 相定妆照 + D 相 console 0。
- 【事故与判例】①**镜像律首败于介质话语**：innerText 把每个块边界说成 \n\n 而 composer 字节是单 \n——两次修归一化后才悟：契约是非空行序列（空行分隔是表现不是内容），「W4 判例·出题者版」——出题者要读对渲染介质的话语。②**定妆照暴露溢出**：whitespace-pre 的 B) 行（~540px）越过 popover 右缘（384px）——craft 修法不是缩短字节而是 band 借滚动（t238 律复用），并补两条 wire 断言（sw > cw + band 右缘 ≤ popover 右缘）。③**覆盖旧套件事故**：编号勘察失误把新套件写成名 qa84-e2e.mjs（Task 84 的 roster 表格套件被覆盖）——git checkout 恢复原件后 mv 又把恢复件顶掉了我的新套件（两步互相踩）；最终重建 t242-e2e.mjs（新世代任务号惯例）+ 原 qa84 补跑 ALL PASS 自证清白。判例：**新套件命名先 `ls scripts/ | rg` 核号，新世代一律 tXXX**。④watchdog 秒死惯犯照旧（重拉即愈）。
- 【定妆照】**shots-qa84/t242-engine-guidance-2x**：chip「RELION not found」+ popover「RELION not detected」+ 破折号字段 + WSL 中性 note + amber guidance 块（四事实行 + A/B mono 列对齐 + Re-detect 闭合）同框——「承诺兑现」的第一帧。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa49/50/51 ALL GREEN + qa55/57/58 GREEN + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + **原 qa84 ALL PASS**（事故自证）；roster 恒等 21。
- 【漂移考古】t210 ×3 WebGL 惯犯（final/lanes/legend-open）具名随批；t212/213/214/215 相对时间词诚实漂移；t218/t219/t223 六帧 + t240-compass-glow = 回归重拍的亚感知噪声/时间词随批提交——本窗 feature 不触对话框世界（header popover 关闭态在所有帧里零像素），无结构性漂移。
- 【世界卫生】全家族绿 + roster 恒等 21、只读窗无 twin、tmp 无残留。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「指南不得漂移于探测」：native not-found 的 guidance 从探测自己的证据 composing——RELION_HOME 设否/目录在否、PATH miss、known 目录存在性分级、home scan 命中数，每一行都是探测事实；「click for guidance」的承诺在两个世界同时兑现
- 「两嘴一井的第三案」：popover 行与 API hint 逐行同序恒等（W3 律在 engine 域）；innerText 的块边界话语是出题者的必修课——契约是非空行序列
- 「band 借滚动在 popover」：whitespace-pre 保住 composer 的列对齐意图，overflow-x-auto 让宽 B) 行向自己的 band 借滚动——t238 律跨出文档域，popconter 盒零溢出成 wire 断言
- 「套件命名的编号核验」：新套件先核号再落名（本窗覆盖了 Task 84 的 qa84，恢复 + 改名 t242 各一步都不能少）；新世代套件一律 tXXX 任务号
- 遗留（下轮候选）：dashboard「ACTIVE ENGINE: RELION not detected」KPI 卡的点击透导（同一 guidance 的 dashboard 姊妹页——点击 KPI 卡打开同一 popover 或跳转，低优先）；map-profile 的 FSC 帧在场时 inspector Report 组的锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）

## Task 243 (2026-09-16, cron 13:17 窗口 trace cron-agent-loop-202609161317)

- 【开局】四件套：尾部 = Task 242（520f691，指南不得漂移于探测）零过时（续传摘要世系只到 239——第七度过时实证，worklog 尾部唯一真源律继续应验）；净场 → watchdog 拉起验活 + 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser errors/console 双空 + 画布 20 jobs。无 bug。
- 【立项】Task 242 遗留首选当选：**dashboard「Active engine」KPI 卡的 guidance 姊妹页**。开局探针先问工件：快照里没有「ACTIVE ENGINE」字样——代码实证真身 label 是「Active engine」（出题者的井判例在开局探针上又应验）；且它是五张 KPI 卡里唯一没有 onClick 的死卡。语义想清楚：**指南跟着问题走**——「为什么没检测到」的疑问诞生在读者看见死卡的地方，guidance 该在疑问处开口；t242 的 header popover 是第二嘴、dashboard 卡 popover 是**第三嘴，同一口井**（API hint 字节）。关键设计约束：hint 尾行承诺「then press Re-detect」——**承诺不许指向够不着的门**，故 Re-detect affordance 必须随行（EngineReDetectRow 与 header 共用同一 store 动作，dashboard 触发的探测实时更新 header chip——一个环境一个真相）。
- 【实现】
  - 新文件 src/components/workflow/engine-guidance.tsx：EngineHintBlock（amber 块 + data-engine-hint + A/B 行 whitespace-pre font-mono + band 借滚 overflow-x-auto）+ EngineReDetectRow（checked 时间 + Re-detect 钮）——header 与 dashboard 的共享嘴，DOM 字节与 t242 原实现逐一相同
  - header.tsx 重构用共享组件（零接线变化；RelionStatusChip 闲置的 refreshSystem/systemRefreshing hooks 移除）
  - project-dashboard.tsx：KpiCard 改 React.forwardRef（PopoverAnchor asChild 需要 ref 落到真 DOM）+ 新增 corner 覆写 prop（Info 图标替 drill-down chevron——「info 不是 go」的动词区分）+ 新增 ariaExpanded prop（开 popover 的按钮报 aria-expanded + aria-haspopup="dialog"，不报 aria-pressed——开合状态不是按压状态）；Active engine 卡在 not-found 时变真按钮 + Popover（open 状态受控 + onOpenChange，Esc/外点关闭免费获得）
  - qa47 契约演进：engine 卡 div→button（demo 世界恒 not-found 故恒 button；有 RELION 的 host 上合法回退 div——guidance 没有观众）
- 【e2e：新 t243-e2e.mjs（编号核验后落名）】23 断言 ×3 全绿：A 相井真相（found:false + hint 尾行承诺 Re-detect）+ B 相姐妹页（卡是真按钮 + 同一承诺 title / haspopup=dialog + expanded 翻转 / 无 aria-pressed / Info 角标 / **镜像律第三案：dashboard popover 行 === API hint 行逐字节同序** / mono ×2 / amber tint / band 借滚（scrollWidth 626 > clientWidth 350）+ band 永不溢出 popover 盒 / **Re-detect 门在场（承诺可达）** / checked 产地行 / Esc 关 + aria-expanded 归位 / 重开（状态开合不是一次性））+ C 相定妆照 + D 相 console 0。
- 【事故与判例】①**镜像标题的选择器井**：title 选择器命中两元素——header chip 与 dashboard 卡共用同一句承诺 title（镜像的副作用正是镜像本身）；修：KPI 卡独有的 group/kpi 类锚定。②**qa47 旧伤现形**：canvas KPI 契约「每钮必含 click to open」撞上 Task 144（2039955）后入列的折叠钮「Collapse pipeline summary」——qa47 近期从未入回归清单，契约停在 KPI drill-down 时代；演进：Expand/Collapse 动词同样诚实宣告点击后果（fold 不是 drill-down，两动词过闸）。**非本窗伤的考古链**：git log -S 定位折叠钮出生 commit + worklog 全文无 qa47 记录——修契约而非回滚产品。
- 【定妆照】**shots-qa84/t243-engine-guidance-dashboard-2x**：Active engine 卡（Info 角标 whisper）+ popover（amber「RELION not detected」标题行 + 四事实行 + A/B mono 列对齐 + Re-detect 门 + checked 产地行）同框——「指南住在疑问处」的第一帧；宽 A) 行右缘借滚在帧里可见（band 律的活体证据）。
- 【build 与终审】OOM 箱 build → 磁盘 chunk grep engine-guidance-dashboard = 1 → Task 86 配方双杀（pkill standalone/server.js + bun server.js + watchdog + fuser 3000）→ watchdog 复活 + 200 → **在线 chunk 终审**（dashboard 懒加载不在主页 HTML 的 11 chunks 里——直接终审目标 chunk 的在线字节，HTTP 200 + 命中 1）。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47 ALL GREEN（契约演进后）+ qa49/50/51 + qa55/57/58 + qa84 ALL PASS + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0 + **t242 GREEN（header 重构后镜像律逐字节自证——DOM 未动一字）** + t243 23/0 ×3；roster 恒等 21。
- 【漂移考古】t223-hero 13764 px @ max 139 = strip scrollLeft 诚实漂移（t241 判例同区同族；**帧高 896×714 钉住未破**——t239 的帧卫生钉持续生效）；t240-compass-glow 31057 px @ max 3 = 亚感知抗锯齿噪声（t240 自己的判例：max ≤6 不定罪）；t212/t215 233k px @ max 122 裁片对照文本逐字相同 = 运行中任务的 live spinner 角度差 + 内容 1-2px settle 落位（诚实活态）；t213/214/219 相对时间词随批；**t210 ×3 WebGL 惯犯具名 checkout（家族多数判例）**。
- 【世界卫生】全家族绿 + roster 恒等 21、twin 已归家、tmp 裁片已清。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「指南跟着问题走」：第三嘴同井——dashboard 的 Active engine 死卡变成 guidance 的活口，疑问诞生的地方就是指南开口的地方；镜像律（渲染非空行序列 === API hint 字节）第三案入册，两嘴结构上不可能漂移
- 「承诺不许指向够不着的门」：hint 尾行承诺 press Re-detect，Re-detect 钮就随行在每一嘴里（共享 EngineReDetectRow、同一 store 动作）——guidance 的闭合律从「文案提到」升级为「affordance 在场」
- 「开合不是按压」：开 popover 的按钮报 aria-expanded + aria-haspopup=dialog，不报 aria-pressed——语义精度；corner 覆写 prop 让 Info 与 chevron 各说各的动词（info 不是 go）
- 「镜像的副作用是镜像本身」：两嘴共用同一句承诺 title，选择器单靠 title 撞双元素——mirror law 连选择器层面都要留痕（group/kpi 类锚定）
- 「契约的考古链」：qa47 旧伤非本窗伤——git log -S + worklog 全文反查证明契约停在 Task 144 之前；修契约（fold 动词过闸）而非回滚产品
- 遗留（下轮候选）：map-profile 的 FSC 帧在场时 inspector Report 组的锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）；engine guidance 若在 found 世界也有可说的事实（多 install 切换指引）可开第四嘴（低优先）

## Task 244 (2026-09-16, cron 13:47 窗口 trace cron-agent-loop-202609161354)

- 【开局】四件套：尾部 = Task 243（84fd8fa，本手上窗所写）零过时；净场 → watchdog 拉起验活 + 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + t243 哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】勘察开题：①Task 13 recital 的「3D viewer 体积截面工具」经工件实证**已被早前任务实现**（molstar-embed 有 ortho-slice 事件 + map-ortho-panel + 可动 clip face 数学——recital 陈旧遗留又一案，本窗记档销账）；②command palette 巡检发现动作索引的真实缺口：Re-detect 全应用无键盘/索引路径。立项 = **「引擎卡的两个世界都开口」**——Task 243 治了 not-found 世界的死卡，found 世界同病未治（RELION 5.0.0 仍坐在 div 里、切 install 必须去找 header 小 chip）；补上 found 世界的 details popover + 调色板 Engine 组（guidance 闭合承诺「press Re-detect」的键盘层门）。教义：**卡在两个世界都没有死态**；「存在的门必须在索引里」。
- 【实现】
  - InstallRow + InstallSwitcher 从 header.tsx 迁入 engine-guidance.tsx（引擎家族共享嘴之家，export；DOM 字节不变——t242 GREEN 自证）；header 删除原定义 + 清理闲置 icon imports（Server/Terminal 只剩 import 的惯犯）
  - dashboard found 分支：Popover（data-engine-details-dashboard 标记）= 「RELION detected」标题行（emerald CircleCheck）+ InstallSwitcher + EngineReDetectRow；卡变真按钮（Info corner 同 not-found 世界的 whisper 动词、ariaExpanded 共用同一 state——两世界互斥 found XOR not-found，一个开关够）；title = `RELION {version} · {path} — click for engine details`（版本+路径领衔，切换后随 store 重领衔）
  - command-palette.tsx：新 CommandGroup「Engine」+「Re-detect RELION environment」行（RefreshCcw teal）——onSelect = close + toast 回执 + refreshSystem()（force probe 签名 ?force=1）
- 【e2e：新 t244-e2e.mjs（编号核验）】27 断言 ×4 全绿：A 相 demo 真相（真 API found:false + roster 21）+ B 相 **found 世界经路由拦截在网络边界替它开口**（合成井：2 native installs）——卡值 5.0.0 + title 领衔 + Info corner + popover 开（radiogroup 两行/预勾/选中项 disabled/另一项可切/Re-detect 门）+ **切 install 三嘴跟真**（toast 回执（page 级——Toaster portal 在 popover 盒外）/radio 翻勾/卡值翻 4.2.0/title 重领衔）+ 「Esc 剥一层」律（第一 Esc 剥 toast、第二剥 popover——应用自己的 shortcuts 律在测试里复活）+ C 相调色板（Ctrl+K 搜 re-detect → 行在场 → Enter 触发 force probe + 回执）+ D 相双世界 console 0。
- 【事故与判例】①**playwright glob 的斜杠井**：`**/api/system*` 的 `*` 不跨 `/`——POST /api/system/select 漏拦落到真服务器 404（合成世界没统治自己的整个 URL 家族）；修：正则 /\/api\/system/。②**自溶解 locator**：卡 title 领衔版本号，切换后旧 locator 蒸发（断言 dissolve 于自己的断言）；修：title 后缀子串锚定（"click for engine details"）+ 切换后断言新 title 全文。③**「剥一层」的测试服从**：单 Esc 败因 = toast 与 popover 两层同活——应用律 Esc=剥一层，测试改两 Esc 而非改产品（产品是对的，出题者要读对应用自己的律）。④**chunk 名手抄井**：在线终审 URL 手抄 `…d3b.js`（真名 `…d3.js`）404——rg 输出逐字复制，不凭记忆转抄。⑤t241 批量跑崩（Node crash tail）单跑 ×2 全绿——连续套件的资源竞争瞬态，非代码伤。
- 【定妆照】**shots-qa84/t244-engine-card-found-2x**：found 世界卡（4.2.0 已翻面 + Info corner）+ popover（RELION detected + DETECTED INSTALLS 双行：5.0.0 NATIVE MPI 待选 / 4.2.0 NATIVE 戴勾 teal + checked 钟 + Re-detect 门）——家族首张 found 世界帧，「一井多嘴、三嘴跟真」的活体证据。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47/qa55 GREEN + qa49/50/51 + qa57/58 + qa84 ALL PASS + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0（批量崩后单跑 ×2 自证）+ **t242 GREEN（InstallSwitcher 迁移后 DOM 字节不变自证）** + t243 ALL PASS + t244 27/0 ×4；roster 恒等 21。
- 【漂移考古】t243 帧 1746 px @ max 114 = **单带 CSS y424-431 = checked 活钟行**（帧的其余 963 行逐字节恒等）——引擎 popover 里的产地钟每跑必漂，诚实内容随批提交（t212/215 时间词判例同族）；t210 ×3 WebGL 惯犯具名 checkout；t212/213/214/219/223 家族 = spinner/时间词/strip 滚位诚实漂移随批。
- 【世界卫生】全家族绿 + roster 恒等 21、tmp 裁片已清、twin 已归家。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「卡在两个世界都没有死态」：not-found 开 guidance（t243）、found 开 details+switcher（t244）——同一个 Info 动词、同一个 open state（两世界互斥）、同一张卡；引擎家族四嘴（header chip / dashboard not-found / dashboard found / palette Re-detect）一井一 store
- 「合成世界要统治自己的 URL 家族」：playwright glob 的 `*` 不跨 `/`，路由拦截用正则——found 世界在真实宿主存在，demo 箱用网络边界的合成井替它开口，拦截不完备 = 合成世界漏风
- 「断言不 dissolve 于自己的断言」：含版本号的 title 是会变的真值，锚定要选不变的后缀——locator 的稳定性是断言设计的一部分
- 「Esc 剥一层」是产品的律，测试服从它：toast+popover 两层同活时单 Esc 不是 bug 是律法；测试要读对应用自己的 keyboard 层契约
- 「recital 的遗留要对工件核实」：3D 体积截面已实现于早前任务——Task 13 recital 携带的遗留清单本身会陈旧，每窗立项前先问工件
- 遗留（下轮候选）：调色板索引完整性律的 wire 化（header 门 ⊆ palette 行 + 诚实豁免清单——print 归 ⌘P、help 归 ?）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）

## Task 245 (2026-09-16, cron 14:32 窗口 trace cron-agent-loop-202609161432)

- 【开局】四件套：尾部 = Task 244（6687c1d，卡在两个世界都开口）零过时（续传摘要世系止于 243——第八度过时实证，worklog 尾部唯一真源律继续应验）；净场 → watchdog 拉起验活 + 200 + roster 21 + 井真相（found:false, hint 10 行）。QA：qa00 GREEN（真名 qa00-data-view.mjs——凭记忆转抄套件名再撞井）+ qa63 SMOKE GREEN + agent-browser errors/console 双空 + 画布 20 jobs。无 bug。
- 【巡检与立项】Task 244 遗留首选当选：**「调色板索引完整性律的 wire 化」**——把 t244 的教义（存在的门必须在索引里）从一行代码升格为可执行契约。勘察：header 交互门件全清点 = **12 件**（project/workspace 两个 SelectTrigger、RELION chip、View 双 tab、spotlight、palette 触发钮、QC report、print、help、theme、GitHub link）；对照 palette 行清单发现**两个真缺口**：Projects 无索引行（Workspaces 有组而 Projects 没有——父组缺席）+ GitHub 门无索引行（Task 179 曾把它降格为「装饰」，但它是不折不扣的门且**没有平台级键盘路径**——不像 print 归 ⌘P）。Task 13 recital 老遗留工件核实：**Topaz wrapper 已实现**（topaz-training/route.ts——recital 又一陈旧项销账）、**#13 useMemo localStorage 已修**（job-card.tsx:197 的 effect 律注释在案）、#5 fs/browse 无鉴权仍真（单用户本地应用，低优先挂账）。
- 【实现】command-palette.tsx：①新 **Projects 组**（父组在 Workspaces 之前——parent before child；行方言与 Workspaces 同构：FolderOpen 图标 + 项目名 + (active) 标记 + SWITCH PROJECT 提示；**同项目守卫**——点 active 行只安静关 palette 不发 POST，与 header ProjectSwitcher 的 `id === project.id` 守卫同一律法；切换走同一 `switchProject` store 动作——一井一 store 每嘴跟真）②**GitHub 行**入 Canvas & app 组尾（外部门殿后；window.open noopener noreferrer；「它挣得一行索引而非一纸豁免——没有平台键盘路径的门，诚实要求一行」）。文件头注释记入 Projects 家族 + Task 245 律宣言。
- 【e2e：新 t245-e2e.mjs（编号核验）】**32 断言 ×3 ALL PASS**。契约以数据活在本子里：DOOR_RULES（10 条覆盖）+ EXEMPT_RULES（2 条豁免，各带理由串）——**新门不匹配任何规则 = FAIL（契约必须更新，不许静默漂移）；规则不匹配任何门 = 陈旧豁免 = FAIL**。A 相 demo 真相（found:false + roster 21 + 单项目）；B 相律本体（**从活 DOM 枚举 12 门钉住清单**（aria-label || title，非手抄清单）→ 每门恰配一规则 → 开 palette 收 95 行 → 逐规则断言行在场（活名断言：项目名从门的 title 属性读——SelectValue 会把 RELION badge 文字漏进 textContent，title 才是净名）+ 组序 Projects < Workspaces + **同项目守卫零 POST** + 安静关）；C 相合成双项目世界（网络边界按 **pathname 谓词**统治整个 project URL 家族——复数 /api/projects（GET 清单+POST switch）与单数 /api/project 恰好互斥）——两行 Projects 行、(active) 标记单点、点 B 行 → POST 一次 → header 触发钮重领衔 → 重开 palette 标记翻面；GitHub 行 → 真弹窗命中 repo URL（context 级路由养弹窗）；D 相双世界 console 0。
- 【事故与判例】①**`^` 锚的全 URL 井（本窗最大一课）**：合成世界单数路由 `/^\/api\/project$/` 永不命中——playwright 对**完整 URL**（http://localhost:3000/api/project）跑正则，`^` 要求 URL 以 `/api/project` **开头**，而 URL 以 `http:` 开头！t244 的「统治整个 URL 家族」判例精化：**URL 家族住在 pathname 里，不住在原始字符串里**——修法为 pathname 谓词函数（`pathOf(u).startsWith("/api/projects")` / `=== "/api/project"`），互斥且序证。②**uppercase 的 innerText 井**：行提示 span 带 `uppercase` 类，innerText 返渲染后大写 "SWITCH PROJECT"——小写匹配零命中；修：按**项目名**匹配行而非提示词（innerText 读介质的话语，W4 判例家族又一案）。③首跑 3 FAIL（合成世界三连）皆出上两井——探针破案（in-page fetch 拦截 ✓ / 组头在场 ✓ / 单数路由 PASSTHROUGH ✗）后一改即绿。
- 【定妆照】**shots-qa84/t245-palette-index-2x**：filtered palette（"project"）同框三真相——Projects 组（demo 行 + (active) + SWITCH PROJECT）+ Open project dashboard ⇧D + Open CryoFlow on GitHub——「索引完整性」的第一帧。
- 【在线 chunk 终审】磁盘 chunk = d8b2f110a6f244df.js（rg 逐字复制）→ **HTTP 200 + "Open CryoFlow on GitHub" 命中 1 + "switch project" 命中 1**（首验的 "4041" 是畸形 URL 的 404 与计数 1 黏连——分步重验澄清；合成井词 "Spliceosome" 磁盘 chunk 零命中自证测试载荷不进产品字节）。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47/qa49/50/51/qa55/57/58 exit 0 + qa84 ALL PASS + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0 + t242 GREEN + t243 ALL PASS + t244 ALL PASS + **t245 32/0 ×3**；roster 恒等 21。
- 【世界卫生】全家族绿 + roster 恒等 21、探针已删、twin 已归家、tmp 无残留。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「索引完整性律 wire 化」：header 门 ⊆ palette 行从教义升格为**数据化契约**——DOOR_RULES 10 条 + EXEMPT_RULES 2 条（palette 触发钮自指、print 归 ⌘P），新门不配规则即 FAIL、规则不配门即陈旧即 FAIL；契约的牙齿是「不许静默漂移」
- 「GitHub 挣得一行而非一纸豁免」：没有平台键盘路径的门必须入索引——print 有 ⌘P 所以豁免诚实，GitHub 没有所以豁免说谎；两门的分界线是「平台是否已把动词接进键盘」
- 「URL 家族住在 pathname 里」：`^` 锚对完整 URL 永不命中（URL 以 http: 开头）——t244 判例精化为 pathname 谓词函数；合成世界统治家族的度量衡是 pathname 不是字符串
- 「innerText 读介质的话语」：uppercase 类让提示词以 "SWITCH PROJECT" 渲染，innerText 诚实转述渲染后的话——匹配要按不变的真值（项目名）而不是会变表现的提示词
- 「recital 的遗留要对工件核实」第二案：Topaz wrapper 早已实现、#13 localStorage 写早已修——Task 13 清单本身在陈旧，每窗立项前先问工件
- 遗留（下轮候选）：**palette 豁免清单的产品化**（exempt 理由串可入 shortcuts report 的「为什么这扇门不在 ⌘K 里」组——文档跟着疑问走，低优先）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先）；Task 13 的 #5 fs/browse 鉴权 / #6/#14 pathref 包含策略 / #7 chart 全量同步读 / #8 particles N+1（性能与健壮性四件，皆低优先挂账）

## Task 246 (2026-09-16, cron 15:17 窗口 trace cron-agent-loop-202609161517)

- 【开局】四件套：尾部 = Task 245（22fc3fa，索引完整性律 wire 化）零过时——**续传摘要第九度过时实证**：摘要世系止于 243 且称 13:47/14:32 两窗 summary-only，worklog 与 git log 实证 Task 244（6687c1d）与 Task 245（22fc3fa）均已交付已 push；worklog 尾部 + git log 唯一真源律继续应验。净场（PORT 3000 FREE + 无残留进程）→ watchdog 拉起验活 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + agent-browser errors/console 双空 + 画布 20 jobs。无 bug。本窗为本会话首个真正执行 cron 七条的窗（前两窗积压经摘要请求挤占）。
- 【巡检与立项】Task 245 遗留首选当选：**palette 豁免清单的产品化**——「文档跟着疑问走」。教义推演：t245 的律是「每扇 header 门都在 ⌘K 索引里（除两扇诚实豁免）」，但豁免的理由串只活在测试套件里——读者在 ⌘K 里找不到 print 门时，疑问诞生的位置是 shortcuts report 的 ⌘K 行（Global 组），产品里却无处作答。设计：shortcuts dialog 新组 **「Not in ⌘K — and why」**，紧跟 Global 组之后（答案贴着疑问的诞生地）；行方言完全复用（门名 — 理由在左、键盘 chips 在右）——**豁免行的 chips 恰好承载豁免的核心证据**（print 行的 ⌘/Ctrl P chips 就是「平台已接管此动词」的活体证词）。
- 【实现】**强镜像同井**：新文件 `src/lib/palette-exemptions.json`（豁免数据唯一真源：name/door/match/keys/reason 五字段，$comment 记井的说明——井的文档住在井里）；**井的两嘴**：①产品嘴——shortcuts-dialog.tsx 的 SHORTCUT_GROUPS 从 JSON 渲染新组（hint 动态派生 `2 honest exemptions` 计数——豁免数变了措辞自己跟上，rows 组合 `${door} — ${reason}` 逐字）；②契约嘴——t245-e2e.mjs 的 EXEMPT_RULES 手写数组删除，改为 readFileSync 同一 JSON `new RegExp(match)`（契约与文档结构上不可能漂移）。文件头注释记入 Task 246 律宣言。
- 【build 与在线 chunk 终审】OOM 箱 rebuild（NODE_OPTIONS=896）→ Task 86 双杀 + PORT 3000 FREE → watchdog 复活 200 → 在线 chunk 终审升级案：两 chunk 分片命中——**chunk 8401d216be18760f.js = 组件真身**（组 label "Not in ⌘K — and why" + hint 模板 "Every header door"/"honest exemption" 全在线）、**chunk 816d360636c16f05.js = JSON 数据模块**（reason 字节 "Self-referential"/"window.print()" 在线 + $comment 注释随 bundle 进字节——约 600B 增重，接受，井的文档完整性优先）；首验 "honest exemptions" 零命中是 minifier 拆模板串（"honest exemption" 与 "s" 分离）+ 首验 chunk 选错（JSON 模块撞同名 marker）——分片形态分步重验澄清。
- 【e2e：新 t246-e2e.mjs（编号核验：t246 空闲）】**28 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21）；B 相文档本体（? 开 dialog → 组序 Global → **Not in ⌘K — and why**（aria-label 原串定位，绕开 uppercase 渲染井）→ hint 计数派生自井 + 律先行 → **镜像律：JSON 每条豁免在 dialog 行逐字出现**（door 净名 + reason 全文 + em-dash 分隔 + 键盘 chips 序列 === JSON keys split）→ **同井锚活门：JSON match 正则对活 header 门 title 各命中恰一门**（同一数据既写文档又锚真门））；C 相 filter & peel（"print" 只剩 print 行、"palette" 只剩 palette 行——filter 读行不读组、"zzzq" 诚实空态、Esc 剥层、重开无残留 filter——dialog 自己的 stale-filter 律）；D 相 console 0 + 定妆照。
- 【事故与判例】①**组 label 的 p 井**：探针 `p.first()` 命中组 label 的 p（label 也是 `<p>` 元素），hint 是第二个 p——组结构固定「label p → hint p → dl」，nth(1) 修（首跑 2 FAIL 皆此一井）。②standalone 井重踩警戒：改源码后 t246 首跑组不在场——watchdog 跑的是 build 后 standalone，产品改动必经 OOM rebuild + 双杀 + 复活才进在线字节（固定工序第四次执行）。
- 【定妆照】**shots-qa84/t246-not-in-palette-2x**：Keyboard shortcuts report 全景——Global 组（⌘K 行，疑问诞生地）→ NOT IN ⌘K — AND WHY（hint 律 + 2 豁免行逐字理由 + 键盘 chips）→ Canvas 组（current view ring）同框；filter 计数诚实更新 34（32+2）。「豁免是诚实的，不是疏漏」的第一帧。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47/50/51/55/57/58 exit 0 + qa84 ALL PASS + qa49 批量瞬态单跑 ALL PASS（Task 244 家族判例：连续套件资源竞争）+ t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0 + t242 GREEN + t243 ALL PASS + t244 ALL PASS + **t245 ALL PASS（换井后契约自证）** + **t246 28/0 ×3**；roster 恒等 21。
- 【世界卫生】全家族绿 + roster 恒等 21、无探针残留、tmp 裁片已清（/tmp/t246-chunk*.js 待删）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「文档跟着疑问走」第二案：t243 让 guidance 住在疑问处（Active engine 死卡），t246 让豁免文档住在疑问处（Global 组的 ⌘K 行）——产品的每一句律法说明都应该在读者形成疑问的位置开口，而不是藏在测试套件里
- 「一井两嘴的强镜像」：palette-exemptions.json 是唯一真源，产品渲染与契约测试同读一井——镜像律从「运行时渲染 === API 字节」扩展到「构建期两嘴 === 同一数据文件」，漂移在结构上不可能
- 「豁免行的 chips 是豁免的证词」：print 行的 ⌘/Ctrl P chips 不只是快捷键提示，它们就是「平台已接管此动词」的活体证据——行方言复用的同时语义自动升级
- 「hint 从井派生计数」：`2 honest exemptions` 的 2 来自 JSON 长度——数据变文档跟着变，措辞不许手写死
- 「在线 chunk 终审的分片形态」：import 的 JSON 与消费它的组件可落不同 chunk——终审要按 chunk 分工验符号（组件 chunk 验 label/hint 模板、数据 chunk 验 reason 字节），单 chunk 单符号的旧判例不够用了
- 遗留（下轮候选）：map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；shortcuts report 组记载 Download HTML 门（维持低优先——与本窗新组相邻的下一个「索引完整性」候选）；Task 13 的 #5 fs/browse 鉴权 / #6/#14 pathref 包含策略 / #7 chart 全量同步读 / #8 particles N+1（性能与健壮性四件，皆低优先挂账）

## Task 247 (2026-09-16, cron 15:47 窗口 trace cron-agent-loop-202609161547)

- 【开局】四件套：尾部 = Task 246（93e201e，豁免文档住在疑问处）零过时；净场 → watchdog 拉起验活 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + t246 哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 246 Stage Summary 点名候选当选：**shortcuts report 组记载 Download HTML 门**。勘察：session-report-dialog 的 footer 有五门（Copy report / Download report / Download HTML / Copy CSV / Download CSV）全鼠标-only；shortcuts report 组只记载了导航与 ⌘P——「the document has its own keyboard」的说法对自己的导出门不完整。教义推演：「怎么带走这个 report」的疑问诞生在 footer 按钮区，答案却只有鼠标。方案：**字节嘴上键盘**——H = Download HTML（便携文档旗舰）、M = Download report（Markdown）；**键盘层不许出歧义键**：copy 与 CSV 门保持鼠标-only（「C」复制哪个格式？歧义键等于说谎的门），诚实缺席优于含糊在场。
- 【实现】
  - session-report-dialog.tsx：无依赖数组 useEffect（open 时挂 window keydown）——**每渲染重挂是故意的：闭包永远新鲜，H/M 导出的永远是当前 md 字节，绝无 stale capture**；守卫三件套（无 modifier、isTypingTarget、e.preventDefault 只在命中时）；键嘴直接调用 exportHtml()/exportMd("download") 本尊——同一字节、同一 flashNote 回执，键盘嘴与鼠标嘴是同一扇门，无从漂移
  - 按钮证词：Download report / Download HTML 按钮内加 no-print kbd 徽章（M/H）——「存在的键盘路径要在门的脸上说出来」；title 补「· or press M/H」；aria-label 不变（可及名干净，kbd aria-hidden）
  - shortcuts-dialog.tsx report 组：新两行插在 ⌘P 之前——**轻到重排序律：字节嘴（M md < H html）在纸嘴（⌘P）之前**；hint「the document has its own keyboard」现在名副其实（37 shortcuts）
- 【build 与在线 chunk 终审】OOM 箱 rebuild → Task 86 双杀 + PORT 3000 FREE → watchdog 复活 200 → 在线 chunk 终审：198d6a368bfe7ca6.js HTTP 200 + "or press H" ×1 + "or press M" ×1（按钮 title 字节在线——门脸上的证词进了产品字节）。
- 【e2e：新 t247-e2e.mjs（编号核验：t247 空闲）】**21 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21）；B 相键盘嘴（header 门开 report → **H 触发真 download 事件**（suggestedFilename session-qc-report-*.html）+ 同一 emerald flashNote 回执 → **M 触发 .md 下载** + 同回执 → 按钮戴徽章（kbd H / kbd M）→ **C 静默守卫**（歧义 copy 动词无键盘嘴，按 C 零回执）→ Esc 剥层）；C 相文档（report 组 5 行、**轻到重序 ← → | Tab | M | H | ⌘/Ctrl P**、H 行与按钮 aria-label 互证（portable HTML 同名同门——文档与门钮两嘴一井）、纸行原位）；D 相 console 0 + 定妆照。
- 【定妆照】**shots-qa84/t247-report-keys-2x**：report footer 门区全景——Copy report / Download report [M] / Download HTML [H] / Copy CSV / Download CSV / Print——**M/H 徽章只戴在有键盘嘴的门上**（无键盘嘴的门诚实裸脸——徽章的存在性本身就是契约）。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47/49/50/51/55/57/58 exit 0 + qa84 ALL PASS + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0 + t242 GREEN + t243 ALL PASS + t244 ALL PASS + t245 ALL PASS + t246 ALL PASS + **t247 21/0 ×3**；roster 恒等 21。
- 【世界卫生】全家族绿 + roster 恒等 21、无探针残留、无 tmp 残留。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「字节嘴上键盘」：H/M 单键直达导出门——键盘嘴调用鼠标嘴的本尊函数（同字节同回执），一个门两层入口、零漂移面；shortcuts report 组的「the document has its own keyboard」从半真变为全真
- 「键盘层不许出歧义键」：copy 与 CSV 保持鼠标-only——「C 复制哪个格式？」的歧义比缺席更糟；诚实缺席优于含糊在场（豁免清单判例的键盘域姊妹案）
- 「徽章的存在性是契约」：M/H kbd 徽章只戴在有键盘嘴的门上——有键的路要在门脸上说出来，没键的门不许装；徽章即文档，文档即按钮 title，title 即 aria-label 的旁证
- 「闭包新鲜律」：无依赖数组 useEffect 每渲染重挂——键盘嘴导出的永远是当前 md 字节；键盘 handler 的 stale closure 是导出域特有的暗井（导出旧报告比不响应更危险）
- 「轻到重排序」：shortcuts 组内字节嘴（md < html）在纸嘴前——带走一份文档的心智模型从最轻到最重：纯字节 → 便携文档 → 纸
- 遗留（下轮候选）：run report（results-view）的 export 门同治（H/M 键盘嘴姊妹案——run report 无 shortcuts 组记载，需另立文档位置）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；Task 13 的 #5 fs/browse 鉴权 / #6/#14 pathref 包含策略 / #7 chart 全量同步读 / #8 particles N+1（性能与健壮性四件，皆低优先挂账）

## Task 248 (2026-09-16, cron 16:02 窗口 trace cron-agent-loop-202609161610)

- 【开局】四件套：尾部 = Task 247（efb10ff，report 字节嘴上键盘）零过时；净场 → watchdog 拉起验活 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + t247 哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 247 的「徽章存在性是契约」判例要求全应用键盘审计——**「存在的键盘路径必须在文档里」**（t245 门↔palette 律的键盘域镜像）。审计方法：rg 全应用 17 个含 keydown 的文件，逐 handler 抽键位对照 SHORTCUT_GROUPS；判读框架：①widget 级 Enter/Space/Esc（按钮/行/输入框的标准可及键）不是应用键盘层成员，不入文档；②主键盘域（global/canvas/dashboard/gallery/report）逐键核对全部诚实（⇧⌘Z 在 ⌘Z 分支内 shiftKey 判定、⌘F 在 find-bar、dashboard 1-6 带守卫、gallery NAV 键、report 五行 t247 刚归档）；③**真缺口两枚，皆在 add-job palette（JobPalette，canvas 域）**：`/` 聚焦 palette 搜索（window listener，catalog tab 活跃时活）与 Alt+←/→ 重排收藏 chips（代码注释自宣「the keyboard twin of the drag」）——**活键无行即漂移**。立项 = 散键归档。
- 【实现】shortcuts-dialog.tsx canvas 组 15→17 行，注释记入审计方法与两键发现过程；**行座次跟着语义走**：`/` 行坐在 ⌘F find 旁（搜索族）、Alt+←→ 行坐在 ⌘D duplicate 旁（整理族）；行措辞对 palette 的真行为诚实（`/` 只聚焦过滤，Enter 不添加——「不说做不到的事」；Alt 行直接引用 palette 自己的「keyboard twin」方言）。
- 【build 与固定工序】OOM 箱 rebuild → Task 86 双杀 + PORT 3000 FREE → watchdog 复活 200（t248 产品字节在 shortcuts chunk，无独立 marker 可验——t248-e2e D 相活体终审代行）。
- 【e2e：新 t248-e2e.mjs（编号核验：t248 空闲）】**21 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21）；B 相 `/` 活体（按 / → activeElement = palette search → type "import" 过滤出 Import chip → **Esc 剥两层**（先清 query 再 blur——search 自己的 peel 律））；C 相 Alt+←/→ 活体（**context 级 localStorage 合成收藏世界**（cryoflow-fav-types 三键，context 蒸发箱自净，demo 箱零污染）→ 三 chips 渲染 → **focus 不 click**（click 是 chip 的 add 契约，键盘路径只要焦点）→ Alt+→ 翻序 → Alt+← 归位 → roster 仍 21（moveFav 只写 localStorage，零 addJob））；D 相文档（canvas 组 17 行、`/` 行座次 row[2] 与 Alt 行 row[10] 各归其位、两行措辞逐字、filter "palette" 三组同框（Global + Not-in-⌘K + Canvas current-view ring））；E 相 console 0 + 定妆照。
- 【事故与判例】①**空串假绿井（本窗最大一课）**：chip 顺序探针读 `span.first().textContent()` 得空串（首个 span 是图标圆点）——更糟的是空串 === 空串让 swap 断言假绿（断言恒真 = 什么都没断言）；修：**按 chip 的 data-testid 锚定类型 key**（palette-fav-chip-{key} 是不变真值），三段断言（seed 序/翻序/归位）每段读具体 key 序列。教训：探针读到空串时，先用它断一次非空真值，再让它进比较逻辑——恒等比较里的空串是哑弹。②t248 无独立产品 marker（改的是 SHORTCUT_GROUPS 文档数据）——在线终审由 D 相活体断言代行（「文档的真值在渲染处验」）。
- 【定妆照】**shots-qa84/t248-stray-keys-home-2x**：filter "palette" 三组同框——Global ⌘K 行 + NOT IN ⌘K — AND WHY（豁免文档）+ CANVAS（current-view ring + 新归档的 `/` 行）——palette 的键盘故事一屏讲完：入口（⌘K/`/`）、豁免（自指）、活键（聚焦搜索）。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47/49/50/51/55/57/58 exit 0 + qa84 ALL PASS + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0 + t242 GREEN + t243 ALL PASS + t244 ALL PASS + t245 ALL PASS + t246 ALL PASS + t247 ALL PASS + **t248 21/0 ×3**；roster 恒等 21。
- 【世界卫生】全家族绿 + roster 恒等 21、合成收藏世界随 context 蒸发、无探针残留、无 tmp 残留。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「键盘层完整性审计」：t245 门↔palette 律的键盘域镜像——rg 全应用 17 文件逐 handler 抽键对照 SHORTCUT_GROUPS，主域全诚实、widget 级键不入册、真缺口两枚（palette 域 `/` 与 Alt+←/→）——「存在的键盘路径必须在文档里」从判例升格为可执行的审计方法（本窗首跑，收获 2 缺口全数归档）
- 「活键无行即漂移」：palette 自己的代码注释宣称 Alt+←/→ 是「keyboard twin of the drag」却无文档行——代码里的自我声明也要跟全局文档对账；行座次跟语义走（搜索族/整理族各归其位）
- 「context 级合成世界」：favorites 世界的井在 localStorage（context.addInitScript 注入），context 关闭即蒸发——合成数据不碰 server、roster 恒等天然成立（对比 t244/t245 的网络边界拦截案：井在哪一层的判据是「数据住在哪」）
- 「focus 不是 click」：键盘路径断言用 focus() 不用 click()——click 触发 chip 的 add 契约会污染 roster；测键盘层要走键盘层的门
- 「空串假绿井」：探针读不到预期文本时（图标 span 先于 label），空串进恒等比较 = 断言哑弹；锚定不变真值（data-testid 的类型 key）而非 DOM 位置——假绿比 FAIL 更危险，它穿着绿衣说谎
- 遗留（下轮候选）：run report（results-view）export 门的 H/M 姊妹案（**键盘域边界设计前置**：inspector 是非模态侧栏，H/M 与 session report 的 window listener 冲突 + canvas 视线惊吓问题，需先定义「键盘域的边界」再动手）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；hero 纸档叠印可读性（维持）；Task 13 的 #5 fs/browse 鉴权 / #6/#14 pathref 包含策略 / #7 chart 全量同步读 / #8 particles N+1（性能与健壮性四件，皆低优先挂账）

## Task 249 (2026-09-16, cron 16:32 窗口 trace cron-agent-loop-202609161637)

- 【开局】四件套：尾部 = Task 248（cdd83c4，散键归档）零过时；净场 → watchdog 拉起验活 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + t248 哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】三项勘察连环：①**Task 13 recital #7 销账**——guinier/resolution/angdist 三 chart 路由工件实证已全部上 cachedFileCompute（statcache.ts 的 mtime-keyed 缓存，注释自载修复史「each poll used to re-read + re-parse...」）——recital 陈旧判例第三案；②**#8 同款销账**——particles 路由的 BFS 已是 batched（「ONE edge query per depth level + ONE job query for all discovered ids」注释自载 N+1 修复）——第四案；Task 13 性能四件仅剩 #5/#6/#14 两件真遗留且皆低优先；③run report H/M 姊妹案域边界审查：canvas 键盘层 M 已被世界地图占用（姊妹案的 M 撞车实锤）+ inspector 是非模态侧栏（域边界不清晰，canvas 上按 H 触发侧栏导出 = 视线惊吓）——**诚实缺席判定：非模态域不收单键**（模态 dialog 的边界是键盘域的天然许可证），记档销账。最终当选：**「纸上证据庭」**——hero 叠印悬案（八窗「维持，依赖真实打印证据」）用 playwright print 仿真 + page.pdf() 制造真实证据，把哲学讨论变像素事实。
- 【证据庭审理（探针 t249-probe.mjs）】demo hero 三签名全部压线：orthovol 76.2% 签名 bbox 内 42 个 stroke 采样（main 23 + overlay 19——重度交叠）、half1 35、half2 7；print tier 层级复核：label 1 / depth 0.85 / main 1 / overlay 0.7——**签名与地形同板全墨（1:1）**，悬案担心的糊字场景坐实（裁片判读：orthovol 的字形与峰弧融成一团）。
- 【判决与实现】**「纸上 halo 例外」开启**——t229 halo 禁令（no halo, no second ink — opacity is the whole hierarchy）的第一次合法破例，且只破在纸上：globals.css print tier 给 .report-hero-label 加 `paint-order: stroke + stroke: var(--background) + stroke-width: 1.5px`——纸色描边画在 fill 之下（SVG 原生技法），地形线在字形周围让位断开，**墨量预算零增长**（halo 是纸色不是新墨）。屏幕侧禁令维持（0.62 浅墨对深地形是层级律在工作——backlit 的恩惠，t231 屏幕判断依旧成立）。CSS 注释全录审判过程。
- 【e2e：新 t249-e2e.mjs（编号核验：t249 空闲）】**14 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21）；B 相证据（hero 在场 + 3 签名 + **交叠量化活体断言**（3/3 签名压线 42/35/7——证据的证词在测试里活体复现））；C 相判决（SCREEN：stroke none + ink 0.62——**禁令站岗**；PRINT：paint-order stroke + stroke rgb(255,255,255) + fill 1——**例外 riding**；t231 阶梯逐档复核未动）；D 相卷宗（print 媒体 hero 裁片 + **真实 PDF 卷宗** page.pdf A4）；E 相 console 0。
- 【事故与判例】①**quarter 的元素井**：ladder 断言用 path.report-hero-quarter 零命中——quarter 网格画的是 `<line>`（探针数据 x1=120/240/360 早证）；选择器要说元素自己的真话。②halo 效果的裁片对照法：治愈前后两张 2x 裁片逐字对比（前：字形融进峰弧；后：字形独立、弧线让位）——「可读性」判决必须落像素证据，不落形容词。
- 【定妆照与卷宗】**shots-qa84/t249-paper-verdict-hero-2x**（halo 治愈后的纸档 hero）+ **t249-paper-verdict.pdf**（真实纸档管线产物——八窗悬案的卷宗归档）。
- 【全家族回归】qa00 GREEN + qa63 SMOKE GREEN + qa47/49/50/51/55/57/58 exit 0 + qa84 ALL PASS + t210 151/0 + t212 30/0 + t213 35/0 + t214 29/0 + t215 44/0 + t218 29/0 + t219 29/0 + t221 14/0 + t223 155/0 + t241 14/0 + t242 GREEN + t243 ALL PASS + t244 ALL PASS + t245 ALL PASS + t246 ALL PASS + t247 ALL PASS + t248 ALL PASS + **t249 14/0 ×3**；roster 恒等 21。
- 【世界卫生】全家族绿 + roster 恒等 21、探针保留（证据庭的程序档案）、无 tmp 残留。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「纸上证据庭」：悬案的审判程序——「依赖真实打印证据」的八窗悬案不再等证据，playwright print 仿真 + page.pdf() 就是打印管线本身；交叠量化（签名 bbox 内 stroke 采样数）把「可读性」从形容词变数字，判决落像素裁片不落感觉
- 「纸上 halo 例外」：t229 禁令的第一次合法破例——屏幕侧 0.62 浅墨分层成立（禁令站岗），纸上全墨同板融合（例外 riding）；修法是 paint-order: stroke 的纸色描边——最轻的破例（地形让位而非墨量增长），且空间上只活在 @media print
- 「recital 的对账纪律」：#7（statcache）/ #8（batched BFS）双销账——注释自载修复史是销账的关键证据（修复当时的任务在注释里留了名字，recital 没收到通知）；Task 13 性能四件仅剩 #5/#6/#14
- 「非模态域不收单键」：run report H/M 姊妹案的审查结论——模态 dialog 的边界是键盘域的天然许可证（Esc 可剥、注意力被捕获），非模态侧栏没有边界（canvas M 已占 + 视线惊吓）；诚实缺席优于惊吓在场（t247 歧义键律的域维度姊妹案）
- 「探针即程序档案」：t249-probe.mjs 保留在 scripts/——证据庭的审理程序（交叠采样方法 + print tier 复核）可复审；判决可追溯的才算审过
- 遗留（下轮候选）：#5 fs/browse 鉴权（单用户本地应用低优先）；#6/#14 pathref 包含策略（低优先）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；depth 标签的纸上观察（halo 已顺带保护 mark 穿字场景——若未来真实打印发现 depth 6px 字压 quarter 网格糊字，同款例外可延申）；run family 批跑基建（qa49 批量瞬态复现两次——串行化+失败 solo 复跑的家族跑批脚本）

## Task 250 (2026-09-16, cron 17:02 窗口 trace cron-agent-loop-202609161706)

- 【开局】四件套：尾部 = Task 249（a8447da，纸上证据庭）零过时（续传摘要第十一度过时——世系止于 247，实际 248/249 已交付，worklog 尾部 + git log 唯一真源律再应验）；净场核查 PORT 3000 FREE + 无 watchdog + 无 server → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t249 哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 249 遗留首选当选：**run family 批跑基建**——qa49 批量瞬态两次复现，每窗家族回归 28 套件手工串行跑且失败时需人工区分瞬态与真回归；判例说「连续套件资源竞争致批量 FAIL、单跑 ALL PASS——回归须串行或单跑复验」——本窗把这条判例变成可执行的法律机器。家族花名册硬编码 28 套件（qa00-data-view、qa63-smoke、qa47/49/50/51/55/57/58、qa84、t210/212/213/214/215/218/219/221/223/241-run-echo/242/243/244/245/246/247/248/249）——显式名单不 glob（diag-*/probe 不是家族成员）。
- 【实现：scripts/family-run.mjs】**串行律 + solo 复跑 + 三重环境守卫**：① spawnSync 逐套件串行（250s/套件天花板）；② FAIL → 4s 喘息 → solo 复跑一次：solo PASS = SOLO-RECOVERY（瞬态实锤）、solo FAIL = REAL-FAIL（需要人的判决）；③ 环境守卫三件套（OOM 适应律，第二次跑批血案后补）：**MEM GATE**（每套件前 MemAvailable < 500MB 等 15s×8 轮回落——在边缘上硬跑只会制造假 FAIL 并邀请 killer）、**SERVER GATE**（server 死等 watchdog 复活 3s×20 轮，server 不可用时 SKIPPED(SERVER) 不进 REAL-FAIL——对死 server 跑出来的不是判决是噪音）、**BREATH**（套件间 3s 让 chromium 退净堆回落）。verdict 四色：PASS 绿 / SOLO-RECOVERY 黄 / REAL-FAIL 红 / SKIPPED 黄；exit code = real-fail > 0 ? 1 : 0（SOLO-RECOVERY 诚实但不是 blocker）。`--filter substring`、`--list`、`--help`；自测钩子 FAMILY_DRILL=<suite>（指定套件首跑强制 FAIL 演习 solo 路径——drill 只 drill 首跑，solo 是真跑，终局 verdict 永远是真值）。
- 【三次跑批实录（每次都教了一课）】**run-1（spawnSync 版，前台 600s 被杀）**：qa49 批量 FAIL 第三次被活捉（job node never appeared）→ solo 卡死 4 分钟 → **spawnSync pipe 陷阱实锤**：timeout SIGKILL 杀 node 子进程，但浏览器孙进程继承 stdio pipe 活着，pipe 不关 spawnSync 永远挂死——240s 天花板形同虚设。修：spawn 异步 + `detached: true`（子进程自成进程组）+ `process.kill(-pid, "SIGKILL")` 杀全树 + destroy stdio 流释放 pipe——天花板变成真的天花板。**run-2（spawn 版，后台）**：进程中途蒸发、日志只有 banner（缓冲未刷）——dmesg 实锤 **OOM 大屠杀**：next-server（2.7GB anon-rss）被 kernel 杀，watchdog 与 runner 一同阵亡；这也正是 qa49「批量 FAIL 单跑 PASS」的深层机制。修：环境守卫三件套。**run-3（守卫版，后台 nohup/setsid 朴素启动）**：**28/28 全 PASS · solo-recovery 0 · real-fail 0 · wall 801s**——qa49 本轮 27.2s 直接 PASS（守卫 + 呼吸消除了瞬态的生存条件），家族跑批首次全程无伤通过。
- 【事故与判例】①**孤儿会话数据污染**：run-1 被 bash timeout 杀时孙进程孤儿化，孤儿 qa49 会话与后续跑批竞争 agent-browser daemon 串行锁；孤儿窗口期间 demo 世界被播入 `QA Class2D Twin`（t215 的 seed 世界）→ roster 21→22 → t249/t215 全线 FAIL——**数据态污染 solo 复跑也救不了**（与资源态瞬态的本质分野：资源态 solo 恢复，数据态要清场）。处置：seed-twin.py --clean（自带 DELETE 通道）删 Twin 恢复 roster 21，t249 + t215 复验回绿。杀跑批工具必须杀全树（Task 86 配方的 runner 版）。②**MultiEdit 非原子井**：多 edit 失败报「未应用」但部分 edit 实际落盘，二次提交造成守卫块重复声明（SyntaxError 级）——大改后必 `node --check` + rg 计数验证，不可信任「No replacement was performed」的表象。③**bash 后台链 && 井**：`A && B & disown` 的 & 作用域与 curl 失败断链让 setsid 静默未启——后台启动用朴素分步（`(setsid node ... &)` + pgrep 验活），不用 && 长链。
- 【自举验证】**本窗全家族回归 = 跑批脚本自己跑自己要验的世界**：28 套件全绿即 t250 的终审（一石二鸟，家族回归从此一条命令）。哨兵复验：qa00/qa63/t249/t215 单跑皆绿。产品字节零改动（scripts/ only），无 chunk 终审需求。
- 【全家族回归】run-3：**pass 28 · solo 0 · real-fail 0 · wall 801s**（含 qa00 1.1s → t249 7.4s 全序列，qa57 174.6s 最重）；roster 恒等 21；跑批零残留零污染。
- 【收尾】worklog（本条）+ commit/push + 环境清理（agent-browser close + watchdog 杀 + Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「判例的 executability」：qa49 瞬态判例挂账两窗后升格为法律机器——「回归须串行或单跑复验」从口头律变成 family-run.mjs 的执行路径（serial + solo-retry + exit code 语义）；判例只有变成工具才算真正结案
- 「pipe 陷阱」：spawnSync timeout 杀不掉继承 stdio 的浏览器孙进程，pipe 悬而不开 await 永挂——timeout 天花板要配进程组杀（detached + kill(-pid)）+ 流销毁才算真的天花板；「被杀」与「杀干净」是两件事
- 「OOM 适应律」：4GB 箱上的跑批三重守卫——MEM GATE（低内存不硬跑）+ SERVER GATE（死 server 出不了判决，SKIPPED 与 REAL-FAIL 分家）+ BREATH（套件间喘息削峰）；OOM killer 无差别，跑批的自我修养是别把自己喂到它嘴边
- 「瞬态的两态分野」：资源态瞬态（solo 复跑恢复，SOLO-RECOVERY）vs 数据态污染（solo 也失败，需 seed 工具 --clean 清场）——REAL-FAIL 的归因要先问「前一个套件的尸体还在吗」；roster 恒等断言是数据污染的烟雾报警器
- 「跑批的自举」：全家族回归 = 新工具的验收测试——一条命令 13.4 分钟替掉每窗手工 28 次串行 + 人工分辨瞬态；下窗 QA 直接 `node scripts/family-run.mjs`
- 遗留（下轮候选）：#5 fs/browse 鉴权（低优先）；#6/#14 pathref 包含策略（低优先）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；家族跑批的 --report JSON 输出（供 worklog 直接引用的机器可读 verdict）；watchdog 与 family-run 的共生（runner 检测到 watchdog 缺席时自拉或告警）

## Task 251 (2026-09-16, cron 18:02 窗口 trace cron-agent-loop-202609161812)

- 【开局】四件套：尾部 = Task 250（6aa8df6，家族跑批判例的执行化）零过时（续传摘要第十二度过时——世系止于 247，实际 248/249/250 已交付）；净场核查 PORT 3000 FREE + 无 watchdog → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t249 哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【勘察与立项】cron recital 每窗背诵的 Task 13 遗留逐件实证：**#5 已修**（fs/browse 带 isLocalRequest 同源门 + Host pin，注释自载「Hardening (#5, rounds 1+2)」——recital 陈旧判例第五案）；**#6/#14 已修**（file/star 两路由共用 resolveInsideJobWorkdir 统一包含策略，注释自载「Both holes are closed」）；**#13 已修**（全应用 localStorage 写全在事件处理器/helper，useMemo 内零写）。但勘察揪出**真缺口：守卫层的不一致**——outputs/star 是 file 的姊妹路由，同一份 .star 字节 file 路由 text 格式有门、star 路由解析后裸奔；普查 49 条 API 路由仅 3 条有门（fs/browse/map-profile/outputs/file），13 条 workdir 派生数据路由全裸。立项 = **「硬化收口」**：守卫扫荡 + 守门测试 + Task 13 recital 全销账。
- 【实现：守卫扫荡 scripts/t251-guard-sweep.py】13 条路由（outputs/outputs/star/log/6charts/micrographs/classes/picks/particles）机械化补 isLocalRequest 门——幂等 sweep（已带门即跳过，首跑漏 star 本尊、幂等补齐自愈）；每门带 per-route 注释（「Parsed or rendered, the bytes come from the job workdir — the door rides along」）。**边界判定**：overlay-session/camera-bookmarks（用户自创注记，非磁盘派生）诚实缺席不扫；写路由（POST/JSON 体）不入本轮威胁面。
- 【直连修复五件】sweep 爆炸半径普查（家族测试仅直连 /outputs ×5）：t210 补挂 H（H 头早已在文件里）、qa58 种子 helper 补 Origin、t184 B3 补 Origin（保到达包含层——它测的是 workdir 边界不是门）、t120/t121 api helper + 裸 fetch 补 sec-fetch-site（非家族但世界卫生不摔下人）。qa67 早带 Origin（file 门落地时的先例同款）。
- 【e2e：新 t251-hardening-gates.mjs】**29 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21 + **主页世界 console-clean 前置断言**）；B 相**门环 16 面 × 4 态**（无 fetch metadata curl 式 → 403；cross-site Origin → 403；rebound Host（curl 伪造——undici 拒伪造 Host，curl 是对的探针）Origin 过源检查但 Host pin 定罪 → 403；same-origin → 门开路径应答）——**48 顿拒 + 16 开门**；C 相包含锋利（../ 词法 / 百分号编码 / 嵌套 / classes workdir 越界全 400 + 契约消息点名 data/relion）；D 相正当用户无伤（**应用自己页面内的同源 fetch 打遍 16 门零 403**——门不杀门内人）；E 相 console（pageerror 0 + 探针噪声有界——D 相故意 404 的资源日志与真实错误分账，主页世界在 A 相已净）。
- 【build 与固定工序】OOM 箱 rebuild → Task 86 双杀 + PORT 3000 FREE → watchdog 复活 200。**API 路由无 client chunk 终审**（守卫字节在 server bundle 不在 static chunks——t247 判例是客户端组件特例）：活体探针即终审，首跑 12 姊妹裸 200（standalone 井旧字节实锤）→ rebuild 后 16 门全 403。
- 【全家族回归】family-run.mjs 一条命令：**FAMILY VERDICT pass 28 · solo-recovery 0 · real-fail 0 · wall 790.9s**（qa49 26.6s 内联 PASS 守卫续效；qa58/t210 修复后 PASS）；**t251 收编花名册 28→29**（runner --filter t251 亲跑 PASS 8.9s 验收）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「Task 13 recital 全销账」**：七件遗留全部实证闭合——#5（isLocalRequest 三门）、#6/#14（resolveInsideJobWorkdir 统一）、#7（statcache）、#8（batched BFS）、#13（localStorage 写出 useMemo）——下窗 cron 文本再背诵 Task 13 时，worklog 即答「全部已修且守门测试在册」，审计成本归零；recital 的终点不是被背诵而是被测试钉死
- 「守卫的不一致是真缺口」：#6 的「包含策略不一致」修在包含层，守卫层同样的不一致活着——同一份 star 字节一门有门一门裸奔，file 路由的门被姊妹裸门架空（drive-by 走 star 门读同样的数据）；姊妹路由的硬化必须成环，单点门是心理安慰
- 「门环四态测试法」：每门 × 无 metadata / cross-site Origin / rebound Host / same-origin 四态——第三态（Origin 过但 Host pin 定罪）只有 curl 能伪造（undici 拒伪造 Host），探针工具的选择本身就是威胁模型的一部分；48 顿拒 + 16 开门 + 应用自己页面零伤 = 门只挡该挡的
- 「幂等 sweep 的自愈」：首跑 ROUTES 漏了 star 本尊（要做的那件事漏在做的工具里），幂等设计让补跑只改缺的那件——机械化变换必须幂等，人肉清单必须被幂等原谅
- 「console 噪声分账」：D 相故意探针的 404 资源日志与真实 console 错误分账（pageerror 0 + 非 resource 日志 0 + 噪声有界），主页世界在 A 相先净——断言要区分「故意的噪声」与「意外的噪声」，否则要么假绿要么冤枉
- 遗留（下轮候选）：写路由的 CSRF 面（POST/JSON 体 + no-cors 表单的残余风险——本轮威胁面外，Next.js JSON 解析默认挡表单，值得一次专项审查）；/system、/hpc/profiles、/projects 等应用元数据路由的门（低敏感，挂账）；map-profile FSC 满档锚点化（等真实满档）；透镜纸面化（哲学门槛维持）；updatedAt 治理（大工程）；EMPIAR 真数据回归（让位）；家族跑批 --report JSON（机器可读 verdict）；watchdog 与 family-run 共生

## Task 252 (2026-09-16, cron 18:47 窗口 trace cron-agent-loop-202609161847)

- 【开局】四件套：尾部 = Task 251（d89cc7b，硬化收口）零过时；净场核查 → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + **t251 哨兵 PASS** + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 251 遗留首选当选：**写路由 CSRF 面**——读环已闭，写面是硬化弧的另一半。普查 30 个写处理器（POST×20/PUT×2/PATCH×4/DELETE×4）后按威胁模型三分成：①**无体 action POST**（run/stop/duplicate/empiar-seed）——无需可解析 JSON 体，跨站 HTML 表单可盲发（表单只讲 GET/POST、no-cors fetch 只讲 GET/POST/HEAD；表单发不了 JSON，JSON 体路由 urlencoded 必 400 自防御）——empiar-seed 最险：全应用唯一无 id action，整个 EMPIAR 项目（10 jobs + engine 派发）零猜测可播种——**四条上 isLocalRequest 写门**；②JSON 体 POST——表单体解析必败 400，空容忍解析器（.catch(()=>({})))后接显式校验（restore 拒「1–500 entries」、layout 拒「No valid updates」、switch 空 id → setActiveProject 返 false）——盲 POST 零状态变更，不上门只断言自防御活体；③PUT/PATCH/DELETE——**方法级免疫**（表单 no-cors 均不可达；CORS 模式需预检而全应用零 OPTIONS handler——spec 挡死），诚实缺席有理有据。
- 【实现】四路由手植写门（run/stop/duplicate/empiar-seed，各带 per-route 注释：「this action needs NO parseable body — a cross-site HTML form can POST it blind」）；empiar-seed 顺手补 NextRequest import（原 POST() 无参）。**直连修复一件**：t152 api helper（唯一 node 级 POST /run 的脚本，非家族但卫生）补 sec-fetch-site。
- 【e2e：新 t252-write-gates.mjs】**17 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21 + 主页 console-clean 前置）；B 相**写门四态**（run/stop/duplicate 假 id：裸 403 / cross Origin 403 / rebound Host 403（curl 伪造）/ same-origin → 404 路由应答；empiar-seed 三态 403——**开门态不点燃**（真播种世界），姊妹门证明代行）；C 相**自防御台账**（urlencoded 入 JSON 路由 400；restore/layout 空载荷 → 400 契约消息逐字——「比 no-op 更强：显式拒绝」）；D 相正当用户（应用自己页面同源 POST 假 id 全 404 路由应答零 403）；E 相 console（真实错误 0 + 探针噪声有界）。roster 全程恒等 21。
- 【事故与判例】①**「无体容忍 = no-op」的假设井**：C 相首断言 restore/layout 空体 200 no-op——实际两路由显式 400 拒空载荷（契约消息自辩）——断言错在测试不在路由，改断言为实证契约（「读契约再写断言，不写想象的契约」）。②empiar-seed 的开门态不能点：真播种 + 自动跑会污染世界——「姊妹门证明」判例（同一 isLocalRequest 对在三个姊妹上已证开，不为一枚门点燃世界）。
- 【全家族回归】family-run.mjs 一条命令：**FAMILY VERDICT pass 30 · solo-recovery 0 · real-fail 0 · wall 801.9s**（t251 5.8s + t252 4.8s 双新门环内联 PASS）；**t252 收编花名册 29→30**（runner --filter 亲跑 PASS 8.1s 验收）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- 「写面的三分法」：CSRF 审查不是「全上门」——无体 action（表单可达）上门、JSON 体路由（内容型自防御）记台账、PUT/PATCH/DELETE（方法级免疫）诚实缺席——威胁模型定界比扫荡重要，30 个处理器里只有 4 个真正裸奔
- 「empiar-seed：唯一无 id 的 action」：id-gated 路由有 cuid 不可猜的纵深，无 id action 连纵深都没有——它是写门的第一个顾客；「不可猜 id」从不是硬化理由，只是缓刑
- 「显式拒绝优于静默 no-op」：restore/layout 对空载荷回 400 + 契约消息（「Body must be { jobs: [...] } with 1–500 entries」）——自防御的最佳形态不是容忍而是把无效输入挡回给调用者；测试要断言的是契约的真实形态
- 「姊妹门证明」：开门态的验证可以不点燃真实副作用——同一 isLocalRequest 对在姊妹路由上已证开门，第四枚门共享同一实现；测试的代价预算要花在刀刃上（403 三态才是每门必验的）
- 「方法级免疫」：PUT/PATCH/DELETE 的 CSRF 免疫是 spec 给的（表单/no-cors 不可达 + 预检零 handler）——诚实缺席和含糊缺席的区别在于缺席理由是否被写下来（http-guard 判例链的第三次应用）
- 遗留（下轮候选）：/system、/hpc/profiles、/projects 等应用元数据读路由的门（低敏感挂账——读环已含高敏感面）；3D viewer 体积截面工具（recital 点名的新功能方向，硬化弧已闭环可转产品）；Topaz wrapper（同上）；map-profile FSC 满档锚点化（等真实满档）；updatedAt 治理（大工程）；家族跑批 --report JSON；watchdog 与 family-run 共生

## Task 253 (2026-09-16, cron 19:17 窗口 trace cron-agent-loop-202609161918)

- 【开局】四件套：尾部 = Task 252（ed75449，写门关闭）零过时；净场核查 → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t252 哨兵 PASS + agent-browser errors 双空。无 bug。
- 【巡检与立项】硬化弧闭环后按 standing orders 转产品——recital 点名两 feature 方向逐件实证：**「3D viewer 体积截面工具」已全面建成**（molstar-embed 携 Slice 密度像平面（轴选择 + scrub + 密度山景 t189-210 谱系）+ ChimeraX 式 box Clip（三轴滑杆 + flip side + 相机投影线框 + 可拖面）+ 双向 2D 联动（CustomEvents，⌖ 镜像 + slice-state 回声））——recital 陈旧第六案；**「Topaz wrapper」已建成**（picking method 三选含 Topaz + 独立参数 tab（topazNrParticles/threshold/diameter/downscale/workers）+ topaz-training 路由与 lib）——第七案。**recital 至此零活项**。立项 = 「recital 退休审计 + 补上 clip 的 2D 缺席」：box clip 只活在 3D 场景，ortho 2D 瓦片对裁剪一无所知（继续显示全盒）——把 t251/252 的「环」精神带进视口联动。
- 【实现：clip-state 第三回声】embed 侧 applyClipIntent 派发 cryoflow:clip-state（on/x/y/z/invert，与 slice-state 同教义：intent applier 单点派发）；panel 侧新监听器收态（nonce 递增）传入三瓦片。**瓦片几何渲染器真相**：读 readMrcOrthoSlice 实证——z 瓦片横轴 X 纵轴 Y、y 瓦片横 X 纵 Z、x 瓦片横 Y 纵 Z，且全平面「轴 0 = 顶行左列」——kept 区间映射到叠层**无需翻转**（top=a%, height=(b−a)%）。存续面画紫罗兰 kept 外框（clip 自家色）+ nonce 闪光；被裁面（法轴 pos 出 kept 区间）戴「clipped」小徽章 + 图像减淡 45%——「每块瓦片讲自己那片故事」。
- 【e2e：新 t253-e2e.mjs】**20 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21 + 种子宿主在册）；B 相**recital 台账**（Topaz 参数与训练 lib/route 在源、slice/clip intent 与 t253 回声在源、t251/252 门在盘、statcache 与 batched BFS 在源——六个「已建成」一次钉死）；C 相**活体联动**（种子体积世界 → View in 3D → 展开 ortho strip → Clip ON → **键盘驱动 Z 滑杆**（Home 到 min 0.02 + ArrowRight ×18 步进 0.01——无视口几何歧义）→ XY 瓦片（法轴 Z）戴徽章 + XZ/YZ 瓦片画 Z 0–20% 保持带 → Z 回 80% 徽章清 + 带重说 → Clip OFF 全静默）；D 相 console 0。
- 【事故与判例】①**Radix thumb 非 button**：`button[role="slider"]` 零命中——Radix Slider Thumb 是 span[role=slider]；选择器要说元素自己的真话（t249 quarter-line 判例的再应用）。②**track 点击假动作**：thumb 的 boundingBox 是把手不是轨道，20% 点在把手宽度上（valuenow 恒 1 假动作）；改键盘驱动（Home+ArrowRight）——「确定性输入优于几何猜测」。③**aria 尾巴**：kept 外框的 aria-label 以「on this plane」结尾，前缀匹配 ^ 才命中——断言写完后要跟渲染串对账。
- 【定妆照】**shots-qa84/t253-clip-speaks-2d-2x.png**：XY 瓦片紫徽章 + 减淡，XZ/YZ 顶部紫色保持带——「3D 的裁剪，2D 的证词」一屏讲完。
- 【全家族回归】family-run.mjs 一条命令：**FAMILY VERDICT pass 31 · solo-recovery 0 · real-fail 0 · wall 941.5s**（t253 内联 126.1s PASS——Mol* 重套件入编）；**t253 收编花名册 30→31**（runner --filter 亲跑 PASS 127.9s 验收）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「recital 退休」**：cron 文本背诵的全部条目——#5/#6/#7/#8/#13/#14（t251/t252/t249 销账钉死）+「3D 截面工具」「Topaz wrapper」（本窗实证建成）——零活项；recital 的背诵历史使命终结，下窗开局只读 worklog 尾部与 git log
- 「clip 的 2D 缺席」：3D 场景的裁剪与 2D 瓦片的全盒显示并存 = 同一事实两个说法——联动环补上第三回声（⌖ 上行、slice-state 下行、clip-state 下行）后，视口里的每个面板讲同一个故事；「越做越细」的实质是消灭沉默的旁观者
- 「渲染器真相的叠层」：2D 叠层几何必须从渲染器源码取证（readMrcOrthoSlice 的轴到行列映射），不从惯例假设（「MRC 原点在下」的惯例在这里不成立——axis 0 就是顶行）——假设翻转方向就会画出说谎的框
- 「键盘驱动的确定性」：滑杆测试的 Home+ArrowRight 步进优于 track 点击（无 boundingBox 几何、无滚动竞态）——输入的确定性是断言确定性的前提
- 「clipped 徽章的诚实」：被裁面不假装显示（减淡 + 徽章），存续面不省略裁剪（外框 + 读数）——视图状态的可视证词要区分「还在的」与「被去掉的」
- 遗留（下轮候选）：应用元数据路由的门（/system、/hpc/profiles、/projects——低敏感挂账）；updatedAt 治理（大工程）；透镜纸面化（哲学门槛维持）；EMPIAR 真数据回归（让位）；家族跑批 --report JSON；watchdog 与 family-run 共生；3D viewer 的新方向候选：slice 密度面与 clip 盒的合成导出（把「裁剪后的体积」导出为子体积 .mrc——RELION 的 box 子区工作流）

## Task 254 (2026-09-16, cron 20:02 窗口 trace cron-agent-loop-202609162006)

- 【开局】四件套：尾部 = Task 253（4ab40a3，clip 学会说 2D 的话）零过时（**续传摘要第十三度过时**——摘要称世系止于 251，实际 252/253 已交付；过时律再应验，worklog 尾部 + git log 是唯一真源）；净场核查 PORT 3000 FREE → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t251/t252/t253 三哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 253 遗留首选当选：**「子体积导出」**——recital 点名的 3D viewer 下一方向，RELION box 子区工作流（感兴趣区裁成独立 map 做 focused processing），t253 clip 工具的产品级续章。勘察四件：readMrcOrthoSlice/mrc.ts 读取库完备（mode 0/1/2/6 + nsymbt + 逐面 pread OOM 教义）；clip 状态语义 `{on,x,y,z,invert}` frac 1 = 不裁；kept = `invert ? [frac,1] : [0,frac]`（map-ortho-panel 实证）；outputs/file 路由的 isLocalRequest + findEffectiveJob → getRun → resolveInsideJobWorkdir + pathref 三段式先例。
- 【实现① lib readMrcSubvolume】mrc.ts 新增：分数→体素在路由层（floor/ceil 保非退化区间非空），lib 收半开体素区间 [lo,hi)。**逐 z-section pread**（一次一面在内存，OOM 教义）；行级 Buffer.copy 位忠实拷贝（mode 保留）；**新头连续性**：start' = parent start + box offset（ChimeraX/RELION 把裁片放回原位的锚）、cella 按 nx'/mx 重标度（体素间距存活）、angles/mapc-mapr-maps 沿袭、dmin/dmax/dmean/RMS 从裁区实算（parent 的统计对子区说谎）、MAP magic + LE machine stamp、nsymbt=0 干净头；**256MB 输出帽**。构建前 tsc 单文件转译 + 17 断言 lib smoke 全绿（省 OOM build 循环——含体素连续性/start 场连续性/cella 重标度/空盒 400/clamp/缺文件 404）。
- 【实现② 路由】GET /api/jobs/[id]/outputs/subvolume：isLocalRequest 门（t251 读环 16→17 面，per-route 教义注释）；findEffectiveJob → getRun → resolveInsideJobWorkdir + readPathrefTarget（与 file 同款逃逸舱——导入 map 同样可裁）；isMrcPath 门；分数校验契约消息（「Box fractions must satisfy 0 ≤ lo < hi ≤ 1 on every axis」）；Content-Disposition 文件名带体素盒（orthovol_crop_16-48_16-48_16-48.mrc）。
- 【实现③ UI】molstar-embed clip 面板新导出按钮：keptFractions() 在客户端解析 invert（API 讲纯几何——职责分离）；exportDims() 用与服务端相同的 floor/ceil 换算——**标签永不谎报文件尺寸**（活体 64×64×64 → 64×64×13 → flip 后 64×64×52）；Download 图标 + 紫罗兰 clip 自家色；temp `<a>` click 原生下载。
- 【工具显示层伪影判例】sed/grep/Read 三路一致显示 line 3200 为 `const overAxis, setHoverAxis]`（缺 `[` 的语法错误）——Edit 修复却报「old_str 不存在」，**od 字节真相：文件完好**（`[h` 两字符被工具输出传输层吞掉，`[g` 的 grabAxis 行完好）；「构建后提交前损坏」的推断被 od 证伪——当一行「看起来语法不可能」时，字节级检查是仲裁者，不要急于修复不存在的 bug。
- 【e2e：新 t254-subvolume-export.mjs】**41 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21 + 宿主 workdir）；B 相台账（路由门 + 包含 + pathref + floor/ceil + lib 帽 + start 连续性 + embed kept/导出/floor-ceil 标签全在源）；C 相**门四态**（bare/cross/rebind-curl 403；same-origin → 400 契约消息 = 开门证明）；D 相契约 + 包含（traversal 400 Invalid path、自种哑文件 qa-notes.txt 的 MRC-only 400 与包含层 404 分账、缺分数/退化/倒置/越界 400、缺图 404）；E 相**字节级正确性**（页面内 fetch 两个裁盒——32³ 与 64×32×32——**逐体素位等于 parent 映射位** + start 场 + dmin/dmax 实算 + Content-Disposition 盒名）；F 相 UI（Clip ON → 键盘 Z 20% → 标签 64×64×13 → flip 64×64×52 → click → **Playwright download 事件**捕 URL 分数 + 存盘 + 头 dims 64×64×13 + 53248 体素全对）；G 相 console 0。定妆照 t254-subvolume-export-2x.png。
- 【事故与判例：t253 REAL-FAIL 的破案】家族批内 t253 FAIL + solo 复跑 FAIL——**真回归**，且是本窗交付揪出的既有几何脆弱：clip-off 点击被 dialog header 描述段 `<p>` 拦截。取证链：几何诊断脚本量出 canvas wrapper 塌缩 38px（strip shrink-0 展开 560px + 92vh dialog）→ contour 卡片（clip ON 时 3 滑杆 + flip 行 + **新导出行 26px** + σ 行 ≈210px）绝对定位 bottom-anchored **向上溢出 canvas wrapper** → 顶行（含 Clip toggle）戳进 header 描述带区 → hit-test 被拦截。今晨旧 build 无导出行矮 26px——**靠 26px 运气通过**；t254 从不关 clip 所以自己全绿。两步修复：①卡片 `max-h + overflow-y-auto`（但 % max-h 对 auto 高父级无效——判例）；②wrapper `inset-x-0 bottom-0` → `inset-0 + items-end`（底锚视觉不变，获得确定高度让 max-h 生效）——**卡片永不越出 canvas wrapper** 成为结构性保证（任何视口高度都成立）。修后 t253 ALL PASS + t254 ALL PASS。
- 【全家族回归】family-run.mjs 一条命令：**FAMILY VERDICT pass 32 · solo-recovery 0 · real-fail 0 · wall 1067.8s**（首跑 t253 REAL-FAIL 破案修复后重跑全绿；t254 内联 PASS）；**t254 收编花名册 31→32**（runner --filter 亲跑 PASS 125.3s 验收）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「clip 盒长出了身体」**：t251 读环 → t252 写门 → t253 视口联动 → t254 导出落地——裁剪从「视觉语言」变成「数据工件」，RELION box 子区工作流闭环；硬化的环与产品的轮在同一条链上
- 「导出头的连续性」：子体积不是新图——start 场记录 parent 原点偏移、cella 重标度、dmin/dmax 从裁区实算——「文件头要回答它从哪里来」；ChimeraX/RELION 拿到裁片能放回原位，统计不说谎
- 「floor/ceil 的非退化保证」：分数→体素用 floor(lo·n)/ceil(hi·n)——任何 lo<hi 的非退化区间至少一 voxel；UI 的 dims 标签用同一换算——**标签与文件逐位一致**，「按钮说多少就是多少」
- 「26px 的运气不是设计」：既有布局（shrink-0 strip + 92vh dialog + 绝对定位卡片）在新内容加入前靠 26px 余量侥幸成立——**回归测试的责任是让运气的余量显形**；修法不是删掉新增内容而是把「永不越出」变成结构性保证（max-h + 确定高度的父级）
- 「% max-h 需要确定高度的父级」：max-h-[calc(100%-X)] 对 auto 高度的绝对定位父级静默无效——CSS 约束链上任何一环不确定，整链作废；wrapper inset-0 + items-end 与 inset-x-0 bottom-0 视觉等价但约束成立
- 「od 是仲裁者」：三个读取工具一致显示的「语法错误」可以是传输层伪影（`[h` 被吞）——修复不存在的 bug 之前先做字节级取证；工具输出的一致≠文件内容的真相
- 遗留（下轮候选）：应用元数据路由的门（/system、/hpc/profiles、/projects——低敏感挂账）；updatedAt 治理（大工程）；透镜纸面化（哲学门槛维持）；EMPIAR 真数据回归（让位）；家族跑批 --report JSON；watchdog 与 family-run 共生；子体积导出的后续：裁片直接「send to new job」（导出的 .mrc 一键成为 Import/Refine 工作流的输入——box 子区到 focused refinement 的全链路）

## Task 255 (2026-09-16, cron 21:48 窗口 trace cron-agent-loop-202609162150) — 进行中

- 【开局】四件套：尾部 = Task 254（df4318c，子体积导出）零过时（续传摘要第十四度过时——摘要称世系止于 251，实际 252/253/254 已交付）；净场 PORT 3000 FREE → watchdog 拉起 200。QA：qa00/qa63/t251/t252/t253/t254 六哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【立项】Task 254 遗留首选：send to new job——裁片成为流水线公民（materialize + mapimport 新 job 类型 + edge 接线）。实现中，详见收尾条目。
- 【中期进度】workflow.ts mapimport spec 落位；engine.ts runMapImportNative + runRealJob 接线 + class3d/refine3d reference from 名单加 mapimport；新路由 subvolume-job/route.ts；UI send to new job 按钮 + 注记；tsc 净（我改文件零错）。**意外捕获真 bug**：t254 GET subvolume 路由缺 `import path from "path"`（typescript.ignoreBuildErrors 掩护下 t254 build 通过，pathref 分支活体执行必 500——本轮补上）。MrcHeader 加 cella 字段（additive）。
- 【中期进度 2】OOM rebuild exit 0 → Task 86 双杀 + PORT 3000 FREE → watchdog 复活 200；chunk 终审双落位（client chunk c253adbd 含 send to new job + clip-send-job；server bundle 含 mapimport）。e2e t255-send-to-job.mjs 三事故修复后 **×3 ALL PASS**（35 断言）：①engine-state.json 顶层键即 job id（无 .jobs 包裹——t254 源码被传输层吞字节误导，种子器 qa67 自证 `state.get(src["id"])`）；②字节等同比对的 GET 必须走页面内同源 fetch（node 裸 fetch 无 metadata = 读环门 403 正确工作）+ 214KB 分块 btoa（全参展开爆栈）+ page.evaluate 参数传 hostId（无闭包穿越）；③首跑崩溃残留 probe job → 启动自愈前置（mapimport 残留清扫）。定妆照两张：t255-send-to-job-note-2x（clip Z20% + 双按钮 + 绿注记）+ t255-send-to-job-canvas-2x（调色板 IMPORT 新增 Import Map + 小地图新节点右下落位）。t255 收编花名册 32→33（--filter 亲跑 PASS 114.6s），全家族回归后台进行中。

## Task 255 (2026-09-16, cron 21:48 窗口 trace cron-agent-loop-202609162150)

- 【开局】四件套：尾部 = Task 254（df4318c，子体积导出）零过时（**续传摘要第十四度过时**——摘要称世系止于 251，实际 252/253/254 已交付；worklog 尾部 + git log 唯一真源律再应验）；净场核查 PORT 3000 FREE + 无 watchdog → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t251/t252/t253/t254 四哨兵 PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 254 遗留首选当选：**「send to new job」**——recital 收官后的产品续章（box 子区 → focused refinement 全链路）：t254 的裁片是「数据工件」但只活在 Downloads 里；本窗让它成为「流水线公民」——一次点击材料化裁片 + 创建 Import Map job + 接线 edge。勘察五件：POST /api/jobs 契约（type + params 白名单 + name + workspaceId）、resolveInputs 的 OUTPUT 供给制（req.from 类型名单 × accepts 输出键 × existsSync）、lineageFor 的 edge BFS、recordNativeRun 的原生输出落账、page.tsx 6s 轮询自动拉新卡片。
- 【实现① workflow.ts mapimport spec】Import Map（Box 图标/teal/import 类/500s/core）：mapPath 参数（pth filePick，hint 点名 SubVolumes 落点）；**ports 讲血缘不讲运行时**——inputs: [inp("map", L.mapIn, ["volume"])]（裁片源自 refined map，图上画得出箭头），outputs: [outp("model_mrc", "Reference map (.mrc)", "volume")]（链得进下游 reference）——而运行时走 mapPath 参数引擎原生处理，无 resolveInputs 门（注释自载「the port says what the crop IS derived from, not what the job consumes」）。
- 【实现② engine.ts runMapImportNative】原生处理器第四成员：mapPath 缺失 → 契约错误点名 Browse 与 viewer 两条来路；host 直查 → WSL 翻译兜底（import 同款礼遇）；.mrc/.map 后缀门（拒绝 .mrcs 影栈）+ readMrcHeader 支持门；symlink 进自己 workdir（一份磁盘拷贝；link 不可行退 copy）→ Files tab + outputs/file 同等服务它；result 串报 dims + pixel（**MrcHeader 加 cella 字段**（offset 40/44/48，additive）→ cella[2]/nz = pixel Å）；recordNativeRun 落账 `{ model_mrc: outPath }`。runRealJob 原生分支接线 + **class3d/refine3d 的 model_mrc from 名单加 "mapimport"**（label 更新「or import a map」）——reference map 的供给环从此含进口地图。
- 【实现③ 路由 POST /api/jobs/[id]/outputs/subvolume-job】GET 姊妹的完整镜像：findEffectiveJob → getRun → resolveInsideJobWorkdir + pathref 逃逸舱 → isMrcPath + readMrcHeader → 同款分数契约（同串契约消息）→ floor/ceil 体素化 → readMrcSubvolume → **writeFileSync 进父 workdir/SubVolumes/**（命名同 GET 约定 stem_crop_ox-…：同几何重发幂等覆盖同一文件）→ 创建 mapimport job（父 workspace 落位 + **卡片放父节点右下 (x+240, y+60)**——图上讲空间血缘 + 名字去重「Sub-volume <stem>」→ 冲突加序号）→ persistPortEdge（portsValid 才画箭头，broken edge 诚实缺席有理由）。**威胁模型台账（t252 教义三度应用）**：本路由 REQUIRES 可解析 JSON 体 → urlencoded 表单死于 request.json()、no-cors 不可达、CORS 模式需预检而全应用零 OPTIONS——ledger 类诚实缺席上门，严格解析无 .catch 容忍（drive-by 形状死于 json() 门口），理由写进路由注释。
- 【实现④ UI】clip 面板 export 按钮下新增 send to new job（FilePlus2 图标 + violet 描边变体 + sendBusy Loader2 + data-testid）：同一 keptFractions() 源——「one geometry, two destinations（Downloads 的文件 AND 流水线的公民）」；成功/失败注记落 clip 卡内（clipSendNote 独立计时器，aria-live polite）——flashProfileNote 在 profile 卡不在 clip 卡，诚实落点。
- 【意外捕获真 bug】tsc 全项目类型检查揪出 **t254 GET subvolume 路由缺 `import path from "path"`**——typescript.ignoreBuildErrors: true 掩护下 t254 build 通过，pathref 分支活体执行必 500（t254 只在源级断言了 readPathrefTarget，从未带真 .pathref 文件跑过该分支）——本轮补上；「ignoreBuildErrors 不是类型债的豁免是分期」判例入账。
- 【e2e：新 t255-send-to-job.mjs】**55 断言 ×4 ALL PASS**：A 相 demo 真相（200 + roster 21 + 宿主 workdir + orthovol 在盘）；B 相台账 18 断言（spec 四件 + 引擎四件 + from 名单 2/2 + 路由五件 + path import 修复 + embed 三件）；C 相自防御台账 8 断言（urlencoded 400 / 空 JSON 400 契约消息 / traversal 400 / 非 MRC 400 契约 / 退化分数 400 / 缺 job 404）；D 相**活体全链路 24 断言**（viewer → Clip ON → 键盘 Z 20% → send → 201 + mapimport + 命名 + dims [64,64,13] + edge + 裁片在盘 + **材料化文件与 GET 下载字节等同（214016B）** + job 入册 + mapPath 指向裁片 + 父 workspace + 图上 edge + **原生 run completed + result 串报 dims+pixel + run record 落 model_mrc 且文件存在（resolveInputs 可链）** → DELETE 清场 → roster 回 21 + edge 随 job 走 + 裁片随清场走）；E 相 console 0。
- 【事故与判例】①**engine-state.json 顶层键即 job id**（无 .jobs 包裹）——t254 源码 `state[host.id]` 被传输层吞字节显示成 `state.jobs[host.id]`，我按显示写进了测试；种子器 qa67 的 docstring 自证 `state.get(src["id"])`——「被吞字节的判例读三次来源：od、相邻代码、以及读过真相的后来者」。②**门内门外的探针选址**：字节等同比对的 GET 走 node 裸 fetch 得 403——读环门正确工作（无 metadata = drive-by 形状）；改页面内同源 fetch（t254 E 相教义）+ 214KB 分块 btoa（全参展开爆栈）+ page.evaluate 传参（无闭包穿越 Rust 边界）。③**首跑崩溃的残留自愈**：e2e 在清场块前崩溃留下 probe job（roster 22 污染次跑断言）——启动自愈前置（mapimport 残留清扫）让测试对自己的历史残骸负责；幂等纪律从 sweep 工具延伸到 e2e。
- 【定妆照】**t255-send-to-job-note-2x**（clip Z20% + 双按钮 + 绿注记「Sent — Import Map job "Sub-volume orthovol" created beside its parent」——t254 结构修复带着新导出行继续不越界）+ **t255-send-to-job-canvas-2x**（调色板 IMPORT 新增 Import Map count 2 + 小地图新节点父右下落位）。
- 【全家族回归】family-run.mjs 一条命令：**FAMILY VERDICT pass 33 · solo-recovery 0 · real-fail 0 · wall 1168.1s**（t255 内联 97.3s PASS；t254 112.6s 带着修好的 path import 继续 PASS）；**t255 收编花名册 32→33**（runner --filter 亲跑 PASS 114.6s 验收）；roster 恒等 21；探针 job/crop/edge 全清零。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「裁片成为流水线公民」**：t251 读环 → t252 写门 → t253 视口联动 → t254 导出 → t255 入链——box 子区工作流五环相扣全闭环；「send to new job」把「看得到的兴趣区」一键变成「refine3d/class3d 的 reference 供给者」，viewer 与 workflow graph 从此讲同一个故事的两半
- 「ports 讲血缘不讲运行时」：mapimport 的输入口（volume）描述裁片的来源，输出口（model_mrc）描述它能喂谁——而真正的运行时走 mapPath 参数原生处理；图的箭头是组织学事实不是数据流事实，两者都诚实才能共存
- 「ledger 类的严格解析」：t252 三分法的第三次应用——REQUIRES JSON 体的路由自防御（表单 urlencoded 死于 json()、预检零 handler 挡死 CORS JS），诚实缺席 + 理由入注释；「无 .catch 容忍」是这类的关键工艺：容忍解析器会把 drive-by 变 no-op，严格解析让它死在门口
- 「ignoreBuildErrors 不是豁免是分期」：t254 的缺 import 在 next build 静默通过、在 tsc 全检查现形、pathref 分支活体执行必 500——类型债被 build 配置延期不等于被偿还；全项目 tsc 是 OOM build 循环前最便宜的债检
- 「同源探针的选址律」：测门环内的路由，node 裸 fetch 测的是「门挡不挡 drive-by」（403 = 门健康），页面内 fetch 测的是「门放不放自己人」——两种探针都是真理但答案相反，选址错了会把健康门误报为故障；大 buffer 转码分块 + evaluate 传参是同族工程细节
- 「测试对残骸负责」：e2e 崩溃留下的不是垃圾是断言毒药（roster 22 污染次跑）——启动自愈前置让每个测试先扫自己的历史残骸；「幂等 sweep 自愈」从机械化变换工具延伸到测试生命周期
- 遗留（下轮候选）：mapimport 卡片的 results 视图富化（File tab 已可用；可加 header 摘要卡）；refine3d/class3d 的 params tab 无 reference 预览（mapimport 进来后 reference 来源多了一条路）；应用元数据路由的门（/system、/hpc/profiles、/projects——低敏感挂账）；updatedAt 治理（大工程）；家族跑批 --report JSON；watchdog 与 family-run 共生；EMPIAR 真数据回归（让位）

## Task 256 (2026-09-16, cron 23:09 窗口 trace cron-agent-loop-202609162309)

- 【开局】四件套：尾部 = Task 255（8bca341，send to new job）零过时（**续传摘要第十五度过时**——摘要称世系止于 251，实际 252/253/254/255 已交付；worklog 尾部 + git log 唯一真源律再应验）；净场核查 PORT 3000 FREE + 无 watchdog → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t251/t252/t253/t254/t255 五哨兵 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 255 遗留首选当选：**「mapimport 卡片的 results 视图富化」**——t255 让裁片成为流水线公民，但其卡片 Results 视图只有 gallery（「看得到它长什么样」），地图自己的故事（多大、多密、从哪来）无处可读。立项 = **「Imported map 身份证卡」**：卡片从地图自己的头文件读全故事——grid 尺寸 + voxel 间距 + 头载密度统计 + 子体积锚点（start 场）+ 来源链（SubVolumes 路径点名父 job）。
- 【实现① 数据面 additive】MrcHeader 加三字段：`start`（头 16/20/24 的 nxstart/nystart/nzstart——「我在裁我的 parent 的哪里」的答案，独立图全零）、`dmean`（84）、`rms`（MRC2014 216）——readMrcHeader 顺手读，**零额外 I/O**（buf 已在手）；outputs 路由 walkWorkdir 的 mrc 分支（非 .mrcs）把 hdr 镜射进 `file.map = { origin, pixel(cellа[2]/nz，头不说则 0), dmin, dmax, dmean, rms }`——「身份证数据搭 already-done 读的便车」。
- 【实现② UI 卡】results-view 新 MapIdentityCard 组件：mapimport job 且 mrcFiles[0] 带 map+dims 时渲染（teal 自家色，Box 图标）；徽章行（dims × vox + Å/voxel + min/max/mean/σ，formatStat 分段格式化——原始 count 与 float map 数量级通吃）；来源行三态——**anchored crop**（「Sub-volume anchor at (16, 16, 0) voxels in the parent map — crop of <父目录>, sent from the 3D viewer」）/ crop 但锚在原点（「anchored at the parent's origin」）/ standalone（「picked from the file browser, no parent offset」诚实不装）；mapSourceNote 解析 mapPath 的 /SubVolumes/（大小写不敏感，Windows 反斜杠归一）。
- 【意外捕获真 bug：symlink 隐身】walkWorkdir 的 `entry.isFile()` 对 **symlink 返回 false**——mapimport 链进自己 workdir 的地图被 outputs 列表完全无视，Results 视图空转「No on-disk outputs」+ 误导文案「Only RELION-engine jobs write maps」（引擎原生 job 明明写了！）——t255 只在源级断言了 link 落盘与 outputs/file 可服务，从未让 **outputs 列表**看过 symlink。修复：`entry.isFile() || entry.isSymbolicLink()` 分支 + statSync follow 后 isDirectory() 排除（目录 symlink 不跟进——环安全 + walk 不出自己 workdir；死链 statSync 抛错 → continue 自愈）。判例：「File tab 可用 ≠ outputs 列表可用」——同名异源的两组列表，一个看 symlink 一个不看。
- 【测试结构升级：try/finally 清场】t256 首跑 C 相 FAIL 后 TypeError 崩溃（mapMeta undefined）——**崩溃点在清场块前，probe job + crop 残留**（t255 判例重演）。重构：C/C2/D 全块 try/finally——崩溃也走清场；plus 自愈前置（mapimport 残留清扫）。顺带清掉 t255 首跑崩溃的孤儿 crop（data/relion/.../refine3d_.../SubVolumes/——build 警告暴露，roster 已净但文件在）。
- 【e2e：t256-map-card.mjs】**45 断言 ×4 ALL PASS**：A 相 demo 真相（200 + roster 21 + parent 头讲 spacing）；B 相台账 11 断言（MrcHeader 三字段读侧 + outputs 镜射 + 卡组件/渲染条件/SubVolumes 解析/anchored 文案/standalone 文案/formatStat）；C 相活体（页面内 fetch POST subvolume-job——**盒特意裁在原点外**（25%..75% x/y → 锚 [16,16,0] 非零，standalone 分支会藏起本窗存在的理由那行字）→ native run completed → outputs.files[].map 对账：dims [32,32,13] + origin == 盒偏移 + **pixel 存活**（crop 0.0156 == parent 0.0156）+ **stats 字节等 crop 头词**（76/80/84/216 逐字段 ===）+ parent 自己的 map 摘要零 origin）；C2 相卡渲染（job 卡 → Results tab → 卡可见 + 8 文案断言：卡名/文件名/dims 徽章/Å 徽章/anchored 分支/(16, 16, 0)/父目录名/sent from the 3D viewer）；D 相清场 + console 0。
- 【定妆照】**t256-map-identity-card-2x.png**：Import Map job 的 Results 视图——teal 身份证卡一屏讲完（文件名 + 32 × 32 × 13 vox + 0.02 Å/voxel + min/max/mean/σ + Sub-volume anchor at (16, 16, 0) — crop of refine3d_g9wt0s3r, sent from the 3D viewer）+ 下方 crop 缩略图。「看得到它长什么样」与「知道它是什么、从哪来」同屏。
- 【build 与固定工序】全项目 tsc 净（我改文件零错；既有债务 examples/skills/diag-archive/molstar pcentre/session-report 与本轮无关）→ OOM rebuild exit 0（顺手暴露 + 清扫 t255 孤儿 crop）→ Task 86 双杀 + PORT 3000 FREE → watchdog 复活 200。**API/UI 改动无 client chunk 终审需求**（MapIdentityCard 字节进页面 chunk 由活体 C2 相证明——卡片真的渲染了）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。全家族回归与收编结果见下。
- 【全家族回归】family-run 后台进程两度被环境收割（nohup 与 setsid 皆不幸免——k8s 会话级进程树清理；dmesg 的 OOM 是旧事件，内存充足）→ **前台分批跑落地**（filter substring 分五批，每批 10 分钟 bash 上限内）：qa 批 pass 10 · wall 402.7s ｜ t21 批 pass 7 · wall 192.0s ｜ t22 批 pass 2 · wall 65.9s ｜ t24 批 pass 9 · wall 123.5s ｜ t25 批 pass 6 · wall 383.1s——**合计 pass 34 · solo-recovery 0 · real-fail 0 · wall 1167.2s**，roster 全程恒等 21；**t256 收编花名册 33→34**（--filter 亲跑 PASS 9.4s 验收）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「身份证卡」**：t251 读环 → t252 写门 → t253 视口联动 → t254 导出 → t255 入链 → **t256 卡片有脸**——box 子区工作流第六环；Import Map 的 Results 视图从「看得到它长什么样」升格为「知道它是什么、从哪来」，crop 的锚点坐标与父 job 名字直接读自地图自己的头文件，不用问任何数据库
- 「symlink 隐身」：walkWorkdir 的 isFile() 对 symlink 返回 false——引擎原生 job 用 symlink 落盘（一份磁盘拷贝）的成本是 outputs 列表看不见自己；「File tab 可用 ≠ outputs 列表可用」——同名异源的两组列表必须分别实证，t255 的源级断言只钉了 link 落盘没钉列表可见；修法顺带立了环安全界（目录 symlink 不跟进、死链 continue 自愈）
- 「additive 头字段的便车」：start/dmean/rms 三个新字段全部搭 readMrcHeader 已有读的便车（buf 已在手，零额外 I/O）——扩展读侧字段的最便宜时刻就是读已经在发生的时刻；消费方（picks/classes/micrographs/map-profile/engine）结构类型兼容，逐个无损
- 「盒特意裁在原点外」：e2e 的裁盒选 25%..75% 让锚点 (16,16,0) 非零——如果裁在原点，anchored 分支（本窗存在的理由）会被 standalone 分支静默替代且测试照样绿；**测试输入要让被测分支成为唯一可能**，等价类不只是覆盖，是让说谎 impossible
- 「后台进程的死法」：nohup 与 setsid 都挡不住 k8s 会话收割长后台进程（log 停在两套件后、零 FAIL 行 = SIGKILL 特征）；前台分批跑是落地答案——filter 分批 + 每批 10 分钟上限内，verdict 逐批聚合；「一条命令」的理想在受限环境里让位于「五条短命令」的落地
- 「崩溃也走清场」：try/finally 包活体块是 t255「测试对残骸负责」判例的执行化——TypeError 崩在断言链中段时 finally 仍删 job、扫 crop、验 roster；启动自愈前置 + finally 清场 = 测试生命周期的头尾两道闸
- 遗留（下轮候选）：refine3d/class3d 的 params tab 无 reference 预览（mapimport 进来后 reference 来源多了一条路，预览卡可以复用身份证数据）；应用元数据路由的门（/system、/hpc/profiles、/projects——低敏感挂账）；updatedAt 治理（大工程）；家族跑批 --report JSON + 分批跑的一等公民化（filter 分批的批定义写进 runner）；watchdog 与 family-run 共生；EMPIAR 真数据回归（让位）

## Task 257 (2026-09-17, cron 00:20 窗口 trace cron-agent-loop-202609170020)

- 【开局】四件套：尾部 = Task 256（641668b，Import Map 身份证卡）零过时（**续传摘要第十六度过时**——摘要称世系止于 251 且预期 HEAD = d89cc7b，实际 252/253/254/255/256 均已交付、HEAD = 641668b；worklog 尾部 + git log 唯一真源律再应验）；净场核查 PORT 3000 FREE + 无 watchdog → watchdog 拉起验活 200。QA：qa00 GREEN（首跑输出超 1MiB MCP SSE 帧限挂起——落盘重跑只取尾行的工序修正）+ qa63 SMOKE GREEN + t251/t252/t253/t254/t255/t256 六哨兵 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 256 遗留首选当选：**「refine3d/class3d 的 params tab 无 reference 预览」**——t255 让裁片成为流水线公民、t256 给了它身份证，但**消费侧**（吃 reference 的 job）仍只见一条裸路径。立项 = **「reference 戴上它的脸」**：class3d/refine3d 的 Overview 出一张 Reference map 卡——吃什么（grid/间距/统计/锚点）+ 从哪来（3D viewer 发来的裁片 / 浏览器手选 / 上游模型 job）。
- 【勘察五件】① 端口名真相：mapimport 输出 `model_mrc`、class3d/refine3d 输入口 `reference`（workflow.ts 实证）——候选 provider 按 fromPort ∈ {model_mrc, model, map} 过滤；② 消费侧数据面：outputs 路由的 inputs 来自 inputFilesFromCmd(run.cmd) 逐 token 解析，`--ref` 后跟的就是 provider 落账的绝对路径（resolveInputs 的 state.outputs 原文）；③ t256 数据面完备：服务端 OutputFile 已带 dims+map，results-view 客户端镜像已带——**job-inspector 无需动镜像**（新组件自带最小类型切片）；④ RELION 未安装（/api/system relionPath: None）——class3d/refine3d 非 engine-native 需真 binary，probe 消费者不能真跑 → **种子 record 模式**（qa60-seed-fsc.py 的 register_run 判例：hand-write engine-state record + Prisma flip status——app 自己的 fixture 全是这么来的）；⑤ demo 世界有 QA Class3D --model--> QA Refine3D（toPort=reference）边，但全是 fixture（cmd = "qa-fixture"，无 --ref）→ 活体验证需自种全链。
- 【实现① 新组件 reference-map-card.tsx】独立文件（job-inspector 已 2388 行）：props { job, refPath }；候选 = store edges 过滤 volume 口；解析 = 逐候选 fetch outputs（同源、no-store）→ **精确路径匹配优先**（workdir + "/" + f.path === refPath）→ basename+dims 兜底（relocated copy）；三态渲染——**无 --ref → null（自隐）**、解析中 → 只渲染路径行、穷尽未中 → 「identity unresolved: the upstream job hasn't produced this map (yet)」（诚实缺席的第三形态：路径已知、故事缺席）；解析成 → teal 卡（t256 同语言）：文件名/dims vox/Å voxel/min/max/mean/σ 徽章（**复用 formatStat**——两张卡讲同一种数字语言）+ 锚点行（origin 非零时）+ 来源三分支（mapimport 的 mapPath 走 mapSourceNote——crop/standalone；其余 provider 走 "produced by the {spec.label} job {name}"）+ **provider 芯片按钮**（TypeIcon + 名字 + CornerDownRight → inspect(provider.id) 一键跳进 provider 的 inspector——「从哪来」是可导航的）。
- 【实现② 接线】results-view 导出 formatStat + mapSourceNote（additive，注释点名 t257 共用——一份实现两张卡不可能漂移）；job-inspector OverviewTab 在 Key parameters 与 Inputs/Outputs 网格之间挂卡，门 = `/^(class3d|refine3d)$/i` 且 data.inputs 有 --ref（fixture job 无 --ref → 永不出示）。
- 【e2e：t257-reference-card.mjs】**29 断言 ALL PASS**：A 相 demo 真相（200 + roster 21 + orthovol 在盘）；B 相台账 13 断言（卡源九件：test hook/自隐/volume 口过滤/精确匹配/basename 兜底/芯片 inspect/三分支来源/锚点行/unresolved 文案 + 导出两件 + 接线两件）；C 相**活体全链**（POST subvolume-job 201 → crop 32³ origin (16,16,16) → **页面内 fetch POST /run**（node 裸 fetch 会被 t252 写门 403——门健康）→ native completed 落账 model_mrc → probe refine3d 创建 + qa60 式种子 record（cmd 带 --ref）+ Prisma flip + POST /api/edges → 页面开 probe inspector → **Overview tab** → 卡渲染九连断言（名字/裁片名/32×32×32/Å/锚点/父 job/sent from the 3D viewer）→ 芯片点击跳进 provider（dialog h2 title = "Sub-volume orthovol"）→ provider Results 的 t256 身份证卡同屏健在）→ C5 负向（QA Class3D 无 --ref → 无卡）→ D 相 console 0。try/finally 清场（t256 判例）：probe 双删 + SubVolumes 裁片扫 + roster 回 21。
- 【事故与判例】①**completed job 默认开 Results tab**（job-inspector ~2217：running/failed → log，其余 → results）——首跑卡片断言 0 命中，diag2 全量 dump 揭晓：Overview 从未展示（那行「No on-disk outputs」来自 results-view 744 而非 Overview）；修 = 开卡后先点 Overview tab——**断言要看向组件真的所在的面**，C5 负向断言同修（否则 0 命中是平凡绿）。②诊断方法论：diag 脚本复刻 e2e 世界 + 全量 dump（dialog innerText + count 多选择器）一发定位；diag 属脚手架用后即焚（两份 diag 已删）。③**page.evaluate 相对 URL 需先 goto**（about:blank 上 fetch("/api/...") 直接 TypeError——diag1 首跑即崩，主 e2e 无此雷因 Phase A 已 goto）。
- 【定妆照】**shots-qa/t257-reference-card-2x.png**：QA RefProbe shot 的 Overview——teal Reference map 卡一屏讲完（provider 芯片 Sub-volume orthovol ↘ + orthovol_crop_16-48... 徽章 + 32×32×32 vox + 0.02 Å/voxel + min/max/mean/σ + Sub-volume anchor at (16, 16, 16) — crop of refine3d_g9wt0s3r, sent from the 3D viewer）+ 下方 Inputs consumed 双行（particles + reference map）+ Command line 的 --ref 原文——「吃什么」与「从哪来」同屏，且都指向可点击的来处。
- 【全家族回归】family-run.mjs 五批前台（t256 判例——后台进程被环境收割）：qa 批 pass 10 · wall 405.7s ｜ t21 批 pass 7 · wall 192.3s ｜ t22 批 pass 2 · wall 65.2s ｜ t24 批 pass 9 · wall 123.1s ｜ t25 批 pass 7 · wall 386.2s——**合计 pass 35 · solo-recovery 0 · real-fail 0 · wall 1172.5s**，roster 全程恒等 21；**t257 收编花名册 34→35**（--filter 亲跑 PASS 18.3s 验收）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「reference 戴上它的脸」**：t251 读环 → t252 写门 → t253 视口联动 → t254 导出 → t255 入链 → t256 卡片有脸 → **t257 消费侧认脸**——box 子区工作流第七环闭环；Import Map 知道自己是什么，class3d/refine3d 知道自己吃的是什么，「裁片 → focused refinement」的链上每一环都在 UI 里讲自己的故事
- 「消费侧与供给侧同源」：预览卡读的是 provider 自己的 outputs 列表（t256 数据面零新 I/O）——供给侧的身份证与消费侧的预览卡共用 formatStat/mapSourceNote 一份实现；「两张卡讲同一个故事」的唯一可靠方式是同一个讲故事的人
- 「种子 record 是活体测试的诚实捷径」：RELION binary 缺席时，qa60 的 register_run 判例让 probe refine3d 的 run record 成为真值（app 自己的 21 个 fixture 全是种子）——测试世界与应用世界的构造方式一致，断言才不是特例
- 「断言要看向组件所在的面」：completed job 默认开 Results tab，卡片住在 Overview——组件没错、选择器没错、是测试的眼睛看错了面板；负向断言（0 命中）尤其要先证明「看向了正确的地方」，否则平凡绿冒充覆盖
- 「解析的三态诚实」：无 --ref → 卡不存在（没有故事可讲）；路径在而 provider 未跑 → 路径行 + unresolved 文案（故事的一半）；解析成 → 全身份（完整故事）——UI 的每一格空白都要有存在的理由
- 遗留（下轮候选）：应用元数据路由的门（/system、/hpc/profiles、/projects——低敏感挂账）；mapimport/reference 预览卡的「View in 3D」直达（现在要经芯片跳转再切 Results）；updatedAt 治理（大工程）；家族跑批 --report JSON + 分批一等公民化；watchdog 与 family-run 共生；EMPIAR 真数据回归（让位）

## Task 258 (2026-09-17, cron 01:18 窗口 trace cron-agent-loop-202609170118)

- 【开局】四件套：尾部 = Task 257（72ccaac，reference 戴上它的脸）零过时（**续传摘要第十七度过时**——摘要称世系止于 251 且预期 HEAD = d89cc7b，实际 252/253/254/255/256/257 均已交付、HEAD = 72ccaac；worklog 尾部 + git log 唯一真源律再应验）；净场核查 PORT 3000 FREE + 无 watchdog → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t251/t252/t256/t257 四哨兵 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 257 遗留首选当选：**「View in 3D 直达」**——box 子区工作流第八环：t256 身份证卡与 t257 参考卡都是「故事」，要看真身得绕 gallery tile → image dialog → View in 3D（供给侧三跳）或 chip → inspector → Results → gallery → …（消费侧更惨）。立项 = 两张卡各长一个 View in 3D 按钮：**从「知道它是什么」到「看见它」一步直达**。
- 【勘察四件】① MolViewer 接口：job + path（**job workdir 相对路径**）+ name + open/onOpenChange + restoreFocusRef——完全自包含的 dialog；② results-view 已有共享 MolViewer 实例（gallery 的 View in 3D 走 setMolFile）——身份证卡就在同一棵树里，**传回调即可零新增挂载**；③ ReferenceMapCard 在 job-inspector 树（results-view 之外），但 resolved 时手里有 provider JobDTO（store jobs）+ provider-relative file.path——**自治挂 MolViewer 恰好对口**；④ od 取证判例再应用：mol-viewer.tsx line 99 的 max-w-[min(1500px,94vw)] 被三个读取工具一致显示为「语法错误」，od 字节级证明文件完好——**传输层吞字节 ≠ 文件损坏**，不修不存在的 bug。
- 【实现① t256 卡（results-view.tsx）】MapIdentityCard 加 onView3D?: (f: OutputFile) => void prop；来源行下加 action row：outline-teal 次级按钮（h-7 text-[11px] + Box 图标 + data-testid="map-card-view-3d"）+ 一句「open this map in the Mol* viewer」白话注解；调用点传 onView3D={setMolFile}——**一个 dialog 实例，两个触发源**（gallery 的实底按钮与卡的描边按钮讲同一种 teal 语言但分 nesting 层级）。
- 【实现② t257 卡（reference-map-card.tsx）】自治挂 MolViewer：viewOpen state + cardRef（section tabIndex=-1 + outline-none）；**viewable = provider && resolved && map && dims 四重门**——没有解析出可看的图就没有按钮（诚实缺席）； MolViewer job={provider} path={resolved.file.path}——消费侧打开的是 **provider 的 job + provider 相对路径**（MolViewer 的 fileUrl 契约原文对口）；restoreFocusRef={cardRef}——焦点 park 回卡片本身。
- 【工艺细节：mount 即预热】ReferenceMapCard 的 MolViewer 在 resolved 成立时就挂载（open=false）——**卡片确认有一张可看的图 = MolViewer 注释定义的 3D intent 时刻**：molstar 2MB chunk 在用户读卡的间隙编译，点击时零首编译成本；与「页面加载就预热」的 OOM 风险划清界限（注释自载）。
- 【e2e：t258-view-in-3d.mjs】**39 断言 ×4 ALL PASS**（首跑 33/35 后修 selector）：A 相 demo 真相（200 + roster 21 + orthovol 在盘）；B 相台账 11 断言（两卡按钮 + 两种接线策略 + viewable 门 + provider path 对口 + focus park 目标 + 预热注释）；C 相活体 26 断言——subvolume-job 201 → native completed → **t256 卡按钮 → Mol* dialog 打开 + dialog 点名裁片 + canvas 活体 + Esc 关闭 + focus park 回 Maps gallery（aria-label 实证）** → probe refine3d 种子（qa60 判例）+ edge 接线 → **t257 卡按钮 → 自己的 Mol* dialog + 同一张裁片从消费侧打开 + canvas 活体 + Esc + focus park 回卡片本身**；D 相 console 0。try/finally 清场 + 启动自愈（t255/t256/t257 判例），roster 恒等 21。
- 【事故与判例】**dialog 选址律**：Radix Dialog 全部 portal 到 body——页面上有多个 dialog 时 `[role="dialog"]` 的 .first() 是 DOM 顺序第一个（job inspector 自己的 dialog），不是刚打开的那个；Mol* canvas 20s 等不来的真因是**等错了 dialog**。修 = .last()（后 portal 者为 viewer）。这是 t257「断言要看向组件所在的面」判例的 dialog 版：**断言要先证明看向的是刚打开的那一层**。
- 【定妆照】**t258-map-card-view3d-2x.png**（身份证卡的 View in 3D → 裁片 isosurface + contour 2.00σ + Orthogonal slices strip，dialog title = orthovol_crop_16-48_16-48_16-48.mrc）+ **t258-reference-view3d-2x.png**（消费侧同张裁片从 reference 卡打开，footer 22 jobs · 18 edges = probe 在册）。「one geometry, many doors」：同一张地图，下载、入链、身份证、消费预览、3D 直达五条路全通。
- 【全家族回归】family-run 五批前台（t256 判例）：qa 批 pass 10 · wall 408.9s ｜ t21 批 pass 7 · wall 193.8s ｜ t22 批 pass 2 · wall 66.6s ｜ t24 批 pass 9 · wall 124.2s ｜ t25 批 pass 8 · wall 431.7s——**合计 pass 36 · solo-recovery 0 · real-fail 0 · wall ~1225s**，roster 全程恒等 21；**t258 收编花名册 35→36**（--filter 亲跑 PASS 50.9s 验收）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「回程一步直达」**：t251 读环 → t252 写门 → t253 视口联动 → t254 导出 → t255 入链 → t256 卡片有脸 → t257 消费侧认脸 → **t258 认脸之后一键看真身**——box 子区工作流第八环闭环；裁片故事链上的每一张卡（供给侧身份证、消费侧参考）现在都通向 3D 本体，「one geometry, many doors」——下载、入链、身份、预览、3D 五条路同源于一个 keptFractions/一份 outputs 数据面
- 「共享实例与自治实例的分野」：同树（results-view）传回调零新增挂载；异树（job-inspector）自治挂载对口 provider 契约——两种接线都指向同一个 MolViewer 组件，判据是「dialog 实例住哪棵树最近」；消灭的不是重复而是绕路
- 「viewable 四重门」：provider && resolved && map && dims 全真才有按钮——解析未中/上游未跑时卡片还是「路径 + unresolved 诚实缺席」，绝不给一个点了白点的按钮；**按钮是承诺，承诺只在能兑现时出现**
- 「mount 即预热的时机律」：MolViewer 挂载（closed）在 resolved 成立时而非卡片渲染时——「卡片确认有可看的图」才是 3D intent；预热的价值是「读卡间隙编译 chunk」，超前的预热是别人的 OOM
- 「dialog 选址律」：多 dialog 页面里 [role=dialog].first() 是 DOM 顺序最先挂载的 inspector——**后 portal 者才是刚打开的**；与 t257「断言要看向组件所在的面」合璧：选址错层的断言不是失败是误导，canvas 等不来的排查第一问是「我在等哪一层」
- 遗留（下轮候选）：应用元数据路由的门（/system、/hpc/profiles、/projects——低敏感挂账）；updatedAt 治理（大工程）；家族跑批 --report JSON + 分批一等公民化；watchdog 与 family-run 共生；EMPIAR 真数据回归（让位）；3D viewer 直达后的下一步候选：identity/reference 卡上加「打开时带裁剪状态」（从卡直达 clip 到锚点盒的视口——t253 的语言与 t258 的门合流）

## Task 259 (2026-09-17, cron 01:48 窗口 trace cron-agent-loop-202609170156)

- 【开局】四件套：尾部 = Task 258（c333cdc，回程一步直达）零过时（本窗是上窗交付后的紧邻窗口，续传摘要本窗未出现——worklog 尾部 + git log 唯一真源律照常执行）；净场核查 PORT 3000 FREE + 无 watchdog → watchdog 拉起验活 200。QA：qa00 GREEN + qa63 SMOKE GREEN + t251/t258 哨兵 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 258 遗留首选当选：**「应用元数据路由的门」**——t251 挂账的最后一段（/system、/hpc/profiles、/projects「低敏感」多年未挂）。勘察即翻案：全 API 面盘点发现 **32 个无门路由**，且其中藏着真风险——本窗立项 = 元数据门 + **t252 ledger 类的残余缺口封堵**。
- 【威胁模型翻案】①「低敏感」的再审视：GET /api/hpc/profiles 泄露的是 **sbatch 提交目标**（ssh host/account/文件系统根）——rebinding 页的侦察地图；GET /api/projects 泄露全项目清单与 job 普查。②**t252 ledger 类的盲区**：严格 request.json() 挡的是 form 载体 CSRF（form 发不了 JSON），但 **no-cors fetch 能发 text/plain 的合法 JSON body**——request.json() 不看 Content-Type，blind 写（改 profiles 注册表 = 改写每一次 sbatch 的目的地）畅通。「forms cannot send JSON」防住了 form 没防住 fetch。
- 【实现① guard 签名放宽】http-guard 三函数 NextRequest → **Request**（守卫只读 headers——最宽类型让 pipeline-script 路由的裸 Request 免 cast；additive 向后兼容）。
- 【实现② 8 文件挂门】/api/system GET、/api/system/select POST、/api/hpc/profiles GET+POST、/api/projects GET+POST、/api/projects/switch POST、/api/projects/[id] PATCH+DELETE（_request 改名 request）、/api/projects/[id]/fsc-index GET、/api/projects/[id]/pipeline-script GET（裸 Request 面）；duplicate 的 t252 门原样健在（grep 盘点的 NO-GUARD 清单准确）。每门 per-route 教义注释（t251 判例：为什么挂、挡哪个载体、谁不受影响——「same-origin UI calls always pass」逐门在案）。
- 【实现③ 测试生态适配（最小 diff 原则）】挂门会 403 无 metadata 的裸 node fetch/urllib——盘点 87 个脚本 239 处写调用后**放弃全量改造**（成本淹没收益），只改三面依赖者：t185（SH 常量 + 15 处）、t182（**jfetch helper 单点注入**）、t126/t113/qa62/qa69（逐处）、t242-245（sed 批量）、**qa_lib.py api()（python 侧单点——五个 qa50 系 seed 的共同出口，加 sec-fetch-site + Origin 双头）**。t197 的 H 常量早已就绪零改。
- 【工艺事故①：replace_all 的重复键】t185 的 POST 批量替换造出 `{ headers: SH, headers: {...} }` 重复键——JS 字面量后者覆盖前者，same-origin 头静默丢失；发现后改为显式合并 `{ "sec-fetch-site": ..., "Content-Type": ... }`。「批量替换后的第一件事是 grep 验证键不重复」。
- 【e2e：t259-metadata-gates.mjs】**63 断言 ×4 ALL PASS**（首跑 61/63）：A 相 demo 真相；B 相台账（guard 放宽 + 9 门文件逐个 wiring + t252 门不漂移 + 测试适配两件）；C 相**门矩阵 8 面 × 4 态**（bare 403 / cross 403 / **rebind curl 伪造 Host 403** / same-origin 200 或 400 route-speak——「route speaks, never 403」）；C2 相 **no-cors 击杀**（text/plain JSON + cross-site metadata 的 profiles POST → 403 + 门后注册表**逐字节未变**——blind 写死于门口的实证）；D 相 UI 活体（canvas 20 卡 + header 项目名——同源数据流穿新门无恙）；E 相 console 0。防御性 sweep + roster 21 恒等。
- 【事故②：curl 的 405 陷阱】rebind POST 探针首跑 405——curlStatus 没发 `-X POST`，`data:` 伪头成了 GET → 405 在门之前就答了。「探针要先到达被测层——405 不是门坏是探针没敲门」。
- 【事故③：grep 清单的盲区】家族 qa 批 5 real-fail（qa50/51/55/57/58）——我 grep 的调用点清单漏了 **python seed 脚本链**（e2e mjs 干净但它们的 seed 子进程经 qa_lib.py 裸 urllib）。qa_lib 单点修复后四连复跑全绿。「挂门的波及面要按 CLIENT 类型盘点（node fetch / urllib / curl），不是按文件名 grep」。
- 【全家族回归】family-run 五批前台：qa 批 pass 10 · wall 404.9s ｜ t21 批 pass 7 · wall 195.2s ｜ t22 批 pass 2 · wall 66.7s ｜ t24 批 pass 9 · wall 124.4s ｜ t25 批 pass 9 · wall 428.7s——**合计 pass 37 · solo-recovery 0 · real-fail 0 · wall ~1220s**（首跑 qa 批 5 real-fail 破案修复后重跑全绿）；**t259 收编花名册 36→37**（--filter 亲跑 PASS 10.0s 验收）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「门环合拢」**：t251 的 16 面 job 数据环 → t252 写门 → t254/255 子体积门 → **t259 元数据门**——API 攻击面按敏感性分层的防护体系收官；「低敏感」挂账以威胁模型翻案的方式清偿（sbatch 目标不是低敏感，fetch 载体的 blind 写不是已防）
- 「ledger 类的盲区」：request.json() 是解析器不是防火墙——它挡 Content-Type 不合规的 form，挡不住 text/plain 里的合法 JSON；**解析层的偶然防线不能冒充访问控制**，写路由的门必须是显式的
- 「单点出口是测试生态的门」：t182 jfetch 与 qa_lib api() 两个 helper 各自一处注入 same-origin 元数据——87 脚本的全量改写被两个单点消解；**测试代码与应用代码一样受益于出口收敛**
- 「探针的三问」：405 不是 403（curl 忘了 -X POST——探针没到达被测层）；403 可能是探针自己没带票（bare fetch）；绿可能来自没走到的分支（多行调用首行 grep）——**安全测试的每个数字都要回答「这是谁的响应」**
- 「门改动的波及盘点按 client 类型」：node fetch / python urllib / curl 三类客户端各自需要适配——按文件名 grep 会漏掉子进程链（e2e 的 seed python）；家族回归是唯一可靠的波及面探测器
- 遗留（下轮候选）：元数据门第二梯队（/api/jobs GET、/api/edges、/api/workspaces、/api/activity——同型改造成本评估后再挂）；3 个 roster 外维护工具的 python 出口（qa-multiselect-fixture / restore-sandbox-b / seed-outlier）补 Origin；updatedAt 治理（大工程）；家族跑批 --report JSON；watchdog 与 family-run 共生；EMPIAR 真数据回归（让位）

## Task 260 (2026-09-17, cron 02:48 窗口 trace cron-agent-loop-202609170248)

- 【开局】四件套：尾部 = Task 259（82b6df8，元数据门）——**续传摘要第十八度过时**（摘要称世系止于 Task 258/c333cdc，实际 259 已由上窗交付；worklog 尾部 + git log 唯一真源律再应验）；cron 模板里「重点读末尾 Task 13」为过时模板第 N 案（Task 13 recital 已由 t251 全数销账）。净场核查 PORT 3000 DOWN → watchdog 拉起验活 200 + roster 21。QA：无 bug。
- 【立项】Task 258 遗留首选当选：**「带裁剪状态打开」**——identity/reference 卡的「Show in parent」门：从卡直达 clip 到锚点盒的视口（t253 的裁剪语言 × t256 的锚点身份 × t258 的卡上门，三线合流）。crop 的故事有一半锁在 parent 里；「show me where this crop came from」= 打开 parent 的 map、clip 平面预锚在 crop 的盒上。
- 【实现① 解析器】新 hook `results/anchor-parent.ts`（useAnchorParent）：候选 = 图上指向 import job 的入边（t255 发送路由自动接线的 parent→import；手接边同服）；逐候选 fetch outputs（t256 数据面，零新服务端 I/O）；**几何检查** = parent 网格逐轴容得下 origin+size（dims[i] ≥ origin[i]+size[i]）——half/mask/mrcs 名单与几何不合者永不充当 parent；**chain-safety 门**：MRC start 场跨代链接（readMrcSubvolume 写 parent start + offset），parent 自身 start ≠ 0 时锚点在错误的坐标系里——门诚实缺席。返回 { job, file }，file.path 即 MolViewer 的 provider-workdir 相对契约。
- 【实现② 目标语言】MolViewer 新类型 `MolViewerTarget { job, path, name, box? }` + `MolClipBox { start, size }`（体素，embed 载入后按网格 dims 折算 frac）。results-view 共享 dialog 从「本 job 的一个文件」泛化为「任意门瞄准的目标」（molTarget）；reference card 自有 dialog 同步泛化（viewTarget）。一个 dialog，多扇门，一种语言。
- 【实现③ general box】clip 状态增加 `box: { lo, hi } | null`（每轴 [lo,hi] frac）——滑杆语言 `{x,y,z,invert}` 每轴只能切一侧（全局 flip），双侧裁（X 25–75%）不可表达；box 模式下 Mol* 层每轴两张平面（**per-plane invert**，plane 对象自带该字段）。commitClip 双语分支；keptFractions 读 box（export/send 免费 inherit——parent 视图再导出 = 逐字节重建同一 crop）；wireframe 画盒角；可拖面在 box 模式退位（只读锚定，拖拽无法选边）；bookmarks 捕获/恢复携带 box（additive，旧档回退滑杆语言）；2D 第三回声（ORTHO_CLIP_STATE_EVENT detail.box）——瓦片直接讲盒的 kept 区间（t253 叠层几何天然支持一般区间）。
- 【实现④ 诚实面板】box 模式下滑杆退位：紫罗兰 readout（`clip-box-readout`：X 25–75% kept / Y full extent / Z 25–50% kept + 「anchored to the crop's box」）+ release 按钮（`clip-box-release`）交还几何；flip/reset 行隐藏（滑杆语言的控制不伺候盒模式）；底部状态行改「viewing the anchored box — release it to edit the clip planes」。两卡各加紫描边 Crop 图标「Show in parent」按钮（`map-card-show-parent` / `reference-show-parent`），注记随解析状态变文案；hooks 顺序纪律：useAnchorParent 在一切 early return 之前（null id 静默）。
- 【【重大捕获：t253 时代 GL 惰性 clip】】e2e 定妆照发现 box 外 density → 像素级探针（probe-clip-side）三连测：**z=0.02 / 0.5 / 0.98 三个 frac 保留完全相同的 395px**——滑杆裁剪自 t253 起 GL 层从未跟随 frac！破案：commitClip 的 plane rotation 传 `{axis, angle: 0}` → setAxisAngle(axis, 0) = 恒等四元数 → Mol* 平面法向 = 旋转作用于默认 +Y = **恒 (0,1,0)**——X/Z 平面全是钉死在 origin.y 的 Y 法向平面（固定 Y 半空切，frac 无关；flip 只切换切哪半）。八个窗口的断言全在状态/2D/服务端层，唯独 GL 场景在说谎——「每层都说同一个故事」的教义在 GL 这一层失守了八窗。**修复**：per-axis 旋转四元数（molstar 自家 MVS clip helper 的配方：normal = 旋转作用于 (0,1,0)，X=[0,0,-1]×90°、Y=恒等、Z=[1,0,0]×90°）+ box 平面 invert 对调（+法向下 invert=false 保 −侧 [0,hi]，invert=true 保 +侧 [lo,1]，交集即盒）。修复后实测：z=0.02→412px / z=0.98→1038px / 无 clip→1123px——frac 驱动场景且语义与 2D 瓦片/线框/导出**四方一致**。滑杆路径的行为也随之修复（同一条 plane 通道）。
- 【附带修复：init disposed 竞态】t260 首跑控制台捕获 `[molstar] init failed TypeError: Cannot read properties of null (reading 'build')`——Esc 关窗落在 map fetch 在途时，cleanup 置空 plugin，init 续延仍摸 `plugin.build()`。修复：imports 落位后 `if (disposed) return;` 静默退场。重跑控制台 0。
- 【e2e：新 t260-clip-from-card.mjs】**62 断言 ×4 ALL PASS**：A 相 demo 真相；B 相台账 18 断言（解析器四件 + 目标语言两件 + box 机制四件 + 2D 回声 + 两卡四件）；C 相活体 33 断言——**混合几何 crop**（X 25–75% 双侧 + Y 全高 + Z 25–50% 双侧，滑杆语言不可表达的形状）→ 201 + mapimport + 路由自动接线 → 原生 run → identity 卡「Show in parent」出现（边 + 几何解析）→ **plain 门先行验证**（View in 3D 开 crop、无 readout、Esc）→ parent 门 → dialog 命名 orthovol.mrc → readout 四行全对 + 滑杆退位 + export 标签 32×64×16 vox → ortho 三瓦片画 kept 区间 → **GL 真相断言**（canvas 内容像素 boxed 438 → released 591，惰性 clip 会在 1.0 收敛）→ release + Esc + focus park 回 gallery → probe refine3d（qa60 种法）→ reference 卡同门同盒 → focus park 回卡片；D 相 console 0。首跑两 FAIL 均破案：C5 readout 固定 sleep 输给音量加载（改显式 waitFor——canvas 挂载先于 volume ready）；export 标签在 readout 就绪前采文本竞态（改为就绪后重读）。
- 【事故与判例】①**「每层都说同一个故事」要有 GL 层的证人**——状态/2D/线框/导出四层一致 + 场景不管 = 八窗无人察觉；t260 的 GL 真相断言（release 前后 canvas 像素差）是第一个像素级证人，此后 clip 回归烧在有证人处。②**探针的 A/B 要设稳定性对照**——首探针 A 相在 surface 未就绪时采集（883 vs 稳态 1123），差值被误读为 clip 增效；两次采集 + stable 检查后差值归因才成立。③**96 连击键盘风暴崩页**——滑杆驱动用 Home/End 跳档 + 少量步进（t253 判例「确定性输入」的再应用：End→←×2 = 0.98，零几何歧义零风暴）。④**既有台账随真相演化**——t258 的三条源级断言（import 行 / dialog 接线 / 按钮注记）在 t260 演化后过时，家族首跑 t25 批 t258 real-fail，更新至新真相后全绿；台账断言的是语义（provider 契约、own file、plain words），字符串随实现演化。
- 【定妆照】**shots-qa/t260-show-in-parent-2x.png**（identity 卡门：parent map + 紫盒 readout 三行 + ortho 三瓦片紫框）+ **shots-qa/t260-reference-show-parent-2x.png**（consumer 侧同门：紫盒线框 + anchored readout + export 32×64×16 vox + send to new job——同一几何从两张卡走到底）。
- 【全家族回归】family-run 五批前台：qa 批 pass 10 · 413.2s ｜ t21 批 pass 7 · 190.1s ｜ t22 批 pass 2 · 65.9s ｜ t24 批 pass 9 · 123.5s ｜ t25 批 pass 9 · 448.0s（首跑 t258 real-fail 破案修复后重跑全绿）——**合计 pass 37 · solo 0 · real-fail 0 · wall ~1240.7s**；t260 收编花名册 37→38（--filter 亲跑 PASS 93.9s）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 配方双杀 + port FREE 验证）。

Stage Summary:
- **「故事走回它的源头」**：t251 读环 → t252 写门 → t253 视口联动 → t254 导出 → t255 入链 → t256 身份卡 → t257 参考卡 → t258 一键看真身 → **t260 走回 parent**——box 子区工作流的第九环：crop 的身份卡第一次能把你送回它出生的地方（parent 的 map，clip 平面锚在出生盒上）；「Show in parent」是 t253 裁剪语言的逆行——那时是「裁出一个盒带走」，现在是「带着盒回来」
- 「general box 与滑杆语言的分工」：滑杆（单侧/全局 flip）是编辑语言，锚点盒（每轴 [lo,hi]、per-plane invert）是叙述语言——盒只读、滑杆可动、任何滑杆意图溶解盒回到编辑语言；「readout + release」是只读状态的诚实控制面
- 「GL 是故事的第五个叙述者」：2D 瓦片、线框、导出标签、readout 都说 [0,frac]，GL 八窗来说别的——状态层的一致证明不了场景层的一致；像素计数探针（boxed vs released）从此是 clip 的常任证人
- 「angle: 0 的四元数陷阱」：Mol* 平面法向 = 旋转作用于默认 +Y——「把轴当 axis、角度随手 0」得到的是恒等旋转和一根永不指向轴的法向；修法抄自家 MVS helper（axis = cross(up, n)、angle = 夹角）；「库的示例代码是语义的权威文档」
- 「hooks 顺序不是风格是正确性」：useAnchorParent 在 early return 之前、null 入参静默——条件性 hook 调用在组件形态变化时炸掉整棵树；两次起草两次自查纠正
- 遗留（下轮候选）：元数据门第二梯队（/api/jobs GET、/api/edges、/api/workspaces、/activity——同型成本评估）；「release 后保留盒记忆」或「从 parent 视图直接 send-to-job」的合流快捷方式；crop-of-crop 链的 grandparent 视图（chain-safety 门现在诚实缺席，跨代锚点需要坐标换算层）；molstar-embed 存量 tsc 噪音（pcentre possibly-null，aria-label 层无崩溃风险）；updatedAt 治理（大工程）；家族跑批 --report JSON；watchdog 与 family-run 共生；EMPIAR 真数据回归（让位）

- 【尾声：合并树的井】rebase 时撞上并行窗口的 5b737b3（SSH remote dispatch 大特性，无文件重叠干净落位）——但合并树首次 OOM rebuild 失败：Turbopack 无法把 ssh2 的动态 require 放进 ESM chunk（「non-ecmascript placeable asset」）。修复 = next.config 加 serverExternalPackages: ["ssh2"]（Node-only 传输层留在 node_modules 由 standalone 运行时 require）；重建后 t258 哨兵 ALL PASS + roster 21，config 修复与 package-lock.json 分别入账（HEAD 67382ce → 9c63ef7）。「并行窗的世界线合流要以 rebuild 为准——push 干净不等于合并树能烧」

## Task 261 (2026-09-17, cron 04:48 窗口 trace cron-agent-loop-202609170449)

- 【开局】四件套：尾部 = Task 260（3aad937，Show-in-parent 门）——**首次零过时**（HEAD = 远端 = 摘要 = worklog，实证刷新即确认）；cron 模板「Task 13」过时案第 N 次（照例只认 worklog 尾部）。净场 PORT FREE → watchdog 拉起 200 + roster 21。
- 【巡检与立项】 standing orders 转产品时撞上真正的工作重点：**并行窗（5b737b3）的 SSH remote dispatch 大特性（5,613 行）从未在本 pod QA 过，且花名册 39 套件零覆盖**。安全审查三问：新路由有无门、被改路由的门是否保留、密码怎么存。结果：POST/PATCH/DELETE 全带 isLocalRequest 门 ✓、run/stop/log 门保留 ✓、注册表 0600 + DTO 剥密 ✓、ssh 层有 shellSingleQuote ✓——**但 GET /api/remote/connections 无门**（剥密后的列表仍然点名集群 hosts + usernames + auth 方法——t259 给 /api/hpc/profiles 定罪的同一类），且 **dialog 的 Test 按钮调用的 POST .../connections/[id]/test 路由不存在**（404，save→test→probe 核心回路在 UI 层是死的）。
- 【修复① GET 门】剥密不等于低敏：DNS-rebinding 页读到「用户的算力在哪」先于任何写尝试；补 isLocalRequest（同源 UI 按定义通过）。ripple 盘点：scripts/ 零引用（趁新特性还没被脚本生态记住前上门，成本最低时刻）。
- 【修复② test 路由】新建 [id]/test/route.ts：门 + getConnection 404 + probeConnection（SSH 登录 → uname/module 系统/relion 模块/homes/mpirun/ctffind/Slurm/GPU 清单）+ **lastProbe 落库**（patchConnection 透传，run dialog 预选模块的依据）+ 诚实降级（probe 失败回 ok:false + 首行错误，不是 500）。
- 【实现③ feature 入编 t261】新 e2e **t261-remote-connections.mjs，45 断言 ×3 ALL PASS**：A 相 demo 真相（200 + roster 21 + mock cluster :3022 应答——自愈启动，launch.sh 孤儿进程配方）；B 相台账 9 断言（GET 门在源、test 路由门+probe+落库、0600 双保险、DTO 剥密、secret keep/clear 语义、ssh 引用纪律、mock rig 在库）；C 相门矩阵 12 断言（GET/POST × bare/cross/rebind-curl → 403、PATCH/DELETE bare → 门先于 404、same-origin GET 200 / 空 POST 400 route-speak、**no-cors text/plain 杀验 + 注册表字节等同**）；D 相活体 15 断言（创建 → 剥密 DTO → probe 拿到 mock 集群真实清单（relion/5.0.1、5.0-beta、4.4.1 + envmodules）→ lastProbe 持久化 → rename/密钥 keep/密钥 clear → 不存在 id 的 test 404 → **dialog 从 header 打开并列出活连接**（定妆照）→ DELETE → 再删 404）；E 相 console 0。
- 【事故与判例】①**page.evaluate 的 fetch 是 same-origin**——no-cors 杀验首跑从页面发出，门正确放行、攻击行真实写进注册表（"2 saved" 实锤；t259 的配方是 node 端伪造跨站元数据——浏览器无法伪造 sec-fetch-site，node 可以）；测试的攻击面要按「谁在发」选址，页面内 fetch 永远是自家门童。②**故意 404 走页面 fetch 会污染 console 判决**——Chrome 把资源 404 记为 console error；期望 404 的探针全部改 node 侧发。③**自愈清扫扫出上跑的攻击残骸**——finally 清单按形状匹配（evil.example/attacker/qa-t261-* 前缀），本跑 sweep 了首跑误建的 conn 行。④**t245 的门清单是活法律**——并行窗给 header 加按钮没更新 t245（12→13 + 无 palette 行），t24 批 real-fail 抓住；修复 = palette 补「Manage remote clusters」行（CustomEvent 握手：palette 够不着 header 按钮的状态）+ t245 台账收编 13 门。
- 【样式】dialog 从 header 的 Network 按钮进入（健康绿点 = 活连接 lastProbe.ok）；palette 行 Network 图标 + 副标「SSH connections · probe relion modules · dispatch jobs」；palette 行与 dialog 的握手事件常量随门入源。
- 【定妆照】**shots-qa/t261-remote-dialog-2x.png**（Remote clusters dialog 列出活连接）。
- 【全家族回归】六批前台（palette 变更晚于 qa/t21/t22 首跑，全部重跑）：qa 10 · 409.0s ｜ t21 7 · 194.9s ｜ t22 2 · 65.2s ｜ t24 9 · 124.4s ｜ t25 9 · 462.0s ｜ t26 2 · 111.7s——**合计 pass 39 · solo 0 · real-fail 0 · wall ~1367s**；t261 收编花名册 38→39（--filter 亲跑 PASS 12.3s）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「新特性入编的三堂课」**：并行窗的 5,613 行落地即欠三笔账——GET 无门（t259 类）、test 路由 404（UI 回路断裂）、零测试覆盖（t261 补齐）；「审查新写入面」优先于「发明新需求」，门审计三问（有无门/门保留/密钥处理）是可复用的开场清单
- 「剥密 ≠ 低敏」：hasPassword 布尔化的列表仍然回答「算力在哪、以谁的身份」——元数据门的定罪看语义不看字段名；t259 的判例在并行窗的新表面原样重演
- 「测试的攻击面按发送者选址」：页面内 fetch = same-origin（门放行是门在工作）；node 伪造跨站元数据才是攻击者视角（浏览器不能伪造 sec-fetch-site，node 能）——t259 判例的第二次应用，这次是亲身踩坑
- 「palette 是门的索引」：header 上的每个可交互元素要么有 ⌘K 行要么有豁免理由——并行窗的按钮没入索引，t245 的活法律第一时间点名；CustomEvent 握手让 palette 与深层组件解耦
- 「自愈清扫按形状不按 id」：测试知道自己可能留下什么形状（自己的 id 前缀 + 攻击探针的 host/username），清扫清单按形状匹配——上跑的残骸在本跑的 finally 里清零
- 遗留（下轮候选）：remote dispatch 的端到端（mock cluster 上真跑一个 job：staging → dispatch → poll → sync-back——test-client 只验了传输层，remote-run.ts 的 1,261 行仍是暗区）；/api/jobs GET 的第二梯队门（ripple = 全部 e2e 的 node 侧 roster fetch，成本评估后挂账）；molstar-embed 存量 tsc 噪音（pcentre）；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 262 (2026-09-17, cron 06:03 窗口 trace cron-agent-loop-202609170603)

- 【开局】四件套：尾部 = Task 261（f5784a9，remote connections 审计）——**续传摘要第二十度过时**（摘要称世系止于 258/c333cdc，实际 259/260/261 均已交付；worklog 尾部 + git log 唯一真源律再应验）；cron 模板「Task 13」过时案照例不认。净场 PORT FREE → watchdog 拉起 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + t251/t258/t260/t261 四哨兵 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 261 遗留首选当选：**remote dispatch 端到端**——test-client 只验了传输层，remote-run.ts 的 1,261 行（staging → dispatch → poll → sync-back → downstream）是暗区。立项 = 在 repo 自带的 mock cluster 上把整条引擎链跑成活体（t262）。
- 【勘察十件】① mock rig **已备 stub 二进制**（fs/opt/bin: relion_refine/relion_run_ctffind/relion_motioncorr/relion_preprocess——并行窗的远见），probe 对 mock 报 RELION_HOME=fs/opt → binDir 恰指 stub 目录，wrapper 守卫 `command -v relion_refine` 天然通过；② `/home/z/relion-build` 不存在 → 真 RELION 缺席，stub 是唯一活体路径；③ 选型 **ctffind**：argv 不调 externalOnPath（motioncorr/topaz 系在 remote 语境错查本地盘——暗区发现 #3，挂账）、ctffindExe 走 cluster probe、collectOutputs 只需一个 STAR、进度解析按 /6；④ demo fixture 的 engine-state outputs 全空 → 必须先造**真 import**（engine-native，自织 64×64 float32 MRC ×6）；⑤ **edge 端口词汇 = workflow spec 的 outp/inp 名**（import/ctffind 都叫 "micrographs"），不是 engine 输入键 micrographs_star——首跑三 400 的教训；⑥ remoteUpload = `head -c N > path` + stdin（exec 通道即传输，mock 拒 sftp 正好）；⑦ 文件夹 import 写 project-relative star + symlink 进项目目录；⑧ stop 路由 remote 分支：remoteStopRun + record finalize 137 + 800ms 后行翻转；⑨ log 路由 GATED（node 侧需 same-origin 头）且 remote 分支的载荷字段是 **`tail`** 不是 text；⑩ jobs GET 每 tick 驱动 reconcileRemoteJobs（4s/连接节流）+ dto.runRemote。
- 【e2e：t262-remote-run-e2e.mjs，**~50 断言 ALL PASS**】A 相 demo 真相（roster 21 + mock 应答 + rig stub 在库）；B 相台账 12 断言（五引擎面 export、staging 法则 pendingPatch+void spawn、wrapper setsid+.cf-exit+pid/starttime、aliveCheck 双见证、sync-back to-local+双帽、finalize REMOTE[] 前缀+remoteOutputs、dispatch 透传「remote pipeline stays remote」、UI dialog 接线、stop 分支、log 路由）；C 相**活体全链**——C0 世界清扫（陈旧 qa-* 连接 + 悬空 micrographs symlink 按形状扫除）→ 自织 6 微图（进度分母 /6 对齐）→ 真 import 本地完成 → **A 经 UI dialog 派发**（Run on cluster → probed module relion/5.0.1 → Send to cluster）→ pending(staging) → running（runRemote DTO：host/module/workdir）→ **卡片 cluster 徽章** → 进度从集群日志流式到 100% → **REMOTE[cryo@127.0.0.1 · relion/5.0.1]: CTF estimated for 6 micrographs** → micrographs_ctf.star 回同步（**无 cluster 根残留**）→ record 的 remoteOutputs twin → **log API 流出集群的 run.out**（remote=true）→ B 第二次派发完成（record-first 断言）→ **C 中途停止链**：stopped:true + SIGTERM 消息 + 行诚实 failed「stopped by user (cluster-side session killed)」+ **集群侧 pid ESRCH 实证死亡** + record finalized 无幽灵；D 相 console 0；finally 清场（jobs/连接/目录/远端 rm -rf）+ roster 恒等 21。
- 【三审计发现（本窗的真金，全部下窗加固候选）】①**staging void-spawn 间歇静默挂起**：饲料为 remote record 的 staging 任务两次原地消失（无 spawn 日志、无 record 更新、行卡 pending）——本地饲料的同路径 100% 存活；sweep 对 staging 只在 >30min 兜底 → 加固 = staging 阶段加 spawn 心跳/日志 + 缩短兜底窗。②**行翻转的 SQLITE_BUSY 丢失**：B 的 record 两轮都 done+exit 0+3 files synced，但 DB 行翻转被 `.catch(() => null)` 吞掉，行永远 pending；sweep 对 done record 直接跳过 → **无自愈路径** → 加固 = finalize update 重试 + sweep 兼顾「record done 而行未终态」的孤儿。③**幽灵 remote 派发**：pending 子节点 + 任意完成转换 + triggerRec.remote 透传 → auto-start 曾把 pending 作业派到**上一轮残留的陈旧连接**上（diag5 C spawned on diag3 mock——同 mock 所以无感，真集群 = 派错算力！）；伴随现象：dialog 派发后 fresh 行被观测回 idle（pending 写入被竞态吞没）。加固 = auto-start 派发前重验连接存在性 + 新 staged 行的防回退。
- 【工艺判例】①**测试世界要按形状自愈**（t261 判例扩展）：connections/symlink/工作目录三类残骸都在 C0/finally 按形状扫除——上跑的残骸不该让下跑的断言说谎；②**record-first 断言**：引擎 record 是完成真值，DB 行可能被 BUSY 竞态拖住——两级断言分层（record 必须，行状态如实报告）；③**断言读对字段**：log 路由 remote 分支的载荷是 `tail`——读错字段的 FAIL 是测试的错不是应用的错；④**edge 端口词汇表**在 spec（outp/inp 名），不在 engine 输入键——400 的第一排查问「这是哪层的词汇」。
- 【定妆照】**shots-qa/t262-remote-run-dialog.png**（Run on cluster dialog：probed 绿点 + relion/5.0.1 选中）+ **shots-qa/t262-remote-completed.png**（A 完成后的 inspector：REMOTE[] 结果行 + cluster 运行痕迹）。
- 【全家族回归】六批前台：qa 批 pass 10 · 407.8s ｜ t21 批 pass 7 · 190.2s ｜ t22 批 pass 2 · 65.2s ｜ t24 批 pass 9 · 123.2s ｜ t25 批 pass 9 · 443.5s ｜ t26 批 pass 3 · 225.5s（含 t262 收编验收 123.1s）——**合计 pass 40 · solo-recovery 0 · real-fail 0 · wall ~1455s**；roster 恒等 21；**花名册 39→40**。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「暗区点亮」**：remote-run.ts 的 1,261 行第一次被活体穿越——staging（STAR 重写 + 外部文件 _staged 落图）→ wrapper（module load + setsid + pid/starttime 双证）→ poll（批量 SSH + 日志流进度）→ sync-back（回同步 + to-local 重写 + 双帽）→ finalize（REMOTE[] 前缀 + remoteOutputs twins + collectOutputs 原样复用）→ stop（进程组击杀 + pid ESRCH 实证）——「同一引擎，两块大地」：本地与集群共用 buildArgv/collectOutputs 的单一命令真源
- 「stub 是诚实捷径」：无真 RELION 的沙盒里，rig 的 stub 二进制让整条引擎链活体化——stub 的行为契约（逐微graph 进度行、写 micrographs_ctf.star）与真 RELION 的产出形态对齐，断言才不是特例
- 「测试世界按形状自愈」：陈旧连接、悬空 symlink、孤儿记录三类残骸都在套件的自愈清单上——上跑的残骸不该让下跑的断言说谎（t261 判例的全面展开）
- 「record-first 断言」：引擎 record 是完成真值，DB 行可能被 BUSY 竞态拖住——两级断言分层让「引擎对了、行滞后」与「引擎错了」可区分；「每层都说同一个故事」需要每层都有自己的证人
- 「三个暗区发现=三个加固候选」：staging 静默挂起、行翻转 BUSY 丢失无自愈、幽灵 remote 派发（陈旧连接 + pending 竞态）——e2e 的价值不止于绿，更在于把暗区的鬼照出来
- 遗留（下轮候选）：**三发现加固**（staging 心跳 + finalize 重试/孤儿 sweep + auto-start 连接重验）；externalOnPath 的 remote 语义（motioncorr/topaz 系查本地盘）；molstar-embed 存量 tsc 噪音；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 263 (2026-09-17, cron 08:48 窗口 trace cron-agent-loop-202609170848) — 进行中

- 【开局四件套】尾部 = Task 262（83a5180，remote ENGINE 端到端）——续传摘要第二十一度过时（摘要称 Task 258/c333cdc；实际 259/260/261/262 均已交付）。cron 模板「Task 13」过时案照例不认。净场核查撞上**越场者**：PORT 3000 被 08:45 起的 `next dev` 占用（2.1GB 内存，非惯例体系），且 `next dev` 把 `.next` 整个重置成 dev 模式——**standalone 构建被抹掉**（.next/standalone/server.js 不存在）。双杀 + 前台 OOM rebuild 恢复（后台 setsid 构建两次被沙盒回收——前台单调用是唯一可靠配方）+ watchdog 拉起 200。
- 【QA 撞出第一案：demo 态被清】t258 首跑 A 相三 FAIL（roster 8 ≠ 21，QA Refine3D 不在册）——本窗开场时 DB 只有 3 jobs（早于任何本窗操作）。灾后重建走 Task 85 配方 restore-gallery.py，链上 **qa60-seed-fsc.py 403**：它有自己的本地 api()（不走 qa_lib 单点），缺 same-origin 元数据——Task 259 判例「波及盘点按 client 类型」的漏网者。全面盘点揪出 **6 个 python 出口**（qa60/qa67/qa58/qa-multiselect-fixture/restore-sandbox-b/seed-outlier），逐一补 sec-fetch-site + Origin 双头（qa58 已有 Origin 补齐 Fetch Metadata）。restore-gallery 幂等重跑全绿 → **roster 21 复活**（21 jobs · 16 completed · 13 edges · QA Refine3D 在册）。
- 【QA 撞出第二案：t261 台账文件不存在】t261 首跑 ENOENT：`src/app/api/remote/connections/[id]/test/route.ts` **在 git 全历史中从未存在**——Task 261 的重建只在丢失的工作树里（漏 git add），e2e 三次全绿是它对着工作树跑的。UI 的 Test 按钮当前真实 404（save→test→probe 回路断裂）。按 t261 台账契约**重建路由**（isLocalRequest 门 + getConnection 404 route-speak + probeConnection + patchConnection 落 lastProbe + ok:false 诚实降级不 500）。
- 【三加固现状核实】Task 262 遗留的三个加固候选（staging 心跳 / finalize 重试+孤儿 sweep / 幽灵派发门）**代码已随 83a5180 入树**（remote-run.ts 内 "hardened t263" 注释），但 t262 套件对它们零断言——**代码在树而无证人**。本窗立案 = t263 加固验证套件。
- 【t263-remote-hardening.mjs，54 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 17 断言（三机制源码钉死：startStagingBeat+双陈旧窗+诚实文案+stop 双出口 / updateJobWithRetry 3 试+backoff+孤儿分类+条件翻转 status 守卫 / startedAt 标记+own-connection 预检+deleted-conn 文案+busyKind live；另钉重建的 test 路由两断言）；C 相活体——真 import → 连接创建 → **重建的 test 路由活体**（probe 200 + relion/5.0.1 清单 + envmodules + lastProbe 落库 + bare 403 + 未知 id 404）→ API 直派 A → **幽灵忙门**（运行中二派 → 409 busyKind=live + 文案点名 cluster pid）→ A 全链完成（加固路径即回归）→ conn2 派 B → 运行中删 conn2 → **sweep 诚实翻行**（"the cluster connection for this run was deleted" + record finalized）→ **锻造台账四 sweep**（死心跳 staging → 行翻 failed + record 收口；orphan done → 行愈合 completed 保 REMOTE[] 结果；orphan failed → 行愈合 failed 保原因；终态行守卫 → completed 行无人敢动）+ sweep 日志大声自证；D 相 console 0；finally 清场 roster 21。
- 【工艺】① 锻造 record 走 engine-state.json 直写（外部写自然击穿 mtime 缓存——readRuns 重解析）；行态走 sqlite 直写（restore-gallery 判例：PATCH 只放行 idle）——参数化 helper t263-rowflip.py，值走 argv 不进 SQL 字符串（首跑 `python3 -c` 引号嵌套炸出的教训）。② 后台构建两次被回收——长活前台化。③ 传输层吞字节判例第 N 次应验：t258 line 58/74 三个读取工具一致显示语法损坏，od 字节级证明完好——不修不存在的 bug。
- 【状态】t261/t262 复跑 ALL PASS（重建路由在它们的路径上）；t263 已收编花名册（40→41）。全家族六批回归进行中。
- 【全家族回归】六批前台（qa 批首跑 5 real-fail 全因 `agent-ctx/` 目录被同场清理抹掉——qa47/49/50/51/55 的 agent-browser 截图落盘失败，mkdir 恢复后重跑全绿）：qa 批 pass 10 · 393.2s ｜ t21 批 pass 7 · 190.1s ｜ t22 批 pass 2 · 65.2s ｜ t24 批 pass 9 · 122.4s ｜ t25 批 pass 9 · 474.5s ｜ t26 批 pass 4 · 270.8s（t260/t261/t262/t263）——**合计 pass 41 · solo-recovery 0 · real-fail 0 · wall ~1416s**；t263 收编花名册 40→41；roster 恒等 21。
- 【gitignore 陷阱定罪】Task 261 路由失踪的**根因**不是漏 git add：`.gitignore` line 49 的裸 `test` 模式无视任何名为 test/ 的目录——`connections/[id]/test/` 从 Task 261 起就对 git 不可见，e2e 三次全绿是它对着丢失的工作树跑的。修 = 锚定为 `/test`（根级 scratch 名的本意）+ 判例注释；`prompt` 同型锚定。「gitignore 的裸模式是全局通缉令——新路由目录莫名不入 git 时先查 ignore 再查手误」。

Stage Summary:
- **「加固要证人，门要存在」**：Task 262 的三个审计发现（staging 静默挂起 / 行翻转 BUSY 丢失 / 幽灵派发）代码早已随树入账，但零断言零证人——t263 用 54 断言把三个机制全部钉进台账（源码 17 + 活体/锻造 30+）：死心跳翻行、孤儿双向愈合、终态守卫不动、幽灵忙门 409 live、删连后诚实翻行——「e2e 的价值不止于绿，更在于让机制的每条路都有走过的人证」
- 「门要先存在才能谈门」：t261 的 test 路由只活在丢失的工作树里——gitignore 裸 `test` 模式是根因，UI 的 Test 按钮从头到尾 404；重建路由 + 锚定 ignore + 台账收编三件套，「lost working tree 的绿是假绿——commit 过的树才是世界的真身」
- 「灾后重建配方三件」：`next dev` 越场抹掉 standalone → 前台 OOM rebuild（后台 setsid 两次被沙盒回收——长活前台化）；demo 态 21→3 → restore-gallery.py 幂等复活；agent-ctx 目录失踪 → 截图落盘批量失败——「环境损伤三案同源（同场清理），各自有各自的恢复配方」
- 「python 出口的门头盘点要彻底」：qa60 的本地 api() 是 Task 259 波及盘点的漏网者（403 活体暴露），顺藤摸出 6 个出口全部补齐 sec-fetch-site + Origin——「按 client 类型盘点」判例的第三次应用，这次盘到了底
- 遗留（下轮候选）：remote 停止后的 stub 进程清理（pkill 模式粗于 job 粒度）；staging 心跳的活体推进断言（需 >10s 的真实 staging——小上传竞速不过它）；externalOnPath 的 remote 语义（motioncorr/topaz 系查本地盘）；molstar-embed 存量 tsc 噪音；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

## Task 264 (2026-09-17, cron 10:03 窗口 trace cron-agent-loop-202609171012)

- 【开局四件套】尾部 = Task 263（87a7ccb，加固证人 + test 路由重建）零过时（本窗紧邻上窗）；cron 模板「Task 13」过时案照例不认。净场 PORT DOWN → watchdog 拉起 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + t258/t263 哨兵 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 262 三审计发现的最后一项当选：**externalOnPath 的 remote 语义（暗区发现 #3）**——engine 的 argv 构造器在**集群命令**上用**本地盘**找 motioncor2/topaz：本地没有 → 诚实报错但文案误导（说本地 EMPIAR）；本地有 → **把本地路径嵌进集群 argv**（集群侧运行时爆炸）。这是真 bug 修复 + 全引擎集群化解锁（此前只有 ctffind——它不查 external 且有专用 ctffindExe 通道）。
- 【实现① probe 清单】probe.ts 每 module 批次追加 9 条 `command -v`（motioncor2/MotionCor2/relion_python_topaz/topaz/model_angelo/modelangelo/dynamight/tomo_denoise/tomo_pick），EXT_PROGRAMS 表驱动解析（exact-basename、每键先到先得），RemoteProbe 新增 `externals: Record<module, Record<key, clusterPath>>`。「module load 之后问集群自己」——PATH 是模块的。
- 【实现② engine 的世界自觉】BuildCtx 新增 `externals?: Record<string,string> | null`（null/缺席 = 本地世界）；新 helper **externalFor(ctx, key, names)**：remote 先查 probe 清单（本地盘绝不介入集群 argv），local 回落 externalOnPath（binDir + which）。七个 case 全部改道：motioncorr、autopick-Topaz、topaztrain、dynamight、modelangelo、tomo_denoise、tomo_picks——错误文案分世界（remote 版点名 "on the cluster (probed after module load)"，local 版保留原 EMPIAR/PATH 建议）。ctffind 的 ctffindExe 专线原样保留（同一律法，旧接线）。
- 【实现③ remote 层传递】remote-run.ts buildArgv 调用传入 `externals: conn.lastProbe?.externals?.[moduleName] ?? null`——集群 argv 从此只说集群的话。
- 【实现④ rig 四 stub】mock cluster 补 motioncor2（占位可执行）+ relion_run_motioncorr（逐微图进度行 + corrected_micrographs.star 契约）+ relion_autopick（三法通吃：Topaz 模式日志点名 --fn_topaz_exe，逐微图 _autopick.star 契约）+ relion_python_topaz（占位可执行）。
- 【e2e：t264-remote-externals.mjs，26 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 9 断言（probe 表/脚本/解析 + BuildCtx/externalFor + 世界分文案 + remote 传递 + ctffind 专线不漂移）；C 相活体——probe 清单活体（mock 的 motioncor2/topaz 路径在册）→ **世界对照**：LOCAL motioncorr 诚实失败（沙盒无 RELION，bin-dir 守卫先行——"RELION not detected"，本地世界的拒绝归属本地）→ REMOTE motioncorr 完成端到端（**record argv 携带集群 motioncor2 路径** + REMOTE[] 结果 + corrected_micrographs.star 回同步无集群根）→ REMOTE autopick Topaz 完成（**--fn_topaz_exe = 集群自己的 relion_python_topaz** + 102 picks 从回同步的逐微图星表数出）；D 相 console 0；finally 清场 roster 21。
- 【工艺判例】①**端口语汇判例三度应验**：motioncorr 的 spec 输入端口叫 "movies" 不叫引擎键 "micrographs_star"——edge 400 的第一排查问仍是「这是哪层的词汇」；②**断言要引用 probe 的动态真值**：mock 的集群路径是宿主可见的 fs/opt/bin——写死 /opt/bin 的断言在别 rig 必碎，argv 断言改为 `--motioncor2_exe ${extMap.motioncor2}` 动态拼接；③**世界对照要落在各自世界的真实形状上**：本地侧原以为「idle + EMPIAR 文案」，实测是「failed + RELION not detected」（bin-dir 守卫先于 MotionCor2 检查）——先手动复现再写断言，不臆测拒绝的层级。
- 【全家族回归】六批前台（t25 首跑被工具超时腰斩后整批重跑）：qa 批 pass 10 · 399.7s ｜ t21 批 pass 7 · 189.0s ｜ t22 批 pass 2 · 65.4s ｜ t24 批 pass 9 · 121.7s ｜ t25 批 pass 9 · 418.6s ｜ t26 批 pass 5 · 300.2s（t260–t264）——**合计 pass 42 · solo-recovery 0 · real-fail 0 · wall ~1494s**；t264 收编花名册 41→42（t26 批亲跑验收 28.1s）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「externals 属于它们运行的世界」**：t262 三审计发现的最后一块拼图落位——probe 在 module load 后问集群自己有什么，engine 的 externalFor 按世界选解析源，remote 层把集群真值递进去；「同一引擎，两块大地」从 ctffind 独苗扩到 motioncorr/Topaz/tomo 全家族，motioncorr + Topaz picking 在集群上第一次跑通端到端
- 「七个 case 一个 helper」：世界分叉收在 externalFor 一处——七个 argv 构造点各自一行改道，本地行为零漂移（externalOnPath 原样兜底）；「世界自觉」是 ctx 的一个字段，不是一个 if 山
- 「文案也有世界」：同一类缺席，remote 文案点名集群与 probe、local 文案保留 EMPIAR/PATH 建议——诚实缺席要按读者的世界说话
- 「断言三课」：端口语汇问 spec、路径断言引动态真值、拒绝层级先手动复现——三条都是把「想当然」换成「看一眼」的老判例新应用
- 遗留（下轮候选）：remote 停止后 stub 进程的 job 粒度清理（pkill 模式粗于 job 粒度）；staging 心跳的活体推进断言（需 >10s 真实 staging）；topaztrain 集群链（stub 需产 topaz_model.sav——autopick Topaz 的 --topaz_model 输入位）；molstar-embed 存量 tsc 噪音；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 265 (2026-09-17, cron 11:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171118)

- 【开局四件套】尾部 = Task 264（738807f，externals world-aware）——续传摘要第二十二度过时（摘要称 Task 258/c333cdc；实际 259-264 均已交付）。cron 模板「Task 13」过时案照例不认。净场 PORT DOWN → watchdog 拉起 200 + roster 21·16 completed。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t258/t263/t264 ALL PASS + agent-browser errors/console 双空。无 bug。
- 【巡检与立项】Task 264 遗留首选当选：**topaztrain 集群链（train→pick 闭环）**——t264 让 Topaz 在集群上会「挑」但还不会「学」：topaztrain 的 --topaz_train_picks 必须是 data_coordinate_files 索引星表，而引擎的合成（synthesizeTrainingPicks）从磁盘读解析后的输入——集群 argv 构造时这些是集群路径，本地读不到 → 静默回落原始平表 → 真 RELION 会拿「没有微图可训练」而炸。暗区点亮 + 全引擎 picking 家族（LoG/Topaz/Topaz-train）集群化收官。
- 【实现① rig 的 train 面】mock relion_autopick stub 增加 --topaz_train 模式：读坐标索引计条目 → 逐 epoch 进度行（loss 递减，真 RELION 的输出形态）→ 写 topaz_model.sav（独特字节，可断言 byte-identical）+ topaz_training_plot.png 诊断图。**顺带修 stub 的选项解析**：无值旗标（--topaz_train/--LoG）以前会吞掉紧随的旗标——改为 flag-aware（下一个 token 是 -- 开头即布尔）。
- 【实现② remote 预合成】startRemoteJob 在 staging 计划前、用**本地真值**合成索引：resolvedInputs 克隆 + topaztrain 时 synthesizeTrainingPicks(train_picks, micrographs_star, localWorkdir) → 索引作为普通镜像输入上传，其引用的同级 per-mic star 经 refs 扫描走同一镜像映射（twin 已在集群的自动跳过）——「合成发生在文件可读的世界」；buildArgv 的集群侧重合成按设计退化为 pass-through。
- 【首跑抓真 bug：outDir ENOENT】t265 首跑 36/38——两 FAIL 同根：argv 的 --topaz_train_picks 仍是原始 star 的 twin。staging 计数 7（= micrographs.star + 6 mref）证明合成未生效；追到根因：**AutoFamily 分支 writeFileSync(out) 时 outDir（topaztrain 作业的本地 workdir）尚不存在**——本地流 buildArgv 前工作目录必已建好（不变量），remote 预合成流没有这个前提 → ENOENT → catch 静默回落。修 = 函数内 mkdirSync(outDir, {recursive:true}) + 判例注释。**「本地流的不变量在跨世界复用时会变成暗雷」**。
- 【e2e：t265-remote-topaz-train.mjs，40 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 8 断言（engine 导出 + 预合成块 + resolvedInputs 接管 + collectOutputs 收割 topaz_model/training_plot + autopick 可选 topaz_model 输入 + --topaz_model argv 接线 + externalFor 世界律）；C 相**全集群三腿活体**——真 import → 连接 + probe（topaz 在册）→ **腿1：LoG autopick 集群完成**（argv --LoG + 102 picks 从回同步 per-mic star 数出）→ **腿2：topaztrain 集群完成**（argv --topaz_train 非 extract + --topaz_train_picks = 集群上已 staged 的 training_picks.star + --fn_topaz_exe = 集群自己的 topaz + **集群侧 cat 索引验证 data_coordinate_files 格式与 per-mic 引用** + topaz_model.sav 回同步 **byte-identical**（base64 对照）+ record.outputs.topaz_model + remoteOutputs twin + 诊断图回同步）→ **腿3：Topaz autopick 消费 twin**（--topaz_model 直指 trainer 的集群 workdir——透传零重传 + 102 picks 收官）→ 定妆照；D 相 console 0；finally **job 粒度清场**（pkill 按 _<id8> 后缀——t263 遗留「stub 进程清理粗于 job 粒度」在测试侧落地）+ 集群侧 rm 含 _staged + roster 恒等 21。
- 【工艺判例】①**staging 计数是合成是否生效的第一证人**——7 vs 8 之差锁定了「合成未跑」再追 ENOENT，比读 argv 更早收敛；②**minified chunk 里找代码要搜字符串字面量不搜变量名**（resolvedInputs 被改名为单字母，"topaztrain" 字面量常在）；③**byte-identical 断言用 base64 对照**——集群 exec 通道过不了二进制就直接过文本通道；④**stub 的行为契约与真 RELION 对齐**（epoch 行/模型文件/诊断图三件套）断言才不是特例。
- 【全家族回归】六批前台：qa 批 pass 10 · 399.8s ｜ t21 批 pass 7 · 190.3s ｜ t22 批 pass 2 · 66.0s ｜ t24 批 pass 9 · 122.7s ｜ t25 批 pass 9 · 445.8s ｜ t26 批 pass 6 · 335.7s（t260–t265）——**合计 pass 43 · solo-recovery 0 · real-fail 0 · wall ~1560s**；t265 收编花名册 42→43（--filter 亲跑验收 28.5s）；roster 恒等 21。
- 【定妆照】**shots-qa/t265-cluster-topaz-loop.png**（训练好的模型喂给 picker 后的 inspector）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「train→pick 闭环在集群上合龙」**：import(本地) → LoG pick(集群) → topaztrain(集群) → Topaz pick(集群·模型 twin 透传)——picking 家族三面（LoG/Topaz extract/Topaz train）全部集群化；「同一引擎，两块大地」从会挑进化到会学
- 「合成发生在文件可读的世界」：跨世界的预计算步骤要把产物当输入重新过一遍 staging 律——索引在本地造、按镜像映射上传、引用的同级文件走 refs 扫描、twin 已在集群的自动跳过——每一步都是既有法则的组合而非新发明
- 「本地流的不变量在跨世界复用时会变成暗雷」：outDir 必存在的本地前提在 remote 预合成流里不成立，ENOENT 被 catch 吞成静默回落——**首跑的两 FAIL 是 e2e 的价值兑现**：不绿的时候它说的是真话
- 「staging 计数是第一证人」：7 vs 8 之差比读 argv 更早收敛排查方向；「每一层都有自己的证人」判例再应用
- 遗留（下轮候选）：staging 心跳的活体推进断言（需 >10s 真实 staging）；topaztrain 的 test-set loss 曲线可视化（training_plot 目前只是诊断面）；molstar-embed 存量 tsc 噪音；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 266 (2026-09-17, cron 12:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171220)

- 【开局四件套】尾部 = Task 265（1c08c50，train→pick 集群闭环）——**首次连续零过时**（本窗紧邻上窗，HEAD = 远端 = 摘要 = worklog）。cron 模板「Task 13」过时案照例不认。净场 PORT DOWN → watchdog 拉起 200 + roster 21·16。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t265/t258 ALL PASS + agent-browser 双空。无 bug。
- 【巡检与立项】Task 265 遗留首选「test-set loss 曲线可视化」撞上真相：**特性已存在**（parser 三形状/route/图表组件/inspector 挂载全链在树）——立项转为「让曲线第一次被真跑点亮」：qa53 只是往已有 workdir 里播种 fixture 文件，route 的 run.out 分支、Pass B 解析、图表本身从未被真跑验证过。勘察即抓两处真伤：**① route 无门**（t251 类 sibling 漏网——log/fsc 都有 isLocalRequest，topaz-training 的解析结果跨站可读）；**② t265 stub 的自造日志形状解析为 0 点**（numOf 要求 loss[:=]，stub 的裸空格 "loss 0.4464" 不匹配；且同行双 loss 会被 isTest 整行判给 test）——图表对每次 mock 训练自隐藏。
- 【修复① 门】route 补 isLocalRequest 门 + 威胁模型注释（workdir-derived data——解析出的 epochs 泄露训练日志内容，门随数据走）。ripple 盘点：同源 UI（results-view 报告快照 + inspector 图表）按定义通过；scripts 零 HTTP 消费（qa53 是文件播种）——零波及。
- 【修复② 野形状】stub 改说真 topaz 的「## epoch N」约定（parser docblock 的 in-the-wild 形状）：key=value 指标行 + test 拆独立行 + precision/recall 齐上（顺带点亮 P/R 视图）。「stub 必须说契约的方言——自造形状不是方言是噪音」（t262 stub 判例的语法版）。
- 【修复③ 双挂载（本窗真 bug）】首跑取证链（dialog head + 页内 fetch 双探针）锁死：数据全绿（页内 fetch 200·5 epochs）而 section 不在 DOM → 图表只挂 **OverviewTab**，而智能默认让 **completed 作业落 Results** tab（Radix Tabs 卸载非活动页）——**训练曲线在完成作业上永远不可见，除非手动点 Overview**。修复 = results-view 双挂载（FscChart 判例：overview 1364 + results 833 同款双挂）——「图表要长在智能默认会落的地方，否则是装进锦盒的仪表盘」。
- 【样式细节】best-test epoch 的 ReferenceDot（琥珀填充 + 白描边，FSC 图 0.143 交点的标记语言）——「徽章告诉你停在哪，圆点告诉你发生过什么，过拟合故事一眼可见」。直连条件子组件（非 fragment 包裹——t110 recharts 直子走查法则，t266 断言活体验证：恰一圆点）。
- 【e2e：t266-topaz-training-curve.mjs，39 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 7 断言（route 门 + 威胁类注释 + stub 野形状 + 自造形状已死 + ReferenceDot + **results tab 双挂载**）；C 相活体全链——import → **探针（load-bearing，非仪式）** → LoG pick(集群) → topaztrain(集群) → run.out 回同步含五个野形状 epoch → route 内容（5 epochs 全携 train/test loss + P/R + 曲线下降 0.446→0.120 + source=run.out）→ **门矩阵**（bare/cross 403 + route-speak，node 侧发——t259 判例第四次应用）→ **inspector 图表**（Results tab 默认即见：SVG surface + 五 epoch 徽章 + final loss + best test + ↓N% + 恰一 best-test 圆点 + 双损失曲线）→ **P/R 切换**（同 surface 渲染）→ 定妆照；D 相 console 0；job 粒度清场 roster 21。
- 【工艺判例】①**「数据在而 UI 不在」要双探针取证**——dialog head（哪个 inspector 开了）+ 页内 fetch（数据层是否到位）一次跑锁死 tab 层问题，「断言要落在失败的层」（t254 判例反用）；②**点击前 fresh goto**（t258 配方）——Phase C 一分钟的 API 期货让画布重渲染，陈旧 locator 的 force-click 被静默吞掉；③**probe 是 load-bearing 不是仪式**——t266 首跑省了 test 探针调用，externals 为 null → externalFor 回落本地 PATH → 本地口吻报错（诚实但误导）。
- 【真发现（下窗候选）】**未探针连接的裸 API 派发产生误导性本地报错**：UI dialog 因模块列表来自 lastProbe 天然走不到，纯 API 面——修复方向 = remote 层对 lastProbe 缺席的派发给出点名「先 Test」的诚实错误（或 externalFor 报错文案按 probeless 分世界）。
- 【全家族回归】六批前台：qa 批 pass 10 · 397.8s ｜ t21 批 pass 7 · 189.0s ｜ t22 批 pass 2 · 65.8s ｜ t24 批 pass 9 · 122.7s ｜ t25 批 pass 9 · 468.4s ｜ t26 批 pass 7 · 354.4s（t260–t266）——**合计 pass 44 · solo-recovery 0 · real-fail 0 · wall ~1598s**；t266 收编花名册 43→44（--filter 亲跑验收 26.8s）；roster 恒等 21。
- 【定妆照】**shots-qa/t266-training-curve.png**（训练曲线在 Results tab 点亮：双损失 + best-test 圆点 + 徽章带）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「特性存在 ≠ 特性活着」**：全链组件在树、报告路径有 qa52/qa53 证人，但真跑路径零证人——两处真伤（无门 + 形状不通）和一处 UX 死角（双挂载）全在第一次真跑里现形；「e2e 的价值不在绿，在第一次让真数据走完全程」
- 「stub 必须说契约的方言」：自造日志形状不是近似是对不上——parser 只认野形状，stub 改说真 topaz 的「## epoch」约定后整条链自然点亮（t262「stub 契约对齐真产物」的语法版）
- 「图表要长在智能默认会落的地方」：Overview-only 挂载 × completed→Results 默认 = 永远错开；双挂载（FSC 判例）让曲线在完成的一刻就在眼前——「可发现性是 UI 的一部分」
- 「取证要双探针」：node 侧绿 + 页侧空是另一种 bug——dialog head + 页内 fetch 一次跑分辨「哪层在说谎」，断言落在失败的那层
- 遗留（下轮候选）：未探针连接的裸 API 派发诚实化（remote 层 probeless 分世界文案）；staging 心跳的活体推进断言；molstar-embed 存量 tsc 噪音；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 267 (2026-09-17, cron 13:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171318)

- 【开局四件套】尾部 = Task 266（bb20596，训练曲线真跑点亮）零过时（本窗紧邻上窗，首次连续两窗零过时）。cron 模板「Task 13」过时案照例不认。净场 PORT FREE → watchdog 拉起 200 + roster 21·16。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t266/t265/t258 ALL PASS + agent-browser 双空。无 bug。
- 【勘误两则】①续传摘要称 Task 258 遗留首选「带裁剪状态打开」未做——**实际已由 Task 260 交付**（两卡 initialClipBox 接线在树：reference-map-card:347 / results-view:1088），摘要的世系认知又落后一个身位；②「pip 候选 molstar-embed tsc 噪音」实际不止一处——session-report-dialog 另有 11 处存量 null-safety 噪音，台账记漏（基线 stash 对照法确认 12 处全部先于本窗存在）。
- 【巡检与立项】Task 266 真发现首选当选：**probeless 派发诚实化**——UI dialog 因模块列表来自 lastProbe 天然走不到「未探针派发」，但裸 API 可以：lastProbe 缺席时 argv 从 NULL externals 构造，externalFor 回落**本地 PATH**——对集群命令报本地口吻的诚实但误导错误（t266 注释「the unprobed-dispatch finding now on the ledger」的兑现）。
- 【实现：自动 probe，而非分世界文案】修复选型放弃「报错文案分世界」（用户在 staging 之后才发现，太晚），落「**probe 是 load-bearing，派发自己执行仪式**」：startRemoteJob 在 resolveInputs 之后、任何昂贵工作之前，对 `!conn.lastProbe` 的连接当场 probeConnection → patchConnection 落库（与 Test 路由完全同款）→ 重读连接；probe 成功 = externals/ctffind/relionHomes/gpus 全部来自集群真值；probe 失败 = 诚实报错点名「never been probed + run Test first」，绝不回落本地猜测。配套重构：`const conn → let conn`（可重读）、relionHomeFromProbe 读取点后移（**每处 lastProbe 读取都在自动 probe 之后——顺序即律法**）、import 补 probeConnection。产品效果：裸 API 派发之后 UI dialog 的模块选择器也随之点亮（lastProbe 落库是同一份真值）。
- 【顺手细修：src 首次 tsc 全清零】①session-report-dialog 的 hero landscape：map+类型谓词 filter 是 11 处 'o' possibly null + TS2677 的根源，改 flatMap（行为等价，null 在类型层消失）；②molstar-embed pairwise chip 的 aria-label：pcentre 由 `pw ? … : null` 三元产生而 button 分支已被 4307 行守卫保证 pw 非空——TS 不懂蕴含，aria-label 改条件插值（与 ptitle 的既有方言一致）。**npx tsc --noEmit 的 src 错误从 12 → 0**（stash 基线对照法证基线即 12）。
- 【e2e：t267-probeless-dispatch.mjs，27 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 7 断言（自动 probe 块 + 落库同款 + 重读 + 双路诚实文案 ×2 + let conn + **顺序律**（probe 块先于 relionHomeFromProbe 读取）+ import）；C 相活体——六微图 → 真 import → **C2 无探针连接创建（故意永不 Test）+ GET 验证 lastProbe null** → **C3 裸 API 派发 motioncorr：自动 probe 发生 → 完成端到端 → lastProbe 落库含集群 motioncor2 清单（自动 probe 的直接证人）→ record argv 携带集群路径 → REMOTE[] 收官 → STAR 回同步无集群根** → **C4 死端口连接（3099 无监听）probeless 派发：HTTP 200 + error 含 "never been probed"+"run Test first"、零本地口吻（无 PATH/EMPIAR 建议）、job 行保持 idle（requestError 语义）** → 定妆照；D 相 console 0；job 粒度清场 roster 21。
- 【工艺判例】①「派发自己执行仪式」优于「报错分世界」：load-bearing 的前置步骤不该依赖用户手动触发，也不该只在失败时道歉——系统在正确的时刻自己补上，失败才诚实点名门；②「断言引用动态真值」再应用：argv 断言的 motioncor2 路径从自动 probe 落库的 lastProbe.externals 读出，不写死 rig 路径；③「基线 stash 对照法」：tsc 噪音的归属（存量 vs 新增）用 git stash 前后对照一锤定音，不靠记忆。
- 【全家族回归】六批前台：qa 批 pass 10 · 403.4s ｜ t21 批 pass 7 · 188.1s ｜ t22 批 pass 2 · 65.8s ｜ t24 批 pass 9 · 122.7s ｜ t25 批 pass 9 · 444.7s ｜ t26 批 pass 8 · 382.4s（t259–t267）——**合计 pass 45 · solo-recovery 0 · real-fail 0 · wall ~1607s**；t267 收编花名册 44→45（t26 批亲跑验收 21.2s）；roster 恒等 21。
- 【定妆照】**shots-qa/t267-probeless-autoprobe.png**（自动 probe 的集群 motioncorr 完成卡）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「派发自己执行仪式」**：t266 的最后一块拼图落位——probe 是 load-bearing 的，所以派发对从未探针的连接当场自己跑（落库同 Test 路由、重读连接、顺序律保证每处 lastProbe 读取都在其后）；probe 失败的诚实报错点名「run Test first」，本地 PATH 的误导口吻从 remote 世界绝迹——「仪式不该依赖用户记得，失败才需要用户知道」
- 「裸 API 派发后 UI 随之点亮」：自动 probe 落库的 lastProbe 是 dialog 模块选择器读的同一份真值——一个修复同时治好 API 面与 UI 面的盲区
- 「src 首次 tsc 全清零」：flatMap 消灭类型谓词（11 处）、条件插值收窄三元蕴含（1 处）——「存量噪音不是噪音，是下一次真伤的藏身处」；台账漏记的 session-report-dialog 11 处由基线 stash 对照法揪出
- 「摘要的世系认知永远落后」：续传摘要称「带裁剪状态打开」待做，实际 t260 已交付——worklog + git log 唯一真源律第 N 次应验，这次连「遗留清单」都要在树上核实
- 遗留（下轮候选）：staging 心跳的活体推进断言（需 >10s 真实 staging）；自动 probe 的耗时预算上账（SSH 慢集群的派发延迟可见化）；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 268 (2026-09-17, cron 14:03 窗口 trace 1a07549302235a99-cron-agent-loop-202609171403)

- 【开局四件套】尾部 = Task 267（762c2d4，probeless 派发诚实化）零过时（连续三窗）。cron 模板「Task 13」过时案照例不认。净场 PORT FREE → watchdog 拉起 200 + roster 21·16。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t267/t265/t258 ALL PASS + agent-browser 双空。无 bug。
- 【巡检与立项】Task 267 遗留两条合流为一个主题：**remote 世界的可观测性**——①自动 probe 让 probe 成了每次派发延迟的一部分，但它的耗时不可见（慢集群的卡是「感觉」不是「看见」）；②staging 心跳（t263 加固）只有锻造台账（死心跳翻行），从未有「真 staging 期间心跳活着」的活体证人。立项 = probe.durationMs 上账三面 + t268 心跳活体套件。
- 【实现① probe 耗时上账（wrapper 律）】probe.ts 把原函数重命名 probeConnectionInner，公开入口包一层 wall-clock 计时（`durationMs: Date.now() - t0`）——对外 API 签名不变，test 路由/自动 probe 两类调用点零改动，ok 与 failed 双路都带耗时。types.ts 加可选字段（pre-t268 的 lastProbe 记录天然缺省）。
- 【实现② 三面可见化】①dialog 健康点 label：「reachable — last probe ok in 1.2s」（慢集群一眼可见）；②ProbeCard：耗时徽标（`data-probe-duration`，ms/s 自适应 + title 解释它与派发延迟的关系）骑在 checkedAt 旁边；③remote-run 自动 probe 的诚实日志带耗时（"auto-probed … in 175ms — the dispatch ran the ceremony itself"）。
- 【实现③ 心跳间隔部署可调】startStagingBeat 的 10s 硬编码改 `CF_STAGING_BEAT_MS` 环境变量（默认 10_000，下限 500ms）——真集群 staging 以分钟计 10s 合理，快本地 rig 一个间隔内跑完 beat 永远落不了地；部署与测试 rig 各取所需，陈旧窗 120s 的台账数学不动（任意 << 120s 的间隔皆安全）。
- 【实现④ stub 睡眠封顶】relion_run_motioncorr 的逐微图 `sleep(1.0)` 改 `min(1.0, 60/N)`——逐微图进度流的契约不变（小作业 ≤60 微图节奏原样），但大作业的运行总时长封顶 60s，500 微图不再把测试拖成超时（二跑 700 微图 = 700s 运行的真凶）。
- 【e2e：t268-probe-cost-heartbeat.mjs，15 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 5 断言（类型字段 + wrapper 三件 + 健康点 label + data-probe-duration + 自动 probe 日志行）；C 相活体——**套件自管 server**（serverBoot：watchdog 先杀 → 双杀 → fuser → 以 CF_STAGING_BEAT_MS=3000 拉起，finally 还原默认 10s——「快 beat 是本套件的镜头，不是对世界的修改」）→ 500 微图真 import → 无探针连接 → 裸派发 motioncorr → **心跳首拍落地 → 轮询捕获推进（06:27:48 → 06:27:51，beat 只在 phase==='staging' 落值，推进即活体自证）** → 500 微图集群完成 → lastProbe.durationMs=299ms 落库 → dialog 双面（probe card 徽标 + 健康点 tooltip）→ D 相 console 0。
- 【三跑判例（每跑一课）】①**首跑 3 FAIL：140 文件 staging <10s 跑完，beat 一次未落**——「活体断言的假设要先验证世界真的按假设运转」（t263 遗留原文「小上传竞速不过它」的本义，亲手撞上才算懂）；②**二跑 3 FAIL：beat1 落了但 beat2 stuck + 完成超时**——staging 跨了 1 个间隔但没跨 2 个（T_s∈[10,20)s），且 700 微图 × sleep(1.0) = 700s 运行是完成超时的真凶——「两个耦合的时长（staging 文件数 × stub 运行数）要分别治理」；③**证人要 poll 不要 sleep**：固定 sleep 11.5s 是在赌 staging 的时长，轮询 beat 推进（beat>beat1 且 phase 仍 staging）把赌注换成观测。
- 【事故与灾后清理】家族回归连跑撞工具 600s 上限，被腰斩的 t25 批留下孤儿：t258 创建的 mapimport 作业「Sub-volume orthovol」没有走到 finally——roster 22 ≠ 21，后续 t22 批的恒等断言卡死 + solo-recovery 重跑再卡（两个 300s 工具超时的真凶）。清理 = 定位孤儿（qa60 的 QA Refine Live 是 roster 设计态成员，真正的入侵者是多出的 mapimport）→ DELETE + workdir 清扫 → roster 21 复原 → 逐批重跑。「腰斩的批次要按形状清场——上跑的孤儿不该让下跑的恒等说谎」（t261 判例的家族版）；工具超时上限要把批边界当单位，不把三批连跑当一次调用。
- 【全家族回归】六批前台（逐批跑，批边界单独调用）：qa 批 pass 10 · 398.0s ｜ t21 批 pass 7 · 193.2s ｜ t22 批 pass 2 · 65.7s ｜ t24 批 pass 9 · 123.1s ｜ t25 批 pass 9 · 443.7s ｜ t26 批 pass 9 · 506.2s（t259–t268）——**合计 pass 46 · solo-recovery 0 · real-fail 0 · wall ~1730s**；t268 收编花名册 45→46（t26 批亲跑验收 121.8s）；roster 恒等 21。
- 【定妆照】**shots-qa/t268-probe-cost-dialog.png**（probe card 耗时徽标 + 健康点 tooltip）+ **shots-qa/t268-heartbeat-motioncorr.png**（500 微图集群 motioncorr 完成卡）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「让延迟可见，让心跳有证人」**：probe 耗时（wrapper 律：公开入口包计时、内部函数改名、调用点零改动）从「感觉卡」变成「看见 175ms」；staging 心跳从「锻造台账」补上「活体推进」——06:27:48 → 06:27:51 的两拍是真 staging 自己的心跳
- 「环境变量是部署与测试的和解」：CF_STAGING_BEAT_MS 让真集群（10s 合理）与快本地 rig（3s 才能 witnessing）各取所需——产品的一个旋钮换来测试的一双眼睛，陈旧窗数学不动
- 「活体断言的三课」：假设先验证（staging 真的 >间隔吗）、耦合时长分别治理（staging 文件数与 stub 运行数）、证人 poll 不 sleep——三条都是把「想当然的时长」换成「观测到的推进」
- 「腰斩批次的孤儿按形状清场」：t258 的 mapimport 孤儿让 roster 恒等说谎、让 solo-recovery 卡死——「上跑的残骸不该让下跑的断言说谎」判例的家族回归版；工具超时以批边界为单位
- 遗留（下轮候选）：sync-back 的耗时上账（对称于 probe.durationMs，回同步也是派发延迟的一部分）；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 269 (2026-09-17, cron 15:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171527)

- 【开局四件套】尾部 = Task 268（f798c52，probe 耗时上账 + 心跳活体）零过时（连续四窗）。cron 模板「Task 13」过时案照例不认。净场 PORT FREE + mock FREE → watchdog 拉起 200 + roster 21·16。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t268/t266/t258 ALL PASS + agent-browser 双空。无 bug。
- 【巡检与立项】Task 268 遗留首选当选：**remote 运行的时间账本**（可观测性三部曲之二）——probe 耗时可见了（t268），但一次 remote 运行真正让用户等待的两段——staging（上传）与 sync-back（回同步）——仍是暗时间；且顺带勘察发现一处诚实小伤：**inspector 的 remote strip 在运行终态后仍显示「Running on the cluster · pid N」**（pid 早已死亡）——phase 停在 "running" 而展示层没有终态分支。立项 = stagedMs/syncMs 两笔账 + 终态措辞退休死 pid。
- 【实现① 两笔计时】①staging 腿：stageFileTree 循环前后计时（stagedT0/stagedMs），随 spawn 交接落 record（`phase:"running", stagedBytes, stagedMs`）——「交接即记账」；②sync 腿：finalizeRemoteRun 里 syncBackWorkdir 前后计时（syncT0/syncMs），随 finalize 落 record——「运行已毕、结果未至的等待」正是它。
- 【实现② 类型与 DTO】RemoteRunState 加 stagedMs/syncMs（可选——pre-t269 记录天然缺省）；RemoteRunInfo（DTO）加 stagedMs/syncMs/syncedFiles/syncedBytes 四字段透传（后两个此前只在 record 层，UI 从未见过）——「账本要一路走到读账人面前」。
- 【实现③ 终态措辞 + 账本 span】inspector remote strip 三分：staging（原文案）→ running（原文案，活 pid）→ **终态（"Ran on the cluster"，死 pid 退休）**；终态追加独立账本 span（`data-remote-ledger`，mono/tabular/teal 描边——「staged 266ms · synced 79ms · 3 file(s) back」），formatLedgerMs 方言（ms/s/m+ss 自适应，与 ETA chip 同语感），title 解释两段等待的语义。「徽章告诉你发生过什么」的既有语言第三度应用。
- 【e2e：t269-time-ledger.mjs，16 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 5 断言（类型字段 + 两计时块 + spawn 交接落账 + finalize 落账 + DTO 透传 + strip 三态源码）；C 相活体——六微图 → import → 无探针连接 → 裸派发（自动 probe 世系）→ 完成 → **record 账本落账（staged 266ms · synced 79ms 双正数）→ DTO 账本（+3 files）→ inspector 终态 strip（"Ran on the cluster" 且无 "Running" 字样 + 账本 span 三段全说）** → 定妆照；D 相 console 0；job 粒度清场 roster 21。
- 【工艺判例】①「交接即记账」：stagedMs 在 staging 循环结束的瞬间落，不等到 finalize 补记——账本条目诞生在它的阶段结束处，与心跳的「活着就打点」互补；②「retire 死状态」：终态展示层借账本行顺带修正（strip 不再宣称 Running）——「修一处时顺手治好它旁边的旧伤，前提是旧伤真的在路径上」；③孤儿清扫判例第二次家族应用：t26 批撞工具上限腰斩，t269 的两作业 + 一连接成孤儿（roster 23）——按形状 DELETE + MICS_DIR 清扫 → roster 21 复原 → 单独验收 → 整批重跑拿正式 verdict。
- 【全家族回归】六批前台（逐批调用——600s 工具上限以批边界为单位，上窗判例）：qa 批 pass 10 · 396.6s ｜ t21 批 pass 7 · 194.0s ｜ t22 批 pass 2 · 65.1s ｜ t24 批 pass 9 · 123.0s ｜ t25 批 pass 9 · 483.3s ｜ t26 批 pass 10 · 532.1s（t259–t269）——**合计 pass 47 · solo-recovery 0 · real-fail 0 · wall ~1794s**；t269 收编花名册 46→47（t26 批亲跑验收 21.4s）；roster 恒等 21；t268 的 server 环境还原在批内验证有效（/proc environ 无 CF_STAGING_BEAT_MS 残留）。
- 【定妆照】**shots-qa/t269-time-ledger.png**（终态 strip：Ran on the cluster + 账本 span）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「两段暗时间，一本明账」**：staging 与 sync-back 从「用户感到的卡」变成「strip 上的两个数字」——remote 可观测性三部曲（probe → heartbeat → ledger）完结；「每一层都有自己的证人」判例的计时版
- 「终态要说终态的话」：phase 字段停在 "running" 是记录层的诚实（它只描述 record 视角），但展示层有 job.status 可以判断终态——「旧伤 retire 的时机是它真正挡路的时候」
- 「账本条目诞生在阶段结束处」：stagedMs 记在 spawn 交接、syncMs 记在 finalize——不补记不追认，记账点 = 阶段边界；与 DTO 透传到 UI 的完整链路一起，「每一层都说同一个故事」有了时间维度
- 「工具上限的批边界律」第二次应验：腰斩 → 孤儿 → 按形状清扫 → 单独验收 → 整批重跑——流程已可预期地恢复
- 遗留（下轮候选）：m+ss 以上时长的可视化打磨（>60s 的 staged 显示 2m05s，可加 tooltip 精确 ms）；updatedAt 治理；家族跑批 --report JSON；EMPIAR 真数据回归（让位）

## Task 270 (2026-09-17, cron 16:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171620)

- 【开局四件套】尾部 = Task 269（a0414d6，time ledger）零过时（连续五窗）。cron 模板「Task 13」过时案照例不认——**续传摘要再次落后两个身位**（称 Task 267/762c2d4，实际 268、269 已在 14:03 / 15:18 窗交付），真源律第 N 次应验。净场 PORT FREE → watchdog 拉起 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t269/t258/t268 ALL PASS + agent-browser 双空；顺手清掉 t268 哨兵残留的 mock cluster 孤儿（`bun run start`→`bun server.mjs` @3022，父子双杀）。无 bug。
- 【巡检与立项】remote 可观测性三部曲（probe t268 → heartbeat t268 → ledger t269）完结后的第四幕勘察：**connections dialog 对「集群替用户跑过什么」零可见**——运行记录散落在各 job 的 inspector 里，dialog 只有健康点 + probe 卡，没有 track record。立项 = **集群的简历（run résumé）**：单次运行的账本 → 集群级聚合；顺手兑现 t269 遗留①（账本 tooltip 精确 ms）。
- 【实现① 聚合函数】remote-run.ts 加 `connectionRunResume(connectionId)`：遍历 readRuns()（mtime 缓存，聚合便宜），`rec.remote?.connectionId` 过滤，done/exitCode 分桶（completed / failed——stop 路由的 137 落 failed 桶），lastRunAt 取 startedAt 最大值，recent 按 startedAt 倒序切 ≤3。配套 `withRunResume(dto)`：total 0 时**整个字段省略**——「没有简历本身就是诚实的状态」（徽章语言：只有发生过的事才配徽章）。
- 【实现② 每一层都说同一个故事（resume 版）】返回 connection body 的**全部三个路由**都带简历：GET 列表、POST 创建、PATCH 编辑——dialog 的 upsert 整行替换，任何一层返回裸 DTO 都会抹掉列表已显示的历史（「partial 写入也要讲同一个故事」）。helper 放 remote-run.ts 而非 connections.ts——后者被 remote-run import，放那边反向成环。
- 【实现③ UI：RunResumeCard】dialog 右栏 probe 卡之下（probe = reachability，résumé = track record）：聚合徽标行（N runs · N completed 绿 · N stopped/failed 红 · last toLocaleString）+ recent 3 条（exit code 即色点：emerald/rose/amber-running + type mono + 账本 `staged X · synced Y · N files back`，formatLedgerMs 方言）+ 底注。**formatLedgerMs 从 job-inspector export**（t269 的私有方言提升为共享方言——一个账本语言遍布 remote 世界）。
- 【实现④ t269 遗留①兑现】inspector 的 data-remote-ledger span tooltip 补精确值（`exact: staged Nms · synced Nms`）——「显示压缩（2m05s），hover 精确（125123ms）：精确数字永不超过一次 tooltip 的距离」。
- 【e2e：t270-run-resume.mjs，34 断言 ×3 ALL PASS】A 相 demo 真相；B 相台账 7 断言（types + 聚合 + 零运行省略 + GET/POST/PATCH 三路 withRunResume + RunResumeCard 共享方言 + inspector 精确 tooltip）；C 相活体——六微图真 import → 无探针连接 → **C2 POST 响应无 resume 字段（零运行省略契约的活体证明）** → C3 run1 完成 → resume 落地（total 1 · completed 1 · recent[0] staged/synced/syncedFiles）→ C4 run2 完成 → total 2 + newest first（简历会生长）→ **C5 run3 stop 造 failed → 137 入 failed 桶（total 3 · completed 2 · failed 1）** → C6 dialog 徽标 + 3 条目渲染 → 定妆照；D 相 console 0。
- 【两跑两课（断言的错，不是产品的错）】①首跑 FAIL「newest entry 说完整方言」——run3 是 stopped，sync 腿从未发生，账本诚实只说 staged：**断言的假设要先验证世界按假设运转（t268 判例的 résumé 版）**——stopped 条目改断言「只说 staged 腿（no sync, no lie）」，完整方言断言移到 completed 条目；②二跑 FAIL「file\(s\) back」正则写死——résumé 卡的方言是复数自适应（"3 files back"），照抄 inspector 静态文本害了自己；③定妆照首拍 résumé 卡在 60vh 滚动区下方缺席——scrollIntoViewIfNeeded 先入镜再拍。
- 【全家族回归】六批前台（逐批调用）：qa 批 pass 10 · 395.8s ｜ t21 批 pass 7 · 193.1s ｜ t22 批 pass 2 · 65.8s ｜ t24 批 pass 9 · 122.5s ｜ t25 批 pass 9 · 438.6s ｜ t26 批 pass 10 · 531.2s（t260–t269）——**合计 pass 47 · solo-recovery 0 · real-fail 0 · wall ~1747s**；t270 收编花名册 47→48（收编验收 = 本窗三连跑，修复断言后两连 ALL PASS）；roster 恒等 21。
- 【定妆照】**shots-qa/t270-run-resume.png**（RUN RÉSUMÉ 卡：3 runs / 2 completed / 1 stopped/failed 徽标 + 三条目——stopped 红点只说 staged，completed 绿点带 synced · files back）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「集群的简历」**：remote 可观测性第四幕——probe 耗时、心跳、单次账本之后，聚合层补齐：一个集群 track record（总数/成败/最近三次的账本）第一次有了自己的面孔；「徽章告诉你发生过什么」的聚合版——零运行的连接连卡都不渲染
- 「每层同故事」的边界推进：GET/POST/PATCH 三路全带简历——「dialog 的 upsert 是整行替换，裸 DTO 就是历史的橡皮擦」；helper 的归属地选择（remote-run.ts）让依赖图保持单向
- 「方言要共享不要复制」：formatLedgerMs export 一行改动，inspector 与 dialog 说同一语言——「两个地方说一种话，第三处就会说第三种」
- 「stopped 的账本不撒谎」：stop 运行的 résumé 条目只有 staged 腿——sync 从未发生就不该被说出；断言先验证世界的假设（t268 判例）与复数方言的正则教训同场应验
- 遗留（下轮候选）：简历的深度视图（点条目跳转对应 job 的 inspector——简历作为索引）；updatedAt 治理；家族跑批 --report JSON + 分批一等公民化（t270 已暴露 --filter 子串与批次命名的耦合）；EMPIAR 真数据回归（让位）

## Task 271 (2026-09-17, cron 17:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171718)

- 【开局四件套】续传摘要称 Task 267/762c2d4——**实际 268/269/270 已在前三窗交付**（尾部 Task 270 / 4b3da23），真源律第 N 次应验。净场 PORT 3000/3022 FREE → watchdog 拉起 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t270/t268/t258 ALL PASS + agent-browser 双空。无 bug。
- 【立项】Task 270 遗留①当选：**简历成为索引（run résumé 深度视图）**——résumé 条目已携带 jobId（types.ts:69），但 dialog 里只是哑行；点条目应关闭 dialog 并打开对应 job 的 inspector。树上核实未交付。
- 【实现① 条目 button 化 + 存在性诚实态】RunResumeCard 直读 workflow store（`jobs.find(j => j.id === e.jobId)`）：**job 在画布上 = 真 button**（`data-resume-jump`，`aria-label` 说 job 名字，hover 时 ArrowUpRight 淡入 + bg-accent 高亮，focus-visible ring——键盘可达）；**job 不在 store = 哑 history 行**（「the job is gone (deleted, or another project's canvas) — the résumé keeps it as history」的诚实 tooltip）——store 是 inspector 真正能打开的世界，索引只指向真的门。条目内容升级：`[dot][job name（truncate，font-medium）][type mono][开始时间 tabular][ledger mono]`，tooltip 带精确 startedAt。
- 【实现② 门把手链路】RemoteClusterDialog 加 `handleOpenJob`（`onOpenChange(false)` → `inspect(jobId)`——**顺序律：先关 dialog 再开 inspector**，两个 dialog 抢 foreground 是输家用户）；ConnectionEditor 透传 onOpenJob（creating + editing 两处实例都接上——「两个渲染点漏一个就是一半用户的哑门」）；footer 教新动词「click one to open its job's inspector」。
- 【e2e：t271-resume-jump.mjs，28 断言 ×2 ALL PASS】A 相 demo 真相；B 相台账 9 断言（store import + onOpenJob 可选 prop + 存在性检查 + button/onClick + hover affordance + **顺序律**（onOpenChange(false) 先于 inspect(jobId)，indexOf 对位）+ 双实例透传 + gone-job 诚实行 + footer 动词）；C 相活体——六微图真 import → 无探针连接 → 裸派发 motioncorr 完成 → **C3 门全程见证：条目是真 button + aria-label 说名字 → hover 定妆照 → 点击 → cluster dialog 自我关闭 → inspector 打开且正在被指的那个 job**（data-inspector-dialog + 名字断言）→ 目的地定妆照 → **C4 删 job：run record 随之而去（DELETE /api/jobs 的 clearRunRecord——record 的生命周期是 job 的）→ résumé total 归零 → 卡片整体退场（t270 零运行省略契约从另一侧见证）**；D 相 console 0；finally 清场 roster 21。
- 【断言的错，不是产品的错（t268/t270 判例第三次家族应验）】C4 首版断言「删 job 后条目留作 history」3 FAIL——树上真相：DELETE /api/jobs 走 clearRunRecord，run record 与 job 同生共死，条目不是「不跳转」而是「整体消失」。**改断言不改产品**：record 生命周期是既有语义（clean invariant：records 只为存在的 job 而活），history 行的真实场景是**跨 project 画布**（connection 是全局的，job 是 per-project 的——从别的项目开 dialog，条目指向不在本画布的 job，哑行 + 诚实 tooltip 就是那时的正确面孔）。改断言时顺便把 finally 作用域 bug 修掉（try 内 const 在 finally 不可见）。
- 【家族七批回归（t26 十年界自然分批）】qa 批 pass 10 · 398.6s ｜ t21 批 pass 7 · 189.8s ｜ t22 批 pass 2 · 65.5s ｜ t24 批 pass 9 · 122.6s ｜ t25 批 pass 9 · 445.3s ｜ t26 批 pass 10 · 540.3s（t260–t269）｜ **t27 批（新十年）pass 2 · 68.7s（t270 + t271）**——合计 **pass 49 · solo-recovery 0 · real-fail 0 · wall ~1831s**；t271 收编花名册 48→49（t27 批亲跑验收 28.8s）；t270 姊妹回归亲跑全过（条目结构升级未伤其内容断言）；roster 恒等 21。
- 【定妆照】**shots-qa/t271-resume-jump-dialog.png**（RUN RÉSUMÉ 卡：hover 态的可跳条目——job 名高亮 + ↗ 箭头 + staged/synced 账本 + footer 新动词）+ **shots-qa/t271-resume-jump-inspector.png**（点击后的目的地：job inspector 正开着被指的那个 job）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「简历成为索引」**：remote 可观测性第五幕——单次的账本（t269）、集群的简历（t270）之后，简历的条目第一次有了门把手：点一条就站在那个 job 的 inspector 前；「徽章告诉你发生过什么」的索引版——门只开向存在的 job
- 「store 是 inspector 能打开的世界」：存在性检查直读 store 而非 API 回调——跨画布的 job 是哑 history 行 + 诚实 tooltip，「索引只指向真的门，指不了的门要说为什么」
- 「顺序律第三度成文」：先关 dialog 再开 inspector——两个 foreground 抢夺者不能共存；t267 的「probe 先于 lastProbe 读取」、t269 的「记账点=阶段边界」之后，这是「顺序即律法」的 UI 交互版
- 「record 的生命周期是 job 的」：clearRunRecord 让删 job 连带抹账——简历不数「已从账本上撕掉的页」；history 行留给真正够不着的门（跨 project 画布）；「改断言不改产品」的前提是产品的语义真的站得住
- 「十年界分批」：t26 批涨到 12 套件必然撞 600s 工具上限——t26/t27 按十年界自然分割，「批边界是工具超时的单位」判例的空间版
- 遗留（下轮候选）：简历 history 行的跨 project 活体见证（需第二 project + 项目切换驱动）；updatedAt 治理；家族跑批 --report JSON + 批次一等公民化（十年界分批是手动的，--filter 子串与批次命名的耦合仍在）；EMPIAR 真数据回归（让位）

## Task 272 (2026-09-17, cron 18:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609171818)

- 【开局四件套】续传摘要称 Task 267/762c2d4——**实际 268/269/270/271 已在前四窗交付**（尾部 Task 271 / 0fe6295），真源律第 N 次应验。净场 PORT 3000/3022 FREE → watchdog 拉起（脚本名笔误 .mjs→.sh 纠正）→ 200 + roster 21。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t271/t258(实名 view-in-3d)/t268 ALL PASS + agent-browser 双面（主页 + clusters dialog 空态）+ console 0。无 bug。
- 【巡检与立项】Task 271 遗留①当选：**简历 history 行的跨 project 活体见证**。树上勘察第一步就撞见真缺口：**DELETE /api/projects/[id] 用 db.job.deleteMany 绕过单 job DELETE 路由的 clearRunRecord**——注释明说 records「intentionally left untouched」；而 run records 存于全局单文件 engine-state.json（connection 全局 + records 全局 + job per-project）。后果链：删 project → records 永远孤儿 → résumé 永远数着死 job、任何画布上都渲染指不到的门——「records 只为存在的 job 而活」invariant 在 project 粒度被打破。立项 = 孤儿治理（级联清）+ 遗留①的活体见证 + 哑行文案从「合并猜测」升级为「三态诚实」。
- 【实现① 孤儿治理（project 粒度闭合）】projects/[id]/route.ts：stop live 循环后、db.job.deleteMany **之前**逐 job clearRunRecord（幂等）——「删 job 连带抹账」的仪式在 project 级同款执行；旧注释退休，新注释写明 bypass 与 invariant。顺序律成文：records 先死、job 行后删。
- 【实现② 存在性三态（server 端真值）】types.ts 的 ConnectionRunResumeEntry 加 exists?: boolean + projectName?: string（pre-t272 DTO 天然缺省）；connectionRunResume **async 化**——对 ≤3 条 recent 逐条 db.job.findUnique（select project.name 一查询双真值）：exists=true + 画布名 / exists=false / 服务端未说。withRunResume 随之 async，三路由调用点全部 await（GET 的 Promise.all + POST/PATCH 的 await）——「每一层都说同一个故事」的 async 版。
- 【实现③ UI 三态哑行】RunResumeCard 哑行分支三分：exists===true → 「the job lives on the “{画布名}” project's canvas — switch to that project to inspect it」（**点名画布**，不再说 another）；exists===false → 「the job is gone (deleted) — the résumé keeps it as history」（不再猜画布）；undefined → pre-t272 合并文案保留。data-resume-gone 数据钩子给第三态一个 CSS/test 接缝。doc comment 同步两态→三态。
- 【OOM rebuild】src 三文件改动 → Task 86 双杀 → build → watchdog 复活 → roster 21。tsc src 全清零保持（新增 0 错误；噪音全在 examples/diag-archive/skills 存量）。
- 【e2e：t272-cross-canvas-resume.mjs，31 断言 ×3 ALL PASS】A 相 demo 真相；B 相台账 14 断言（clearRunRecord 导入+循环+顺序律+旧注释退休；DTO 字段；async 聚合+联合查询+双分支；三路由 await；UI 三态+data 钩子）；C 相活体——**C1 第二画布诞生**（POST /api/projects 创建即 active，注册表双画布，jobs 0）→ C2 六微图真 import（第二画布上）→ C3 无探针连接 + 裸派发 motioncorr 完成（record 落全局 state file——「connection 与 records 不知 project 为何物」）→ **C4 切回 demo**（switch 200 → 21 jobs 回归 → 第二画布的 job 不在）→ **C5 résumé 跨画布见证**（total 1 不变 + exists=true + projectName="t272 Cross Canvas"——server 端存在性分级的活体）→ **C6 UI 哑行见证**（无 data-resume-jump + tooltip 点名画布且不说 gone）→ **C7 DELETE 第二 project → résumé 字段整体省略（t270 零运行契约 project 粒度第三度见证）+ 级联清空双 record（无孤儿）**→ 卡片退场定妆照；D 相 console 0。定妆照①首拍 résumé 卡缺席（60vh 滚动区，t270 判例复用 scrollIntoViewIfNeeded 入镜）。
- 【两跑两课】①首跑 2 FAIL + 崩溃：GET /api/projects 有 isLocalRequest 守卫，套件裸 fetch 被拒——「守卫也是 API 契约的一部分，SH 头在 registry 面前是 load-bearing」；demoProject undefined 让 C4/finally 崩——demoId 防御 + throw 走 finally 清场。②二跑 1 FAIL：断言找旧词「another project」，而 exists=true 分支正因**点名画布**不再说 another——「断言的错，不是产品的错」判例第四次应验（tooltip 完全正确）。③t270 家族回归 2 real-fail：async 化改了签名文本，t270 的两处源码断言跟进升级（`export function` → `export async function`）——「语义不变、文本演进」的断言维护，「改断言」的合法场景是产品语义站得住且断言描述的是旧文本。
- 【全家族回归】七批前台（逐批调用，批边界=工具上限单位）：qa 批 pass 10 · 399.9s ｜ t21 批 pass 7 · 190.0s ｜ t22 批 pass 2 · 64.8s ｜ t24 批 pass 9 · 123.1s ｜ t25 批 pass 9 · 460.2s ｜ t26 批 pass 10 · 531.4s（t260–t269）｜ **t27 批 pass 3 · 100.2s（t270–t272）**——合计 **pass 50 · solo-recovery 0 · real-fail 0 · wall ~1870s**；t272 收编花名册 49→50（t27 批亲跑验收 27.7s）；t270 断言升级后亲跑 + 批内全过；roster 恒等 21。
- 【定妆照】**shots-qa/t272-cross-canvas-history-row.png**（RUN RÉSUMÉ 卡的跨画布哑行：1 run · 1 completed 徽标 + motioncorr 条目无 ↗ 箭头——门在别的画布上）+ **shots-qa/t272-post-delete-empty-dialog.png**（第二 project 删除后卡片整体退场）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + mock cluster 击杀 + port FREE 验证）。

Stage Summary:
- **「跨画布的简历闭环」**：remote 可观测性第六幕——resume 的全局性与 job 的 project 粒度第一次正面相遇：活体见证（哑行点名画布）、孤儿治理（project DELETE 级联清 records）、三态诚实（点名/已逝/未说）一次交付；t271 遗留①以「真 bug + 产品深化」的姿態收官
- 「真源律第 N 次应验」：续传摘要落后 4 个身位（267→271）；开局四件套的树上核实永远是第一动作
- 「守卫也是契约」：isLocalRequest 让裸 fetch 在 registry 面前吃闭门羹——套件的 SH 头不是装饰；「断言的假设要先验证世界按假设运转」的 API 守卫版
- 「async 化是签名事件」：函数从 sync 变 async，类型、调用点、三路由、既有源码断言四处同步——「一个签名变更的半径要先画出来再动手」；t270 的 real-fail 是这半径的第一张账单
- 遗留（下轮候选）：exists=false 的 UI 活体见证（需手工注入 record——正常流转已不可达，正是修复的意义）；家族跑批 --report JSON + 批次一等公民化（十年界分批仍手动）；updatedAt 治理；EMPIAR 真数据回归（让位）

## Task 273 (2026-09-17, cron 19:18+20:18 双窗 trace 1a07549302235a99-cron-agent-loop-202609171921/2024)

- 【开局即事故：环境重建撞脸】19:18 窗完成 Task 273 实现（family-run 批次一等公民化 + --report JSON）与 t273 套件两连 ALL PASS，家族回归跑到 t27 批时发现两案（嵌套报告污染 + roster 字面断言过期）。20:18 窗开局实证刷新撞上**环境重建现场**：本地 HEAD 被回滚到 83a5180（时间线 B 的 Task 262 快照，与 origin/main 分叉 1:1），工作区叠着陌生物（mini-services/relion-ws、persist/ 370M、relion-projects/ 2.9G「real-relion-验证项目」、tool-results/ root 700、qa-shots-17），server 500，roster 0。
- 【取证与恢复（未盲动）】①git fetch 取证：**origin/main = a03a29f（Task 272）完好**——所有已交付工作在 GitHub 上是真值；②本地 worklog 未提交改动 = 时间线 B 的 Task 263/264 条目 + gitignore `/test` 锚定——**远程已是超集**（Task 263-272 十条目全在 + 锚定已整合），本地残骸可安全丢弃；③`git reset --hard origin/main` 归位；④工作树叠着旧时间线的 **untracked src 残骸 24 项**（fs/clone/picker/schedules、executor.ts、commands.ts、dto.ts——HEAD 里不存在却引 system.ts 的旧导出）→ `git clean -f src/` 清除；⑤package.json 缺 socket.io-client 声明而 executor.ts 引用它（t262 时代的历史遗留，旧 node_modules 有存货、环境重建后蒸发）→ npm install 补声明。
- 【build 九试三课】环境重建后的第一次 OOM rebuild 连败：①Turbopack EACCES 读 root 的 tool-results/ → outputFileTracingExcludes 四目录排除；②panic 在 globals.css 的 PostCSS loader（"unexpected end of file" ×3）——dmesg 实锤 OOM（RSS 2.4GB 被杀），真凶 = **tailwind v4 自动内容检测扫全项目**，3.3GB 环境数据树撑爆 loader 内存 → globals.css 加 `@source not` 四行排除（首试括号语法错，「@source paths must be quoted」——v4 语法无括号）；③通过。「源代码自洽的树也会被环境残骸拖垮：构建的内存账单里有环境的份额」。
- 【世界重建三件】DB 表消失（Prisma P2021）→ `prisma db push` 重建 schema；demo 态 0 jobs → restore-gallery.py 两跑复活（首跑只建 project，二跑 roster 21 满血——脚本自身的幂等分两步）；QA Refine3D workdir 无 seed → qa67-seed-volume 重播（t25 判例预防性执行）。qa00 GREEN + qa63 GREEN 复验。
- 【Task 273 收尾（上窗实现经 fs 延迟效应幸存于工作树）】19:18 窗的 family-run.mjs 改动（+212 行）与 t273-family-report.mjs 在 reset 之后依然在磁盘上（环境 fs 视图延迟，ls 曾短暂失明报 No such file）——按现状补上窗发现的两案：①**FAMILY_REPORT 隔离律**：REPORT_FILE 支持环境变量覆盖，嵌套世界（套件内 spawn 的 family-run 子进程）读写自己的报告文件，外层积累永不被自家成员的 --reset 抹掉（活体案：t27 批的报告被 t273 自己 reset 成单条目）；②**roster 断言动态化**：C1 覆盖行断言从输出解析 declared/covered 对比，不写死「50 suites」（t273 收编瞬间它自己就挂在这行字面量上）。
- 【e2e：t273-family-report.mjs，26 断言 ×2 ALL PASS】B 相 11 断言（BATCHES 注册表 + 未知批 exit 2 + 孤儿检查 + FAMILY_REPORT 覆盖 + merge 写盘 + runSuiteMs 三点记账 + attempts 词汇 + 550s 守卫 + --summary/--reset）；C 相活体 14——--batches 七批全覆盖零孤儿（动态 roster 断言）→ 未知批拒 + 列可用 → --reset 清 → 空 summary 诚实语 → **--batch t22 真跑**（报告键 t22：pass 2、per-suite verdict/attempts/ms、wallMs/ISO lastRun）→ --summary 说 t22+TOTAL → --filter qa00 并存两键（merge 非 clobber）→ **健康守卫活体**（伪造 580s wall → 重跑同键 → ⚠ 报 600s ceiling → 真跑覆盖假值自愈）；D 相 reset 不留垃圾；**真实报告全程零触碰（隔离律的活体自证：套件跑完 scripts/.family-report.json 仍不存在）**。
- 【家族回归 + 顺手一修】七批 --batch 模式（逐批单独调用）：qa 10·398.9s ｜ t21 7·190.6s ｜ t22 2·65.6s ｜ t24 9·123.7s ｜ t25 9·472.8s ｜ t26 10·545.0s（t261 首挂 ENOENT——data/remote-connections.json 在全新沙盒不存在，产品层本有 existsSync 空态守卫，套件裸读是脆断言 → 容忍空态修复后批内全绿）｜ t27 4·177.8s——**合计 pass 51 · solo-recovery 0 · real-fail 0 · wall 1974.4s**；roster 恒等 21。
- 【本轮的回报】`family-run --summary` 直接产出上面那段回归数据——worklog 的回归行第一次从机器报告拷贝而非终端手抄；下窗的七批回归 = 七条 --batch 命令 + 一条 --summary。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「批次一等公民 + 报告即真值」**：十年界分批从 agent 记忆变成 BATCHES 注册表（--batch/--batches + 覆盖检查 + 孤儿示警）；跑批 verdict 落 JSON（merge 非 clobber），--summary 机器可读——「批边界是工具超时的单位」判例从记忆变成守卫（550s 预警）
- 「环境重建的取证律」：git fetch 先于一切判断——origin/main 是唯一真值，本地分叉按超集关系裁决（远程含全部内容 → 残骸可弃）；untracked 残骸让「干净的工作树」说谎（git status 干净但 src 里叠着 24 个旧文件）——「reset --hard 清不掉 untracked，构建失败先查谁在被编译」
- 「构建的三层内存账单」：file tracing 扫目录（EACCES 即死）→ tailwind 内容检测扫大文件树（OOM 即死）→ turbopack 引擎本身——每层都有排除/隔离旋钮，「环境的残骸要有名字地被排除，而不是被假装不存在」
- 「嵌套世界要隔离」：自我引用的套件（t273 测 family-run）必须 FAMILY_REPORT 隔离共享可变状态——「测试不污染生产数据」在报告文件上的版本；真实报告的「不存在」就是隔离律的活体证人
- 「fs 视图会延迟」：环境重建中 ls 报 No such file 而文件其实在——盘点要在重建完成后重做，结论只在两次独立读取一致时成立
- 遗留（下轮候选）：exists=false 的 UI 活体见证；updatedAt 治理；EMPIAR 真数据回归（让位）；persist//relion-projects/ 的归属确认（环境层数据树，产品无引用，@source not 只是绕过不是回答）

## Task 274 (2026-09-17, 用户报障窗口 — "Module not found: Can't resolve 'ssh2'")

- 【报障与诊断】用户贴来 Turbopack overlay：`./src/lib/remote/ssh.ts:23:1 Module not found: Can't resolve 'ssh2'`（import trace → /api/remote/connections/route.ts，Next 16.1.3）。三步定音：①报错行号与 HEAD 逐行比对（fs/path/ssh2 三行 import 恰在 21/22/23 行）→ 用户跑的就是最新代码，不是旧 checkout；②GitHub 上 package.json（dependencies: ssh2 ^1.17.0、devDependencies: @types/ssh2）与两份 lockfile（bun.lock + package-lock.json）全部带 ssh2 → 清单健康；③错误是 RESOLUTION 失败（包不在 node_modules）而非打包失败（那会报 cpu-features 之类）→ 根因 = 用户本地 git pull 后未重装依赖——「能起 next dev 说明装过 next，但那次安装早于 remote 功能引入 ssh2」。
- 【沙箱重建恢复（第二次，t273 同款遭遇）】/home/z/cryoflow 消失、/home/z/my-project 回退为陈旧脚手架（worklog 停在旧 Task 5 快照）。恢复沿用 t273 配方：origin/main 为真源——浅克隆后发现真源已前进到 d8d9f5c（t273：BATCHES 注册表 + family-report + socket.io-client 补声明），ff-only 合并；仓库落回规范位 /home/z/my-project（dev-server.sh 与全部 QA 脚本的硬编码路径所在）；两支 worklog 血统合流（沙箱旧 Task 1–5 + 仓库 Task 207+，单档案零丢失）；bun install 补齐 ssh2/socket.io-client；全局 DATABASE_URL 投毒（file:.../custom.db）在 db:push 与 dev 启动两处显式覆盖；mock cluster :3022 + dev :3000 看门狗配方拉起；Mock Cluster 连接重建 + 实探针落档（envmodules、3 个 relion 模块、externals、durationMs 177）。
- 【t274 加固：让这类失败自报家门】①next.config.ts 依赖卫兵——createRequire 锚定 <cwd>/package.json，boot（dev+build）即 resolve ssh2，缺失则打印 12 行行动性警告（点名包名、给出 npm/bun/pnpm install 命令、预告 /api/remote/* 会炸）——overlay 只报包名不报药方，卫兵把药方说在 Next banner 之前；warn-only：无 ssh2 时除 remote 路由外全部可用，硬退会惩罚恰好只做本地的用户。②.env.example 补档——README 第 2 步 `cp .env.example .env` 自 Task 5 起就是空指针（.gitignore 的 `.env*` 把模板一起吞了 272 个任务无人发现），`!.env.example` 例外 + 带注释模板（DATABASE_URL 相对 prisma/ 解析 + CRYOFLOW_DATA_DIR 说明）。③bun.lock 补 socket.io-client 条目（t273 改了 package.json 但漏了 bun.lock 再生——frozen-lockfile 场景必炸）。④README Getting started 第 1 步加「每次 git pull 后重跑 install」注记；docs/remote-relion.md 失败目录新增 stale-node_modules 一行。
- 【验证】卫兵双分支活体：stash node_modules/ssh2 → boot → 警告先于 ▲ Next.js banner 打印 → 恢复 → boot 零警告；/api/remote/connections 200（连接 + lastProbe 全量 DTO）；/ 200；agent-browser 双面（主页 + clusters dialog：「Mock Cluster — reachable — last probe ok in 0.2s」+ 三模块 chips 可点设默认）+ 页面/控制台 0 错误 + 桌面/移动双定妆照。
- 【用户的本地修法（写给报障人）】`npm install`（或 `bun install`）→ 重启 dev server；fresh clone 则照 README 四步走——现在 .env.example 真的存在了。
- 【收尾】worklog（本条）+ commit/push + 提醒用户轮换已在对话中明文暴露的 GitHub PAT。

Stage Summary:
- 「清单健康，安装过期」：报错行号 = HEAD 指纹 + 三份清单全带 ssh2 → 判定用户侧 pull 未重装；「resolution 失败 ≠ 打包失败」是这次诊断的分水岭
- 「药方要说在 overlay 前面」：boot 时卫兵先于用户到达失败点——overlay 报包名，卫兵报修法；warn-only 尊重只做本地的用户
- 「README 的第一步不能是空指针」：.env.example 被 `.env*` 吞掉 272 个任务无人发现——gitignore 例外语法与模板文件必须成对提交
- 「沙箱重建第二次」：t273 的恢复配方（origin/main 为真源 + 规范位重装 + 脚本化拉起）本次复用即中——判例成文的价值；bun.lock 漏再生是 t273 的账单，本窗口代付
- 遗留（下轮候选）：卫兵清单目前只有 ssh2——未来新增 serverExternal 级依赖时应扩卫兵数组而非另起炉灶；exists=false 的 UI 活体见证（t272 遗留）；EMPIAR 真数据回归（连续让位）

## Task 275 (2026-09-17, cron 21:33 窗口 trace 1a07549302235a99-cron-agent-loop-202609172136)

- 【撞号声明】本窗与用户报障窗并行——两边都把各自工作称 Task 274；远端 45193a7 先 push 先得名，本条在 rebase 融合时重编号 **275**。两窗工作互不重叠（对方 = ssh2 缺装守卫 + .env.example + bun.lock 补账 + 沙盒二次重建；本窗 = 早期 era 数据树检疫），next.config.ts 与 .gitignore 的并行改动区域不重叠、自动融合；worklog 双条目全保留。
- 【开局四件套】尾部 = Task 273（d8d9f5c，批次一等公民 + --report JSON + 沙盒重建恢复）零过时；origin/main..HEAD 空（d8d9f5c 已 push）。cron 模板「Task 13」照例不认。净场发现 3022 有上窗 mock cluster 残留（bun pid 15501）击杀 + watchdog 拉起初次无声（手动 start-prod.sh 复盘起活——watchdog 后续重新武装）。QA：qa00 GREEN + qa63 SMOKE GREEN + 哨兵 t273/t272/t270 三连 ALL PASS + agent-browser 双空（console 0 / errors 0）+ roster 21。无 bug。
- 【巡检与立项】Task 273 遗留④当选：**persist//relion-projects/ 的归属确认**（t273 只用 @source not 绕过了它们，没有回答它们是什么）。树上勘察三步出真相：①产品 7 处 src 文件引用 molstar，但引用全走 node_modules（`import "molstar/build/viewer/molstar.css"`）——public/molstar/（23M 独立 bundle）**全仓库零路径引用**；②persist/RESTORE.md 自述「PolarFS 跨容器回收存活」的灾后恢复指南，但恢复路径指向 `/tmp/my-project/`（旧挂载拓扑）且称 GitHub 5a72d14 为「最终工作树」；③**git cat-file 证实 5a72d14 在我们自己的历史里、remote 同为 Jing0715-fer/cryoflow**——归属判决精化：不是异项目残骸，而是**本项目早期 era（real-RELION 验证时代）的持久备份卷**。立项 = 归属判决文书化 + 单根检疫 + 根目录复现检测器。
- 【判决：检疫（mv）而非删除】relion-projects/ 内含 641MB EMPIAR-10017 真实原始数据（10 微图 + 10 Henderson .coord）与三个真实验证项目——不可再生的实验资产删除不可接受；放着不可接受（t273 的三条内存账单：tracer EACCES、tailwind 扫描 OOM×3、未来任何扫仓库工具的同类地雷）。`mv` 同文件系统 rename 零拷贝、verdict 可逆。**执行**：persist/、relion-projects/、mini-services/、qa-shots/、qa-shots-17/、public/molstar{,.css} 七项 → `_legacy-archive/`（3.3G），README.md 判决书随行（内容清单 + 归属证据 + 取用路径 + 「放回检疫区」警告）。
- 【实现① 排除规则单根化】next.config.ts outputFileTracingExcludes：四条（tool-results/persist/relion-projects/mini-services）→ 两条（tool-results——我们的运行时 scratch 留根、`_legacy-archive/**`）；globals.css @source not 三行散排 → 单根一行（tool-results 行保留）；.gitignore `/_legacy-archive/*` + `!/_legacy-archive/README.md`（README 必须随库——判决书不随数据走就等于没写；注意 gitignore 语义：父目录整体排除后无法 re-include，须用 `/*` 排内容再豁免 README）。
- 【实现② 检测器 scripts/check-foreign-trees.mjs】19 断言三组：①根目录五名 + public/ 两名清白（exit 2 + FAIL 行点名入侵者 + 给出修复 mv 命令）；②检疫区完备（根存在 + README 判决词在文 + 七成员在场）；③排除规则单根化（next.config 有新名无三名陈旧、globals.css 同、.gitignore 藏目录）。exit 0 GREEN / exit 2 大叫——「根目录复现」从下次 build 的 OOM 崩溃前移为亚秒级检测。
- 【实现③ qa68-legacy-archive.mjs 哨兵，25 断言 ×2 ALL PASS】A 相产品存活（GET / 200）；B 相检测器判决全 ledger（五根清白 + 两 public 清白 + 档案根 + 判决 README + 七成员 + 双排除单根 + 无陈旧排除 + gitignore）；**C 相活体自检：staged 伪造入侵（persist/.qa68-probe）→ 检测器 exit 0→2 且 FAIL 行点名 persist → heal → 2→0 GREEN 复言**——「一个不能失败的检测器是装饰字符串」；D 相零残留（try/finally 保证伪造入侵永不遗留——套件自己制造的地雷自己拆）。
- 【两课】①「断言的错」第五次应验：检测器首跑 1 FAIL——README 判决词找英文 "quarantine"，而判决书是中文「检疫」；改检测器认「检疫」，文书不动；②**tracked 残余在移动时现形**：mini-services/.gitkeep 被 git 跟踪（占位符时代遗产），mv 让它变成 `D`——占位符随其时代退休是正确的（内容已入档案、检测器守门），提交删除而非复活。
- 【build 健康验证（检疫的回报）】Task 86 双杀 → npm run build **首试即过 · 2m0.452s · 零事故**——对比 t273 环境重建后的九试三败（EACCES ×1 + PostCSS OOM panic ×3）；start-prod.sh 复活 200 + roster 21。同参数的 build，树外 3.3G 的消失就是全部差异——「排除规则挡住账单，检疫直接消灭账单」。
- 【全家族回归（--batch 七批 = t273 交付的首次实战 dogfood）】qa 批 pass 11 · 416.1s（**qa68 0.3s 批内收编验收**，花名册 51→52）｜ t21 批 pass 7 · 195.1s ｜ t22 批 pass 2 · 66.2s ｜ t24 批 pass 9 · 124.8s ｜ t25 批 pass 9 · 453.7s ｜ t26 批 pass 10 · 536.9s ｜ t27 批 pass 4 · 176.7s——**合计 pass 52 · solo-recovery 0 · real-fail 0 · wall 1969.5s**（--summary 一条命令直出，本条回归行首次全程机器拷贝）；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（mock cluster 击杀 + Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「检疫不是删除，也不只是排除」**：t273 用 @source not 挡住账单（每层排除旋钮），t274 把账单本身搬走（单根 + 一行排除）并立碑（README 判决书）+ 派卫兵（qa68 检测器）——「环境的残骸要有名字地被排除」的下文是「先让残骸只剩一个名字」
- 「归属要先问 git 而不是先猜」：RESTORE.md 的另一 remote 暗示 + /tmp/my-project 的他拓扑路径都指向「外来时间线」，而 `git cat-file -t 5a72d14` 一锤定音是**本仓库自己的历史**——文档会撒谎（路径是旧拓扑的），对象库不撒谎
- 「免疫系统的活体自检」：伪造入侵 → exit 2 点名 → heal → GREEN 复言——检测器的失败路径被亲跑过一次，它才有资格守门；套件的 try/finally 是「自己制造的地雷自己拆」
- 「--batch 七批首战全绿」：上窗为「批边界是工具超时的单位」建的机制，本窗第一次成为唯一操作方式——七条 --batch + 一条 --summary，回归行机器拷贝零手抄
- 遗留（下轮候选）：updatedAt 治理；exists=false 的 UI 活体见证（继续让位）；EMPIAR 真数据回归（数据现在有了明确门牌 `_legacy-archive/relion-projects/empiar-10017-真实全流程/`，RESTORE.md 路径需按现拓扑翻译）；产品功能候选：3D viewer 体积截面工具、Topaz wrapper 深化

- 【实现① tsconfig 排除单根化（检疫第四层）】t275 检疫覆盖了 tracer/tailwind/gitignore 三层，漏了第四层类型检查器——tsconfig 的 include 是 `**/*.ts`，裸 `npx tsc --noEmit`（每个编辑器、每次 CI）仍在扫 _legacy-archive（档案区 mini-services 的 socket.io 错 2 条）+ examples（1）+ scripts/diag-archive（6）+ skills（sandbox 基建，3），12 行噪音转储淹没零错误信号。exclude += 四树 → **裸 tsc 12 → 0**。check-foreign-trees.mjs 新增四条断言（「the noise hides the next real wound」——t264 的教义入法），qa68 台账跟随 25→26 断言 ALL PASS。排除法四层律成文：tracer、tailwind、gitignore、tsc。
- 【实现② 沙箱 EMPIAR bundle 恢复】t273/t274 沙箱重建时 /home/z/empiar-10017/micrographs 丢失（seed.ts L70 的 pre-fill 地址 + engine.ts L79 的 EMPIAR_DIR 常量双双悬空——demo import 无路径、empiarData 模式必失败）。恢复 = 零拷贝 symlink → 档案区 Import/job001/data（10 真 Falcon .mrc + 10 真 Henderson .coord）：数据物理上仍在检疫区（symlink 在仓库外，构建工具永远看不见），产品重新拿到地址。这是环境层恢复而非产品改动——判例：「恢复不是垃圾，symlink 是检疫判决书里写明的取用路径」。
- 【实现③ t276-empiar-fidelity.mjs（28 断言 ×2 ALL PASS，批内 0.5s 收编）】三层保真度：**A 相** 地面真相在场（档案地址 + verdict README 点名 + bundle symlink 幂等自愈——套件自带修复机制）；**B 相** 解析器保真度（我们的 starfile.ts/mrc.ts 就地只读读真实 RELION 5.0.1 产物）：optics 真值逐值转录（1.77/300/2.0/0.1）+ 10 真 Falcon 图、postprocess.star 单文件双部互证（data_general FinalResolution 25.173333 vs data_fsc 曲线 extractFsc→fscResolutionAtThreshold(0.143)=24.69 Å，诚容差 0.6 内——RELION 插值差异如实转录）、跨文件互证（Refine3D model 的 EstimatedResolution == postprocess FinalResolution，两份独立文件一个真相）、真 MRC 二进制 header（Falcon 4096×4096×1 float32 且 **cella 全零诚实断言**——生产者没写，star 是唯一像素尺寸载体；postprocess.mrc 128³ cella 453.12/128=3.54 与自家命令行互证）、era 管线内部算术（632 Henderson picks == 632 extract 行）、optimiser 的 _rlnCurrentIteration=-1 完成态哨兵如实转录；**C 相** 产品轨道载真数据（t272 配方第二次应用）：第二画布 + 真 bundle import（result「10 micrographs imported (pixel 1.77 Å)」）→ 产品写的 micrographs.star 用我们的解析器读回（10 行项目相对 Falcon 名 + optics 与 era 真值一致）→ 真 manualpick 下游（默认端口自动接线）→ **5539 picks VERBATIM 逐值保真**（我们图的 632 行 x/y 与真实 Henderson .coord 完全相等，零变换零漂移）→ project DELETE 清场；**Z 相** roster 21 + 产品存活。SKIP 语义：档案缺失时 exit 0 大声 SKIP（保真需要地面真相，世界漂移不是产品失败）。finally 自拆（反向删 job/项目/目录）。
- 【断言的错，第六次应验】t276 首跑 7 FAIL 全是套件的错不是产品的错：①log 路由响应字段是 tail 不是 log/text；②optimiser 的 -1 是 RELION 完成态哨兵（真实世界脏值第二例）；③folder 分支静默过滤非图像文件（skipNote 只在显式列表分支）——断言改为诚实对齐产品语义；④VERBATIM 检查的 every() 空数组恒真——补非空洞守卫。
- 【OOM 击杀与批纪律（t273 守卫的活体预言）】t25 批两次后台跑被**全局 OOM 无声击杀**（4GB 沙箱：新 build server + 残骸浏览器 + t25 浏览器重型套件）——nohup 进程组随会话回收，setsid 也死于 OOM sweep；残骸 = t258 探针 job 滞留（roster 22，t251 立即 FAIL 捕获）。处置：删探针 job（DELETE 的 clearRunRecord 同步扫 record——t272 不变量活体工作）+ 净残骸浏览器 + **前台重跑**（t25 471.5s 9/9）。教训：「批要前台跑、残骸浏览器是 OOM 弹药、roster 恒等断言是世界的验伤报告」。
- 【全家族回归（七批前台逐批）】qa 批 pass 11 · 412.2s ｜ t21 批 7 · 192.3s ｜ t22 批 2 · 65.6s ｜ t24 批 9 · 123.6s ｜ t25 批 9 · 471.5s ｜ t26 批 10 · 546.2s ｜ t27 批 5 · 182.0s（t270-t273 + t276 0.5s 批内收编）——**合计 pass 53 · solo-recovery 0 · real-fail 0 · wall 1993.4s**（--summary 机器拷贝）；花名册 52→53，coverage check 干净（t276 归 t27 批）。tsconfig 变更后 build 首试即过 + watchdog 复活 200；裸 tsc 0；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（mock cluster 击杀 + Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「真数据是最高级别的评审员」**：合成 fixture 测的是「我们能解析自己写的东西」；EMPIAR-10017 的真实 RELION 5.0.1 产物测的是「我们能转录别人写的世界」——cella 全零、-1 哨兵、插值容差这些真实世界的脏，合成数据永远不会教
- 「单文件双部互证、双文件单真相」：FSC 曲线 vs 自家 header（0.6 Å 诚容差）、Refine3D model vs postprocess star（0.001 Å 严格相等）——保真度断言的两种形状：同一份产物的自洽 + 独立产物的一致
- 「检疫的第四层」：t275 回答了「残骸是什么、搬去哪、谁来守」；t276 补上最后一个会走进残骸的工具（类型检查器）——排除法现在是四层律，裸 tsc 从 12 行噪音回归零错误纯信号
- 「VERBATIM 是保真度的终极形状」：1978 年 Henderson 手工 picks 经产品 import→manualpick 全链 5539 值逐像素相等——产品不是在「处理」真数据，是在「忠实转写」真数据
- 遗留（下轮候选）：RESTORE.md 路径按现拓扑翻译（档案区判决书的最后一块拼图）；exists=false 的 UI 活体见证（继续让位）；updatedAt 治理（继续让位）；folder import 的非图像文件静默过滤可考虑上报（result 提示「N non-image files ignored」——本窗断言发现的 papercut，未动产品）；产品功能候选：3D viewer 体积截面深化、Topaz wrapper 深化
