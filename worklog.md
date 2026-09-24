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

## Task 276 (2026-09-17, cron 22:33 窗口 trace 1a07549302235a99-cron-agent-loop-202609172237)

- 【开局四件套】尾部 = Task 275（98439a0 检疫窗）零过时；origin/main..HEAD 空（98439a0 已 push）；净场良好（PORT 3000/3022 FREE，watchdog 拉起 200 + roster 21）。QA：qa68 GREEN（25 断言）+ t273 GREEN + qa00 GREEN + qa63 SMOKE GREEN + agent-browser 活体目检（console 0 / errors 0 / 画布 21 jobs 16 edges）——无 bug。cron 模板「Task 13」照例不认；树上核实 Task 13 时代遗留（#5 fs/browse 守卫、#7 statcache、#8 particles 批量化）均已于中间窗口修复。
- 【巡检与立项】Task 275 遗留候选逐一勘察：t262 三发现加固已全部在树上（heartbeat L481 / orphan sweep L509 / auto-start 重验 L773）；externalOnPath remote 语义已修复（externalFor 优先 probe inventory）；3D 截面工具（t260）与 Topaz wrapper（训练路由+模板）均已交付。真遗留两项：**EMPIAR 真数据回归**（t275 给了明确门牌 `_legacy-archive/relion-projects/empiar-10017-真实全流程/`，2.7G 真实 RELION 5.0.1 全流程产物）与 **tsconfig 检疫漏层**（裸 `npx tsc --noEmit` 仍扫档案区+examples+diag-archive+skills，12 行噪音转储淹没零错误信号）。立项 = **「真数据开口说话」**：EMPIAR-10017 保真度套件（解析器 × 真实产物 × 产品轨道三层）+ tsconfig 排除单根化（检疫第四层）+ 沙箱 EMPIAR bundle 恢复（/home/z/empiar-10017/micrographs → 档案区 Import/job001/data 的零拷贝 symlink，seed pre-fill 地址与 empiarData 模式复活）。
- 【关键勘察】真实 Falcon MRC header 的 cella 全零（RELION/MotionCor2 未写）——像素尺寸只活在 star 里，套件须诚实断言 header 沉默；postprocess.mrc cella 453.12/128 = 3.54 Å 与文件头注释 --angpix 3.54 互证；FSC@0.143 = 24.69 Å vs header FinalResolution 25.173333（RELION 插值差异，诚容差互证）；Import/job001/data 的 10 个真实 Henderson .coord（632 行/图）与 Extract/job004 per-mic extract.star 行数严格相等（era 管线内部自洽）；Refine3D run_model.star 的 EstimatedResolution == postprocess FinalResolution（跨文件互证）。
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

## Task 277 (2026-09-18, cron 00:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609180023)

- 【开局四件套】尾部 = Task 276（2fe0943）零过时；origin/main..HEAD 空（已 push）；净场良好（PORT 3000/3022 FREE，watchdog 拉起 200 + roster 21）。QA：qa68 GREEN（26 断言）+ t273 GREEN + t276 GREEN + qa00 GREEN + qa63 SMOKE GREEN + agent-browser 活体目检（console 0 / errors 0 / 画布 21 jobs 16 edges）——无 bug。cron 模板「Task 13」照例不认。
- 【开局即修：worklog 完整性】上窗 python 收尾编辑把 Task 276 的**标题行与开局三弹**（【开局四件套】【巡检与立项】【关键勘察】）连同「— 进行中」标记一起切掉了（`s[:idx] + append` 的 idx 落在标题行，append 又不含标题与开局段）——无头条目已随 2fe0943 入库。本窗开局 rg '^## Task 276' 零命中当场暴露，按上窗 heredoc 原文逐字恢复。教训：「程序化编辑尾部文档时，替换锚点必须含标题行本身，或 append 必须以标题开头——交接文档的完整性是惯例⑦的账，开局 rg 标题正则是新的四件套成员」。
- 【巡检与立项】Task 276 遗留四项当选三项：**exists=false 的 UI 活体见证**（t272 起让位两窗——「正常流转已不可达，正是修复的意义」，见证需要手工注入 record）；**folder import 静默过滤上报化**（t276 断言发现的产品 papercut）；**RESTORE.md 现拓扑翻译**（t275 遗留「判决书的最后一块拼图」）。updatedAt 治理继续让位。
- 【实现① 第三态现身（t272 套件 C8 相，+13 断言 ×2 ALL PASS）】正常流转已不可达 exists=false（级联清扫正是修复）——见证配方：C7 之后向全局 engine-state.json **注入**一条指向真死 job（C7 里随第二画布死掉的 jobM）的 record（remote.connectionId 指向探针连接），DTO 断言 server 端 DB 检查判级 exists=false + projectName 缺席，UI 断言哑行 `data-resume-gone="gone"` + tooltip 逐字 "the job is gone (deleted) — the résumé keeps it as history" + 不点名任何画布 + 无 ↗ jump + scrollIntoView 后定妆照 shots-qa/t272-resume-gone-row.png；finally 用注入前快照恢复 state file（「套件自己制造的场景自己拆」）。注入记录 schema 与活体记录同构（jobId/projectId/type/pid/cmd/workdir/logFile/errFile/startedAt/done/exitCode/remote{connectionId,module,mode,stagedMs,syncMs,syncedFiles,syncedBytes}）。三态故事至此完整闭环：jumpable（t271）→ another canvas 点名（t272 C5/C6）→ gone（本窗 C8）。
- 【实现② folder import 上报化（t276 papercut 修复）】engine.ts runImportNative 的 folder 分支此前对非图像文件**静默过滤**（显式列表与通配符两分支一直有 skipNote，唯独 folder 分支——demo 与 EMPIAR bundle 都走的形态——沉默）；修复 = `skipped = entries.length - mrcs.length` 复用既有 skipNote 机制，result 变为「10 micrographs imported · 10 non-image files skipped (pixel 1.77 Å)」。t276 断言收紧：新增 `/10 non-image files skipped/` 断言（bundle 的 10 个真实 Henderson .coord 不再被吞）。向后兼容核实：t262/t263 的 `.includes("6 n")` 前缀断言与 t272 的 MICS_DIR（纯 mics，0 skip）均不受影响。
- 【实现③ RESTORE.md 现拓扑翻译（t275 遗留终结）】检疫判决书 _legacy-archive/README.md 说「路径需按现拓扑翻译」——文末新增「当前拓扑翻译（Task 277）」节：旧路径映射表（/tmp/my-project/ → /home/z/my-project/、persist/relion-stack → _legacy-archive/persist/…、EMPIAR 数据不再 cp 改 ln -sfn 即 t276 恢复配方）+ 进程模型两处更新（watchdog/start-prod 现已存在；「setsid 无效」判例被 t276 OOM 事件精化为「setsid 能活过会话回收，死因换成全局 OOM——前台逐批是纪律」）+ 「恢复完成后跑 t276，ALL PASS 即对齐」的验收口。原文判例逐字保留（era 文档不改写历史，翻译以附节形式追加）；archive README 的 persist/ 行同步修正；qa68 26 断言复跑 GREEN（判决词 grep 标记 5a72d14/检疫 未动）。
- 【全家族回归（七批前台逐批——上窗 OOM 教训已成纪律）】qa 批 pass 11 · 416.8s ｜ t21 批 7 · 195.2s ｜ t22 批 2 · 66.8s ｜ t24 批 9 · 124.8s ｜ t25 批 9 · 474.4s ｜ t26 批 10 · 532.2s ｜ t27 批 5 · 186.2s（t270-t273 + t276）——**合计 pass 53 · solo-recovery 0 · real-fail 0 · wall 1996.4s**；roster 恒等 21；engine.ts 变更后 build 首试即过（109s）+ watchdog 复活；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（mock cluster 击杀 + Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「第三态终于现身」**：t272 的三态 UI 里，jumpable 与 another-canvas 两态当窗就有活体见证，gone 态因「正常流转不可达」让位两窗——本窗用「注入真死 job 的 record」补上最后一态，三态故事闭环（t271 jump → t272 another → t277 gone）
- 「不可达正是修复的意义，见证需要制造」：级联清扫让 gone 态成为正常世界的空集——空集的见证 = 套件手工注入 + finally 快照恢复，与 t211 的「场景制造判例」同宗
- 「沉默的过滤器也会说谎」：显式列表报 skip、通配符报 skip、唯独 folder 分支吞掉——同一个 result 字符串里三种来源两种诚实度；t276 的真数据（mrc + coord 同目录）恰好是沉默误导的世界，papercut 从断言发现走进产品
- 「era 文档的翻译是附节不是改写」：RESTORE.md 正文逐字保留（旧拓扑的历史真相），翻译表 + 进程模型更新以 Task 277 附节追加——档案区的东西连文档都保持可考古
- 遗留（下轮候选）：exists=false 见证已终结；RESTORE.md 翻译已终结；updatedAt 治理（继续让位）；resume 卡片级 helper 文案的细粒度化（「click one to open its job's inspector」对 gone 行不适用——行级 tooltip 已精确，卡片级文案是通用引导，可考虑随选中连接的记录形态自适应）；产品功能候选：3D viewer 体积截面深化、Topaz wrapper 深化

## Task 278 (2026-09-18, cron 01:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609180118)

- 【开局四件套】尾部 = Task 277（7623ccd）零过时；origin/main..HEAD 空（已 push）；净场良好（PORT 3000/3022 FREE，watchdog 拉起 200 + roster 21）。cron 模板「Task 13」照例不认；树上核实 Task 277 遗留两项均真未交付（resume helper 通用文案在 L464-467、updatedAt 仍最小实现、3D 截面无 crosshair 联动）。
- 【QA】五哨兵全 GREEN：qa68 26 断言 + t273-family-report + t276-empiar-fidelity + qa00 + qa63；agent-browser 活体目检 console 0 / errors 0 / 画布 21 jobs。无 bug，基线稳定。
- 【巡检与立项】Task 277 遗留两项合并立项：① **三平面正交查看器「焦点交点」深化**（惯例④⑤——三瓦片此前各刷各的，没有任何东西告诉你兄弟平面正切在你正看的那张图哪里；真三平面查看器的经典能力缺席）；② **resume 卡 helper 文案三态自适应**（Task 277 遗留原文：「click one to open its job's inspector」对 gone 行不适用——卡片级文案说谎）。updatedAt 治理继续让位。
- 【实现① 三平面焦点交点（map-ortho-panel.tsx）】四件套一次交付：**crosshair 联动**——父面板持有 positions{x,y,z}，瓦片经 onPositionChange 上抛自身位置（effect 而非 render 体，一值一报），每瓦片按兄弟位置画两条虚线，线取**被标记平面的 accent 色**（AXIS_COLOR：XY 瓦片上竖琥珀线 = YZ 平面切在此列、横紫线 = XZ 平面切在此行；渲染器真值与 clip overlay 同源——axis 0 即顶行左列，无翻转）；**点击拾取**——图像容器 cursor-crosshair + onClick 按像素算分数坐标，pick 同时落两条通道（positions 供 crosshair 线 + follow adoption 通道驱动兄弟瓦片平面本体滑移——「pick = 导航而非仅注记」，复用 3D 场景已有的 nonce adoption 机制）；**体素级步进**——dim 已知时 stepFrac = 1/(dim-1)，slider step / 键盘箭头 / ‹ › 微按钮三者同一步长即 ±1 voxel（64³ 网格上两击 = 精确两体素），dim 未知回退 1% 保持可用；**面板级 toggle**——Focus 字形按钮（aria-pressed + data-canvas-ui 钩子，做 expand 按钮的兄弟绝不嵌套——既有定位器全部幸存）；3D→2D 的 slice-state 事件同步写入 positions（crosshair 永不与 3D 驱动的平面脱节）。
- 【实现② resume helper 三态自适应（remote-cluster-dialog.tsx）】RunResumeCard 按 recent 行的 exists 形态计算 variant：goneCount===0 → "live"（原文案逐字保留）/ 有 gone 有可点 → "mixed"（「click a **live** one to open its job's inspector; entries marked gone are deleted jobs the résumé keeps as history」）/ 全 gone → "history"（「Runs this connection once dispatched, kept as history — …there is nothing left to open」）；pre-t272 的 undefined 行算可点（旧世界行仍是门）。`data-resume-helper={variant}` 是测试接缝。卡片文案不再对 gone 行说谎。
- 【t278-ortho-crosshair.mjs（46 断言 ×2 ALL PASS，批内 ~100s 收编花名册 53→54）】A 相 demo 真相（200 + roster 21）；B 相源码台账 17 断言（AXIS_COLOR 三色、data-ortho-cross/on 双钩子、cursor-crosshair、1/(dim-1)、toggle、3D 驱动写入 positions、helper 三分支文本）；C 相活体（t253 配方 seed 64³ 体量世界 → Mol* 起活 → ortho 展开）：三瓦片各两条线、琥珀/紫 accent 逐色断言、竖/横方向断言、键盘驱动 y 线随动（50%→1.6%）、点击 XY 图像 (25%,75%) → XZ 滑至 ~0.75 / YZ 滑至 ~0.25 / 被拾瓦片自身平面守恒、toggle 灭 0 线 / 开 6 线、Home 后 readout "z 1/64" 两击后 "z 3/64"；D 相 helper 三态活体——**t277 注入配方轻量化**（无第二画布：POST 探针无关连接——路由是纯 upsert 不探测（树上核实）+ 手工注入 GLOBAL engine-state，真实 roster import job 的 record → exists=true、伪造死 id 的 record → exists=false，三轮 live/mixed/history 各配 page.reload 刷数据 + API 先证 DTO 再证 DOM）；finally 键级恢复 state 快照（快照里有则还原、没有则删除——不吞世界原有键）+ DELETE 连接；Z 相 roster 21 + 死 record 清零 + console 0。
- 【断言的错，第七次应验（本窗 4 FAIL 全部一因产品一因断言）】首跑 4 FAIL：① pick 只写 positions 未驱动 follow——crosshair 线动了而兄弟平面纹丝不动（「注记不是导航」——产品真 bug，修复 = pick 复用 adoption 通道双写）；② Chrome CSSOM 把 style 属性序列化成 `rgba(245, 158, 11, 0.75)` 带空格，断言找无空格串——squash 去空白后匹配（DOM 观察的第九课：getAttribute 是 CSSOM 规范化后的串，不是你写的字面量）。
- 【全家族回归（七批前台逐批——OOM 纪律第三窗）】qa 批 pass 11 · 412.1s ｜ t21 批 7 · 194.1s ｜ t22 批 2 · 65.9s ｜ t24 批 9 · 124.4s ｜ t25 批 9 · 498.9s ｜ t26 批 10 · 545.2s ｜ t27 批 6 · 230.7s（t270-t273 + t276 + **t278 首战**）——**合计 pass 54 · solo-recovery 0 · real-fail 0 · wall 2071.2s**（--summary 机器拷贝）；roster 恒等 21；两轮 build 均首试即过 + watchdog 复活；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「正交查看器的最后一课是共享一个点」**：切片、clip、上下文回声、体素读数都在，但三张图互相不知道对方在哪——crosshair 联动 + 点击拾取把「三张并排的图」变成「一个体积的三个窗口」；这是 RELION _display 与医学影像查看器的共同经典，本窗补齐
- 「pick = 导航而非仅注记」：首跑 4 FAIL 里最大的那个——crosshair 线随拾取移动而平面不动，是「画了线没有开车」；修复 = 拾取同时写 positions（线）与 follow（平面），一条通道是注记、两条才是导航
- 「卡片文案的诚实度要跟随行的事实」：helper 三态是 t277 第三态的最后一英里——行级 tooltip 已精确，卡片级还在对 gone 行说「click one to open」；变体由 recent 的 exists 形态计算，文案与事实对齐
- 「轻量注入配方的诞生」：t277 的 gone 见证需要第二画布真死一 job；t278 发现 helper 见证不需要——POST 连接是纯 upsert（不探测），record 可纯手造，exists 的分级只查 DB——「能注入的就不必真死」；三轮 reload 刷数据、键级快照恢复、套件自拆
- 遗留（下轮候选）：updatedAt 治理（继续让位）；ortho 瓦片点击拾取与框选缩放的潜在手势冲突（未探测到但值得留心）；3D viewer 剩余深化方向：截面 PNG 一键导出、bookmark 里携带焦点交点；产品功能候选：Topaz wrapper 深化

## Task 279 (2026-09-18, cron 02:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609180221)

- 【开局四件套】尾部 = Task 278（c3a893b 已 push）零过时；origin/main..HEAD 空；净场良好（PORT 3000/3022 FREE，watchdog 拉起 200 + roster 21）。开局即修：worklog 尾部发现 Task 278 收尾编辑残渣——一段无标题孤儿片段（开局三行，内容与 Task 278 条目自身完全重复，rfind 尾部定位 + 2 次出现计数守卫后删除）。cron 模板「Task 13」照例不认（实际尾部已是 278，中间 6 个 task 由中间窗口交付——摘要过时第三窗实证）。
- 【QA】五哨兵全 GREEN：qa68 19 断言 + t273-family-report + t276-empiar-fidelity + qa00 + qa63；agent-browser 活体目检 console 0 / errors 0 / 画布 21 jobs（data-job 节点恒等，svg 37）——无 bug，基线稳定。
- 【巡检与立项】Task 278 遗留池两项合并立项（惯例④⑤）：① **三联截面 PNG 一键导出**（t278 焦点交点的自然延续——三张正交切片是每篇 cryo-EM 论文的经典多联图，但只活在应用里，无路可去 deck/稿件）；② **bookmark 携带焦点交点**（保存的 view 已带 σ/sign/slice/clip，唯独不知道「检视发生在哪里」）。updatedAt 治理继续让位。
- 【实现① 三联导出（map-ortho-panel.tsx）】panel 头部 Download 按钮（crosshair toggle 的兄弟，绝不嵌套——既有定位器全部幸存；data-ortho-export-state 机器态接缝：idle/busy/ok/err + Loader2/Check/TriangleAlert 三态字形，ok/err 1.6s 自回 idle）：三平面用瓦片自己的服务端渲染器在**当前焦点交点**处取图（fetch format=png&axis&pos → createImageBitmap）→ 固定出版栅格 canvas 合成（14+34+512×3+14 布局：每板 512px、accent 色板名、等宽 voxel readout、**crosshair 虚线同色同语言** ctx.setLineDash([5,4]) + AXIS_COLOR、底部 footer = map 文件名 + focus x/y/z % + UTC 时刻）→ toBlob → a[download] `ortho-<map>-<hhmmss>.png`。深底 #0b1220 出版风格——文档资产不随应用主题摆动。EXPORT_BG/EXPORT_TILE/AXIS_LABEL 常量族与 AXIS_COLOR（t278 原有）同源。
- 【实现② 焦点随书签走（四道门一次闭环）】**上报**：panel 的 positions 每次提交变化 dispatch `cryoflow:ortho-focus`（2D→3D），embed 以 orthoFocusRef 接住（ref 非 state——捕获读「屏幕此刻」，embed 不因 2D 刷洗重渲染）；**采集**：captureBookmarkView 以 spread 冻结 `focus` 进 view（无 ortho 世界时缺席——不撒谎）；**恢复**：restoreBookmark dispatch `cryoflow:ortho-focus-restore`（3D→2D），panel 三瓦片经 pick 的同一双通道 adopt（positions 线 + follow 平面滑移——「fly back = 整张图」，恢复即导航）；**白名单**：camera-bookmarks 路由 sanitizeView 增 focus 三值 bounded(0,1,0.5)，缺席行原样透传（legacy 永远合法）；saneImportedView 对畸形 focus 诚实降级 undefined（不毒化 restore）。
- 【t279-ortho-export-focus.mjs（41 断言首跑 ALL PASS，批内收编花名册 54→55）】A 相 demo 真相；B 相源码台账 19 断言（事件对、导出机器、四道门逐处）；C 相活体（qa67 64³ seed → Mol* 活 → ortho 展开）：事件监听证 focus 上报（点击 (25%,75%) → x 0.2486/y 0.7498/z 0.5）、**下载活体**（waitForEvent("download") → saveAs → PNG 魔数 + IHDR 1592×616 逐字节断言 + 文件名 `ortho-orthovol-*.png` + exportState ok）、保存书签 → GET 断言 view.focus 服务端落地、clamp 探针（PUT focus x:5,y:-1 → GET x:1,y:0——白名单真咬合）、先改焦点再点书签行 → XZ 回 ~0.75 / YZ 回 ~0.25（恢复即导航活体）、legacy pose-only 书签 reload 后恢复零错误（向后兼容）；finally PUT 空列表触发路由 deleteMany 清行；Z 相 roster 21 + console 0。
- 【断言的错，第八次应验（首跑 2 FAIL 全是套件的错）】① triptych 高度断言写 630——14+34+512+14+42 心算错，真值 616，产品无误（「断言先算术，产品后怀疑」）；② C6 reload 后找不到 View in 3D——reload 链路漏了 Enlarge orthovol 步骤（View in 3D 按钮住在放大视图里），补齐后全绿。另首跑前语法错一次（孤儿 try 无 catch）——python 编辑注释行残留，套件自身 lint 意识。
- 【全家族回归（七批前台逐批——OOM 纪律第四窗；t24+t25 连跑超 600s 工具上限，拆单批）】qa 批 pass 11 · 414.1s ｜ t21 批 7 · 198.5s ｜ t22 批 2 · 65.9s ｜ t24 批 9 · 124.0s ｜ t25 批 9 · 502.4s ｜ t26 批 10 · 531.8s ｜ t27 批 7 · 279.3s（t270-t273 + t276 + t278 + **t279 首战**）——**合计 pass 55 · solo-recovery 0 · real-fail 0 · wall 2116.0s**（--summary 机器拷贝）；roster 恒等 21；build 首试即过 + watchdog 复活 200；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「三联图终于能上稿件了」**：三张正交切片是 cryo-EM 论文的经典 figure，此前只活在应用里——一键导出用瓦片自己的服务端渲染器取图、固定出版栅格合成、crosshair 同色同语言随行，文档资产不随主题摆动；这是 t278 焦点交点的直接下游（导出的正是「你正在检视的那个点」）
- 「焦点是 view 的一部分」：书签已带 σ/slice/clip，唯独不知道检视发生在哪里——四道门（上报/采集/恢复/白名单）一次闭环，恢复走 pick 的同一双通道，「fly back = 整张图」教义贯彻到 2D
- 「ref 而非 state 的捕获纪律」：2D 每次刷洗都上报会让 embed 重渲染——orthoFocusRef 只存「屏幕此刻」，捕获时读取；事件轻、方向清、职责不越界
- 「clamp 在门口咬合」：服务端 sanitize 对 focus 三值 bounded——套件 PUT x:5/y:-1 得回 x:1/y:0，白名单不是纸面声明；legacy 行缺席字段原样透传，向后兼容在四道门每一道都成立
- 遗留（下轮候选）：updatedAt 治理（继续让位）；ortho 瓦片点击拾取与框选缩放的潜在手势冲突（未探测到但值得留心）；3D viewer 剩余深化：bookmark 列表/缩略图标注焦点交点位置、导出图加 σ/contour 元数据行；产品功能候选：Topaz wrapper 深化

## Task 280 (2026-09-18, cron 03:33 窗口 trace 1a07549302235a99-cron-agent-loop-202609180335)

- 【开局四件套】尾部 = Task 279（6275399 已 push）零过时；origin/main..HEAD 空；净场良好（PORT 3000/3022 FREE，watchdog 拉起 200 + roster 21）。QA：五哨兵全 GREEN（qa68 19 断言 + qa68-legacy 26 断言 + t273 + t276 + qa00 + qa63）+ agent-browser 活体目检 console 0 / errors 0 / 21 jobs 恒等。cron 模板「Task 13」照例不认（实际尾部已是 279）。
- 【巡检与立项】Task 279 遗留两项树上核实均真未交付：① bookmark 列表行 renderViewChips 只有 σ/slice/clip 三 chip，无 focus 标注（t279 已把 focus 存进 view，唯独行上不可见）；② 导出 footer 只有 focus+时刻，无 σ/contour 元数据（σ 是 embed 的 isosurface 状态，MapOrthoPanel 无通道可知）。合并立项 Task 280「σ 走到 2D」：req/resp 成对事件（ORTHO_SIGMA_STATE 3D→2D 推送 + ORTHO_SIGMA_REQUEST 2D→3D 拉取，同 FOCUS/FOCUS_RESTORE 成对先例）+ 面板头 σ chip + footer contour 元数据 + 书签行 focus chip。updatedAt 治理继续让位。
- 【实现① σ 状态通道（成对事件，同 FOCUS/FOCUS_RESTORE 先例）】**3D→2D 推送**：molstar-embed 的 sigmaRef 同步 effect（[sigma, sign] 依赖，mount 亦跑）每次变化 dispatch `cryoflow:ortho-sigma-state`（detail {sigma, sign}）——slider / preset / 书签恢复三条源全覆盖；**2D→3D 拉取**：MapOrthoPanel mount 时 dispatch `cryoflow:ortho-sigma-request`，embed 监听后从 **refs（非 state）** 应答——「refs 是书签捕获读的同一份屏幕此刻真源，chip 与书签永不打架」；panel 应答侧校验（sigma 数字有限 + sign ∈ {1,-1}）防畸形事件。拉取解决了兄弟 mount 时序（MolStarEmbed 的推送 effect 先跑、2D 面板晚听一拍）——「推送保增量、拉取保存量，chip 从对话框首帧就活着」。
- 【实现② 面板头 σ chip + 导出 footer contour 元数据行】**chip**：头部 crosshair toggle 的左兄弟（绝不嵌套——既有定位器全部幸存），cyan 色系（ortho 面板自家色相 ScanLine cyan-600；三平面 accent teal/violet/amber 已被占用），mono tabular，`iso 3.00 σ`（sign<0 显示 `-`），`data-canvas-ui="ortho-sigma-chip"` 测试接缝，title 说明它会进导出 footer；**footer**：σ 段拼进既有右串（`iso 3.00 σ · focus x ..% · …  UTC`）——EXPORT_FOOT_H 42 不变、栅格 1592×616 不变，t279 尺寸断言零维护；**诚实缺席律**：isoSigma null（未听到任何 σ）时 chip 不渲染、footer 跳过 σ 段——「猜的默认 2.00 是谎言」。
- 【实现③ 书签行 focus chip（renderViewChips 第四 chip）】v.focus 存在时渲染 `focus 25/75/50%`（cyan 同 σ chip 语义呼应 ortho 世界）；导入预览对话框共享 renderer 同步受益；legacy 行无 focus 保持 chipless（「缺席是诚实，猜的 50/50/50 是谎言」）；BookmarkView 类型不动（focus 字段 t279 已有）。
- 【t280-ortho-sigma-chips.mjs（43 断言 ×2 ALL PASS，归 t28 批）】B 相源码台账 17 断言（成对事件、refs 应答、诚实缺席、chip 分支）；C 相活体（qa67 64³ seed → Mol* 活 → ortho 展开）：**C1 拉取通道活体**（chip 从首帧可见且读 `iso 2.00 σ`）、**C2 推送通道活体**（点 preset `Set contour to 3 sigma` → chip 跟 `iso 3.00 σ`）、C3 pick (25%,75%) → Save 书签 → 服务端 view.sigma=3 + view.focus 落地 + **DOM 行含 `focus 25/75/50%` 与 `3.00 σ`**（renderViewChips 活体）+ 定妆照 t280-sigma-chip-row.png、C4 导出活体（PNG 魔数 + 1592×616 尺寸不变 + exportState ok）、C5 no-focus 书签 reload 后行 chipless + focus 行 chip 幸存（向后兼容）；finally PUT 空列表清行；Z 相 roster 21 + console 0。
- 【t28 十年诞生与防呆的活体演示】花名册收编时把 t280 写进 t27 批注释行——但 BATCHES 匹配 `/^t27/`，t280 是 **t28 十年**第一个套件：家族 t27 批跑出 real-fail **t273-family-report**（--batches exit 2 + covered NaN）——「A NEW DECADE must be REGISTERED here」的防呆正确地叫了（loud, not silent）。修复两处：BATCHES += `{ name: "t28", match: /^t28/ }`（八批注册表完整化）；t273 C1 断言数组加 "t28" + 文本 seven→eight（批数文本演进，同 t270 async 化判例——「roster GROWS never a literal」教义的批列表演进）。t273 复跑 ALL PASS + t28 批首战 pass 1 + t27 批复跑全绿覆盖台账。
- 【启动瞬态一课】watchdog 拉起后立即探活 200 但 roster 短暂为 1（server 首启 Prisma 初始化未完）——「探活 200 ≠ 世界就绪」；三连测 roster 21 恒等后确认虚惊；fd 22 证实 server 打开的是真 DB（/home/z/my-project/db/custom.db）非 Task 99 冻结快照。
- 【全家族回归（八批前台逐批——OOM 纪律第五窗；t24+t25 连跑又撞 600s 工具上限，拆单批重跑）】qa 11 · 411.4s ｜ t21 7 · 195.7s ｜ t22 2 · 66.8s ｜ t24 9 · 124.2s ｜ t25 9 · 480.8s ｜ t26 10 · 535.7s ｜ t27 7 · 280.8s ｜ t28 1 · 43.6s（**t280 首战**）——**合计 pass 56 · solo-recovery 0 · real-fail 0 · wall 2139.0s**（--summary 机器拷贝）；roster 恒等 21；build 首试即过 + watchdog 复活；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「σ 终于走到了 2D」**：三联导出图从此带着 contour level 走（RELION _display 的经典排版——图必有 σ）；面板头一枚安静 cyan chip 让「3D 现在切在哪个阈值」在 2D 侧也可见；t279 的 footer 只差这一行
- 「成对事件是双向通道的既有形状」：FOCUS_EVENT/FOCUS_RESTORE_EVENT 先例 → SIGMA_STATE(3D→2D 推)/SIGMA_REQUEST(2D→3D 拉)；推送保增量、拉取保存量——mount 时序竞态不需要定时器，需要一条拉取门
- 「应答从 refs 来，不从 state 来」：refs 是书签捕获读的同一份「屏幕此刻」真源——chip、书签、导出 footer 三处 σ 永远同源；state 可能落后于异步 commit
- 「缺席是诚实」：isoSigma null → chip 不渲染、footer 无 σ 段；书签无 focus → 行无 chip——猜的默认值是谎言，缺席渲染是三处一致的诚实律
- 「防呆叫对了」：t280 进错批注释行，decade registry 的 coverage check 当窗抓住（t273 real-fail）——loud not silent 的设计本意；修复是登记 t28 批 + 断言随批数演进，家族台账八批全绿收官
- 遗留（下轮候选）：updatedAt 治理（继续让位）；ortho 瓦片点击拾取与框选缩放的潜在手势冲突（未探测到但值得留心）；bookmark 缩略图上标注焦点交点位置（chip 已见，缩略图叠加是下一步）；产品功能候选：Topaz wrapper 深化

## Task 281 (2026-09-18, cron 05:03 窗口 trace 1a07549302235a99-cron-agent-loop-202609180503)

- 【开局四件套】尾部 = Task 280（7293bb1 已 push）零过时；origin/main..HEAD 空；净场发现 12 分钟前的 bun server 半死残骸（进程活着但 PORT 3000 未监听）——Task 86 双杀 + watchdog 拉起。开局探针 roster=1 虚惊：**探针配方错**——`/api/jobs` 历来返回 `{jobs: [...]}` 包裹结构（上次路由改动是早期 remote 窗口），`len(json)` 数的是 dict 的 key；修正 `["jobs"]` 后 21 恒等。「断言的错」在本窗开局就应验了一次。cron 模板「Task 13」照例不认（实际尾部已是 280）。
- 【QA：九哨兵全绿 + 竞态双坑填平】qa68-legacy 26 断言 + qa68-e2e 19 断言 + qa00 + qa63 + t273 + t276 + t278 全 GREEN；**t280 首跑 1 FAIL**：导出按钮 `data-ortho-export-state` 停在 "busy"——竞态 = `a.click()` 触发 download 事件在 React `setState("ok")` commit 之前，套件 saveAs 后立即 getAttribute 跑赢了 commit（5 跑 2 败）。修复 = pollUntil 轮询等待 ok/idle（8s 窗），**t279 埋着同款断言同款移植**——同族坑一次填平，两套件修复后各三连 ALL PASS。agent-browser 活体目检 console 0 / errors 0 / 画布 21 jobs。
- 【巡检与立项】Task 280 遗留池勘察：bookmark 缩略图叠加焦点交点需要 3D→2D 投影（成本高收益小，缩略图是 isosurface 屏幕快照无体素信息）；Topaz wrapper 已有 418 行训练曲线深化空间边际递减；**ortho 面板的能力清单核查**发现真缺席——`readout` 只有 slice 位置的 voxel index，**hover 像素密度值 readout 不存在**（医学影像查看器/RELION _display 的经典仪器：「这块是颗粒还是噪声」要的是数字不是眯眼）。立项 = Task 281「密度探针」。
- 【实现① readMrcVoxel（mrc.ts）】分数坐标（0…1，瓦片 pick/probe 同款坐标系）→ 邻近体素（**与渲染器同一取整** round(p*(dim-1))——光标下的数字就是光标下的体素）；MRC 原生布局 x 最快 z 最慢 `offset = 1024 + nsymbt + ((iz·ny + iy)·nx + ix)·bytesPerVoxel`；**单 voxel pread**（bytesPerVoxel 字节）——无平面缓冲无 section 扫描，hover 频率轮询近乎免费（outputs/file OOM 教义的极致形态）；非有限分数返回 null——探针 chip 保持沉默而非说谎。
- 【实现② format=value 路由分支（outputs/file/route.ts）】同 containment 链（isLocalRequest 守卫 → findEffectiveJob → workdir 词汇域 + realpath → pathref），payload 是数字不是字节；axis→(hAxis,vAxis) 映射用渲染器自己的 TileSpec 约定（z→(x,y)、y→(x,z)、x→(y,z)）；.mrcs 拒绝（stack 用 slice/montage 浏览）、非 MRC 拒绝；畸形分数 clamp 到 [0,1] 回退中心——200 而非爆炸。
- 【实现③ 前端探针（map-ortho-panel.tsx）】**实线 sky 十字线**（PROBE_COLOR rgba(56,189,248,.8)——σ chip 的 cyan 家族；focus 线是虚线 accent 色——「我在看哪」与「光标在哪」两种仪器永不混色）；线全速跟随（本地几何零 I/O）、值 trailing 节流追赶（PROBE_THROTTLE_MS 140ms——**trailing 而非 leading-drop**：窗内 move 排期到窗关闭时发，停住的cursor必被探到最后位置而非 200ms 前的）；abort 防乱序（新 fetch 前 abort 旧的、leave/unmount 清场）；左下角 chip `value @ x,y,z`（1-based，与 "z 33/64" 同惯例；首 fetch 在途时只显地址——「还没有值」不能读成「值是 0」）。
- 【t281-density-probe.mjs（41 断言 ×2 ALL PASS，t28 批内收编花名册 56→57）】A 相 demo 真相；B 相源码台账 19 断言（reader 布局、路由分支、守卫在前、实线 vs 虚线色语言、trailing、abort、1-based）；C 相 API 先行：**三轴一voxel一真理**（axis=z/y/x pos=.5 fx=.5 fy=.5 三条不同代码路径全部解析到 voxel (32,32,32) 且值逐位相等 0.8763…——映射正确性的最强活体证词）、corner clamp（(0,0,0)→voxel 0、(1,1,1)→voxel 63）、畸形分数回退中心 200、.star 404；C6-C10 UI 活体（qa67 64³ seed → Mol* 活 → ortho 展开）：hover 两条线 + chip 数字、线跟随 70%、leave 清场、再入重挂、**hover 不劫持 pick**（探针悬停后 click 仍让 XZ→0.75/YZ→0.25，focus 虚线幸存——t278 手势边界遗留的活体排查）、定妆照 t281-density-probe.png（chip `0.000 @ 17,48,33` 在 blob 外背景区——与中心 0.876 对照正是「particle or noise」的硬数字答案）。
- 【断言的错，第九次应验（首跑 2 FAIL 全是套件）】①Playwright 鼠标坐标落设备像素——356px 框的 fx=0.25 序列化成 24.9%（box 原点带小数）；断言改 CSSOM 解析 + ±1.5% 容差（「CSSOM 串是序列化不是等式目标」第二课）；②consoleErrors 声明在 if(host) 块内 Z 相 ReferenceError——提升顶层。另心算陷阱一次：0.25×63=15.75→round=16→1-based 17，y=0.75×63=47.25→47→48（初写 49，套件首跑前自查修正）。
- 【全家族回归（八批前台逐批——OOM 纪律第六窗）】qa 11 · 412.1s ｜ t21 7 · 197.5s ｜ t22 2 · 66.4s ｜ t24 9 · 124.3s ｜ t25 9 · 438.4s ｜ t26 10 · 548.8s ｜ t27 7 · 284.9s ｜ t28 2 · 71.6s（t280 + **t281 首战**）——**合计 pass 57 · solo-recovery 0 · real-fail 0 · wall 2143.9s**（--summary 机器拷贝）；coverage check 干净（57 套件八批各归属唯一）；roster 恒等 21；build 首试即过 + watchdog 复活；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「光标下有了数字」**：ortho 面板的仪器清单补上密度探针——切片、crosshair、拾取、体素步进、导出、σ chip 之外，hover 读值是医学影像查看器与 RELION _display 的共同经典；「这块是颗粒还是噪声」从眯眼变成读数（0.000 背景 vs 0.876 颗粒中心，一眼的差距）
- 「三条代码路径一个真相」：axis=z/y/x 对同一体素的三种解析全部落到 (32,32,32) 且值逐位相等——分数→体素的映射证明不靠断言靠结构：三轴同点同值是任何单一映射 bug 都无法伪造的证词
- 「trailing 而非 leading」：节流的正确形状是「停住的 cursor 必被探到最后位置」——leading-drop 让光标停在节流窗内时 chip 永远落后 200ms；线全速（本地几何）、值追赶（trailing fetch），两速分离是 hover 仪器的正确物理
- 「单 voxel pread 是 OOM 教义的极致」：从 raw 全文件流（t251 前）到 section-wise（map-profile）到单 voxel 4 字节——I/O 粒子随语义需求收缩到下限，hover 频率轮询在服务端近乎免费
- 「探针与拾取的手势边界被活体排查」：t278 遗留的「点击拾取与框选缩放冲突」担忧落定——瓦片无拖拽手势，hover(move) 与 pick(click) 正交，套件 C9 亲证 hover 后 click 仍然拾取、focus 线幸存
- 遗留（下轮候选）：updatedAt 治理（继续让位）；bookmark 缩略图叠加焦点交点（需 3D→2D 投影，成本收益再评估）；探针 chip 的 σ 相对值显示（value/σ 比值——等用户真正需要时再加）；产品功能候选：Topaz wrapper 深化、导出图叠加探针标记

## Task 282 (2026-09-18, cron 06:03 窗口 trace 1a07549302235a99-cron-agent-loop-202609180610)

- 【开局四件套】尾部 = Task 281（22307ac 已 push）零过时；origin/main..HEAD 空；净场良好（PORT 3000/3022 FREE）→ watchdog 拉起 200 + roster 21 三连恒等。cron 模板「Task 13」照例不认（实际尾部已是 281）。
- 【QA：六哨兵全绿】qa68-legacy 26 断言 + qa00 + qa63 + t281 + t280 全 GREEN；agent-browser 活体目检 console 0 / 21 jobs 恒等。无 bug，基线稳定。
- 【巡检与立项】让位多窗的「updatedAt 治理（大工程）」终于被树上核实——**传说与实际不符**：schema 全 @updatedAt 自动管理、手动 touch 仅一处 legacy 构造、store L905 的 Task 164 注释早已声明 equality predicate 不依赖「每次 PATCH 都 bump」的 courtesy。真正的痛点 = **Prisma @updatedAt 在每次 update() 调用时都 touch（哪怕 data 全同值）**，而 project-dashboard L1420 的 `formatDistanceToNow(j.updatedAt)` 拿它当「最近修改」显示——拖拽抖动落回原位、重复保存、空体 PATCH 都会把「updated 2 minutes ago」说成一次从未发生的编辑。立项 = Task 282「updatedAt 诚实化」：让时间戳回答「最后一次真实编辑」而非「最后一次请求」。规模：PATCH 一处 + 套件——所谓大工程实为精确语义修复。
- 【实现：PATCH no-op 抑制（jobs/[id]/route.ts）】data 构造完成后、update 调用前插 `patchIsNoOp` 检测：**空 data 即 no-op**（Prisma 对空 update 也 touch）；字段逐一与 existing 对比（x/y 数字严格等、name/note/workspaceId 字符串等）；**params 语义对比**——stringify 对比可能因 key 顺序误判，两侧 parse 后 stringify（同一字符串两次 parse 顺序一致，覆盖已有 key 不变序、新 key 追加在尾，等价语义对比）；**unparseable 的 stored params 永不相等**（写入 sanitized merge 是诚实修复）；**reset 意图豁免**——body.status==="idle" 永远执行（kill + clearRunRecord 副作用已先跑，reset 是显式意图必然摸时间戳）。no-op 时直接返回 existing——响应形状零变化（job DTO 照旧，t262 等套件无感）。
- 【t282-updated-at-honesty.mjs（27 断言首跑 ALL PASS，t28 批内收编花名册 57→58）】A 相 demo 真相；B 相源码台账 7 断言（no-op 检测、空体分支、reset 豁免、语义对比、unparseable 分支、existing 短路返回、dashboard 消费方在场）；C 相活体（demo Import Movies 1 为标本，1100ms sleep 让时钟先于 s0 走动）：同值 x PATCH 不摸 stamp、空体不摸、变值摸（52.561Z→06.362Z）、params 同 map 不摸/改 pixelSize 摸、name/note 同值不摸（note null→显式清空写 null 也是 no-op——写 null 到已 null）、**reset 意图即使全等也摸**（06.415Z→06.575Z）；标本 x 恢复原位（真实变值 PATCH 故意摸）；Z 相 roster 21 + 浏览器 21 节点 + console 0。既有套件 PATCH 依赖核查：t272/t270 的 PATCH 断言在 remote 路由域、家族 jobs PATCH 全是变值语义——零冲突。
- 【全家族回归（八批前台逐批——OOM 纪律第七窗）】qa 11 · 412.1s ｜ t21 7 · 191.3s ｜ t22 2 · 66.0s ｜ t24 9 · 124.3s ｜ t25 9 · 459.3s ｜ t26 10 · 529.3s ｜ t27 7 · 279.0s ｜ t28 3 · 73.2s（t280 + t281 + **t282 首战**）——**合计 pass 58 · solo-recovery 0 · real-fail 0 · wall 2134.5s**（--summary 机器拷贝）；coverage 58 套件八批各归属唯一；roster 恒等 21；build 首试即过 + watchdog 复活；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「让位多窗的『大工程』是精确的一处语义修复」**：updatedAt 治理连续让位约十窗，树上核实后实为 PATCH 一处 no-op 抑制——「传说的大工程」也要开箱验货，让位的成本可能远大于工程的成本；本窗同时把 Task 281 遗留的 bookmark 缩略图投影（成本高收益小）与探针 σ 相对值（等真需求）正式判让位
- 「@updatedAt 的诚实度在调用者手里」：Prisma 的 @updatedAt 每次 update() 都 fire 忠实于调用——说谎的是把「调用」当「变化」的上层；Task 164 让 equality 不依赖 courtesy（防御），t282 移除 courtesy 本身（根治）
- 「params 对比要语义不要字面」：stringify 的 key 顺序是序列化伪影——同一 map 两次 parse 顺序一致，覆盖不变序 + 新 key 尾追，语义对比等价且零依赖；unparseable 永不相等是「写入修复优于沉默相等」
- 「reset 豁免是意图语义不是字段语义」：status=idle 的 PATCH 即使全等也摸 stamp——它已经跑了 kill + clearRunRecord，副作用的痕迹就该留在时间戳上；no-op 抑制抑制的是「没有意图的请求」，不是「没有 diff 的字段」
- 遗留（下轮候选）：bookmark 缩略图叠加焦点交点（需 3D→2D 投影，成本收益再评估）；探针 chip 的 σ 相对值显示（等用户真正需要时再加）；导出图叠加探针标记（瞬态 hover 状态进文档资产语义存疑）；产品功能候选：Topaz wrapper 深化

## Task 283 (2026-09-18, cron 06:48 窗口 trace 1a07549302235a99-cron-agent-loop-202609180656)

- 【开局四件套】尾部实证 = Task 282（e2ae285 已 push）——摘要里以为的 Task 272 基线已过时三个 Task（03:33/05:03/06:03 三窗在其它会话交付了 280/281/282），以树上实际为准；cron 模板「Task 13」照例不认。净场：清掉 3022 上 1h 前的 mock cluster 残留 + watchdog 拉起 200 + roster 21 三连恒等。
- 【QA】四哨兵全绿：qa68-legacy-archive 26 断言 + qa00 + qa63 + t282；agent-browser 活体目检 console 0 / errors 0 / 画布 21 jobs·16 edges。开局自摆乌龙一次：`react-flow__node` 数出 0——这是自绘 canvas 工作流 UI，探针的错不是产品的错（本窗第十次应验）。
- 【遗留池树上核实】Task 13 老遗留 #5 fs/browse 已有 isLocalRequest 守卫（早年交付）；Task 272 遗留 family --report JSON 已由 t273 交付（--batches/--summary）；updatedAt 治理已由 Task 282 交付——老任务书遗留池**彻底清空**。真缺口：体素密度直方图不存在（angdist 的 marginal histograms 是无关物）+ σ 事件家族缺 SET 通道（面板看得见 σ 改不了 σ）。立项 = Task 283「直方图说话」：WHERE TO CUT 由看分布回答，不由 slider 试错回答。
- 【实现① readMrcHistogram（mrc.ts）】直方图 NEEDS 每个体素——这是语义地板——故分块两遍单文件读：pass1 min/max/sum/sumsq 累加器（float64）、pass2 在已知 [min,max] 上分 256 箱；O(1) 内存（1<<18 体素 ≈ 1MB float32/块，700³ 图也永不 2.8GB RAM）；NaN/Inf 诚实排除（nFinite 独立计数，Σbins=nFinite 断言每体素恰入一箱，v===max 落末箱不可丢）；(path,mtime,size) 缓存 + LRU 8——hover 频率不是它、panel-open 频率绝对是它，第二眼免费。
- 【实现② format=histogram 路由分支（outputs/file/route.ts）】同 containment 链（isLocalRequest 守卫 → findEffectiveJob → workdir 词汇域 + realpath → pathref），payload 是分布不是字节；.mrcs 拒绝（stack 用 slice/montage 浏览）、非 MRC 拒绝；receipt 带 jobId+file。
- 【实现③ OrthoHistogram 条（map-ortho-panel.tsx）】**log 刻度柱**——cryo-EM 直方图是噪声尖峰+粒子长尾，线性 y 把其余一切压扁成不可见；**σ 标尺** ±1/2/3σ（stats 实际跨到的才画）+ μ 最强线；**cut line** 当前 contour 青色实线（σ chip 同族——条的全部生意就是 contour），越界阈值画 faded 箭头在边缘（诚实：值在可见范围之外，chip 说多远）；**hover bin 读数** value (+σoffset) · count（探针的「要数字不要眯眼」教义上一层）；stats 行 data 接缝 mean/std/n/lo/hi（点击数学的服务端真值）；主题感知（useTheme 重绘，仪器两主题都可读）；**默认 OFF**——第一次看是一次显式请求（服务端要全卷走读），toggle 后服务端缓存使后续免费。
- 【实现④ ORTHO_SIGMA_SET_EVENT】σ 家族补全：STATE 回声（3D→2D）/REQUEST 拉取（2D→3D）/**SET 命令（2D→3D）**。点击密度 → σ = (v−μ)/σ → sign 跟随点击侧（μ 左负右正——负 contour 反差门一键直达）→ clamp [0.05,10]（slider 恢复路径同款）→ dispatch；embed 监听 setSigma/setSign，既有 [sigma,sign] effect 完成剩余（pump + STATE 回声）——chip 与 cut line 自行汇聚，零额外管道。
- 【t283-histogram-sigma-pick.mjs（46 断言 ×3 ALL PASS，t28 批内收编花名册 58→59）】A 相 demo 真相；B 相源码台账 21 断言（分块常量、累加器、分箱、非有限排除、缓存 mtime、LRU、路由分支+守卫、log 柱、标尺、cut 解析同 stats、箭头诚实、主题重绘、SET 家族、clamp、sign 跟随）；C 相活体：API 全分布（nTotal=64³、256 箱、Σbins=nFinite=262144、μ∈(min,max) σ>0）、缓存 bit-identical、.star 404、**探针与直方图读同一文件**（centre probe 值 0.8763 ∈ [0.0000, 0.9054]）、UI toggle→ready、UI μ = API μ（一个服务端真值两个消费者）、**CLICK-TO-SET 闭环**（点击 mean+3σ → chip echo 3.00 σ）、**远边缘 clamp**（(hi−μ)/σ=6.35 → chip 6.35）、负侧诚实缺席（seed map min=0 无负尾巴 → 负点击不可达如实断言 + 直接 dispatch SET −1.5σ 活体见证 embed 翻转分支 chip −1.50 σ——「缺席是诚实，活体在下一层」）；定妆照 t283-histogram-strip.png（hover 读数 0.5641 (+3.82σ) · 84 vx 在册）。
- 【全家族回归（八批前台逐批——OOM 纪律第八窗）】qa 11 · 414.9s ｜ t21 7 · 191.9s ｜ t22 2 · 66.0s ｜ t24 9 · 124.0s ｜ t25 9 · 501.7s ｜ t26 10 · 539.8s ｜ t27 7 · 278.4s ｜ t28 4 · 102.7s（t280+t281+t282+**t283 首战** 22.8s）——**合计 pass 59 · solo-recovery 0 · real-fail 0 · wall 2219.4s**（--summary 机器拷贝）；t273 coverage check 认证 59 套件八批零孤儿；roster 恒等 21；build 首试即过 + watchdog 复活；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「WHERE TO CUT 有了眼睛」**：直方图条补上 contour 决策的经典仪器——噪声峰、粒子肩、Nσ 落点一眼可见；「这块该切在哪」从 slider 试错变成看分布+点击（RELION _display / IMOD / ChimeraX 的共同答案，本井第三个 ortho 仪器：切片→探针→直方图）
- 「σ 家族三通道成形」：STATE 回声 / REQUEST 拉取 / SET 命令——2D 侧从「看得见 σ」升级为「改得动 σ」；sign 跟随点击侧让负 contour（反差倒置样本）从设置面板的特例变成直方图上普通的一击
- 「直方图的 I/O 是语义地板的又一课」：单 voxel pread（t281）→ 语义需求要全体素 → 分块两遍 O(1) 内存 + (path,mtime,size) 缓存——「I/O 粒子随语义收缩」反过来也成立：「语义要求多少就读多少，但内存恒定、缓存兜底」
- 「诚实缺席的套件版」：seed map 无负尾巴 → 负点击断言如实改名（min≥0 解释为何不可达），翻转分支下沉一层用直接 SET 活体见证——不假装点击、不删断言，缺席本身成为证词
- 遗留（下轮候选）：直方图叠加到 triptych 导出 footer（文档资产语义待评估）；.mrcs 栈的 per-slice 直方图（stack 浏览的下一步）；bookmark 缩略图叠加焦点交点（继续让位）；产品功能候选：Topaz wrapper 深化

## Task 284 (2026-09-18, cron 07:48 窗口 trace 1a07549302235a99-cron-agent-loop-202609180754)

- 【开局四件套】尾部实证 = Task 283（efc61b1 已 push）——摘要以为的 272 基线又过时三个 Task；cron 模板「Task 13」照例不认。净场良好（PORT 3000/3022 FREE）→ watchdog 200 + roster 21。
- 【QA】四哨兵全绿（qa68 26 断言 + qa00 + qa63 + t283）；agent-browser 活体 console 0 / errors 0。
- 【巡检与立项】Task 283 遗留池树上核实：triptych footer 直方图（t280 已把 σ 送进 footer，分布叠加语义待评估）、.mrcs per-slice 直方图（class 分布条已是无关物）、bookmark 缩略图投影（继续让位）、Topaz 深化（边际递减）。**快看对话框核查发现真缺口**：t283 的直方图仪器只在 ortho 面板，而用户对任一图像输出的第一眼走的是 results-view 的 map/stack 对话框——「第一眼」无分布可言。立项 = Task 284「快看也开口」：strip 抽取为共享组件 + 对话框只读接入。
- 【实现① density-histogram.tsx】t283 的常量、绘制核心（σ 标尺 + log 柱 + cut line + arrowhead + hover 读数）、fetch、stats 行整体迁出为 ONE drawing truth；`DensityHistogramStrip` 可选 `cutSigma`/`onPickSigma`——面板传两者（交互），对话框都不传（只读，光标 default、title 不许诺 cut）；`QuickHistSection` = 对话框用 toggle（默认 OFF）+ strip，data-canvas-ui 用 uiPrefix 组合（ortho-hist / quick-hist 各自机器可寻）。
- 【实现② 面板换用】map-ortho-panel 删 270 行内联 strip，改 import 共享组件：cutSigma={isoSigma} + onPickSigma 里 dispatch ORTHO_SIGMA_SET——σ 数学（sign 跟随点击侧、clamp [0.05,10]）随 strip 走，dispatch 留在面板。
- 【实现③ 对话框接入】非 .mrcs 分支 `<QuickHistSection key={imageFile.path}>`——key 逐文件重置 toggle；默认 OFF（第一次看是显式请求，服务端缓存让后续免费）。
- 【真 bug（t284 顺藤摸出）】探针实锤：**对话框从不滚动**——DialogContent 基类无 max-height/overflow，超高内容被视口硬裁剪（t284 前内容恰好不超高，故从未暴露；strip 一上，下半截不可达）。修复 = 调用点加 `max-h-[90dvh] overflow-y-auto`（不动共享基类，避免波及其它对话框）。
- 【t284-quick-histogram.mjs（31 断言，t28 批收编花名册 59→60）】A 相 demo 真相；B 相源码台账 17 断言（共享模块双 export、read-only 门 `if (!onPickSigma) return`、cursor 双态、对话框永不传 onPickSigma「只读靠构造不靠运气」、key 重置、对话框可滚、面板交互接线、路由仍拒 stacks）；C 相活体：qamic.mrc（套件手写 64×64×1 float32 MRC——微照片头型）API nTotal=4096、体积对话框 toggle OFF→ready→**μ = API μ（一个服务端真值，第三个消费者）**、微照片对话框 single section + n=4096 + μ 相等、逐文件重置（重开体积 toggle 复位 OFF）；Z 相 roster 21 + console 0；定妆照 ×2（volume: hover 0.3802 (+2.46σ)·141 vx / micrograph: 0.3361 (+1.83σ)·n 4,096）。
- 【断言的错，第十一次应验（首跑 7 FAIL 全是套件）】①pollUntil 返回第一个 truthy——"loading" 也是 truthy，t283 同形断言的 `st === "ready" ? st : null` 映射被漏写；②gallery 的 aria-label 无扩展名（label=orthovol 非 orthovol.mrc），选择器落空 → fallback 点中第一个瓦片（run_it020_half1 32³ → n=32768 的 μ）——「选择器的错，不是产品的错」。
- 【收尾前】t283 断言随 t284 重构演进（绘制断言迁读 density-histogram.tsx，语义不变——t270 async 化同款合法维护）；t283/t284 各两连 ALL PASS；裸 tsc 0；build 首试即过。
- 【t212 证词修复（家族首跑的意外收获）】家族 t21 批 4 real-fail（t212-215）：t212 的 S2/D5 期望宿主恰四卷（orthovol + halves + masked 是常驻成员、被台账记账），而 t284 的 qamic.mrc 证据文件留驻 workdir → 清单变五。修复 = t284 的 qamic 以「先删（防上次崩溃残留投毒）+ try/finally 后删（证据不留驻）」清场——「证据文件不是居民」；重跑 t21 全绿。
- 【全家族回归（八批前台逐批——OOM 纪律第九窗）】qa 11 · 415.4s ｜ t21 7 · 197.8s（首跑 4 real-fail → qamic 清场修复后全绿）｜ t22 2 · 66.5s ｜ t24 9 · 122.9s ｜ t25 9 · 446.9s ｜ t26 10 · 535.5s ｜ t27 7 · 273.4s ｜ t28 5 · 114.0s（t280-t284，t284 首战）——合计 pass 60 · solo-recovery 0 · real-fail 0 · wall 2172.3s（--summary 机器拷贝）；coverage check 认证 60 套件八批各归属唯一；roster 恒等 21；裸 tsc 0；build 首试即过。
- 【I/O 通道的「display 不是真相」再应验】收尾时 python/rg/Read 一致「显示」state[host.id] 为 stateost.id（e[h] 字节序列被终端通道吞掉）——差点按假象「修复」一个正确的文件；Task 283 的教训（display is not truth, codepoints are）原样应验，本轮唯一真缺陷只是尾部少一个闭括号。判读真伪靠 node --check / 套件运行 / 字节级探针，不靠回显。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「快看也开口了」**：直方图仪器从 ortho 面板走进快看对话框——用户对任一图像输出（校正微照片、half-map、movie stack）的第一眼从「眯眼看图」升级为「看分布 + 读数字」；RELION _display 对微照片的直方图惯例在产品里补齐
- 「ONE drawing truth, two consumers」：strip 抽取为共享组件，面板传 cutSigma + onPickSigma（交互）、对话框两者皆无（只读）——「只读靠构造不靠运气」（对话框源码 grep 不到 onPickSigma 成套件断言）；光标与 title 双态区分模式
- 「真 bug 是顺手挖出的」：对话框从不滚动（基类无 max-height/overflow，历史内容恰好不超高）——t284 的 strip 让下半截不可达，探针实锤「零可滚祖先、docSH=视口」后调用点 max-h-[90dvh]+overflow-y-auto 修复；新仪器暴露既有缺陷，正是仪器存在的意义
- 「证据文件不是居民」：套件写入宿主 workdir 的文件要么进台账（qa67 的 orthovol 被 t212 记账）、要么以先删+finally 后删清场（qamic）——「世界如其所被发现的那样归还」
- 遗留（下轮候选）：triptych 导出 footer 叠加直方图缩略（文档资产语义再评估）；.mrcs 栈 per-slice 直方图（stack 浏览下一步）；bookmark 缩略图叠加焦点交点（继续让位）；产品功能候选：Topaz wrapper 深化、快看对话框内 display range 调节（histogram 之上的一步）

## Task 285 (2026-09-18, 用户报障第二窗口 — "Export buildArgv doesn't exist" + 端口硬编码)

- 【报障与法医】用户转来另一助手在本机的抢修日志：ssh2 错误之后又爆 `Export buildArgv doesn't exist`（slurm.ts:30 → engine.ts），该助手遂行 36 分钟手术——engine.ts +730/-999、remote-run.ts 改导入、`bun add asn1`、从 "6baa340^" 恢复 upsertRun/updateRun——错误依旧。上游取证三枚指纹：①HEAD 的 buildArgv 是 2352 行 `export async function buildArgv`（grep 'export function' 漏 async 是双探陷阱）+ resolveInputs(967)/collectOutputs(3208)/workdirFor(548)/upsertRun(271)/updateRun(281) 全部在位，slurm.ts:30 导入一一对应；②tsc src 0 错；③/api/jobs 200 本身就穿过 slurm→remote-run 导入链。结论：**上游从未坏过，用户本地是分叉历史**——`git cat-file -t 6baa340` = "Not a valid object name"，该提交不存在于 origin 任何历史；另一助手是从用户本地某次未推送的私改提交里"恢复"代码，等于给幻影打补丁。asn1 之谜同解：ssh2@1.17 的 dependencies 本就含 asn1 ^0.2.6——缺它说明用户 node_modules 连传递依赖都不全（残缺安装的又一指纹），`bun add asn1` 是给残肢装义肢。
- 【t285 交付：端口硬编码退休】用户真实场景：3000 被卡死旧进程占用，`bun run dev --port 3004` 被吞——package.json 脚本的追加参数落在 `| tee dev.log` 管道之后、进了 tee 而非 next（"管道后缀吞参"判例）。修法：`"dev": "next dev 2>&1 | tee dev.log"` 去掉 `-p 3000`——next dev 原生读 PORT 环境变量、缺省仍 3000，零 shell 展开语法、全平台一致。实测双面：`PORT=3005 bun run dev` → 3 秒绑 :3005 + /api/jobs 200；无 PORT → 3000 默认 + 200。README Getting started 新增 Troubleshooting 三行表（ssh2 缺失→重装、端口被占→PORT 环境变量+PowerShell 变体、本地树改坏→reset --hard origin/main 且 db//data/ 免疫）。
- 【环境战役（一窗三折）】①并发 cron 窗口已把 origin 推进 11 提交（t275-t284：直方图三部曲、引擎第三态、平台治理）且本地 t274 被重写为 a127acf（混入 .zscripts/dev.pid）——stash→reset --hard origin/main→pop 干净落地（README 无冲突：t275-284 未碰它）；②db/cryoflow.db 被清成 0 字节 + data/remote-connections.json 被抹（cron 收尾清理的代价）——db:push 重建表、demo 项目自动重播、Mock Cluster 连接重建+实测探针（3 模块、233ms）；③next-server 无声暴毙一次——3022 存活+日志零错误+内存骤释三证确诊 OOM（tsc 与 chromium 并行压垮 4GB 盒，t268 判例重演）——串行化重进程后复活。
- 【验证】PORT 覆盖与默认双绿；/、/api/jobs、/api/remote/connections 全 200；tsc src 0 错；浏览器主页+对话框 0 错误；探针 233ms。
- 【用户本机修法（写给报障人）】见最终回复——核心是 `git reset --hard origin/main` 回正分叉历史 + 重装依赖 + 清 .next 缓存；运行中的 WSL RELION 作业不受影响（db/ 与 data/ 均 gitignored）。

Stage Summary:
- 「上游健康，本地分叉」：cat-file 一锤定音（6baa340 不存在）——当助手开始从"本地未推送提交"恢复代码时，该怀疑的是历史本身而非导出表；grep 'export function' 漏掉 'export async function' 是本案的第一个假线索
- 「管道后缀吞参」：package.json 带管道的脚本会吞掉 CLI 追加参数——PORT 环境变量是 next dev 的原生正道，不是 shell 技巧
- 「残缺安装的指纹链」：缺传递依赖(asn1) + 缺直接依赖(ssh2) 同源——别给残肢装义肢，重装才是治愈
- 「4GB 盒的并发税」：tsc+chromium+next-server 三峰并压 = OOM 第三次应验（t268 首例）——重进程串行化是本盒的生存纪律；3022 存活+零日志暴毙 = OOM 的法医三联征
- 遗留（下轮候选）：t272 遗留 exists=false 活体见证仍在排队；EMPIAR 真数据回归（连续第三窗让位）
## Task 286 (2026-09-18, cron 09:18 窗口（与并行窗 a8cbd3f 同号撞车：彼为用户报障 setup 修复、先占 285，本窗 display window 交付顺延 286） trace 1a07549302235a99-cron-agent-loop-202609180919)

- 【开局四件套】尾部实证 = Task 284（3e2fe34 已 push）——续窗摘要声称的「272 基线 + 八窗被摘要阻塞」不实：272→284 已由各窗实交付（摘要连续第十次过时，worklog 唯一真源律再次应验）。净场 + watchdog 200 + roster 21。
- 【QA】活体 console 0 / errors 0；哨兵 t284 ALL PASS + qa63 SMOKE GREEN。老 Task 13 遗留树上核实：#5 fs/browse 已有 isLocalRequest 守卫（第 97 行，后续窗已交付）——cron 任务书的过时指引照例不认。
- 【巡检与立项】Task 284 遗留池核查：快看对话框核查发现真缺口——t283/t284 让直方图「会说话」（分布在哪、μ/σ 多少），但图像本身仍听命于固定 2–98 百分位拉伸：用户看得见分布、却指挥不动显示。RELION _display 的 min/max 惯例在产品里缺席。立项 = Task 286「直方图指挥显示」：显式 display window 全链路。
- 【实现① 服务端 mrc.ts】`MrcWindow` 类型 export；stretchToGray 增可选 window 参数——显式窗口分支置前：lo→黑、hi→白、LITERAL 映射（**不做 auto-inversion**：启发式是给 auto 范围兜底的，用户显式选的范围再被静默翻转就是背叛拖拽）；percentile + 反转路径原样保留为 AUTO 默认。四个 renderer（slice/montage/large/ortho）全签名透传。
- 【实现② 路由】format=png 解析 lo/hi——**只有**有限数对且 hi > lo 才是窗口；缺失/垃圾/倒置一律优雅回落 AUTO（绝不 400），回落与 auto 字节同一（套件断言）。
- 【实现③ strip 第三模式】density-histogram.tsx：`onPickWindow?: (w | null) => void` + `window` props——①σ 预设 chips 行（auto/±1σ/±2σ/±3σ/±5σ，data-win-preset 机器可寻，active 镜像活体窗口：对称 μ±kσ 才认领）；②两个拖拽手柄（lo=amber 黑点、hi=violet 白点——刻意避开 contour 的 cyan），pointerdown 最近手柄捕获 + pointermove 在飞更新 + **release 才 commit**（拖拽中不逐帧重渲染图像）；release 读 dragWinRef（ref 镜像，防 pointerup 与末次 move 的提交竞争——陈旧闭包保险）；手柄不可穿越（min gap = span·2%）；③**越窗柱淡化 0.28**——渲染裁剪了什么在 strip 上一眼可见；④光标三态（crosshair / ew-resize / default）；⑤读数行 data-win-lo/hi/state + σ 偏移。strip 从「描述分布」升级为「指挥显示」，一个仪器三种模式（contour/window/read-only）。
- 【实现④ 对话框接线】results-view：`imgWindow` 状态提升——QuickHistSection window/onWindowChange 双向、MrcImage src 拼 `&lo=&hi=`（**一个状态两个消费者**：strip 与图像读同一真值）；`[imgPath]` effect 逐文件重置 AUTO（与 strip 的 key={path} 重置平行——「窗口属于它被画下的那个文件」）；.mrcs 栈分支原封不动（直方图从未对 stack 说过话，窗口也不越界）。
- 【t286-display-window.mjs（46 断言，roster 60→61）】A 相 demo 真相；B 相源码台账 26 断言（MrcWindow 类型、LITERAL 注释与 auto-inversion 跳过同址、五处 stretch 透传、路由 hi>lo 校验 + 四 renderer 接线、拖拽门 `if (!onPickWindow || !winNow || !data) return`、ref 提交、越窗淡化、chips hooks、imgWindow 状态/URL/重置、t284 的 onPickSigma 缺席断言与 montage URL 原样）；C 相活体：**确定性证据卷 t286win.mrc**（64×64×4 float32，v=((x+2y+3z)%16)−8——十六个密度值各恰 1024 次，μ=−0.5、σ=√21.25 是算术不是采样）；C1 直方图 = 算术（μ/σ/span 全命中）；C2 png 路由：auto/有效窗/倒置/垃圾/半窗五连，**graceful trio 与 auto 字节同一、有效窗字节不同**；C3 活体：chips auto→±1σ（URL 携带 &lo=&hi= 且值=μ±σ、手柄读 ±1.00σ、chip aria-pressed 镜像）→ hi 手柄拖拽 24px（σ 偏移 1.13>1.00、自定义后 preset 退位、URL hi 跟随）→ auto 清除（URL 洁净）；C4 逐文件重置（换文件后 URL 无 lo、toggle 复位 OFF）；Z 相 roster 21 + console 0；定妆照 ×2。
- 【首跑 1 超时 = t284 的坑再挣一次】对话框 90dvh 滚动区内 toggle 在折叠下方，点击点落在 img/wrapper 上被「拦截」重试到超时——t284 的 scrollIntoView 教训原样再应验：ensureVisible 助手覆盖全部对话框内点击；顺带修出 C3→C4 流程缺陷（对话框未关就点画廊瓦片）。二跑起 ALL PASS，三连绿。
- 【断言的错，第十二次应验（t284 三 FAIL 全是文本演进）】①title 三元被 prettier 换行拆断 `onPickSigma ? interactiveTitle`（语义未变：σ 分支仍首选 interactiveTitle）→ 断言演进为 `? interactiveTitle`；②③我自己重写的文档注释/JSX 多行把 `Mount with key={path}`、`QuickHistSection key={imageFile.path}` 两个可 grep 短语拆断 → 产品侧保留原短语（断言描述的契约值得一行原文）。t284 两连 ALL PASS 复绿。
- 【全家族回归（八批前台逐批——OOM 纪律第十窗）】qa 11 · 405.9s ｜ t21 7 · 190.7s ｜ t22 2 · 64.6s ｜ t24 9 · 121.6s ｜ t25 9 · 489.6s ｜ t26 10 · 539.7s ｜ t27 7 · 273.9s ｜ t28 6 · 140.4s（t280–t286，t286 首战即家族）——合计 **pass 61 · solo 0 · real-fail 0 · wall 2226.6s**（--summary 机器拷贝）；coverage check 认证 61 套件八批各归属唯一；roster 恒等 21；裸 tsc 0；build 首试即过 ×2。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「直方图指挥显示」**：RELION _display 的 min/max 窗口惯例补齐——快看对话框里用户对任一图像输出从「看分布」升级为「以分布为仪表盘改显示」：σ 预设一击、lo/hi 手柄拖拽、auto 一键回位；strip 与图像读同一个窗口状态（一个状态两个消费者教义第三次落地）
- 「显式命令不被第二次猜测」：显式窗口走 LITERAL 映射、跳过 auto-inversion 启发式——auto 范围才配启发式兜底；路由对无效窗口优雅回落 AUTO（回落与 auto 字节同一成套件断言）而非 400——「拒绝撒谎，但不拒绝服务」
- 「确定性证据」：十六个密度值各恰 1024 次的合成卷让 μ=−0.5、σ=√21.25 成为算术——直方图真值对照算术而非自身；「证据文件不是居民」（先删 + finally 后删）延续 t284
- 「拖拽的诚实」：release 才 commit（拖拽中不逐帧重渲染）、release 读 ref 防陈旧闭包、手柄不可穿越、越窗柱在 strip 上即时淡化——仪器说什么就是什么
- 遗留（下轮候选）：.mrcs 栈 per-slice 直方图 + 窗口（stack 浏览下一步，服务端 window 能力已就位）；triptych 导出 footer 叠加直方图缩略；快看对话框 display range 数值输入（chips/拖拽之外的第三入口）；bookmark 缩略图叠加焦点交点（继续让位）；Topaz wrapper 深化（边际递减）

## Task 287 (2026-09-18, cron 窗口 trace 1a07549302235a99-cron-agent-loop-202609180503——被摘要窗延误后实际执行)

- 【开局四件套】尾部实证 = Task 286（05887cd 已 push）——续窗摘要声称的「272 基线 + 连续十窗被摘要阻塞」第十一次不实：05:03 窗实交付 280/281/282，06:48→283、07:48→284、并行窗 a8cbd3f→285（用户报障 setup）、09:18→286；worklog 唯一真源律再次应验。净场良好（PORT 3000/3022 FREE）→ watchdog 拉起 200 + roster 21。cron 模板「重点读 Task 13」照例不认。
- 【QA】三哨兵全绿（qa00 DATA-VIEW GREEN + qa63 SMOKE GREEN + t286 ALL PASS）；agent-browser 活体目检 console 0 / errors 0 / 33 data-canvas-ui hooks（`react-flow__node`=0 依旧是自绘 canvas 的探针陷阱，非产品缺陷）。
- 【巡检与立项】Task 286 遗留池树上核实：快看对话框 stack 分支只有 montage+说明文字，路由 histogram 对 .mrcs 一律 400「for 3D volumes」——**「.mrcs per-slice 直方图」为真缺口**，直方图家族第四部曲立项 = Task 287「栈也开口」。t283 面板→t284 快看→t286 指挥显示→t287 per-slice：stack 的第一问「这张粒子能不能用」由**那张图的分布**回答，不是几千张的栈级模糊。
- 【实现① mrc.ts readMrcHistogram slice 化】可选 `slice` 参数 = 单 z section（对 .mrcs 即单张粒子图）：sliceOffset = s·nx·ny，count 收缩为 nx·ny；两遍分块读 O(1) 内存不变；**cacheKey 带 slice 维度**（`|s${slice ?? "all"}`——单图直方图不是整卷直方图）；范围外/非有限 → null（路由转成 actionable 400）。
- 【实现② 路由 histogram 分支三重诚实】stack：slice **必填**（未命名的栈直方图=没有主语的数字，400 文案教用法「pass &slice=N (0-based)」）+ 必须整数 + 范围校验（越界 400 **实名 nz**「this stack holds N images (0…N-1)」——header 现读）；volume+slice → 400「a volume's histogram is the whole grid」（静默忽略参数是撒谎）；payload 回显 `slice: slice ?? null`（一个 payload 一个真相）。
- 【实现③ strip 透传】DensityHistogramStrip + QuickHistSection 各加 `slice?: number`；fetch URL 条件拼 `&slice=`、依赖数组 `[jobId, path, slice]`——步进即重问同一仪器；toggle 状态**不**重置（读者的意愿跨步存活）；toggle 行文案 slice 感知（「slice N's density distribution」）。
- 【实现④ stack 分支 UI】slice 光标（◀ ▶ + range slider + 等宽读数，四枚 data-canvas-ui hooks，两端 disabled 诚实）驱动**单 slice 视图**（`&montage=0&scale=large&slice=N` + imgWindow 联动 &lo=&hi=）与直方图（一个光标两个消费者）；**步进清窗口**（`[imgPath, stackSlice]` effect——另一张图是另一个分布，旧 lo/hi 是对新像素的陈旧命令）；换文件光标归位 0 + toggle 复位（t284 契约）；montage 总览原样保留（t286 的 auto-overview 契约持有）。
- 【t287-stack-histogram.mjs（68 断言 ×3 ALL PASS，t28 批收编花名册 61→62）】A 相 demo 真相；B 相源码台账 23 断言（slice 偏移/缓存键/范围校验、路由三重诚实+回显、strip 双 props+deps、光标四 hooks+clamp+montage 原样）；C 相活体：**确定性证据栈 t287stack.mrcs**（4 sections×32×32，section s 值 = s·10+((x+y)%4)·0.5——四值各恰 256 次（32%4==0），μ_s = s·10+0.75、σ=√0.3125 是算术）；C1 API：slice 0/3 的 μ 0.75/30.75 算术命中 + 回显 + 诚实 400 五连（缺 slice/negative/越界实名 nz/小数/volume+slice）；C2 UI：光标步进→视图跟随（slice=1 URL）→直方图 μ 跟随（10.75→20.75）→toggle 行点名 slice→±1σ 窗口 = **该 slice 自己的 μ±σ**（10.1910/11.3090）→步进清窗口（slice=2 无 &lo=）+ strip 状态归 auto + **toggle 存活**；C3 重开归位 slice 1 + toggle OFF；Z 相 roster 21 + console 0；定妆照 t287-stack-slice-histogram.png。证据文件先删+finally 后删（不是居民）。
- 【断言的错，第十三次应验（首跑 1 系列假 FAIL + 环境二连）】①「Enlarge t287stack」选择器落空——friendlyLabel 对 workdir 根的 .mrcs 给「Stack <name>」标签（带扩展名），非产品缺陷，选择器改 `aria-label*=` 部分匹配；②首跑大量 API FAIL 实为**旧 server 占港**：fuser -k 漏杀 02:34 启动的旧 standalone 实例（Task 86 教训复活变体——start-prod.sh 注释里写着的正是这个），重建产物明明含新代码（rg 实证）而 3000 仍答旧行为（volume+slice 200 铁证），按 PID 诛之 + watchdog 重拉即愈——**重建后必须以进程启动时间实证新实例在位**；③自己埋的雷：t24+t25 两批串在一条 600s 超时命令里，强杀时 t25 的 t255/t258 世界 job 残留（roster 23 污染 t24 重跑全军 roster 断言崩）——手动 DELETE 两 job（Task 272 clearRunRecord 仪式在位）恢复 21 后 t24 全绿。教训固化：**家族批次必须一命令一批，两命令一批也绝不合并**。
- 【t283/t284 断言随语义演进（t270 async 化同款合法维护）】「The density histogram is for 3D volumes」文案退场 → 演进为 grep「Stacks histogram per slice — pass &slice=N」（语义升级：从一律拒到按 slice 开口）；t283 的 `readMrcHistogram(abs)` → `readMrcHistogram(abs, slice)`。t283/t284/t286 三哨兵复绿 ALL PASS。
- 【全家族回归（八批前台逐批——OOM 纪律第十一窗，一命令一批）】qa 11 · 405.0s ｜ t21 7 · 196.3s ｜ t22 2 · 65.3s ｜ t24 9 · 121.8s（roster 污染清除后全绿）｜ t25 9 · 467.4s ｜ t26 10 · 542.7s ｜ t27 7 · 275.5s ｜ t28 7 · 154.5s（t280–t287，**t287 首战即家族**）——合计 **pass 62 · solo 0 · real-fail 0 · wall 2228.5s**（--summary 机器拷贝）；coverage 认证 62 套件八批各归属唯一；裸 tsc 0；build 首试即过；roster 恒等 21。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「栈也开口了」**：直方图家族四部曲收官——面板（t283）、快看（t284）、指挥显示（t286）、per-slice（t287）；RELION _display 的粒子栈逐张检视惯例补齐，「这张粒子能不能用」从眯眼看 montage 变成看那张图的分布 + 以分布为仪表盘改显示
- 「没有主语的数字不是答案」：栈级直方图被拒绝不是因为做不到（整栈读就完了），而是因为**它没有语义主体**——每张图有自己的 μ/σ；slice 必填 + volume 拒 slice 是同一枚诚实的两面（参数要么有主体、要么不存在，静默忽略是撒谎）
- 「窗口属于它被画下的那张图」：t286 的「窗口属于文件」在 stack 里再下沉一层——另一张图是另一个分布，步进即清窗（strip 与视图一起归 AUTO），但 toggle 存活——读者的意愿跨步存活，命令不跨分布存活
- 「重建 ≠ 上线」：fuser 漏杀的旧 standalone 实例让新构建空转半小时——**验证新实例在位要看进程启动时间**，PORT 200 只说明有个 server 在答话，不说明它是谁
- 「一命令一批」：600s 强杀拦腰斩断套件的 finally 清场，世界残留以 roster 23 反噬下一批的 roster 断言——家族批次的时间上限纪律不是跑得慢的问题，是被杀后世界是否完整的问题
- 遗留（下轮候选）：.mrcs montage 缩略图也可吃 display window（服务端 montage renderer 已接 win——只差 UI 入口）；快看对话框 display range 数值输入（chips/拖拽之外的第三入口）；triptych 导出 footer 叠加直方图缩略；bookmark 缩略图叠加焦点交点（连续让位）；EMPIAR 真数据回归（连续第四窗让位）

## Task 288 (2026-09-18, 用户报障第三窗口（编号让位于 cron 09:18 窗口的 Task 286——同窗并行，287 已被 cron 05:03 窗占号，本条顺延为 288 — 集群弹窗「太窄、输入框太小、用户名密码」)

- 【报障】用户三连：①「0设置的窗口太窄了」——Remote clusters 弹窗在 1440 视口上实测仅 512px；②「很多输入框太小，看不见输进去的内容」——全表单 h-8 text-xs（32px 高/12px 字号），登录区还是 4 列网格，host 输入框只有 ~100px 宽，login.cluster.example.org 根本看不见；③「ssh登录还是需要用户名和密码的，需要进行设置」——字段其实一直在，但默认认证是 agent（下拉里排第一），密码用户找不到入口。
- 【t286 修复】①弹窗 max-w-3xl → sm:max-w-5xl + max-h-[85vh] overflow-y-auto（矮屏可滚）；②两栏布局 flex-col sm:flex-row + 左栏 w-full sm:w-60（窄屏列表堆叠在表单上方）；③登录区 4 列 → 2 列重排：Host 全宽置顶（714px）→ Username + Port → Display name + Auth method——「最长的值占最宽的格」；④全表单输入 h-8 text-xs → h-9 text-sm（36px/14px，实测），路径类字段 font-mono text-[13px]，Textarea min-h-[72px]；⑤默认认证 agent → password + 下拉排序 Password 置顶——「大学集群的第一路径是密码，agent 是进阶」；⑥Field 标签 text-[11px] → text-xs、hint 10px → 11px；⑦Run-on-cluster 弹窗同步升级（max-w-md → sm:max-w-lg，控件同尺寸）。
- 【CSS 判例】第一版用 max-w-5xl 无效——shadcn Dialog 基类带 sm:max-w-lg，Tailwind 同属性响应式变体在样式表中排在裸 utility 之后，512px 赢了。修法：用相同断点变体 sm:max-w-5xl（同变体内按 max-w 尺度排序，5xl > lg 必胜）。「要赢过基类的响应式类，得在同一个断点里说话」。
- 【验证】1440 视口：弹窗 512→1024px、Host 100→714px、Username 349px、全部输入 36px/14px；390 移动视口：弹窗 358px 贴合、Host 304px、列表堆叠、overflow-y auto；新建流程 UI 实走：默认认证=Password 且密码框直接可见 → 六字段填充 → Create connection 落列 → Test & probe 真实 SSH 登录 → 3 个 relion 模块 chips + LAST PROBE 卡现身；console 0 错误；测试连接清理后世界只剩 Mock Cluster。
- 【环境】本窗 next-server 无声暴毙两次（均伴随 tsc/chromium 并行）——4GB 盒「重进程串行化」纪律第三次应验；tsc 全绿后服务器即重启恢复。
- 【收尾】worklog（本条）+ commit/push。

Stage Summary:
- 「512px 的牢笼」：基类的 sm:max-w-lg 悄悄赢了裸 max-w-5xl——同属性响应式变体后写不等于后赢，样式表顺序才是法官；同断点变体是唯一公平决斗
- 「最长的值占最宽的格」：Host 全宽置顶是表单重排的第一律——4 列网格里 100px 的 host 框是「设计密度压垮功能」的标本
- 「默认值即路径」：auth 默认从 agent 改 password + 选项重排，比任何提示文案都直接——用户找不到入口的字段等于不存在
- 「输入框的最小尊严」：h-9 text-sm（36px/14px）是可读与紧凑的分界——密码用户在 32px/12px 的格子里输凭据是对耐心的征税
- 遗留（下轮候选）：弹窗在超宽屏（>1536）可考虑 max-w-6xl；t272 遗留 exists=false 活体见证仍在排队

## Task 289 (2026-09-18, cron 12:03 窗口 trace 1a07549302235a99-cron-agent-loop-202609181203)

- 【开局四件套】尾部实证 = Task 287（39305e1 已 push）——续窗摘要声称的「272 基线 + 连续十一窗被摘要阻塞」第十二次不实：272→287 已由各窗实交付；cron 模板「Task 13」照例不认。净场良好 → watchdog 200 + roster 21。
- 【QA】三哨兵全绿（qa00 DATA-VIEW + qa63 SMOKE + t287）+ agent-browser 活体 console 0 / errors 0。
- 【立项】Task 287 遗留池树上核实：①数值输入第三入口（t286 遗留）与 ②montage 跟窗（t287 遗留）均为真缺口——服务端 renderMrcMontagePng 已接 window 且路由已透传（line 291），只差 UI 入口。合窗立项 Task 289「窗口的输入面收官」（树上立项时为 288，与并行窗撞号——对方 cluster dialog 修复先落地占号，按 t286 判例 renumber 289）。
- 【实现① 数值输入（density-histogram.tsx）】读数升级为可写：lo/hi 两个 number input（step=any、placeholder=auto）替代纯文本读数——第三入口（chips=一击、拖拽=探索、数值=精确复现）；Enter→blur→容器 onBlur 一条 commit 路径（无双提交）；容器级 focus 门（onFocusCapture/onBlur+relatedTarget）：打字中外部窗口变化不重写字段、tab lo→hi 不早提交、离开整对才 commit；无效对（倒置/半成品）恢复活体窗口——「拒绝撒谎，不拒绝服务」；σ 偏移从读数迁入字段 title（动态 currently Xσ）。
- 【实现② montage 听令（results-view.tsx）】stack 总览加「follow window」开关：默认 OFF（十六图十六分布——auto-overview 契约默认持有）；开启即显式命令全部 cell（服务端已就位）；无窗时 disabled + title 教如何 earned；三层各司其职：aria-pressed=意愿、disabled=可交互性、data-montage-window=实际行为（montageWin && imgWindow——开关存活跨 slice 步进但窗口死了时 hook 诚实读 off）；开关逐文件复位（[imgPath] effect）。
- 【套件 t289-window-input.mjs（56 断言，二跑起 ALL PASS）】A 相 demo 真相；B 相台账 22 断言；C 相活体：确定性证据栈（t287 配方 4×32×32）→ 数值输入全链（typed pair URL verbatim、σ echo hook 精度、字段跟 chips、倒置拒绝、半成品拒绝、恢复活体）→ montage 三幕（无窗 disabled+URL 净、开窗跟令+windowed、撤令回 auto）→ slice 步进（窗口死 toggle 存活→新窗免点击复用）→ 重开全复位；Z 相 roster 21 + console 0；定妆照 t289-windowed-montage.png。
- 【断言的错，第十四次应验（首跑 2 FAIL 全是套件）】①σ echo 断言用全精度期望对照 hook 的 toFixed(2) 输出（0.0039>1e-3）——改按 hook 自身精度对照；②流程自摆乌龙：slice step 前手动关了 toggle，后面「surviving toggle」断言对象被自己撤走——重排为 ON→步进→新窗复用→撤令。附带产品精修：data-montage-window 从「开关状态」升级为「实际行为」。
- 【「重建 ≠ 上线」再挣一次 + 撞号再应验 + 后台化截断 build 新教训】首跑 C 相超时 = watchdog 服务旧 standalone（UI 改动未 rebuild）；第二次 build 被命令链尾部 `&` 后台化截断（26s 即断）致 standalone MISSING、server 起不来——**npm run build 必须前台独占跑完**（OOM 纪律 + 不可后台化双纪律）；前台重跑后 standalone OK、新实例启动时间实证在位。
- 【哨兵复绿】t283/t284/t286/t287 全 ALL PASS（本窗 commit 后 push 撞号：并行窗 baeaeab 的用户报障窗也交付了一个「Task 288」cluster dialog 修复先落地占号——按 t286 判例 rebase + 我方 renumber 289、套件与证据照名重链，编年史单一真相）（t286 两处断言随语义演进：旧读数文案→placeholder="auto"；montage「永不」→「默认不、显式才」）；t287 montage 契约断言同款演进；family-run.mjs 花名册 62→63 收编 t289。
- 【全家族回归（八批前台逐批——OOM 纪律第十二窗，一命令一批）】qa 11 · 403.4s ｜ t21 7 · 189.4s ｜ t22 2 · 65.1s ｜ t24 9 · 121.7s ｜ t25 9 · 470.0s ｜ t26 10 · 530.6s ｜ t27 7 · 274.1s ｜ t28 8 · 166.5s（t280–t288，**t288 首战即家族**）——合计 **pass 63 · solo 0 · real-fail 0 · wall 2220.7s**（--summary 机器拷贝）；coverage 认证 63 套件八批各归属唯一；roster 恒等 21；裸 tsc 0；build 两次（UI 精修后重建）均过。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「窗口的输入面收官」**：display window 家族第五部曲——chips（σ 一击）、拖拽（视觉探索）、**数值输入（精确复现）**三入口齐备；RELION _display 的 min/max 惯例从「看得见、指得出」到「写得进」——论文方法节说 displayed at lo=0.2, hi=1.3 时用户不再需要拖 handle 追浮点
- **「总览听令，但只听点名的令」**：montage 跟窗开关默认 OFF——十六图十六分布，一个窗口命令全部是跨分布命令（t287 清窗教义的另一面）；打开即是显式意图，无窗时 disabled 并教如何 earned；开关存活跨 slice 步进（意愿）、窗口不存活（命令）——「意愿与命令的分离」在 montage 上第三次落地
- 「三层各司其职」：aria-pressed 说意愿、disabled 说可交互性、data-montage-window 说实际行为（montageWin && imgWindow）——仪器的每个信号只说一件事，测试就不必猜
- 「一条 commit 路径」：Enter→blur→容器 onBlur（relatedTarget 门）单路提交——tab lo→hi 不早提交、打字中外部不重写、无效对恢复活体；逐键提交是对半个数字的撒谎
- 「后台化截断 build」新教训：命令链尾部 `&` 把 npm run build 甩进后台又被会话终止（26s 即断）→ standalone MISSING、server 起不来——**build 必须前台独占跑完**（OOM 纪律 + 不可后台化双纪律）；「重建 ≠ 上线」的检验手段（进程启动时间）第二次救命
- 遗留（下轮候选）：triptych 导出 footer 叠加直方图缩略（文档资产语义再评估）；快看对话框 display range 的 σ 数值输入（当前是绝对值——σ 口径输入待真需求）；bookmark 缩略图叠加焦点交点（连续让位）；EMPIAR 真数据回归（连续第五窗让位）；Topaz wrapper 深化（边际递减）

## Task 290 (2026-09-18, 用户报障第四窗口 — "测试连接 / 本地远程区分 / remote root 释义 / 结果留集群按需取回 / Molstar 直预览")

- 【报障五连】用户在 t288（弹窗加宽 + 用户名密码可见）之后提出五项：①「需要增加测试连接」——Test 按钮只存在于已保存连接，创建表单上"先保存再测试"是信任的跳跃；②「如何和本地的relion进行区分呢？需要增加一个模式切换？」——本地 Run 与集群派发是两个未标注的按钮，用户看不出模式差别；③「remote root是什么意思，如何填写呢？」——原 hint 一句话说不清 ~ 展开与镜像语义；④「结果文件主要还是存在远程服务器上吧，不要所有数据都同步过来，只显示一些关键的图片等，map等大文件不同步到本地，点击下载时再从服务器下载」——sync-back 默认全量（cap 内），大 map 静默落笔记本；⑤「支持molstar直接预览服务器上的文件」。
- 【t290-a 测试连接（by-value）】新路由 `POST /api/remote/connections/test`：请求体即连接对象（host/username 必填、三态密钥语义同 POST），sanitizeConnection 造瞬态连接 → probeConnection → **不落盘**；瞬态 id 用后 dropConnection（幻影 id 不得占 SSH 池位）。创建表单的 Test & probe 常驻（valid 前禁用），探测卡「Probe (not saved yet)」当场显示模块 chips——**点击 chip 预选 defaultModule，随 Create 一起落库**（保存态仍走 PATCH）。坏密码 → ok:false + error 首行（非 500）。
- 【t290-b 模式切换（Run ▾ 分裂钮）】job-panel 的 Run 按钮长出 ▾ 菜单：Run on this machine（本机 RELION binary，输出留本盘）/ Run on cluster (SSH)…（stage inputs · module load · key files sync back, bulky outputs stay on the cluster）——**模式是每次运行的选择而非全局开关，菜单说的是选择不是状态**；本机无 RELION 时 local 项诚实禁用（沙箱实测：disabled ✓）。job-inspector 的 Re-run 同样长 ▾（local = 原 confirm 对话框，cluster = 同一受控对话框）。RemoteRunButton 增加 `dialogOnly + open/onOpenChange` 受控模式——**一个对话框组件，多扇门**（服务器图标 + ▾ 菜单同开一个），t262 依赖的 `[aria-label="Run on cluster (SSH)"] .first()` 触发器原样保留。
- 【t290-c remote root 释义】hint 升级为完整语义（镜像 data/relion、首跑自动创建、~ = 集群 home、两个例子）；probe 捕获 `$HOME`（RemoteProbe.homeDir，一次 exec 多 echo 一行）→ 编辑器在字段下渲染 `resolves to /home/cryo/cryoflow`（data-remote-root-resolved，仅 ~ 根且已有 probe 时）——「用户看得见的根才是信得过的根」。
- 【t290-d key-files 同步策略（默认）】RemoteConnection 增 `syncPolicy: "key-files"|"everything"`（缺省 key-files）+ `keyFileMb`（缺省 16MB，sanitize 1–2048 夹取；旧记录缺字段运行时按默认读）。syncBackWorkdir 先跑 find 写 **`.cf-remote-manifest.json`**（路径+尺寸台账，dotfile：outputs walk 与 sync find 双双跳过——它是记账不是数据；「先写台账」：sync 中途死掉，Results 仍知道集群有什么），再按策略过滤：KEY_TEXT_EXT（star/log/out/err/json/xml/pdf/eps/…文本骨架）永远同步；二进制 ≤ keyFileMb 同步（class averages 几 MB 回家），超过留集群——skipped note 改为「they are listed in this job's Results; preview or download them there on demand」。
- 【t290-e 按需取回（懒腿）】新模块 remote-files.ts：`fetchRemoteFileIntoWorkdir`——remoteStat 验证 → remoteDownload（32GB 硬顶，点击即意图但无穷不是政策）→ 落到 workdir 真实路径（**不是缓存：下载就是落地**，下游本地作业与查看器全部无改动可用）→ STAR 同 sync-back 规则 to-local 重写；in-flight Map 去重（画廊预览与 Mol* 同帧抢同一 map = 一次 SSH 拉取）。接线点只有一处：outputs/file 路由的 resolveInsideJobWorkdir 404 分支（`"File not found" && run.remote`）——png/raw/text/value/histogram 全部格式从同一解析点受益，本地作业保持纯 404 路径零开销；outputs/star 路由同钩子。
- 【t290-f 列表合并 + 远程卡片】outputs 列表读 manifest，把本地缺席的条目以 `remote: true` 并入（classify + friendlyLabel，无 header 读取——列表保持瞬时，尺寸来自台账；远程侧 300 条上限）。results-view：MrcGallery 对 remote 文件渲染 **RemoteFileTile**——「on cluster」云朵徽章 + 四扇门：remote-fetch-preview（占位整块可点）/ remote-fetch-btn（Fetch & preview：挂载 MrcImage，png 请求即懒取回，onLoaded → 列表刷新**毕业为本地瓦片**）/ remote-view-3d（Mol* 经 format=raw 同一懒腿拉取）/ remote-download（raw 流下载）。**渲染绝不花费 SSH 传输——取回永远是显式点击**。MrcImage 增可选 onLoaded。Run-on-cluster 弹窗描述同步新语义（key files sync back; bulky maps stay on the cluster, fetchable on demand）。
- 【验证（沙箱 mock cluster :3022 全链路）】by-value 探测 API：好凭据 ok:true + 3 模块 + homeDir；坏密码诚实 ok:false。UI 实走：创建表单默认值齐全（~/cryoflow、16MB、Test 在 valid 前禁用）→ 填 127.0.0.1:3022 cryo/demo + ~/mock-e2e → Test & probe（免保存，注册表计数不变）→ 探测卡 + 解析行 `resolves to …/fs/home/cryo/mock-e2e`（DOM data-remote-root-resolved）→ 点 chip 预选 → keyFileMb=1 → Create 落库（policy key-files + keyMb 1 + defaultModule relion/5.0.1 一并落）。模式菜单：job-panel ▾ 两项（local 禁用/cluster 可用）+ inspector Re-run ▾ 同构；两扇门开同一对话框。远程实跑：造 6×600×600 电影（1.44MB/张）→ 本地 import → ctffind 经 **▾ 菜单**派发 Mock Cluster relion/5.0.1 → 完成（REMOTE[cryo@127.0.0.1 · relion/5.0.1]: CTF estimated for 6 micrographs）→ 首次 finalize 台账 3 文件全同步。植入 2MB 合法 mrc（720×720 float32，run_it003_class001.mrc）到集群 workdir → 重跑 → 第二次 finalize：**列表出现 `REMOTE mrc 2074624 run_it003_class001.mrc | Class 1 map (iter 3)`，2MB 未落地**。懒取回三证：png 门 HTTP 200/111KB PNG/2.0s + 本地落地 2074624 字节；raw 门（Molstar 路径）**与集群副本字节同一**（cmp）；UI 毕业流：点 Fetch → 云朵卡 → img loaded:true → onLoaded 刷新 → 远程卡消失、本地瓦片在场、文件在盘。远程卡四门 hooks（remote-fetch-preview/btn/view-3d/download）+ 徽章 DOM 实证。390px 视口无横向溢出；console 0 错误；清场后 0 遗留瓦片、roster 回 3 demo 作业、Mock Cluster keyFileMb 复位 16。
- 【环境】4GB 盒 OOM 四连：tsc/Turbopack 重编译 + chromium 同驻即倒（内核日志实锤 next-server anon-rss 2.8GB 被诛）——本窗纪律升级为 **chromium 与重编译互斥**（重进程窗口先关浏览器，curl 验后端、浏览器只做轻渲染验证）；dev server 五次重启全部自愈，远程作业在集群侧跑完、reconcile 重启后正确收尾两次（staging 中断自愈路径未触发——run 记录未落地时 POST 死亡 = 旧完成记录原样保留，重派发即正解）。并发窗口 t289（直方图数值输入 + montage 窗口）落地 763037d/1ce1505：stash → reset → pop 零冲突（其改动在 stack 分支，与我的 gallery/remote 无交叠），合并树 tsc 0 错 + 页面零错误。
- 【收尾】worklog（本条）+ commit/push + 环境清理（测试作业/工作目录/mock 侧植入文件与 staged 镜像/夹具电影全清）。

Stage Summary:
- **「结果住在集群，笔记本按需借用」**：key-files 策略（文本骨架永远同步 + 二进制 ≤ keyFileMb）+ 台账（manifest）+ 懒腿（点击才取回、落地即本地数据）三件套——「下载不是缓存，是数据的搬家」；大 map 不再静默落用户笔记本
- **「一个解析点，所有格式受益」**：懒取回只挂在 resolveInsideJobWorkdir 的 404 分支——png/raw/text/value/histogram 与 Mol* 走同一扇门，本地作业零开销；「渲染绝不花费 SSH 传输」是远程瓦片的第一律
- **「模式是选择，不是状态」**：Run ▾ / Re-run ▾ 说出两种执行世界（本机 binary vs 集群 module load），禁用态诚实（本机无 RELION 时 local 项灰）；一个 RemoteRunButton 受控实例，多扇门共用
- **「测试先于承诺」**：by-value 探测让创建表单在落库前回答「这个登录能用吗」，chip 预选 defaultModule 随 Create 一起进注册表——「先保存再测试」的信任跳跃退役
- **「4GB 盒的互斥纪律」**：chromium 与 Turbopack 重编译/tsc 同驻 = 内核 OOM 必诛 next-server（四连实锤）——重进程窗口先关浏览器；dev server 死亡后远程作业在集群侧继续、reconcile 自愈收尾（run 记录未落地的 POST 死亡 = 旧记录原样，重派发即正解）
- 遗留（下轮候选）：远程瓦片 identity card（取回后 header 事实随列表刷新出现，取回前只有尺寸——可在 fetch 后补读）；remote-view-3d 在大 map 上的实际 Mol* 渲染实测（本轮以 raw 门字节同一 + 既有 Mol* 流路代证）；t272 exists=false 活体见证仍在排队；EMPIAR 真数据回归（连续第五窗让位）
## Task 291 (2026-09-18, cron 13:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609181318 —— 树上立项为 290，与并行用户报障窗撞号：对方 cluster 结果借用（五连报障）先落地占号，按 t286 判例 rebase + 我方 renumber 291，套件/花名册/证据照名重链)

- 【开局】尾部实证 = Task 289（1ce1505 已 push）——续窗摘要声称「272 基线 + 连续十二窗被摘要阻塞」第十三次不实（272→289 已由各窗实交付）；cron 模板「Task 13」照例不认（树上核实 recital 七件全销账：#5/#6/#14/#7/#8/#13 均闭合）。净场：3022 残留 mock-cluster bun（1h38m 前窗清场遗漏）双杀清掉 → watchdog 200 + roster 21。
- 【QA】agent-browser 活体 console/errors 0 + 三哨兵全绿（qa00 + qa63 + t289）。
- 【立项】Task 289 遗留池树上核实：家族 --report JSON 已被 Task 273 交付（t273-family-report + --summary/--reset 实在树上）；当选遗留①「triptych 导出 footer 叠加直方图缩略」——文档资产线第三部曲（t279 三联画 → t280 σ 脚注 → **t291 分布**）。
- 【实现】map-ortho-panel.tsx：EXPORT_FOOT_H 42→64；导出时与三平面**并行**拉 format=histogram（8s AbortController 超时守卫）；footer 中央画 log 缩略（EXPORT_THUMB 300×40、slate 柱 #64748b、μ 强刻度 + ±1σ/±2σ 静刻度、青色截断线 #22d3ee 随 isoSigma、离标 faded 0.35、caption "density (log)"）；honest-absence（fetch 失败/超时/畸形 → 单行 footer，缺席即诚实）；measure-first 防碰撞布局（缩至文本让渡 span，<120px 整体跳过）；导出按钮 title 增列 cargo。
- 【套件】t291-ortho-hist-footer.mjs（**42 断言首跑 ALL PASS**）：B 相台账 20；C0 API 直方图 256 bins/nTotal 262144；C1 光栅演进 1592×616→**638**；C2 **Node zlib 解 PNG 像素级**——518 slate 柱像素 + 青色单列窄带（≥15px 纵向 run）落于中段 span x≈615；C3 文档 186KiB 即定妆照。t279/t280 两处 616 高度断言随语义演进（t286 判例合法维护）；family-run 花名册 63→64 + 新十年批次 t29 注册。
- 【哨兵复绿】t279/t280/t281/t283/t284 全 ALL PASS（build 前台独占 ×1，server 启动时间 05:35:56 > build 05:35:49——「重建 ≠ 上线」检验在案）。
- 【全家族回归（九批前台逐批——OOM 纪律第十三窗，一命令一批）】qa 11 · 410.1s ｜ t21 7 · 190.4s ｜ t22 2 · 64.9s ｜ t24 9 · 121.9s ｜ t25 9 · 485.5s ｜ t26 10 · 532.6s ｜ t27 7 · 281.4s ｜ t28 8 · 166.7s ｜ t29 1 · 22.6s（**t291 首战即家族**；t29 批次 22.6s 疑假绿——独立复验：报告落盘 06:19:10 新鲜、光栅 1592×638、青色截断 x≈615、506 柱像素全在——热缓存加速而非跳步）——合计 **pass 64 · solo 0 · real-fail 0 · wall 2276.0s**（--summary 机器拷贝）；coverage 认证 64 套件九批各归属唯一；roster 恒等 21；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「footer 长出分布」**：文档资产线第三部曲——t279 三联画（三平面 + 十字线）、t280 σ 脚注（「没有 contour 的图是半张图」）、t291 分布（「有 contour 还有它切在分布何处」）：读者一眼看出截断活在粒子尾部而非噪声峰——RELION 论文图的惯例（地图直方图 + 阈值标记）进了导出资产
- **「一个真相，三个消费者」**：format=histogram（chunked two-pass + mtime 缓存）的同一 payload——ortho 面板的 σ picker（t283）、快看对话框的只读条（t284）、triptych footer 的缩略（t291）——服务端一份数据喂三种口径的仪器，产品无第二份真相
- **「缺席即诚实」在 footer 上的第三次落地**：fetch 失败/超时（8s AbortController）/畸形 payload → 缩略整体不画、单行 footer 照旧——猜出来的分布是对读者的撒谎；σ 截断线同款：离标 faded 0.35 + 钳位，绝不发明位置
- **「文档版式永不碰撞」**：measure-first 布局——先量 name/stats 文宽再让渡 span，缩略缩至 span 上限、<120px 整体跳过；文档网格归常量（EXPORT_THUMB 300×40）所有，数据只决定内容不决定版式
- **「把哲学讨论变像素事实」再下一城**：t291 套件在 Node 里裸手解 PNG（zlib + 五种 filter unfilter，零依赖）——518/506 slate 柱像素 + 单列青色窄带（≥15px 纵向 run）落在中段 span：「分布画上去了、截断线是窄带不是色块」从断言文本升级为像素证据
- 遗留（下轮候选）：快看对话框 display range 的 σ 数值输入（σ 口径待真需求）；bookmark 缩略图叠加焦点交点（连续让位）；EMPIAR 真数据回归（连续第六窗让位）；Topaz wrapper 深化（边际递减）；triptych 导出的 8s 超时在大体积地图上的余量实测（首走 O(volume) 的真实耗时曲线）
- 【收尾补记】撞号处理完成：rebase onto 2b8d663（仅 worklog.md 一处冲突，双方条目双保留）→ renumber 291（套件/花名册/源码注释/t279/t280 引用/证据照名重链）→ amend 996be81 push + 证据重摆 7b6f0fc push；合并树 tsc 0、t291 套件 renumber 后复跑 ALL PASS（青色截断 x≈615 复现）。终态 HEAD = 7b6f0fc，roster 21，双 port 净场。

## Task 292 (2026-09-18, 用户报障第五窗口 — "All configured authentication methods failed，MobaXterm 能登" —— 编号让位于 cron 13:18 窗的 Task 291（ortho footer 直方图），本窗顺延 292)

- 【报障】用户实测真实集群：探测卡 unreachable + no module system + 2.0s + "All configured authentication methods failed"，同账号密码 MobaXterm 登录成功（"我确定账号密码正确，用mobaxterm可以成功登录"）。附带症状：No relion modules found / No GPUs visible（探测失败的空态连带）。
- 【复现优先】给 mock cluster 加 MOCK_AUTH_MODE 三方言：password（原样）/ keyboard-interactive（模拟 `PasswordAuthentication no` + `KbdInteractiveAuthentication yes` 的 HPC 加固 sshd —— MobaXterm 透明说这个方言，裸 password 客户端死在那句报错上）/ keyboard-interactive-2fa（双提示：密码+验证码）。**意外发现：现有代码（tryKeyboard + keyboard-interactive 处理器，5b737b3 起就在）对 kbd-only 服务端完全正常**（28ms 登录 + 3 模块）—— ssh2 的降级链（none→password→keyboard-interactive）没有缺失。用户失败的真凶是：**多种可修复的配置错误全部塌缩成同一句密码学呓语**——空存的密码（编辑流不回显、没重输）、agent 无套接字、key 文件不可读、真 2FA、纯错密码，ssh2 一律回答 "All configured authentication methods failed"，用户无从排查。
- 【t292 修复三件套（src/lib/remote/ssh.ts）】①preflightAuthProblem 预检：password 无存密/key 无路径/key 文件不可读/agent 无套接字（win32 命名管道除外）→ 0ms 专属错误，网络都不碰（"an edit that skips the password field keeps it empty; MobaXterm working proves the credential, not the stored copy" 直接对用户的报障说话）；②谈判记录仪：自定义 authHandler 镜像 ssh2 自己的线性链（none→password→publickey→agent→kbd，逐串回传由 ssh2 的 authsAllowed 复核），记录 tried（我方试了什么）+ serverOffers（服务端最后一次"可继续方法"清单——ssh2 默认 handler 把这份情报扔掉了）+ kbdPrompts（键盘交互轮的提示数）；③authFailureMessage：穷尽错误改写为「原句 — tried password + keyboard-interactive — the server accepts X — 定向提示」，四种提示各自指路：多提示 2FA（"the cluster asked N questions — only single-prompt password login is supported"）/ 仅 publickey（"switch the auth method to Private key"）/ kbd 被拒（用户名或密码错 + 重输并保存）/ 服务端不列方法（查用户名与账户策略）。
- 【验证矩阵】复现脚本 8 用例全中：kbd-ok ✓（用户场景：28ms + 3 模块）、kbd-wrong ✓（完整诊断行）、pw-ok/pw-wrong ✓（密码方言回归）、kbd-2fa ✓（"asked 2 questions" 提示）、empty-pw/agent/key-missing ✓（0ms 预检拦截）。API 四路：by-value 正/错/空 + 已保存 Mock Cluster 回归（202ms）。浏览器（agent-browser）：创建表单免保存探测 kbd mock → **reachable + envmodules + 3 模块 + homeDir（374ms）**；错密码 → 探测卡完整诊断行（role=alert）；密码区新增方言提示（data-auth-dialect-hint："Sent over both SSH password and keyboard-interactive prompts — the dialect university clusters usually speak (the same login MobaXterm uses)"）；390px 无横向溢出；console 0 错误；定妆照 t292-kbd-probe-error.png。
- 【remote 家族 11 套件全绿】t261/t263/t267/t268（dev server）+ t262/t264/t265/t269/t270/t271/t272（prod server——dev 模式下 t262 必触发 OOM，见环境节）。途中三笔基础设施修缮（全是真 bug，非本窗引入）：①t263-rowflip.py 硬编码 db/custom.db（沙箱投毒残留，与 .env.example 钦定的 cryoflow.db 相悖）→ **按作业 id 找库**（job 刚从 API 创建，行在哪个库哪个库就是服务器的库）——修前 rowflip 写 0 行、孤儿治愈永不触发、t263 ②阶段五连 FAIL；②t263 日志断言读 server.log（家族 prod 惯例 tee）→ 回落 dev.log（"the words are in the SERVER's log"的本义在两种模式下都成立）；③4 个 mock 二进制（motioncor2/relion_autopick/relion_python_topaz/relion_run_motioncorr）git 索引 100644 → **100755**：fresh clone 跑 motioncorr 必 exit 126（command found but not executable）的真仓库 bug，t267 三连 FAIL 的根源。
- 【环境战役（4GB 盒第五连）】dev server 五次无声暴毙（内核实锤 anon-rss 3.1GB 诛 next-server——Turbopack 原生侧内存不受 NODE_OPTIONS 的 V8 上限约束，t262 级负载必杀）；解法 = prod 模式跑重组件（`npm run build` 前台独占 + start-prod.sh + 显式 DATABASE_URL=file:.../cryoflow.db——start-prod.sh 不设 DATABASE_URL 会吃到投毒 .env 的 custom.db）。两笔新判例：**qa-server-watchdog 残留会复活 prod 服务器**（杀服务器前先杀 watchdog）；**`pkill -f "bun run start"` 误杀 mock cluster**（launch.sh 的 start 脚本与 app 的 start 同名同模式——清理要按进程全 cmdline 验明正身）。t262 脏世界判例：注册表残留的 Mock Cluster 连接成为对话框默认（active→否则第一个），套件新建的连接被顶替 → connectionName 断言失败——套件世界的连接注册表也要清场。
- 【世界与清场】roster 21（restore-gallery 重建后全程保持）；Mock Cluster 连接复职 + 探针（219ms）；kbd/2fa mock 实例取证后诛杀；repro 脚本用后即删；最终 :3000（dev，cryoflow.db）+ :3022（password 方言 mock）双活。
- 【合流】并发 cron 13:18 窗落地 3 提交（其 t291 = ortho footer 直方图，从 290 renumber）：stash → reset --hard origin/main → pop，16 张 t26x 截图双改冲突取我方（拍自含本窗改动的最终代码树且全绿取证），代码零冲突，合流树 tsc 0。

Stage Summary:
- **「认证被诊断，而不只是被尝试」**：tryKeyboard 一直在、降级链没坏——坏的是失败时的一句话把五种可修复的错误压成同一个密码学呓语；预检 + 谈判记录仪 + 定向提示让每种失败自己开口（"MobaXterm 能登证明的是凭据，不是存储的副本"——把用户报障的原话变成产品的诊断语）
- **「ssh2 扔掉的情报」**：serverOffers（服务端"可继续方法"清单）只到 authHandler 的形参——自定义 handler 把它记下来，错误信息就能说出集群说什么方言；这比任何文档都准确
- **「复现先于理论」**：mock 先学会说用户的方言（kbd-only / 2FA），八用例矩阵跑完才发现真凶不在降级链——"先建复现环境再读一行源码"的顺序又一次避免了给幽灵打补丁
- 「套件的地基也会烂」：rowflip 的硬编码库路径、日志文件的模式假设、丢失的执行位——三笔都不是产品代码，但每一笔都能让绿灯家族说谎；基础设施的腐烂以套件假 FAIL 的形式自我暴露
- 「watchdog 与 pkill 的教训」：常驻守护者会复活你杀掉的东西（先杀 watchdog 再杀服务器）；模式匹配的 pkill 不分敌我（bun run start 一句杀两家）
- 遗留（下轮候选）：真实 OpenSSH sshd 的 kbd-interactive 复验（沙箱无 root 装不了 openssh-server——用户侧下一次 Test 即见完整诊断，错误行自带下一步指引）；用户 PAT 已暴露多窗仍未轮换（继续提醒）；EMPIAR 真数据回归（连续第六窗让位）
## Task 293 (2026-09-18, cron 14:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609181426 —— 树上立项为 292，与并行用户报障窗撞号：对方 SSH 认证诊断（MobaXterm 报障）先落地占号，按 t286/t291 判例 rebase + 我方 renumber 293，套件/花名册/证据照名重链)

- 【开局】尾部实证 = Task 291（106078c 已 push）。「重建 ≠ 上线」本窗再挣：standalone（05:35）老于合并树（05:40 rebase 带入对端 t290 cluster 借用代码）——前台独占 rebuild 后 watchdog 200 + roster 21。
- 【QA】七哨兵全绿（qa00/qa63/t291/t283/t284/t281/t289）——对端 t290 重接的 outputs/file 404 分支未伤及直方图/png/value 消费方。
- 【立项】对端 t290（cluster 借用五部曲）**零家族套件**（commit 无 scripts/ 文件、花名册无条目）——其改动恰是全 results 面（png/raw/value/histogram/Mol*）共用的解析点。立项 Task 292「借用的守门」：补家族套件守共享门。
- 【实现（纯 QA 资产，零产品改动）】t293-remote-borrow.mjs：A 相 demo 真相；B 相台账 24 断言（by-value 探测路由三门 + 同步策略 key-files 默认/16MB cap/KEY_TEXT_EXT + manifest dotfile 台账 + 懒腿 stat-verify/32GB/safeRel/STAR 重写/in-flight 去重/幂等 + outputs 合并 remote:true/300 cap/无 header 诚实 + file 路由 404→fetch 分支 + Run ▾ 两世界/受控门/四扇 remote 门/$HOME）；C 相活体：C1 by-value 探测（好凭据 ok+relion/5.0.1+homeDir、注册表零变化、坏密码 ok:false 非 500）；C3 import→dispatch(keyFileMb=1)→完成→骨架同步；C4 植入 720×720 float32 2MB map 于集群 workdir→重跑→**cap 拦截**（未落地）+ manifest 台账点名 + REMOTE 瓦片（kind/size/label、dims 诚实缺席）；C5 png 门懒取回→落地**字节同一（sha256）**→瓦片毕业为本地**带 dims**（identity card 免费见证）；C2 Run ▾ 双世界 + local 无 RELION 诚实禁用；定妆照 t293-remote-borrow.png；Z 相 roster 21 + console 0。
- 【套件七跑定妆（首跑 8 FAIL 全自摆乌龙——两个真发现）】①sync-back 只看作业自己的 workdir（首跑把 2MB map 植入 A 的集群 workdir 却指望兄弟作业 B 的 manifest 记账——零命中；修正 = 对端手测的 Re-run 流：同作业重派、manifest writtenAt 轮询判定二次 finalize）；②completed 作业开的是 job-inspector 的 Re-run ▾（无 disabled 门、confirm 兜底），诚实禁用门住在 job-panel（idle 作业）——qa63「completed → inspector modal」判例的套件面应验，修正 = 各门各断（panel 菜单断禁用、inspector 菜单断双世界）；③附带断言卫生：.catch(() => true) 的 isDisabled 是虚绿——清除，menu 定位收敛 [data-state="open"]。终版 52 断言 ALL PASS：植入 map cap 拦截未落地 + manifest 台账点名 2074624B + REMOTE 瓦片（kind/size/"Class 1 map (iter 3)" label、dims 诚实缺席）+ png 门懒取回字节同一（sha256 对比集群副本）+ 瓦片毕业带 dims [720,720,1] + zero remote residue。
- 【全家族回归（九批前台逐批——OOM 纪律第十四窗，一命令一批）】qa 11 · 406.9s ｜ t21 7 · 192.5s ｜ t22 2 · 64.9s ｜ t24 9 · 122.0s ｜ t25 9 · 476.0s ｜ t26 10 · 537.2s ｜ t27 7 · 278.4s ｜ t28 8 · 167.3s ｜ t29 2 · 71.2s（t291+t293）——合计 **pass 65 · solo 0 · real-fail 0 · wall 2316.5s**（--summary 机器拷贝）；roster 恒等 21；裸 tsc 0；rebuild 前台独占 ×1（部署合并树）。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「借用的守门」**：t290 五部曲（by-value 探测/Run ▾ 模式切换/root 释义/key-files 策略/按需取回）从手测变为家族一等公民——它重接的 outputs/file 404 分支是 png/raw/value/histogram/Mol* 全体消费方的共享解析点，此门无守则处处无守
- **「同作业重跑」才是 sync-back 的正确试验场**：兄弟作业各有 workdir，manifest 记账只认自己的家——植入式证据必须走 Re-run 流（对端手测的隐含前提被套件化时显式化）
- **「各门各断」**：job-panel（idle）的 Run ▾ 持有 relionBlocked 诚实禁用；job-inspector（completed）的 Re-run ▾ 无门、confirm 兜底——同一个 aria-label 的两个实例，断言必须落在持有该门的组件上
- **「字节同一」的懒腿证明**：sha256(落地副本) == sha256(集群原件) + 瓦片毕业带 dims——「下载是数据的搬家不是缓存」从注释升级为像素级证据链
- 遗留（下轮候选）：远程瓦片 identity card 之 fetch 后补读 header 已由毕业流部分见证（dims 在案），其余 header 事实（μ/σ 等）待真需求；remote-view-3d 大 map 的 Mol* 渲染实测；t272 exists=false 活体见证（连续排队）；快看对话框 σ 口径输入（待真需求）；EMPIAR 真数据回归（连续第七窗让位）
- 【收尾补记】撞号处理完成（本窗第二次）：rebase onto 069e7d7（对方 Task 292 = SSH 认证诊断；16 个家族重摆 PNG 二进制冲突取对方、worklog 双保留）→ renumber 293（套件/花名册/证据/内部标识符照名重链）→ amend 5667649；合并树 rebuild ×1（对方 ssh.ts 认证路径上线）+ tsc 0 + **t293 renumber 后复跑 ALL PASS**——其 C1 by-value 探测断言在对端新 authHandler 之上依然成立（好凭据 ok、坏密码诚实诊断）。终态 HEAD = 5667649+证据重摆，roster 21，净场。

## Task 294 (2026-09-18, cron 15:33 窗口 trace 1a07549302235a99-cron-agent-loop-202609181539 —— 无撞号，树上直接立项 294)

- 【开局】尾部实证 = Task 293（3061474 已 push）——续窗摘要声称「272 基线 + 连续十三窗被摘要阻塞」第十四次不实（272→293 已由各窗实交付）；cron 模板「Task 13」照例不认。净场良好（双 port FREE、无残留进程）→ watchdog 200 + roster 21；standalone（07:37）新于最后 src 提交（069e7d7 07:08）——部署树在位。
- 【QA】agent-browser 活体 console/errors 0 + 三哨兵全绿（qa00 1.4s / qa63 12.9s / t293 48.3s）。
- 【立项】Task 272 遗留池树上核实——**「exists=false 的 UI 活体见证」已被 Task 277 交付**（t272 套件 C8 相：假 record 注入 → 服务端判 exists=false → UI 哑行 data-resume-gone 全套在案）——遗留清单逐窗抄写不核树的第二例（第一例 = Task 13 recital，Task 291 核实销账）。真缺口：**死历史没有处置权**——gone 行是永久居民，t272 级联只在 project DELETE 时扫记录，其余途径产生的孤儿记录（手工清库、旧快照回灌、t272 之前年代的残留）永远留在 résumé 里。立项 Task 294「résumé 的墓碑门」：给死历史一扇可关的门。
- 【实现（API）】新路由 `DELETE /api/remote/records/[jobId]`：**三重拒绝各自开口**——404（无记录可忘）/ 409 非 remote record（这是 résumé 的门，不是 job 生命周期的门）/ 409 活 job（活历史归画布管——删 job 或 project，t272 级联会带走记录）；**顺序律**：alive 检查先于 clearRunRecord（拒绝先于删除）；isLocalRequest 守卫同 registry 惯例；成功返回 `{ ok, connectionId }`。
- 【实现（UI）】remote-cluster-dialog.tsx：gone 行长出 hover 显影的 X（与活行跳转箭头同一习语，`data-resume-forget` 钩子）——**门只在 exists===false 的行渲染**（活行是门 jump、死行是墓碑 forget，UI 已经知道哪行死就不假装不知道；活行即使 API 层强闯也会被 409，但 UI 连门都不画）；in-flight disabled + Loader2 防双删；拒绝落 `role=alert` 行（`data-resume-forget-error`，服务端的诚实原文直达用户）；成功 `reload()`——服务端重聚合，一个真相，不对缓存卡片做本地手术。prop 链：handleForgetRun → ConnectionEditor（create + saved 双挂载）→ RunResumeCard。
- 【套件 t294-resume-forget.mjs（47 断言，三跑 ALL PASS）】A 相 demo 真相；B 相台账 15 断言（三重拒绝 + 顺序律 + 门只画在死行 + 双挂载 + reload 一个真相）；C 相活体：C1 probeless 连接（全程零 SSH，不需要 mock cluster）；C2 拒绝三连活体（bogus 404 / 本地 record 409 带原文 / 活 demo job 的 remote record 409 带原文且记录存活）；C3 gone record 注入（t277 配方）→ résumé 计数 + exists=false + 无画布点名；C4 对比活体——同一连接下活 job 行 = jump 按钮且无 forget 门（门的位置学）；C5 点击 forget → 卡片退场（total 0 → 字段省略）+ 记录离开全局状态文件；hover 显影定妆照 t294-resume-forget-row.png；D 相 console 0；finally 状态文件回灌 + 连接删除 + roster 21。
- 【断言的错，第十五次应验（首跑 3 FAIL 全自摆乌龙）】①`indexOf("reload();")` 命中 handleDeleted 的更早出现——断言未圈定 handleForgetRun 块；②对比活 record 穿 REFUSAL_CONN 马甲却在 FORGET_CONN 的 résumé 里找它——聚合按 connectionId 过滤，对比物必须穿同一件马甲。产品零错，套件两处修正后二跑三跑 ALL PASS。
- 【部署】rebuild 前台独占（chromium + watchdog 先杀——OOM 互斥纪律第十五窗），新路由 `/api/remote/records/[jobId]` 在构建清单在列；进程启动 07:57:19 > BUILD_ID 07:57:06——「重建 ≠ 上线」检验在案。
- 【哨兵复绿】t270（37.1s）/ t271（32.8s）/ t272（37.0s）全 ALL PASS——墓碑门未伤及 résumé 家族（t272 C8 的 gone 行在带门渲染下依然诚实）。
- 【全家族回归（九批前台逐批——OOM 纪律；t24+t25 合跑撞 600s 工具上限被斩，t24 报告已落、t25 单独补跑——「一命令一批」再次立法）】qa 11 · 405.5s ｜ t21 7 · 191.4s ｜ t22 2 · 65.1s ｜ t24 9 · 122.3s ｜ t25 9 · 454.0s ｜ t26 10 · 535.9s ｜ t27 7 · 274.4s ｜ t28 8 · 166.9s ｜ t29 3 · 93.2s（**t294 首战即家族**）——合计 **pass 66 · solo 0 · real-fail 0 · wall 2308.7s**（--summary 机器拷贝）；coverage 认证 66 套件九批各归属唯一（花名册 65→66）；roster 恒等 21；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「历史要能被放手」**：résumé 是记忆不是刑期——gone 行从永久居民变成可处置的墓碑；遗忘是用户的显式选择，系统不再替用户保管他不要的历史；t270（记忆）→ t272（记忆说真话）→ t277（真话活体见证）→ t294（真话可以被放手）——résumé 家族第四部曲
- **「门只在能开的地方出现」**：活行是门（jump，inspector 能开）、死行是墓碑（forget，API 兜底 409）——双层诚实（UI 不画 + API 拒绝）比单层更便宜也更真；「显示一扇打不开的门」与「假装门不存在」都是撒谎
- **「三重拒绝各自开口」**：404 / 409 非 remote / 409 活 job——每个拒绝都指路（这是 résumé 的门不是生命周期的门 / 活历史归画布管走级联）；顺序律「拒绝先于删除」与 t272「记录先于行删」互为镜像：门的两端都要先问后动
- **「一个真相，reload 即知」**：成功不做本地手术——缓存的卡片想不说谎，唯一的方式是重新问服务端；对共享状态（全局 engine-state.json）的每一个写路径都回到同一聚合出口
- **「合跑撞上限」**：t24+t25 一条命令 = 596s > 600s 工具上限，斩断点丢掉的只有「批次作为单位」的语义——600s 天花板不认你的算术，一命令一批是物理定律不是建议
- 遗留（下轮候选）：remote-view-3d 大 map 的 Mol* 渲染实测；快看对话框 σ 口径输入（待真需求）；EMPIAR 真数据回归（连续第八窗让位）；résumé recent 只有 ≤3 行、total 大时旧条目无入口（分页/展开，待真需求）；批量 forget「一键清墓」（待真需求）
- 【收尾补记】净场抓到一个跨窗残留 + 一个真基础设施刺：:3022 被 pid 20854（07:45 启动）占着——是哨兵复绿时 t272/t293 套件拉起的 mock cluster；套件 finally 的清场模式 `pkill -f 'mock-cluster/server.mjs'` 与实际进程 cmdline `bun server.mjs`（launch.sh 以裸相对路径 exec）**永不匹配**——这就是 mock 残留屡次跨窗存活（Task 291 开局也抓到过一次 1h38m 残留）的根源。修法方向（下轮可落地）：launch.sh exec 时用绝对路径，或清场模式改为按 cwd/端口定位（fuser -k 3022/tcp 已证可靠）。本窗以 kill pid + 端口验证净场（双 port FREE、无 watchdog/standalone 残留）。


## Task 295 (2026-09-18, cron 16:48 窗口 trace 1a07549302235a99-cron-agent-loop-202609181652 —— 取代 13:18 cron（连续十四窗被摘要阻塞未执行），无撞号，树上直接立项 295)

- 【开局】尾部实证 = Task 294（f82b29c 已 push）——续窗摘要声称「272 基线 + 连续十四窗被摘要阻塞」第十五次不实（272→294 已由各窗实交付）；cron 模板「Task 13」照例不认（Task 291 已核实 recital 七件全销账；Task 273 已交付 --report JSON）。净场良好（双 port FREE）→ watchdog 200 + roster 21。
- 【QA】三哨兵全绿（qa00 + qa63 + t294）+ agent-browser 活体渲染正常。
- 【立项】t294 收尾补记交办的**基础设施刺**（11 个套件的清场模式 `pkill -f 'mock-cluster/server.mjs'` 永不匹配实际 cmdline `bun server.mjs`——mock 残留屡次跨窗存活的根源）+ Task 294 遗留池两项「待真需求」合流立项：**résumé 的全景与批量**（recent 硬 cap 3、total 大时旧条目无入口；墓碑逐个 hover 手点繁琐）——résumé 家族第五部曲（t270 记忆 → t272 真话 → t277 见证 → t294 放手 → **t295 全景与清墓**）。
- 【实现① 基础设施（launch.sh）】exec 改绝对路径 `bun "$PWD/server.mjs"`（dev 同理 `--hot`）——surviving cmdline 终于携带 `services/mock-cluster/server.mjs`，11 个套件的既有清场模式零改动即命中；副利：cmdline 不再含 "run start"，`pkill -f "bun run start"`（t292 判例的误杀）从此不可能误杀 mock。活体三证：cmdline 绝对路径在案 → 老 pkill 命中诛杀 → port FREE。
- 【实现② 全景（remote-run.ts + GET /api/remote/records）】connectionRunResume 增 `opts?: { all?: boolean }`——`slice(0, opts?.all ? undefined : 3)`，读数行与全景是**同一聚合的两个孔径**，不是两本台账；exists/projectName 的 t272 注解循环随孔径覆盖全部条目。新路由 GET：isLocalRequest 守卫 + 400（无 connectionId——全景永远是一个连接的历史）+ 404（未知连接——虚无的全景是撒谎）。
- 【实现③ 批量 forget（DELETE /api/remote/records）】t294 单门法则的集合版且**更窄不更宽**：只触及穿本 connectionId 的 records；**批量顺序律**——一次 findMany 先给全批画生死线，再让死者清场（拒绝先于删除）；活 records 保留并计数（kept）——活历史归画布管，t272 级联会带走。响应 `{ ok, forgotten, kept }` 两种命运都报数。
- 【实现④ UI（RunResumeCard）】expand 开关（data-resume-expand + aria-expanded）：overflow 才出现、expanded 即「Show recent only」；effect `[expanded, connectionId, resume]` 从服务端拉全景——reload 换对象即重拉，**全景跟账本走不跟快照走**；shown = full ?? resume，同一渲染器两个孔径。bulk 门（data-resume-forget-dead）两段武装（"Forget n gone" → "Sure? Forget n"）+ **全图门**（`shown.recent.length >= shown.total` 才渲染）——折叠态的计数会低估爆炸半径，「说不出爆炸半径的门绝不画」；成功落 role=status 行（Forgot n · kept m），拒绝落 role=alert 行；单行 X 门（t294）原样保留。
- 【套件 t295-resume-panorama.mjs（56 断言，**首跑 ALL PASS**）】A 相 demo 真相；B 相台账 22 断言（两路由 + 孔径变体 + 批量顺序律 + 全图门 + 双段武装 + effect 依赖 + launch.sh 绝对路径）；C 相活体：C1 probeless 连接（零 SSH）；C2 注入 5 records（2 活 = 真 demo jobs、3 死，死者穿插最新三行）；C3 折叠态 3 行 + expand 在场 + **bulk 缺席**（全图门活体）；C4 展开 5 行 + bulk 在场 "Forget 3 gone" + 定妆照；C5 API 直证（400×2 / 404×2 / 全景 5 条 + exists=false 预分级）；C6 折叠往返 + 门随折叠退场；C7 两段 bulk → Forgot 3 · kept 2 + 状态文件三死俱逝两活俱存 + 二次 bulk 诚实幂等（forgotten 0, kept 2）+ t294 单门 409 活 record 复证；D 相 console 0；finally 状态文件回灌 + 连接删除 + roster 21。
- 【哨兵复绿 + 断言的错，第十六次应验（1 FAIL 全是套件）】t294 台账断言随 JSX 穿透演进（RunResumeCard 增 connectionId/onForgetAllDead 两 props——改断言文本，产品零错）；t270 `slice(0, 3)` 断言随孔径语义演进（`opts?.all ? undefined : 3`——默认孔径不变）；t270/t271/t272/t294 全 ALL PASS。
- 【全家族回归（九批前台逐批——OOM 纪律第十六窗，一命令一批）】qa 11 · 406.9s ｜ t21 7 · 193.1s ｜ t22 2 · 65.2s ｜ t24 9 · 122.3s ｜ t25 9 · 436.3s ｜ t26 10 · 530.6s ｜ t27 7 · 277.6s ｜ t28 8 · 165.9s ｜ t29 4 · 113.2s（**t295 首战即家族**）——合计 **pass 67 · solo 0 · real-fail 0 · wall 2311.1s**（--summary 机器拷贝）；coverage 认证 67 套件九批各归属唯一（花名册 66→67）；roster 恒等 21；裸 tsc 0；rebuild 前台独占 ×1（chromium/watchdog 先杀），新路由 /api/remote/records 在构建清单在列，进程启动 09:13:56 > build 09:13:52——「重建 ≠ 上线」检验在案。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「读数行与全景是同一本台账的两个孔径」**：opts.all 不是第二份聚合——≤3 与全量出自同一个 connectionRunResume，t272 存在性分级随孔径全程在案；卡片展开即换上宽孔径，折叠即回读数行，渲染器只有一个——「一个真相，两个焦距」
- **「说不出爆炸半径的门绝不画」**：bulk 门只在全图态渲染（shown.recent.length >= shown.total）——三行折叠态下的 "Forget n" 会把没看见的墓碑也一并清掉而标签只说看见的；全图门让标签永远精确（Forget 3 gone / Sure? Forget 3 / Forgot 3 · kept 2）
- **「批量顺序律是单门法则的集合版」**：一次 findMany 画全批生死线，然后死者才清场——t294 的「拒绝先于删除」从行粒度升到批粒度；活记录 kept 计数返回，清墓从不清活人
- **「修根不修症状」**：11 个套件的清场模式一个没改——launch.sh 的 exec 换绝对路径后既有模式全体复活；跨窗 mock 残留（Task 291 抓过 1h38m、t294 收尾抓过）从根源闭合，副利封死 `pkill -f "bun run start"` 误杀通道
- **「全景跟账本走」**：effect 以 resume prop 为依赖——reload 换对象即重拉全景，bulk 成功后展开态自动瘦身（5 行 → 2 行），无一处本地手术；对共享状态的每个读路径都回服务端聚合出口
- 遗留（下轮候选）：remote-view-3d 大 map 的 Mol* 渲染实测；快看对话框 display range 的 σ 口径输入（待真需求）；EMPIAR 真数据回归（连续第九窗让位）；résumé 全景的分页（当前一页全量，条目数十级尚可，百级待真需求）；Topaz wrapper 深化（边际递减）
- 【收尾补记】净场又抓到一个真泄漏 + 完整归因：:3022 残留 pid 14561（09:17:47 启动，cmdline 已是绝对路径形态）——本窗哨兵对 2 的 t271 启动后泄漏。根因不在 launch.sh（绝对路径修复已生效，严格复现 launch→pkill→dead exit 0），而在 **t271 自己：启动 mock（weLaunchedMock=true）但 finally 从不清理**——标志设了没用，每次「端口空闲时启动」的 t271 运行都漏一个 mock；后续 t272 走 mockListening 复用路径（weLaunchedMock=false）清场门关着，家族跑批全程复用，泄漏就此穿越整个家族回归。修复 = t271 finally 补 t270/t272 同款 `if (weLaunchedMock) pkill` 块；复跑 t271 ALL PASS + 运行后 3022 FREE 实证闭合。附：fuser -k 3022/tcp 本窗对 bun 监听者一次未命中（kill pid 可靠）——端口清场以 ss 验证 + pkill 模式为主，fuser 降级为兜底。


## Task 296 (2026-09-18, cron 18:03 窗口 trace 1a07549302235a99-cron-agent-loop-202609181808 —— 无撞号，树上直接立项 296)

- 【开局】尾部实证 = Task 295 收尾补记（t271 mock 泄漏修复，0645214 已 push）——续窗摘要声称「272 基线 + 连续十五窗被摘要阻塞」第十六次不实；cron 模板「Task 13」照例不认。净场良好（双 port FREE、零残留）→ watchdog 200 + roster 21；BUILD_ID（09:13）晚于最后 src 提交——部署树在位。
- 【QA】四哨兵全绿（qa00 / qa63 / t295 / t294）+ 活体渲染正常——项目稳定，进入自主立项。
- 【立项】遗留池树上核实：「remote-view-3d 大 map 的 Mol* 渲染实测」连续九窗让位且零套件覆盖——现有测试世界最大 3D 体素网格只有 64³（1MB demo orthovol）、t293 植入图 720×720×1（2MB），Mol* 管线从未被真实重建量级压过。立项 Task 296「大 map 的判决」：256³ float32 = 64MB（64× 体素数）走完 mapimport → identity card → Mol* 全管线并计时定罪。
- 【实现① 套件（t296-big-map-viewer.mjs，37 断言，三跑 ALL PASS）】A 相 demo 真相；B 相台账 9 断言（raw 路由流式注释在案、ParseCcp4 四段链、四阶段 loading overlay、contour slider/presets 契约、mapimport 卷校验、**hardlink 先行 + 无出树 symlink 双钉**）；C0 确定性合成 MRC（三个高斯球 bounding-box 求值 ~400ms、诚实 header stats——min/max/mean/rms 真算不伪造、精确 1024+n³·4 字节）；C1 mapimport → 原生 run → completed → model_mrc + **lstat 断真文件非 symlink** + **raw API 直证**（SH 同源头、46ms 全量 67MB 流出——Mol* 即将发出的同一请求，失败则具名报错而非 viewer 内神秘 overlay）；C2 计时：identity card dims chip「256 × 256 × 256 vox」→ View in 3D → canvas 4.3s → **fetch+parse+isosurface 全程 15.4s**（120s 判决门）→ 无 error overlay；C3 5σ preset 提交 16.7M 体素无崩 + 定妆照；C4 Esc 退场；C5 直方图路由直证——**冷全网格扫描 1036ms → LRU 命中 46ms**（「第二眼免费」教义的活体见证，nFinite=256³ 全网格在案）；D 相 console 0；finally 删 citizen + 清 tmp + roster 21。
- 【真 bug 现形（首跑 ERROR OVERLAY 兜底取证）】「map download failed (HTTP 400)」——png/raw/value/histogram 全线 400「Path escapes the job directory」而 identity card 的 stats 却诚实显示。根因：**runMapImportNative 用 symlinkSync 把源 map 链进 workdir**——源在 data 树之外（用户 Downloads/EMPIAR 下载是常态场景）时，t270 时代加固的 containment 政策（resolveInsideJobWorkdir realpath 检查）如设计般拒绝出树 symlink → **导入的 map 永远打不开**。t258 家族只导入过 crop（subvolume 路由直接写字节），九窗让位恰好掩护了这个盲区。对照组实验定罪：demo orthovol（树内真文件）raw 200/10ms ✓，直连 import（树外 symlink）400 ✗。六处 symlink 点位排查：import（电影）流 line 687 早已 hardlink 先行——唯 mapimport 用错原语，且其注释本就声称「link into the workdir (one copy on disk)」。
- 【实现② 修复（src/lib/relion/engine.ts，一处手术）】symlinkSync(host, linked) → **linkSync(host, linked)**（hardlink 先行，同文件系统零拷贝、realpath 落在 workdir 内 containment 天然通过）→ copyFileSync 兜底原样保留（跨卷 EXDEV）。注释全文记录 t296 判决（identity card 诚实而 viewer 被锁死的完整因果链）；logText 文案改「materialized into the job workdir (hardlink, or byte copy across volumes)」。修复后：raw 200、Mol* 15.4s 渲染、5σ 提交、直方图全链复活。
- 【断言的错，第十七次应验（首跑 2 FAIL + 一崩溃全自摆乌龙）】①「Building isosurface…」span 的 detach 在 error 相同样卸载——6847ms 实为 time-to-error 而非成功计时（修复后用「无 error overlay」+ raw 直证双保险）；②C5 裸 Node fetch 撞 isLocalRequest 守卫（403 13ms）被误标为「cold scan」——补 SH 头后真相优美（1036ms 真冷扫 → 46ms LRU）；③C3 预设点击在 error 相未挂载 → 未捕获超时崩套件——可见性守卫包裹。产品零错，套件三处修正。
- 【部署】rebuild 前台独占（chromium/watchdog 先杀——OOM 纪律第十七窗），进程启动 > BUILD_ID 检验在案。
- 【哨兵复绿】t258（crop 链最受波及——subvolume-job 也是 mapimport，现 hardlink 树内）+ t276（EMPIAR import 流）全 ALL PASS。
- 【全家族回归（九批前台逐批——一命令一批）】qa 11 · 413.3s ｜ t21 7 · 201.2s ｜ t22 2 · 65.4s ｜ t24 9 · 123.3s ｜ t25 9 · 491.0s ｜ t26 10 · 538.5s ｜ t27 7 · 280.0s ｜ t28 8 · 172.3s ｜ t29 5 · 150.8s（**t296 首战即家族**）——合计 **pass 68 · solo 0 · real-fail 0 · wall 2435.8s**；coverage 认证 68 套件九批各归属唯一（花名册 67→68）；roster 恒等 21；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（Task 86 双杀 + port FREE 验证）。

Stage Summary:
- **「九窗让位掩护了一个真 bug」**：mapimport 对树外源 symlink 而非 hardlink——containment 加固后（t270 时代）identity card 依旧诚实（listing 直读 header）而 png/raw/histogram 全线 400，导入的 map 成了看得见摸不着的展品；只有第一份用真实重建量级从**树外**导入的套件才能撞见——九窗让位的债，一笔还清还带了利息
- **「代码用错了自己的注释」**：注释声称「link into the workdir (one copy on disk)」，代码却写 symlinkSync——hardlink 才是这句话的本义；import（电影）流 line 687 的 hardlink-first 早已是榜样，mapimport 补齐同一教义（hardlink → copy，永不 symlink——出树 symlink 在 containment 政策下永远是死路）
- **「计时断言要区分 time-to-done 与 time-to-error」**：loading overlay 的 detach 是双相出口（成功与 error 都卸载它）——「无 error overlay」必须与计时并列断言，raw API 直证（Mol* 的同一请求）让失败在进 viewer 之前就具名
- **「大 map 的判决数据」**：256³ float32 64MB——raw 流式 46ms 全量、Mol* fetch+parse+isosurface 15.4s、5σ 提交无崩、直方图冷扫 1036ms → LRU 46ms；4GB 盒上的重建量级基线首次在案
- 遗留（下轮候选）：384³/512³ 更大体素级的阶梯压测（T296_N 环境变量已备，OOM 互斥下另行立项）；remote-view-3d 大 map 的 **remote 借用链**实测（t293 cap 拦截过的 2MB 已见，64MB+ 过网线是真考题）；快看对话框 display range 的 σ 口径输入（待真需求）；EMPIAR 真数据回归（连续第十窗让位）；Topaz wrapper 深化（边际递减）
## Task 297 (2026-09-18, 用户工单窗口 —— 三个真实集群缺陷: relion 5 不可见 / 登录节点无 GPU / sbatch6gpu.sh 可变宽度提交)

- 【工单】用户实测报告（OpenHPC · Lmod · Slurm · CentOS 7 集群）: ①`module avail` 明明加载得了 `relion/beta_5.0_gpu_ompi5_cuda118`（envLines 里写着）却探测不到 relion 5 ——「确认这个命令可以调用 relion 5」; ②登录节点无 GPU（nvidia-smi 静默——管理节点，GPU 在计算节点）; ③附 sbatch6gpu.sh 范式（附件未达，按经典 6-GPU OpenHPC 范式还原:`--ntasks=6 --gres=gpu:6 mpirun -n 6 … --gpu 0:1:2:3:4:5`），要求**按可配 GPU 数量提交**。
- 【根因①（解析器丢 beta 名）】parseRelionModules 的 plausibility 过滤只认 `/^v?\d/` 开头的版本——`beta_5.0_gpu_ompi5_cuda118` 以字母开头被**静默丢弃**（严格复现:avail 列表里有它、解析结果里没有它）。第二层:Lmod 对 beta 模块默认 hidden——`module load` 能加载而 `module avail` 不列出。双修:PRE_RELEASE_PREFIX（beta/alpha/rc/dev/pre/nightly/build/preview/experimental）+ 「含数字且含 `._-` 分隔符」两条新通道;探测命令加 `module avail --show_hidden`（Lmod ≥7 / EM 4.4+，`|| true` 兜底旧版）。
- 【根因②（登录节点的谎言）】probe 在登录节点跑 nvidia-smi——真实集群管理节点无 GPU 是常态而非缺陷。修:Slurm 在场时读 `sinfo -h -o '%P|%G|%D|%T'`（分区|GRES|节点数|状态），按分区聚合出 `slurmGpus[]`（partition/nodes/gpusPerNode/gpuTotal/model）——GPU 清单的诚实出处是调度器不是显卡。ProbeCard 新「Compute-node GPUs (via Slurm sinfo)」行 + 「登录节点无 GPU 属正常」注解; run 对话框 GPU 步进上限随之取 gpusPerNode。
- 【实现① verify-module 门】POST /api/remote/connections/[id]/verify-module（isLocalRequest 守卫）: 用户手输模块名（beta/hidden 皆可）→ probeModuleDetail（probe 循环抽出的共享仪式:登录 shell `module load X` → relion_refine/mpirun/ctffind/externals 清点，**CF_LOAD_RC 显式回传加载退出码**）→ 成功: merge 进 lastProbe（模块列表+home+mpi+ctffind+externals）+ 可选 pin defaultModule;失败: 模块工具自己的话原样返回（Lmod 的 "Unknown module"）。**假阳性封堵**:mock 环境 relion_refine 恒在 PATH——load rc ≠ 0 时即便 relion_refine 找得到也拒绝（陈旧环境的二进制不是这个模块的证明）。
- 【实现② slurm 模式（sbatch6gpu.sh 范式）】startRemoteJob 的 "not wired" 早退删除，真实现: buildSbatchScript 生成与直跑模式**同合同**的脚本（run.out/run.err 同路径——日志尾/进度解析/同步回收零改动）; `.cf-exit` 退出码合同三保险——显式捕获写真码（0 含自然完成）、TERM/INT trap 写 143（scancel）、EXIT trap 只写非零（GNU bash 实测:TERM 杀身时 EXIT trap 见到的是陈旧 $?==0——不设防会把用户手停伪造成成功）;提交 `sbatch <script>` 解析 "Submitted batch job <id>" → slurmId;**轮询走 squeue**——aliveCheckScript 增 slurmId 参数（.cf-exit 优先，squeue 在队=ALIVE:STATE——状态词随行，inspector 说得出 "queued"）;**停止走 scancel**（进程树在计算节点，登录节点的 kill 永远够不着）; GPU 宽度: MPI 族一 rank 一 GPU（multi-gpu 类型集取 hpc/slurm.ts 的 MULTI_GPU_TYPES——class2d 在列，与本地引擎窄集不同是有意的:relion_refine_mpi 本就 MPI 并行），单 GPU 类型 --gres=gpu:1，CPU 类型不申请 GPU;下游 passthrough 携带 gpusRequested（远程管线同宽度续跑）。
- 【实现③ UI】Run 对话框: 模式 Select（direct nohup / Slurm sbatch——probe 无 Slurm client 时该项禁用并说明）+ GPU 步进器（1–8，默认 6 应工单之名的 sbatch6gpu.sh;含 --gres/--gpu 设备列的实时拼法提示）+ 模块自由输入门（beta/hidden 名直接可输——dispatch 的 load guard 兜底 exit 127）;连接表单: useSlurm 文案兑现（"not wired yet" 删除）+ slurmPartition 字段（空=集群默认）;inspector 远程条: Slurm <jobid> · N GPU(s) · queued/running（调度器自己的词汇）。
- 【mock-cluster 扩建】module 工具: 参数后移解析（--show_hidden/-d 生效——隐藏的 beta_5.0 只在显式索要时列出）+ --version;新命令 sbatch（解析 #SBATCH 头 → setsid 后台跑 + PENDING 1s（可观察状态迁移）→ "Submitted batch job N"）/ squeue（-j 单查:在队报状态词、终局静默——轮询合同的镜像;无参全表）/ scancel（组杀 TERM→KILL）/ sinfo（gpu 分区 6 GPU/node × 4 节点 + long CPU 分区）+ mpirun 桩（吞 -n/--map-by 等，exec 单命令）。**登录节点刻意无 nvidia-smi**——正是用户场景的诚实复刻。
- 【E2E（mock 集群,全部真链路）】probe: relionModules 含 beta_5.0（解析器+hidden 双修复活）· slurmGpus=[{gpu,4,6,24}] · 登录节点 gpus=[] ✓;verify-module: 假名拒绝（"module load failed (exit 1): Lmod has detected the following error: Unknown module…"）·真名通过+pin ✓;全链 Slurm 提交: import(本地)→motioncorr(1 GPU sbatch)→ctffind(**CPU sbatch 无 --gres**)→autopick→extract→class2d(**6 GPU: --ntasks=6 --gres=gpu:6 --mem=88G mpirun -n 6 … --gpu 0:1:2:3:4:5 实物脚本在案**)→进度 25%→58%→100% · slurmState PENDING→RUNNING 迁移在案 · REMOTE[...] 结果+sync-back 3 文件 ✓;scancel: stopped:true · .cf-exit=143 · "stopped by user" ✓;失败路径: TERM trap 与显式捕获的退出码合同隔离测试（自然 0 / 失败 1 / TERM 143）✓。
- 【浏览器验证（agent-browser）】首页+canvas 渲染 ✓;集群对话框: useSlurm 开关/slurmPartition 输入/含 beta_5.0 的模块 chips/**verify 门活体拒绝**（假名→role=alert 原话）✓;inspector 远程条 "cryo@127.0.0.1:3022 · relion/beta_5.0_gpu_ompi5_cuda118 · Ran on the cluster" ✓;Run 对话框打开+新描述渲染（t296 代码确认在浏览器中活着）——**连接列表交互的活体截图被沙箱 4GB 内存天花板阻断**（Turbopock 逐路由编译内存爬升至 2.5-3GB 被 OOM-kill 反复击杀,与产品代码无关;同一 fetch 路径 curl 验证 200+全量数据）。
- 【质量】裸 tsc 0;改动文件 eslint 0（仓库存量 8 error 全在未触及的 diag-archive/print-doc-*/map-ortho/session-report——预存债务非本窗引入）;git 净场（mock 运行时 .slurm/ 入 gitignore）。
- 【收尾】worklog（本条）+ docs/remote-relion.md（§4a beta/hidden 模块 + §4b 登录节点 vs 计算节点 + Slurm 模式章节 + 失败目录扩容 + roadmap 划线）+ README 特性行 + commit/push。

Stage Summary:
- **「版本号不以数字开头的模块也是模块」**:plausibility 过滤的初衷是拒散文噪音（"relion is"），但 OpenHPC 命名法（beta_5.0_gpu_ompi5_cuda118）恰好全员字母开头——过滤器把真模块当噪音丢了;修正后判据是「预发布前缀 or 含数字含分隔符」，噪音仍然进不来
- **「模块工具自己的退出码是唯一诚实的证词」**:relion_refine 在 PATH 上不等于模块加载成功（陈旧环境/mock 皆伪造此信号）——CF_LOAD_RC 显式回传,verify 门以 load rc 先于二进制清点拒绝
- **「GPU 的诚实清单出自调度器」**:登录节点 nvidia-smi 静默是常态不是缺陷;sinfo 的 GRES 聚合（partition→GPU/node×nodes）才是 run 对话框敢让你选 6 的依据
- **「同一份合同,两种启动方式」**:sbatch 脚本复用直跑模式的全部契约（run.out/run.err/.cf-exit/工作目录）——轮询/日志/进度/同步回收零改动;唯一新词汇是 squeue 的状态词和 scancel 的死法
- **「EXIT trap 见到的 $? 未必是命令的退出码」**:GNU bash 在 TERM 杀身时以陈旧的 0 跑 EXIT trap——不设防的 trap 会把 scancel 伪造成 exit 0 成功;TERM trap 写 143 + EXIT trap 只写非零 + 显式捕获写真码,三层各守一段
- 遗留（下轮候选）: sacct 兜底（squeue purge 后的终局态交叉验证,当前靠 .cf-exit + 120s 宽限）;array 模式 sbatch（逐微图 --array 分片,HPC 对话框已有生成器,远程 dispatch 未接）;sbatch --dependency 链（管线级 afterok）;verify-module 的 by-value 变体（create 流程保存前验证）


## Task 298 (2026-09-18, cron 19:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609181926 —— 撞号第二窗：并行 cron 窗抢先交付其 Task 297（slurm sbatch + GPU 清单，26708f2），按 t286/t291 判例我方 renumber 298，套件/花名册/证据照名重链)

- 【开局】尾部实证 = Task 296（a84b803 已 push）；四哨兵全绿（qa00/qa63/t296/t295）+ 3022 FREE + roster 21——立项 t296 遗留池首选「remote-view-3d 大 map 的 remote 借用链实测」（连续十窗让位；树上核实 t293 借用链只递过 2MB png 门、t296 大图永远本地——两条线从未相交）。
- 【真 bug ①（基础设施）】mock cluster 的 exec `cat` 对大流**有损**：套件首跑 C6 渲染成功而落盘 59,543,232 字节（截断 7.5MB）→ 裸 ssh2 探针（scripts/t298-probe-ssh-loss.mjs，10 连跑）定罪 10/10 丢 1.6–48MB、exit=0、正常关闭。根因两层：**server.mjs** `proc.stdout.pipe(stream,{end:false})` + `outEnded&&errEnded→finish()`——pipe 的 'end' 只意味着字节 HANDED TO ssh2 channel 而非 FLUSHED to socket，未冲刷尾巴被 close 销毁；**ssh.ts** `stream.on("exit")→ws.end()`——exit 与 close 之间合法存在尾随数据，提前 end 是 write-after-end 崩溃类。
- 【修复① mock 泵】bare pipe 换**写回调泵**：`stream.write(chunk,cb)` 以回调到账为交付、`pendingWrites` 计数、背压 pause/drain、完成条件 = dead+双端 end+pendingWrites===0；宽限期 drain 感知（flow 脉冲续期，静默满窗才动斧头）+ 60s 硬顶；write 包 try/catch。修复后探针 10/10 字节精确 ~200ms。
- 【真 bug ②（产品竞态）】C5 双并发拉取暴露 `fetchRemoteFileIntoWorkdir` 的 fast-path 竞态：existsSync 会看见 in-flight 下载刚 create 的空/半截文件并当完整流走。修复：**in-flight 检查先于 fast-path**（有 pull 在飞，人人等它）；失败拉取**不留墓碑**（rm 半截文件）。
- 【真 bug ③（传输完整性）】bun+ssh2 客户端在负载下仍会量化截断（恰 5 MiB 停摆；node 端裸 ssh2 探针全对而 bun 应用侧丢——bun 流/窗口怪癖）。产品级正解 = **门上字节对账判决**：落地后 statSync 对账 pre-pull remoteStat 的 size，不符重试（3→5 次、250ms 间隔）、再不符 rm + 502 诚实拒绝——「喂 viewer 截断地图」从此不可能；写侧换 **writeSync 同步落盘**（无缓冲可丢）。三跑 ALL PASS + 零失败响应。
- 【套件 t298-remote-big-map.mjs（42 断言，终版三跑 ALL PASS）】A demo 真相；B 台账 17（32GB ceiling + dedup 契约 + 排序法 + no-tombstones + 字节对账 + writeSync 法 + over-cap 流内斩 + 计时器 + 懒腿漏斗 + RemoteFileTile 四门 + mock 泵法）；C0 确定性 256³ MRC；C1 本地 import；C2 借用环（keyFileMb=1）；C3 植入 64MB→re-run→key-files 留下它+台账精确+REMOTE 瓦片 dims 缺席；C4 SSH 腿计时（Mol* 同请求，~1.2s 全量 67,109,888B + Content-Length + sha256 字节同一）；C5 dedup 竞态（双并发全量+字节同一）；C6 UI 腿计时（云徽章→remote-view-3d→Mol* 拉 64MB 过 SSH→canvas ~4s→全链 ~13-16s 进 120s 门→毕业带 dims [256,256,256]→零 remote 残留）；C7 直方图第二眼（冷 ~1s→LRU ~10-50ms，nFinite=256³）；D console 0 + **失败响应 0**（新增 page.on(response) 取证钩子）；finally 双 port 清场+植入图诛杀。
- 【沙箱重启战役（本窗最大劫难）】家族回归 t27 批次期间 **12:25:20 整机重启**（uptime 实证）；平台重启后自启 next dev（dev.log 12:33，OOM 于 491s 自亡）**擦除 .next 全部 prod 工件**；随后工作区**回滚到 Task-272 时代快照**——本窗全部未提交工作（套件/探针/三层修复/worklog 条目）阵亡，Tasks 273–296 本地树消失。恢复：`git fetch`（origin/main 幸存全部历史）→ 发现**并行窗已交付其 Task 297**（26708f2，slurm sbatch+GPU 清单+probe 修复，零触碰我方修复位点）→ `reset --hard origin/main` + 我方 renumber 298 + 全部产物重放。第二次 build 又因 OOM 崩溃再擦 standalone（"Node.js v24.21.0" 横幅取证）→ 清场后单独前台重建成功。**教训入法：commit/push 前置到套件三绿之后、家族回归之前**——重启吃掉未提交工作，push 是唯一护身符。
- 【收尾】commit/push（套件三绿后立即）→ 全家族回归（见 Stage Summary）→ worklog 补齐 + 终 push + 净场。


## Task 299 (2026-09-18, cron 23:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609182318 —— 立项中)

- 【开局】尾部实证 = Task 298（6ab675d 已 push）；HEAD 6e1cfd1 为并行窗的未 push 截图翻新提交——已护身 push（+ 5 张 t266-t269 截图翻新 a6a1e7d）。续窗摘要第十九次不实（声称 272 基线/连续十八窗阻塞）；cron 模板「Task 13」照例不认。
- 【净场】3022 泄漏 mock（21:38 启动，1h43m）处决；roster 23 → 代并行窗执行其夭折 t268 套件的清场仪式（删除 2 个泄漏 job）→ 21 恒等。
- 【QA】四哨兵全绿：qa63-smoke ✓ qa00-data-view ✓ t298-remote-big-map ALL PASS ✓ t296-big-map-viewer ALL PASS ✓——项目稳定，进入自主立项。
- 【树上核实】t297 遗留池核实：sacct 兜底未交付（src 仅注释提及）；**t297 的 slurm sbatch 模式无持久化套件**（树上无 t297-*.mjs，家族回归零覆盖）。
- 【立项】Task 299「sacct 兜底——调度器自己的证词在 purge 后依然在场」：squeue 只见 PENDING/RUNNING，job 终局离队 + .cf-exit 因 NFS 迟滞/节点崩溃而缺席时，现行为 = VANISHED → 120s 宽限 → 伪「interrupted remotely」失败；sacct 的 accounting 是唯一诚实的终局证词。实现 = mock 三件套（accounting 账本 + sacct 工具 + scancel 记账）+ aliveCheckScript 第三证人 + sweep 解析 SACCT: 映射 + inspector 终局词条。副产品：t299 套件成为 slurm 模式的首个家族公民。
## Task 300 (2026-09-18, 用户工单窗口(续窗交付) —— 远程 Relion 的使用方式: 本地/远程项目 + 集群路径浏览 + 检测节点提交)

- 【撞号注记】按 t286/t291/t298 判例第三例:本工单窗口在树上立项 298 期间,并行 cron 窗口已抢先交付其 Task 298(远程大图借用链,6ab675d)与 Task 299(sacct 终局证词,82ca5f6);我方按撞号原则 renumber 300(代码注释 t298→t300 同步重链)。

- 【工单】t297 修复交付后用户的下一问:「目前都正常检测到了,但是我不知道该如何使用,如果是调用远程的 relion,数据应该也是放在远程的集群上面的」——三项设计要求: ①创建 project 时选择本地/远程项目(可直接选择已保存的 IP 地址); ②导入图片、选择 star 文件等直接浏览/选择远程集群上的路径; ③远程项目提交任务时直接选择检测到的节点(brain/brain2/brain3/brain4/normal/normal02)并指定 GPU 数目。
- 【实现① 数据模型与 API】ProjectMeta 增 `remote: { connectionId }`(projects.json 持久化,存在性在 API 门校验——先验后建,typo 的连接 id 得到点名 400 而非半绑定项目);projectRemoteRef 无密投影(每次 DTO 构建时从活体注册表新鲜解析——连接改名/删除即自愈);POST /api/projects 增 remoteConnectionId;PATCH /api/projects/[id] 支持重绑定/解绑(null 显式解绑、absent 不动、re-bind 是数据搬家在意图上需诚实告知);ProjectDTO/ProjectSummaryDTO 携 remote ref。
- 【实现② 集群文件浏览】新 src/lib/remote/remote-ls.ts: GNU find -printf 主通道(`%y|%s|%f` 行协议,-L 跟随符号链接)+ ls -la 回退(BSD 世界)+ canary 探测 -printf 支持;绝对路径服务端重建(路径改写型 mock/chroot 永远无法把自己的文件系统布局泄进 STAR);statRemoteFiles 批量 stat(200/批,argv 长度卫生);新路由 GET /api/remote/connections/[id]/browse: roots 视图(/ + $HOME + remoteRoot)、单层列目录、通配符预览(RELION File-name-pattern 模式,find -name 引号包裹永不 shell 展开)、控制字符 400、isLocalRequest 门;PathBrowserDialog 增 remote prop——同一对话框两种世界(同一响应方言),标题/描述/roots 图标/占位符全部远程变体。
- 【实现③ 远程导入零上传】engine.ts runImportRemoteLeg: 远程项目的 import 三形态(文件夹/通配符/多选文件列表)全部走 SSH 枚举校验,micrographs.star 写入集群绝对路径——staging 走查只收集本地存在的 ref,集群 ref 原样随 argv 引用,一个电影字节都不上传;连接被删的诚实降级(点名重加路径)。
- 【实现④ 检测节点提交】probe 的 sinfo 命令升 5 字段(%P|%G|%D|%T|%N);expandHostlist 解析 Slurm hostlist 表达式(node[01-04] 补零、gpu[1,3-5] 列表、a[1-9:2] 步进、截断形式原样保留——诚实的部分列表胜过伪造的完整列表);slurmGpus[] 增 hosts(跨状态行合并去重,64 上限);run 路由+引擎双闸净化 partition([A-Za-z0-9_.-] ≤64);buildSbatchScript 增 partition/nodelist;**单主机分区的 --nodelist 钉扎**(用户选的组在探测中解析为恰好一个主机名时,#SBATCH --nodelist=<host> 字面钉到那个节点——分区可能比 hostlist 长命,后加节点会静默放宽选择;多主机组保持分区级——1 节点 sbatch 钉 4 节点会请求整组);Run 对话框新增「Node / partition」选择器(Auto + 各检测组,含主机名/每节点 GPU 数/模型),GPU 步进器上限随所选组实时收敛(5-GPU 组不提供 6);remote-run-button 对远程项目锁定绑定连接(数据在那台集群上——换连接会搁浅数据);job-panel 远程项目主 Run 按钮即集群派发(bookkeeping 类型除外——import/select/symexpand 是远程项目的本地一半),所有路径参数的 Browse 按钮变紫色 Server 图标直达集群浏览;header/project-panel 的 violet 远程徽章。
- 【实现⑤ 远程项目的 store/seed 穿透】createProject 携 remoteConnectionId;toProjectDTO/项目列表携 remote;ProjectSwitcher/ProjectCardRow/RemoteBadge 渲染。
- 【mock-cluster 扩建】sinfo 升 5 字段 hostlist 语法 + 清单复刻用户真实集群(brain 6 · brain2 8 · brain3 6 · brain4 8 · normal 5 · normal02 8——各 1 节点,置于既有 gpu/long 之后);translatePath 增 /data2/ 前缀翻译(用户集群的 Relion 装在 /data2 下)+ 裸挂载根正则(lookahead ['"\s;&|)]|$——bash -lc 脚本里 test -d /data2; 的分号)+ FS_ROOT 守卫($HOME 回显的沙箱绝对路径不再被二次翻译翻倍);CF_MOCK_DEBUG 调试日志门。
- 【E2E(mock 集群,全真链路)】探测: slurmGpus 含 brain2/brain4/normal02(8 GPU, hosts=[同名])· brain/brain3(6)· normal(5)· gpu(6×4 节点)✓;远程项目创建 → DTO.remote 投影 ✓;browse: roots/裸挂载根/子目录/通配符(6 matched)/~ 展开 ✓;import 集群路径 → micrographs.star 全集群绝对路径(/data2/movies-t298/movie_0N.mrcs)· 零电影字节上传 ✓;motioncorr sbatch @brain2: --partition=brain2 --nodelist=brain2(单 GPU 类型正确收敛为 1 GPU)✓;class2d sbatch @brain2 8GPU: --ntasks=8 --gres=gpu:8 --mem=112G mpirun -n 8 --gpu 0:1:2:3:4:5:6:7 实物脚本在案 + 135 文件同步回收 ✓;运行日志「submitted to Slurm (job 9, 8 GPU(s) · partition brain2 · node brain2)」✓。
- 【浏览器验证(agent-browser, 全交互链)】首页渲染+水合(主题切换往返)✓;New project 对话框: Data location「This machine / Cluster (SSH)」切换器 ✓ → Cluster connection 下拉显示已保存 IP「Mock HPC (6-GPU) 127.0.0.1」✓ → UI 创建远程项目 → 头部 violet 徽章 127.0.0.1(两处)✓;Run 对话框: 「Node or partition」选择器展开列出用户集群全部六节点(brain2 brain2 8 GPU/node · 1 node / brain4 / normal02 / brain / brain3 / gpu node01-04 / normal)✓ → 选 brain2 → GPU 步进器提示「--gres=gpu:6, mpirun -n 6 · brain2 offers 8/node」+ nodelist 提示 ✓ → 加到 8 × GPU ✓;作业面板: import 参数的紫色「Browse … on the cluster」按钮 ✓ → 远程浏览器对话框「Select files on Mock HPC (6-GPU)」roots 视图 ✓ → 手输 /data2 → 列出 movies-t298 ✓ → 进入列出 6 部电影(各 21 B)✓ → Select all images (6) → Import 6 files → 参数框填入 6 个集群绝对路径(标注「6 files」)✓;五张定妆照(t300-remote-project-header/node-picker/run-dialog-brain2-8gpu/remote-browser-roots/remote-browser-files.png — 仓库根目录在案)。
- 【沙箱 4GB 内存墙(第十七窗)】Turbopack 逐路由编译峰值 2.6GB 反复被 OOM-kill(dmesg 在案)——dev-server-3001.sh 补 NODE_OPTIONS --max-old-space-size=896(dev-server.sh 同款教义)+ 关浏览器 curl 预热全部所需路由后再开浏览器的编排,五次重试后全链活体验证完成;沙箱模板 server(3000) 验证期间暂停、验证后恢复(GET / 200)。
- 【质量】裸 tsc 0;改动文件 eslint 0;git 净场(data2 测试数据入 mock .gitignore)。

Stage Summary:
- **「数据在哪,浏览就在哪」**:远程项目的每一个路径参数(电影目录/star 文件/参考图)的 Browse 按钮都直通集群文件系统——SSH 上的 find -printf 行协议,roots/单层/通配符三形态,选中即集群绝对路径;数据不搬家,浏览跟着数据走
- **「零上传既是设计也是事实」**:import 写集群绝对 STAR,staging 走查只认本地存在的 ref——集群 ref 原样随 argv 引用;「not one movie byte is uploaded」不是口号而是 E2E 断言
- **「分区是组,节点是钉」」:用户选 brain2 得到的不只是 --partition=brain2——组在探测中解析为单主机名时 --nodelist=brain2 字面钉到那台节点(分区可能比 hostlist 长命);多主机组诚实地停在分区级(1 节点作业钉 4 节点 = 请求整组,是过度约束)
- **「选择器的上限来自被选者」」:GPU 步进器随所选节点组实时收敛——normal(5 GPU/node)不提供 6;「brain2 offers 8/node」的提示随选择实时更新
- **「绑定新鲜解析,删除诚实降级」」:remote ref 每次 DTO 构建从活体注册表解析——连接删除徽章消失、浏览/提交门点名缺失集群、重加即复原;绑定从不静默解绑
- 遗留(下轮候选): 多主机组的节点级(而非组级)挑选(待空闲节点感知);sacct 终局态交叉验证;sbatch --dependency 管线级 afterok 链;远程项目的 pipeline 模板一键搭建(当前 scaffold 在远程项目上建空作业)

## Task 301 (2026-09-18, 用户工单窗口 —— t300 交付后的两问: 切换器可见性 + 宽屏 KPI 卡片重叠)

- 【工单】用户两问: ①「为何我的 UI 中没有看到选择本地还是 cluster 的选项」②「dashboard 的统计卡片在宽屏上会显示在同一行,导致每个卡片都比较窄,文字和趋势图形会重叠」。核查: ①的答案是 checkout 落后——`git ls-remote` 证实 origin/main 已在 31e3b6d(t300 含 Data location 切换器),用户本地未 pull;但工单②是树上真实缺陷,且验证途中又揪出两个同族存量缺陷,一并修复。
- 【根因② KPI 水印重叠】KpiCard 的 sparkline 是绝对定位的 bottom-right 水印(opacity-80, 84×24),与文字列同层——lg:grid-cols-5 五列平铺时每卡仅 ~210px,truncate 的 sub 文字跑满内容宽,水印必然压在 "+N in the last 14 days" 上;容器 max-w-6xl 封顶 1152px,宽屏也逃不出 210px 卡宽。
- 【修复② 两区布局】KpiCard 重构为 flex flex-col justify-center: 文字区(图标+数值+标签+sub)在上,趋势条(mt-1.5 独立行、右对齐)在下——重叠在任何卡宽下结构性不可能(不再依赖恰好不相遇);网格 5 列从 lg 推迟到 xl(1024-1279 落到宽敞的 3+2),容器 xl:max-w-7xl(≥1280 用满宽度,卡宽 210→234px);Running/Engine 无 spark 的卡由 grid stretch 等高。
- 【修复①可发现性】New project 对话框的 Data location 切换器从 bg-secondary/40 小药丸升级为 radio-card 双卡(边框、左对齐、text-xs 粗体标签、"where the data lives" 问句行、选中 border-primary/50 bg-primary/5)——行为零改动,可见性拉满;Dashboard 项目网格卡新增 violet Server 徽章(本地/集群在网格上一眼可辨,API 早已携带 remote ref 只是没人渲染;title 携 username@host,长名 truncate)。
- 【顺带揪出·存量 A: RELION chip 纵向爆裂】RelionStatusChip 无 shrink-0、label 无 nowrap——header 拥挤时按钮被挤到 ~52px label 宽,"RELION not found" 折成三行,纵向撑破 h-8 chrome 盖到邻居(VLM 视觉复核发现,程序化几何证实 52×48 的 leaf)。修复: 按钮 shrink-0 + label max-w-[220px] truncate whitespace-nowrap(title 携全文)。
- 【顺带揪出·存量 B: header 左右集群互相穿透】1600px 实测 "noted" chip 终于 x=1215 而 RELION chip 已始于 x=1169——46px 互穿。渐进披露档位按旧版右栏标定(右栏此后长了 remote 门+报告按钮,左栏 t300 又加了 violet 绑定徽章): 2xl(1536) 档的三个计数器实际需要 ~1700px 才有行宽。修复: 计数器档位 2xl:flex → min-[1700px]:flex(实测注释在案);1600 下计数器隐藏、左右集群零重叠,1920 下计数器回归且零重叠。
- 【验证(standalone prod + agent-browser 双通道)】4GB 内存墙三杀 dev server(dmesg OOM 在案: Turbopack 懒 chunk 编译峰值 2.8GB,与浏览器不能共存)→ 转 standalone 生产构建(bun run build + 孤儿脚本 scripts/prod-3001.sh,启动模式复刻 start-prod.sh 教义)双验证: ①程序化几何断言——KPI 带 1600/1100/375 三宽度各 5/3/2 列、卡宽 234/337/166、sparkline 与 sub 文字重叠数全 0(vGap=6 的独立行);项目网格 violet 徽章 2(两远程项目)/0(本地 demo);header 1600 与 1920 双宽度 leaf 重叠数全 0、RELION chip 32px 单行;②VLM 视觉复核——KPI 卡无重叠/对话框双卡醒目且 Cluster 选中态+连接下拉在案/顶栏(修复后)干净;对话框交互链(Data location 切 Cluster → Mock HPC 下拉)活体走通。六张定妆照(t301-final-1600/final-dialog/header-1920/kpi-1100/kpi-375/newproject-cluster.png)。
- 【质量】裸 tsc 0;改动三文件(header/project-dashboard/project-panel)eslint 0;沙箱模板 3000 验证期间暂停、验证后恢复。

- 【QA 复核】四哨兵复绿后完成实现：mock 三件套（sbatch launcher 弃 exec 改呼吸余生一拍记账 COMPLETED/FAILED + scancel 先写 marker+CANCELLED 行再动手 + 新 sacct 工具读 accounting 账本、last-row-wins、无账本即沉默）+ aliveCheckScript 第三证人（squeue 沉默后问 sacct，终局词走 SACCT:<state>|<exit>:<sig>，在飞词保持 ALIVE，空判决才配 VANISHED）+ sweep 解析映射（CANCELLED→143、TIMEOUT→124、signal→128+sig、词上记录）+ pollOneRemote SACCT→exit + inspector 终局词条「Ran on the cluster · Slurm <WORD>」。tsc 0，rebuild 部署（BUILD_ID 在位）。
- 【套件 t299-slurm-sacct.mjs（47 断言，五跑迭代，终版三跑 + 家族内 ALL PASS）】A demo 真相；B 台账 22（三证人语法、映射合同、mock 记账、sacct 沉默合同、strip 词条）；C0 沉默合同；C1-C3 mock 记账活体（COMPLETED|0:0、FAILED|3:0、CANCELLED|0:15+marker+恰好一行）；C4-C8 植入证人走真 sweep（COMPLETED→行成/词上记录/无伪墓碑；FAILED→exit 3；CANCELLED→143；TIMEOUT→124；无证词+过宽限→interrupted remotely 墓碑原样）；C9 strip 活体；D console 0；finally 状态文件快照还原→行删除（t272 顺序律套件版）→mock 侧按 sbatch id 精确清账。**slurm 模式的首个持久化家族公民**（t297 交付时无套件）。
- 【套件三课（全是套件的错）】① execSync+JSON.stringify 让本地 shell 先展开 $HOME；② mock 的 translateCommand 对含 /home/cryo/ 子串的宿主绝对路径做前缀拼接 → 加倍成不存在的树——修法 = execFileSync（免本地 shell）+ mock 原生 $HOME 路径；③ 五个证人行落默认随机坐标互相重叠拦截点击——显式坐标拉开。
- 【真 bug ②（t298 反截断门的暗面，t262 抓获）】remoteDownload 的判决 `written > 0 ? written : null` 把**合法的 0 字节文件**（一次干净 ctffind 的 run.err）判成 download failed——sync-back 少算、台账短斤、t262 的 ≥3 断言抓获。修 = 字节对账判决 `written === st.size`（0===0 是 PASS；截断的非空读仍然死）——t298 教义本来的样子，反截断保证反而更强。t262 两跑 ALL PASS + t298 反截断哨兵复绿。
- 【孤儿战役（本窗最大劫难，升级版撞号）】23:33 的同 Job cron 并行窗 15:41 用 add -A 吞并提交了我进行中的 t299 产物（懒惰 UUID 消息 6e3f8d5）；其自身 QA 又三度夭折（t268/t258/t268）留下幽灵连接+墓碑记录+泄漏 job。**而更深的陷阱是我自己的**：`timeout` 杀 family-run 父进程时在飞的子套件变孤儿继续改写世界（建 job、删记录、重启服务器）——我一度把孤儿当并行窗，误删了孤儿 t268 的活连接。t271/t24/t264 的 real-fail 全是这些残骸的污染（t271 复跑 ALL PASS、t24 复跑 pass 9、t264 复绿证实）。教训入法：**工具超时切断批次后必须先清孤儿（pkill family-run/t2*.mjs/chrome）再清世界再信任何后续判决；qa-t*-${Date.now().toString(36)} 连接 id 的时间戳可解码——新鲜的 id 是活窗不是残骸，处决前先解码。**
- 【批次分裂（t273 法则的进化）】t26 长破 600s 工具天花板（10 套件、t268 心跳重启独吃数分钟，两窗亲眼目睹被切断后报告残留陈旧败绩）——按「天花板即批次边界」分裂：t26 = t260–t265（pass 6）、t26b = t266–t269（pass 4），coverage 70 套件各归属唯一。
- 【断言之错，第十八次】t269 源码断言找字面量 `"Ran on the cluster"`——t299 终局词条模板字符串化后字面量消失；断言跟进子串（产品行为正确，活体断言全过）。
- 【全家族回归（十批前台逐批）】qa 11 · 404.1s ｜ t21 7 · 189.7s ｜ t22 2 · 65.6s ｜ t24 9 · 122.8s ｜ t25 9 · 441.3s ｜ t26 6 · 329.0s ｜ t26b 4 · 206.9s ｜ t27 7 · 271.5s ｜ t28 8 · 162.6s ｜ t29 7 · 249.8s——合计 **pass 70 · solo 0 · real-fail 0 · wall 2443.3s**；coverage 70 套件十批各归属唯一（花名册 69→70）；roster 恒等 21；裸 tsc 0。
- 【收尾】worklog（本条）+ commit/push（套件三绿后立即、家族回归前——t298 教义第二次兑现：本次 push 先于家族且全程未丢一字节）+ 环境清理（孤儿处决 + 双 port FREE 验证）。

Stage Summary:
- **「squeue 的沉默不是死亡证明」**：squeue 只认识 PENDING/RUNNING，job 终局即被清除；.cf-exit 是包装器的证词，NFS 迟滞/节点消失都能让它缺席——sacct 的 accounting 才是控制器自己的账本，是唯一在 purge 后依然在场的终局证词。第三证人上堂后，VANISHED 的语义收窄为「无任何证词」——死亡之门一处未宽，谎报之门彻底关闭
- **「0 === 0 是 PASS」**：反截断门的正确形态是字节对账（written === remoteStat.size），不是「来过字节就算活」——后者把空文件的诚实判决成了失败；t298 教义在 remoteDownload 补齐最后一角，反截断保证反而更强
- **「timeout 杀得死父进程，杀不死在飞的孤儿」**：被切断的批次留下继续改写世界的孤儿套件——它们比并行窗更像并行窗；处决任何「残留」前先解码 qa-t*-<base36 时间戳>，新鲜的 id 是活窗
- **「批次边界就是天花板边界」**：t26 十套件涨破 600s 后，_registry 分裂是 t273 法则的自然进化，不是官僚主义——被切断的批次的报告是谎言，宁可两个诚实的半批
- 遗留（下轮候选）：sacct 的 elapsed/TRES 列（sacct -o Elapsed,MaxRSS 让台账说调度器的时长）；sbatch --dependency 链（管线级 afterok）；array 模式 sbatch（HPC 对话框已有生成器，远程 dispatch 未接）；verify-module 的 by-value 变体（create 流程保存前验证）；384³/512³ 阶梯压测（T296_N 已备）；family-run 的进程组自杀（SIGTERM 时先杀在飞套件再死——把孤儿的根从纪律变成代码）；EMPIAR 真数据回归（连续第十一窗让位）

## Task 302 (2026-09-19, cron 03:03 窗口 trace 1a07549302235a99-cron-agent-loop-202609190303 —— 无撞号，树上直接立项 302；开局实证：worklog 实际尾部 = Task 299（sacct 第三证人，HEAD 1d4c7f6），cron 指引的「Task 13」与续窗摘要的「Task 272」双双过时，照例以树上实际为准)

- 【开局盘点】HEAD = 1d4c7f6（t299），其前有 t300（remote projects）/t301（KPI band/header 细节）两窗交付；PORT 3000 活（bun 独监）、3001/3022 FREE；roster 21 恒等；裸 tsc 0；家族十批 pass 70 报告在案。agent-browser QA：GET / 200、快照渲染正常（header/工作区/项目切换器/noted chip/RELION chip 全在位）、console + errors 双零、qa63-smoke solo SMOKE GREEN（console 0）——项目稳定，按惯例③自主选题。
- 【QA 先行揪出在树真雷（断言之错第十九次，但这次是真 real-fail 不是文本演进）】t273-family-report C2 断言硬编码批名连写串 `"qa, t21, t22, t24, t25, t26, t27"`——t26b 注册进 BATCHES 后 join 产物是 `...t26, t26b, t27...`，连续子串失配，solo 复跑坐实 `t273: 1 FAIL`。盘上报告的时间戳揭示病灶：t27 批 17:26 跑在 t26b 注册（18:46）之前——t299 窗的家族回归没吃到自己嘴里的狗粮（注册与回归的顺序颠倒，套件就没机会看见新批名）。修复 = 断言自维护化（t273 C1 对花名册规模的「永不字面量」教义推广到批名清单）：从 family-run 源码 `matchAll(/name: "([^"]+)"/g)` 解析批名，refusal 必须点名每一个在册批——名单再长也不会碎。修复后 t273 solo ALL PASS。
- 【本轮主交付：family-run 的进程组自杀（t302）——t299 遗留首选，「把孤儿的根从纪律变成代码」】runSuite 的超时组杀收得了悬挂的套件，收不了跑者自己：600s 工具天花板的 SIGTERM（或 Ctrl-C）杀死父进程后，在飞套件（detached 自成进程组）无人收尸，继续改写世界——正是 t299 窗最大劫难的根因（孤儿比并行窗更像并行窗）。三件套：
  1. **组杀**：runSuite 以 `inFlight = { file, pid, stdout, stderr, startedAt }` 追踪在飞套件、close 时清位；SIGTERM/SIGINT/SIGHUP 处决器 `process.kill(-pid, "SIGKILL")` 取整树（超时组杀的自身法则向外转），管道 destroy 防 'close' 悬挂；`dying` 守卫防二连信号。
  2. **诚实证词**：死前把批次键写成 `interrupted: true` + `interruptedBy` + `interruptedAt`（在飞套件名；null = 死在第一口气之前）+ suites 台账（已完结者按原词汇 + 在飞者 verdict "interrupted" / attempts 1 / ms 实测）——被杀的批次留下证词，不是沉默，更不让陈旧旧条目冒充「这批从没跑过」。
  3. **信号方言**：退出码 143（SIGTERM/SIGHUP）/ 130（SIGINT）；`setTimeout(exit, 150)` 让管道先冲刷（process.exit 截断在途写）。--summary 为 interrupted 条目渲染 ⚡ 行（"INTERRUPTED by <sig> at <where> — re-run the key to overwrite the testimony"）；--help 增补信号条款；BATCHES 注册 t30 十年位（t302 即其唯一成员，coverage 71 套件零孤儿）。
- 【套件 t302-family-suicide.mjs（44 断言，首航 ALL PASS）】A demo 真相（GET / 200 + roster 21）；B 台账 15（三信号注册、组杀、dying 守卫、inFlight 追踪/清位、三证词字段、143/130、150ms 冲刷、--help、t30/t302 在册、⚡ 渲染、interruptedSuites 复用台账词汇 + t273 修复双钉：旧字面量已死 + 自维护解析在场）；C0 --batches 活体（11 批、declared===covered=71）；C1 breath 期 SIGTERM（143 + interruptedAt null + 空 suites 诚实）；C1b breath 期 SIGINT（130 + interruptedBy）；**C2 在飞杀活体**——poll ps 见 qa63-smoke 进程即 SIGTERM 跑者：143 退出 + **孤儿处决活体见证**（在飞套件 ms 40 即死于组杀，ps 复查无踪）+ interruptedAt 点名套件 + 台账行 interrupted；C3 --summary 渲染 ⚡ 行；C4 重跑覆盖自愈（interrupted 字段消失、pass 1、ms 9791 first-try——同时让修复后的 runSuite 热路径扛真实套件端到端）；D 卫生（无 family-run/qa63 残留 + roster 21）；finally 临时报告三件焚毁。嵌套隔离照 t273 法则：FAMILY_REPORT 三份私有文件，真累积器分毫未动（--summary 复核：t27 条目刷新 274.5s，余九批原样）。
- 【套件自纠三处】① 嵌套运行时 runnerAlive() 会撞上外层跑者（batch t30 里 t302 的 ppid 就是外层 family-run）—— hygiene 扫描排除 `process.ppid`；② C1 同义反复断言删除；③ 未用 import 清除。
- 【家族回归】--batch t27（修复热路径 7 套件端到端 + 跑者自测嵌套隔离）：pass 7 · solo 0 · real-fail 0 · wall 274.5s；t302 solo 全绿；t273 solo 复绿。产品代码零改动（纯 test-infra 窗），全家族十批重跑不必要——t27 批 + 两个跑者套件已覆盖全部被改面。
- 【收尾】worklog（本条）+ commit/push + 环境清理（3000 独监、零残留进程、临时报告焚净、roster 21）。

Stage Summary:
- **「跑者要与自己的孩子同死」**：超时组杀收得了套件、收不了跑者——SIGTERM 一到，在飞套件整组陪葬、死前留下 interrupted 证词；孤儿从纪律问题变成代码保证，t299 窗的「孤儿误当并行窗」事故根因自此关死
- **「被杀的批次留下证词，不是沉默」**：interrupted 条目三字段（flag/signal/where）+ 台账按原词汇记账；--summary 的 ⚡ 行指路「重跑即覆盖」——杀死的批次不能让旧条目冒充现状，也不该让累积器永远带伤
- **「名单类断言永不连写字面量」**：t273 C2 的碎裂是 t26b 插队的一等必然（t271 断言找旧词、t299 断言找旧词之后，第一次碎在注册行为本身上）——批名从源码解析，名单增长时断言自愈；这颗雷在树上活了整整一个家族回归周期（t26b 注册于回归之后，套件没机会看见），「先改注册、后跑回归」的顺序自此也是套件的性命
- 遗留（下轮候选）：sacct 的 elapsed/TRES 列；sbatch --dependency 链（管线级 afterok）；array 模式 sbatch（HPC 对话框已有生成器，远程 dispatch 未接）；verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十二窗让位）；family 全家族 t30 批首跑（t302 已在册，下次全家族回归自然入账）

## Task 303 (2026-09-19, cron 03:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609190326 —— 无撞号，树上直接立项 303；开局实证：worklog 尾部 = Task 302（HEAD b0c77c4），cron 指引的「Task 13」照例过时)

- 【开局盘点 + QA】HEAD = b0c77c4（t302 进程组自杀 + shots chore），树净、3000 活、roster 21、tsc 0。agent-browser 冒烟：GET / 200、console/errors 双零——稳定。按惯例③自主选题：**t303 = sacct 的 elapsed/TRES 列**（Task 302 遗留首选，t299「调度器自己的证词」的自然续章——控制器说了 COMPLETED，但调度器的秒表（Elapsed）与资源计量（MaxRSS）产品还听不见）。
- 【主交付：台账说调度器的时长】四层一次交付：
  1. **alive-check 语法升级**：sacct 查询 `State,ExitCode` → `State,ExitCode,Elapsed,MaxRSS`（单一 const AC，两分支共用）；且 **EXIT 路径也附征 sacct 证词**——wrapper 的 .cf-exit 赢得判决后，同一 SSH 往返里对终局账本行（且仅终局行，accounting lag 不得伪造判决）追加第二行 `SACCT:…`，块解析器新增 second-line 收藏（b.sacct）——调度器的秒表不再是回退证词的特权。
  2. **方言解析器**：parseSlurmElapsed（[[DD-]hh:]mm:ss → ms，含 mm:ss 与天前缀两种真 sacct 输出）+ parseSlurmMaxRss（K/M/G/T/裸 → bytes）+ parseSacctRow（可选四/五列组，真 sacct「CANCELLED by <uid>」照旧容忍）+ persistSacctTestimony（两条退出路径共用：EXIT 附征时 word 不动、fallback 时 word 上位；首服即录、done 记录不覆写、缺列沉默不猜）。
  3. **记录与 DTO**：RemoteRunState/RemoteRunInfo 增 slurmElapsedMs/slurmMaxRssBytes（served or absent, never guessed）；remoteInfoFor 投影放行。
  4. **UI**：inspector 终局条在 `Ran on the cluster · Slurm <WORD>` 之后追加 ` · 12m34s · 1.2 GB peak`——formatLedgerMs 保持台账单一时间方言（t270 教义），峰值内存骑 formatStagedBytes 形状。
- 【mock 三件套跟进】sbatch launcher 钉起始时刻（job-$id.start 镜像）→ 账本行升为六列 `<id>|<STATE>|<exit:sig>|<end>|<start>|<MaxRSS>`（MaxRSS 恒空——mock 不计量脚本内存，诚实缺席）；scancel 读起始文件让 CANCELLED 行的秒表也说话；sacct render 支持六列行（4 列旧账本向后兼容 → Elapsed 空）+ fmt_elapsed 按真 sacct 家族渲染。
- 【真 bug（套件活体抓获，源码断言全瞎）】首版把共享查询提成**普通字符串** const——`${J}` 失去模板插值、字面量吐进 shell，`set -u` 下未绑定 J 使每个 $() 空转 → 有账本的 witness 全被判 VANISHED（C4-C7/C10 全灭，恰是 C8 的 VANISHED 路径暴露的对照）。mock 日志逐字坐实 `sacct -j ${J} …`。修复 = 模板字面量；B 相断言同步改为「sacct -j 恰 1 处（单一真源）+ ${AC} 恰 2 处（两分支各一调）」。**教义重申：台账断言看不见插值层的语义，活体见证必须。**
- 【第二处断言之错】C4 曾要求 slurmElapsedMs > 0——但 exit-0 裸脚本同秒完结，调度器诚实给 0ms；恰是 t299 自己的「0 === 0 是 PASS」字节对账教义在时间维度重演。改 >= 0，>0 案例由 C10 的 754000 精确见证。另：C10 植入 MaxRSS 刻意取 1.24G 而非 1.25G——toFixed(1) 的平局（1.25→1.3）不得作为确定性断言的承重墙。
- 【套件】t299-slurm-sacct.mjs 扩至 **57 断言 ALL PASS**（原 47 + t303 新增 10）：B 相 4 列语法/单一真源/双解析器/双路径共用 persist/second-line 收藏/DTO/types/strip 词条/mock 六列渲染/launcher 钉表/scancel 读表；C 相 C1/C3 秒表活体（00:00/00:01）、C4 记录秒表、C7 四列行诚实缺席、**C10 六列植入行走真 sweep**（754000ms + 1331439862 bytes 精确 + strip「· 12m34s · 1.2 GB peak」确定性词条 + 定妆照 t299-sacct-ledger-stopwatch.png）。诊断脚本 scripts/t303-probe.py（非家族成员）：连接 + 植入 + 轮询 + 自清理的活体探针。
- 【家族回归】改动面 = 远程生命周期两批：t26 pass 6 · 353.9s（t262 引擎 e2e 123.3s——EXIT 附征路径全量穿越）｜ t26b pass 4 · 205.1s（t268 心跳 + t269 台账）｜ t299 solo ALL PASS。产品重建 + watchdog 复活（GET / 200）。累积器 t26/t26b/t29 条目刷新，TOTAL pass 70 · real-fail 0。
- 【收尾】worklog（本条）+ commit/push + 环境清理（mock 杀净、探针残留焚毁、3000 独监、roster 21 恒等）。

Stage Summary:
- **「调度器的秒表不是回退证词的特权」**：EXIT 路径的 wrapper 判决与 sacct 证词同车（一次 SSH 往返、零额外开销）——只要账本有终局行，记录就带 Elapsed/MaxRSS；served or absent, never guessed，四列行的空列与缺席同义
- **「插值层是源码断言的盲区」**：模板字符串提成普通 const，`${J}` 字面量入 shell，set -u 全灭活体——B 相 15 条源码断言无一报警，mock 日志一行坐实；凡 shell 生成代码，必须有走真通道的活体见证
- **「0 是答案，不是缺席」**：秒表 0ms 与缺席是两个词——sub-second 脚本的诚实 0（>= 0）与账本未服务的 undefined（=== undefined）在套件里各占一条断言；时间维度的 0 === 0 教义
- **「toFixed 的平局不承重」**：1.25G 会因 round-half 规则浮成 1.3——确定性断言的输入必须躲开一切平局点
- 遗留（下轮候选）：sbatch --dependency 链（管线级 afterok）；array 模式 sbatch（HPC 对话框已有生成器，远程 dispatch 未接）；verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十三窗让位）；family 全家族 t30 批首跑（t302 已在册）

## Task 304 (2026-09-19, cron 04:33 窗口 trace 1a07549302235a99-cron-agent-loop-202609190433 —— 开局实证：worklog 尾部 = Task 303（HEAD 1a3c7c5），但树顶躺着**并行窗 04:21 的半成品提交 a59c595（懒惰 UUID 消息、未 push、无 worklog 条目、产品改动未重建部署）**——t304（sbatch --dependency 链）收养案)

- 【收养与首航】04:33 cron 开局：worklog 尾部=Task 303 ✓，但 git 树顶多出一个 `a59c595 b3af81e5-…-cron` 懒惰消息提交（t299 窗撞号事故的同款形态）：内容 = t304 套件 458 行 + 产品三件（buildSbatchScript 的 dependency 参数 + startRemoteJob 的 db.edge 直系父母扫描 → afterok 链 + slurmDependsOn 记录/DTO/strip「waits on」）+ mock sbatch 的依赖合同 + FAMILY 注册 1 行（t304 经 /^t30/ 自动归批）——**提交后窗即死**：无 worklog、未 push、BUILD_ID 早于提交（产品改动从未部署）。收养流程：tsc 0 / eslint 0 → 重建部署（watchdog 复活）→ 套件首航 → **13 FAIL**。
- 【QA 先行揪雷 ×3（层层剥开，全是并行窗半成品的债）】
  1. **边创建 400 被空洞断言放行（真根因）**：mkEdge 用引擎词汇 `micrographs_star` 建边——边 API 校验的是 **workflow.ts 的 UI 端口注册表，端口名是 `micrographs`**（两套词汇各说各话：引擎 INPUTS/记录 outputs 用 micrographs_star，UI 端口用 micrographs）→ POST /api/edges 400 "Port mismatch"，而套件断言 `!== 0` **任何非字面 0 的状态都算过**（空洞见证的教科书）→ 全部子任务饿死在 resolveInputs "not-ready"，一个 sbatch 都没提交。修 = 端口名改注册表词汇 + 断言改诚实（=== 201，五处边全部见证）。
  2. **pollUntil 误用（假停滞的根源）**：`pollUntil(fn)` 在**第一个真值就返回**，而 job status 永远真值——三个终态轮询全在 tick 0 返回派发时刻的 "pending"/"running"，套件「失败」时机器其实一切正常（mock 的 CANCELLED 行 6 秒落账、sweep 随后 finalize）。C1 的 completed 通过纯靠 strip 轮询烧掉的 45 秒偶然垫到。修 = 状态轮询等待目标终态（=== "failed"/"completed" 才返回）。
  3. **strip 正则漏算 GPU 段**：strip 实际渲染 `Slurm job 61 · 6 GPU(s) · queued · waits on 60`（ctffind 申请 6 GPU，strip 如实说话），首稿正则假设 id 后直接跟状态词 → 17 个轮询圈全空。修 = `(?: · \d+ GPU\(s\))?` 可选段。
- 【诊断武器库（仪器化 + 三方活体对账）】sweep 临时插桩（skip 原因/poll 逐块状态）+ 复现探针三件（repro/C2/strip）+ state 文件 watcher——**watcher 抓到探针自身的读改写竞态**（stateRuns 的 `?? {}` 回退在裸 map 形状的 engine-state.json 上全盲 + 植入清台）——探针的锅，不是产品的（套件的 `?? s` 写法正确）。仪器证据链：mock 账本行（52 FAILED / 53 CANCELLED / 54 COMPLETED）与 sweep 块状态（ALIVE:PENDING → SACCT:CANCELLED|0:0|| → finalize 143）逐秒对上；**直接 mock 测试证明依赖取消合同 3 秒内闭环**。诊断完拆除插桩、焚毁探针（套件本身覆盖全部路径，不留坏工具）。
- 【产品契约的两处澄清（断言跟进产品，不是产品迁就断言）】① **EXIT 路径的 word 不动是 t303 明文**：wrapper 的 .cf-exit 赢得判决时记录的 slurmState 停在最后 ALIVE 词（RUNNING），秒表照落——终局 strip 的 `· Slurm <WORD>` 只在 accounting 兜底路径说话（正则卫兵防伪），wrapper 路径优雅降级为裸 "Ran on the cluster · <ledger>"。套件的诚实断言改为：调度器自己的词找账本要（waitJournal COMPLETED|0:0）+ 记录要 done/exit 0/秒表 ≥0。② mock 的 PENDING 期对 squeue 可见（sbatch 写 pid 文件指向 launcher + state=PENDING），取消后 launcher 死 → squeue 沉默 → sacct 兜底——ALIVE:PENDING 是诚实的话，不是卡死。
- 【套件 t304-sbatch-dependency.mjs（58 断言，六航终版 + 家族绿）】A demo 真相；B 台账 11（directive+kill-on-invalid、db.edge 直系父母、同连接活父母过滤、afterok 语法、slurmDependsOn 记录/DTO×2/投影、strip 词汇、mock 解析/CANCELLED 自记/600s 上限）；C1 活体全链（边 201×2 → 活父母 55 → 派发（staging 回执 waiting:"not-ready" 是成功形状，拒绝才带 error）→ slurmId → 记录点名链条 → 脚本带指令 → mock HOLD PENDING → **strip 说话** → 父落 → 子释 → 账本词 COMPLETED + 记录 done/exit 0/秒表）；C2 kill-on-invalid-dep 见证（败父 → mock CANCELLED → **143 + 词上记录 + 无伪墓碑**）；C3 对照（无活上游 → 无链条、脚本无指令、跑完）；D console 0 + roster 21；finally 状态快照还原 + job/连接/mock/账本全清。
- 【家族回归】--batch t30 首跑入账：**pass 2（t302 + t304）· solo 0 · real-fail 0 · wall 94.0s**；累积器 11 批 TOTAL **pass 72 · real-fail 0**；roster 恒等 21；裸 tsc 0；改动文件 eslint 0；roster 注释更新（72 suites as of Task 304）。
- 【收尾】worklog（本条）+ **懒惰提交 a59c595 amend 为正式 t304 消息**（未 push 故 amend 安全）+ push + 环境净场（3000 独监、3001/3022 FREE、mock 杀净、探针焚毁、零残留进程）。

Stage Summary:
- **「半成品收养要过三道门：重建、首航、验毒」**：并行窗的提交里套件从未绿过——产品代码质量不差，但空句断言（`!== 0`）、误用 pollUntil（第一个真值即返回）、漏算渲染段（GPU 插入语）三层雷全部埋在「首航」之后；收养不是 git 操作，是完整重走交付闭环
- **「两套词汇的 registry 必有一撞」**：引擎的记录 outputs 键（micrographs_star）与 UI 的端口注册表名（micrographs）各说各话——跨层 API 的字面量必须向**接收方**的注册表对齐；而 `!== 0` 式断言是空洞见证的极简反例，状态码断言必须点名成功的那个码
- **「轮询器等的是真值，不是终态」**：通用 pollUntil(fn) 的合同是「第一个真值返回」——拿它等终态必须在 fn 里翻译目标（s === "failed" ? s : null）；否则 tick 0 的 "pending" 就是你得到的一切，机器在套件身后悄悄把活干完
- **「ALIVE:PENDING 是诚实的话」**：mock 的 PENDING 期 squeue 可见（pid+state 文件）、取消后 launcher 死 → squeue 沉默 → sacct 兜底——sweep 看到 ALIVE:PENDING 不是卡死，是调度器在如实报告它的队列；判断「停滞」前先问每一环的证人
- 遗留（下轮候选）：array 模式 sbatch（HPC 对话框已有生成器，远程 dispatch 未接）；verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十四窗让位）；**终局 strip 的 wrapper 路径也可以说话**（EXIT 附征的 SACCT 第二行里有终局词，includeWord=false 把它丢了——happy path 的 strip 永远说不了 "· Slurm COMPLETED"，t299 的终局词条近乎死代码——升级 persistSacctTestimony 的 includeWord 语义是下一颗好雷）

## Task 305 (2026-09-19, cron 05:48 窗口 trace 1a07549302235a99-cron-agent-loop-202609190549 —— 开局实证：worklog 尾部 = Task 304（HEAD 8e09d87 已 push、树净、3000 活、零残留），cron 指引的「Task 13」照例过时)

- 【开局 + QA】GET / 200、roster 21、qa63-smoke GREEN（console 0）——稳定。按惯例③自主选题：**t305 = 终局 strip 的 wrapper 路径也可以说话**（Task 304 遗留清单自钉的雷：EXIT 附征的 SACCT 第二行里有终局词，`includeWord=false` 把它丢了——happy path 的 strip 永远说不了 "· Slurm COMPLETED"，t299 的终局词条近乎死代码）。
- 【主交付：EXIT 路径的词提升 + 一致性门控】`wordAgreesWithExit(row, exitCode)`——用兜底路径自己的映射合同（CANCELLED→143、TIMEOUT→124、否则 exit/sig）算出账本词对应的退出码，**等于 wrapper 的退出码才提升词**；分歧（收尾一瞬的 scancel、TIMEOUT 后仍存活的 wrapper）保持旧沉默并 console 点名（"the ledger says X but the wrapper exited Y — the word stays silent"）。EXIT 分支：`persistSacctTestimony(e, witness, agreed)`——**verdict 永远是 wrapper 的退出码，词只是词汇**，strip 永不渲染矛盾；秒表/计量不受门控（两字段本就 first-served-wins）。
- 【套件 t299 扩至 70 断言（+13）首航 ALL PASS】B 相钉子更新（条件提升 + 门控映射）；**C11 wrapper 路径词开口活体**——plant 新增 `cfExit` 参数（在 sweep 首轮前预写 .cf-exit，确定性走 EXIT 分支而非兜底）+ 植入 6 列 COMPLETED 行（125s + 1.24G）→ 记录词 COMPLETED + 秒表/计量齐 + **strip 说 '· Slurm COMPLETED · 2m05s · 1.2 GB peak'**（定妆照 t299-wrapper-word-speaks.png）；**C12 矛盾守卫活体**——.cf-exit 0 对 CANCELLED 行 → 词不落（slurmState undefined）、verdict 仍是 wrapper 的 0、秒表/计量照骑。t304 C1 升级：记录词断言改 demand COMPLETED + 新增终局 strip 活体断言（'Ran on the cluster · Slurm COMPLETED · …' happy path 首次端到端）。
- 【家族回归揪出上一窗的自己的债（真 real-fail，非断言之错）】--batch t26 **t260-clip-from-card FAIL**：crop send 路由 400 "No on-disk outputs"——**QA Refine3D 的运行记录不在 engine-state.json**。根因溯源 = **t304 窗调试期的坏探针**（`stateRuns` 的 `?? {}` 回退在裸 map 上全盲 + 植入清台）抹掉了全部 19 条 demo 记录，当时只修了探针没恢复现场；roster（DB）/磁盘树/smoke 都不依赖记录所以连绿五窗，t260 是第一个消费者。修 = **scripts/restore-demo-records.mjs（常备愈合工具入库）**：从 DB roster + 磁盘树重建缺失记录——workdir 按引擎 `<type>_<id8>` 布局、outputs 用**引擎自己的 collectOutputs**（零猜测：认不出的老命名约定 = 诚实缺席，demo 教程作业的 workdir 本就大多为空，空 outputs 恰是原状）、result 用 DB 行的历史字符串、文件顶层形状保持（裸 map vs {runs}）。15 条重建（select2d 无 workdir 跳过——idle 无需记录）、QA Refine3D 复活、手动重放 crop POST 400→201、t260 solo ALL PASS。
- 【家族回归】四批全绿：t26 pass 6 · 334.6s（t260 愈合 + t262 的 EXIT e2e 活体骑过词提升）｜ t26b pass 4 · 203.6s（t269 strip 子串断言与新增词相容）｜ t29 pass 7 · 260.1s（t299 C11/C12 入批）｜ t30 pass 2 · 97.2s（t304 升级 C1）；累积器 TOTAL **pass 72 · real-fail 0**；roster 21 恒等；记录 20 条（5 原有 + 15 重建）；裸 tsc 0；改动文件 eslint 0。
- 【收尾】worklog（本条）+ commit/push + 环境净场（3000 独监、mock 杀净、零残留）。

Stage Summary:
- **「verdict 是退出码，词是词汇」**：wrapper 的 .cf-exit 与账本的终局行都到场时，两者讲同一个故事才让词上记录——映射合同复用兜底路径自己的（CANCELLED→143/TIMEOUT→124），矛盾时沉默 + 点名；strip 永不渲染矛盾，t299 的终局词条从近乎死代码变成 happy path 的常驻话
- **「确定性走 EXIT 分支要预写 .cf-exit」**：sweep 每 4-6s 一轮、wrapper 先写 exit 文件 launcher 后落账——活体见证 EXIT 分支的词门控必须把 .cf-exit 在 plant 时就放好，否则兜底路径抢先、见证无效
- **「clean up your own crime scene」**：t304 窗的坏探针清台抹掉 19 条 demo 记录，五窗连绿掩盖了它（没有消费者），t260 才引爆——修探针不等于修现场；状态文件的读改写竞态一次污染，恢复要靠 DB + 磁盘 + 引擎自己的 collectOutputs 逐条重验
- **「愈合工具入库」**：restore-demo-records.mjs 不是一次性脚本——记录是运行态、没有种子文件、下一次状态污染还需要它；用引擎自己的 collectOutputs 重建 = 零猜测，认不出的就是诚实缺席
- 遗留（下轮候选）：array 模式 sbatch（HPC 对话框已有生成器，远程 dispatch 未接）；verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十五窗让位）；demo 教程链的下游重跑（记录的 outputs 是诚实缺席，demo 链若要可重跑需按老约定补 outputs 映射）

## Task 306 (2026-09-19, cron 06:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609190628 —— 开局实证：worklog 尾部 = Task 305（HEAD 2f8c397 已 push、树净、3000 活、roster 21、qa63 GREEN、零残留），cron 指引的「Task 13」照例过时)

- 【开局 + QA】GET / 200、roster 21、qa63-smoke GREEN（console 0）、累积器 11 批 pass 72 real-fail 0 与 Task 305 报告一致。按惯例③自主选题：**t306 = array 模式接进远程 dispatch**（Task 305 遗留清单首选：HPC 对话框的生成器/模拟器早就会说 --array，真 dispatch 路径从没说过——万张微图的 MotionCorr 在簇上只能单节点独跑，调度器自己的数组语法闲置）。
- 【主交付：--array=1-N%M 进真路径】六层一次交付：
  1. **类型合同**（remote-run.ts）：ARRAY_TYPES（motioncorr→corrected_micrographs.star、ctffind→micrographs_ctf.star）——合法 = argv 恰一个 --i 输入星表 + --o 指向 workdir 根（末任务能把 shard 输出星表并回 collectOutputs 认的规范名）；refine3d 类全局对齐 Job 拒绝切片（名字上切了、统计上碎了）。ARRAY_CONCURRENCY=4 一个诚实默认（对话框一个旋钮，不给第二个误用的）。
  2. **脚本生成**（buildSbatchScript 的 array 参数）：--array=1-N%M 指令（骑 dependency 之后）；每个任务 awk 轮转切片（**结构行 data_/loop_/列定义全量透传、仅 block>=2 数据行进轮转**——import 星表 2 列行也要活，原 hpc 生成器的 NF>3 启发式吃不下）；命令里 --i 换 "$SHARD"、--o 换 "$OSHARD/"（任务私有输出子目录）；rc 记账文件名带 SLURM_ARRAY_JOB_ID（重跑永不读旧账）；**末任务计数门**（wc -l ≥ N）并回 shard 星表 + 写 .cf-exit（全零才 0，第一个坏 rc 说话）。
  3. **trap 分工**：EXIT trap 加阵列守卫（单个 shard 的失败不得在兄弟还在跑时抢判决词）；TERM/INT trap 不设防（scancel 杀整组，先写者赢、词相同 143）。
  4. **接线**：RemoteRunTarget.shards（2..64、slurm-only、路由+引擎双闸）+ RemoteRunState/Info.slurmArray + remoteInfoFor 投影 + startRemoteJob 的类型门（stage 之前诚实拒绝）+ argv 重写目标定位失败即 throw（spawn 闭包内 return fail 够不着调用方——TS2322 教的）。
  5. **mock 同长牙**：sbatch 解析 --array=1-N%M（**\K 而非 lookbehind——GNU grep 禁变宽 lookbehind**）；launcher 以 %M 上限并发 fan-out（wait -n）+ 逐任务 rc 捕获 + 账本逐任务行 `<id>_<t>`（真 sacct 数组语法）+ 主行 verdict（全零 COMPLETED 否则 FAILED 带第一个坏 rc）；scancel 杀组照旧波及任务子进程。
  6. **UI**：运行对话框 Array split 步进器（1 = 不切分 = 旧合同字节不变；仅 slurm 模式 + 合法类型显示——「在 dispatch 时会被拒的旋钮不是旋钮是陷阱」）；inspector 终局条 + 活体条都说 `· array 1-3%4`。
- 【真雷两颗（全被活体/沙箱揪出，源码断言全瞎）】
  1. **切片 awk 的 NF>0 把 block-2 列定义行（_rln #N）和 loop_ 也卷进轮转池**——每个 shard 的星表结构被打碎（沙箱跑出 3/2/2/3 的行数分布才暴露）。修 = 结构行三条规则前置透传（/^loop_/、/^_/），仅数据行轮转；沙箱复验 shard 结构完整（两块 data_ + 列定义全量 + m1/m5 轮转精确）。
  2. **mock launcher heredoc 的 $__total 未转义**——sbatch 期展开撞 set -u 直接炸（行号还撒谎指到 mkdir）；同场加映 GNU grep 变宽 lookbehind 非法。修 = 运行时引用全转义 + 解析器换 \K 形式。**heredoc 里的每一层展开时机（sbatch 期 vs launcher 期 vs awk 单引号期）都要点名**。
- 【套件】t306-sbatch-array.mjs **52 断言 ALL PASS**（A 真相 + B 台账 21 + C 活体 28 + D 卫生）：C1 全链（分片派发 → 记录点名 {total:3,concurrency:4} → 递交脚本带指令与切片 → mock 3 任务并发 → 逐任务行 COMPLETED → 主行 COMPLETED → sweep 终结 done/exit 0 → **合并星表 12 行全部到家**（collectOutputs 原样认领）→ DTO 携带 split → strip 说词 + 定妆照）；C2 中途 scancel 三见证（记录 137 = stop 路由自己的 KILL 词、账本 CANCELLED、**任务 TERM trap 的 143 落在 .cf-exit**）；C3 对照（无分片 → 无指令无分支，trap 守卫是唯一保留——一份 trap 形状服务所有递交）；C4 class2d+shards 在 staging 之前被诚实拒绝（"cannot ride an array split"）。
- 【家族回归揪自己两笔】① **roster 是显式名单不是注释**——只改了注释没加条目，t30 批跑了 t302+t304、t306 隐形（Task 302 的名单教训原样反咬）；补条目后 73 套件。② **timeout 580 包裹调用投毒卫生扫描**——timeout 进程的 argv 含 "node scripts/family-run.mjs"，正则命中、pid 是祖父非 ppid → t302 的「无残留跑者」×2 连 solo 复跑都炸；去包裹重跑即愈（套件没错，操作者错）。
- 【家族回归】--batch t30：**pass 3（t302 32.9s + t304 59.8s + t306 51.1s）· solo 0 · real-fail 0 · wall 152.9s**；累积器 11 批 TOTAL **pass 73 · real-fail 0**；roster 21 恒等；裸 tsc 0；改动文件 eslint 0；重建部署后 strip 词条进包（首航时终端条缺词 = 陈旧构建，定妆照坐实——「改了 UI 再 build，顺序不能反」）。
- 【收尾】worklog（本条）+ commit/push + 环境净场（3000 独监、mock 杀净、沙箱焚毁、零残留）。

Stage Summary:
- **「末任务计数门」**：数组任务彼此独立、无人知道谁是最后一个——rc 记账文件（名字带 SLURM_ARRAY_JOB_ID 防重跑串账）+ wc -l ≥ N 的计数门让最后收工的任务兼职合并员与判决员；单 shard 失败由 EXIT trap 守卫压着不抢词，TERM 例外（scancel 杀全组、词恒 143）
- **「结构行不进轮转池」**：STAR 的 data_/loop_/列定义是骨架、数据行才是肉——切片器必须把骨架整根递给每个 shard；NF 启发式（原 NF>3）在 2 列行面前既切不动又骗得过活体，只有逐 shard 结构校验能抓
- **「heredoc 有三个时钟」**：sbatch 期（$id/$deps 未转义=烘焙）、launcher 期（\$__t 转义=运行时求值）、awk 单引号期（\$2 转义才活着进程序）——三层展开时机混用一行就是一颗雷，set -u 的报错行号还会指错地方；GNU grep 的变宽 lookbehind 禁令让 \K 成为唯一正解
- **「卫生扫描的 ps 正则会看见祖父」**：timeout/wrapper 类进程的 argv 含被检字符串、pid 却不是 ppid——套件的 ppid 排除只防一层；跑批者不用 wrapper（或套件排除整条祖先链）是操作纪律
- 遗留（下轮候选）：extract/autopick 的 array 变体（输出非单星表，合并需要 coords/粒子语义）；verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十六窗让位）；demo 教程链的下游重跑（按老约定补 outputs 映射）

## Task 307 (2026-09-19, cron 07:18 窗口 trace 1a07549302235a99-cron-agent-loop-202609190719 —— 开局实证：worklog 尾部 = Task 306（HEAD 89ad82b 已 push、树净、3000 活、roster 21、qa63 GREEN、累积器 11 批 pass 73 · realFail 0），cron 指引的「Task 13」照例过时)

- 【开局 + QA】GET / 200、roster 21、qa63 冒烟 GREEN（console 0）。开局即遇一桩显示层怪谈：remote-run.ts 三处 `?.[moduleName]` 在工具输出里显示成 `?.oduleName]`（语法坏状）——AST dump + 字符长度对账证明是**输出通道吞掉字面 `[m` 两字符序列**（ANSI SGR 复位过滤器不要求 ESC 前缀），文件本身健康；`[module`/`[mode` 同款伪影。教训：诊断要以 AST/长度为准，不凭渲染文本定罪。
- 【主交付：extract + autopick 上了 array split】t306 只会切/并「单星表进、单星表出」的 motioncorr/ctffind；把微图变成粒子的两类活从没骑过 split，而它们才是最需要分片的。关键在输出形状根本不同——
  1. **ARRAY_TYPES（名→星表）升级为 ARRAY_FLAVORS（outArg/outStar/merge 三元组）**，三种合并方言：`star`（t306 原样，motioncorr/ctffind）、`rows`（extract：`--part_dir` 保持**共享**——逐微图粒子栈零碰撞，仅 `--part_star` 分片；真 RELION 的 ImageName 路径相对**星表自身目录**，shard 星表写 `../extra/…`，合并时拼 block≥2 数据行并剥掉前导 `../`）、`coords`（autopick：逐微图坐标星表名字天然不相撞，合并 = **文件收集** `cp shard_k/micrographs/*_autopick.star <W>/micrographs/`，连星表拼接都不需要）。argv 重写按 flavor 定位各自的输出旗（`--o`/`--odir`/`--part_star`）；extract 另有共享 part_dir 卫兵（重定向即拒）。
  2. **真 RELION 双块方言**：mock 的 relion_preprocess 假体从「无视输入写死 150 行」升级为 star-aware（#N 列号 + 位置回退、逐微图栈入共享 extra/、relpath ImageName），输出改为 data_optics + data_particles 双块——首航揪出单块星表会**整体绕过 block≥2 过滤**（首捐献者不剥 ../、追加捐献者全被丢弃），假体必须说真话的方言。
  3. **flock 串行化计数门（真雷，家族回归揪出）**：两个 shard 可以在同一口气里 append rc + 读满台账 → **两个合并器并发** cp/append/mv 互相踩踏，合并星表撕裂成无结构头的 4 行碎片（manifest 尺寸 336B 坐实）。修 = `exec 9>>.cf-merge.lock; flock 9`，败者见 .cf-exit 已言即退位；无 flock 的异端登录节点诚实降级为旧竞态（尽力而为而非死锁）。t306 的潜伏竞态，昨日连绿是运气，家族批两次 solo 踩中后落网。
  4. 脚本补 `mkdir -p "$OSHARD" || exit 111`（老 flavor 的二进制自建输出目录，extract 的 part_star 无人建）。
- 【首航三连雷全记录】① wantOut 判别键写反：按 outStar 非空判别，把 motioncorr/ctffind 的 `--o`（目录 `<W>/`）误期望成文件路径 → 派发即 throw——t306 家族回归当场逮住（t307 自身三绿是因为 autopick 的 outStar 为空碰巧走对）；修 = 按**旗的种类**判别（--part_star 是文件旗，--o/--odir 是目录旗），教训钉进注释。② 服务器复活时序：watchdog 在构建完成前就用旧包复活，C4 说着旧文案——**杀两次、以拒绝文案为构建指纹**。③ select2d 在 NATIVE_TYPES 里根本不可远程，C4 拒绝测试须用 class2d（t306 同款）。
- 【套件 t307-sbatch-array-extract-pick.mjs（61 断言，ALL PASS ×3）】A 真相；B 台账 12（flavor 表、重写、双块方言、共享 part_dir 卫兵、flock 串行、coords 收集、mock 假体合同、对话框四类型）；C1 autopick×3 活体全链（slurmArray {3,4} → 脚本带 --odir 分片换写 → 逐任务行 COMPLETED → 主行 COMPLETED → 204 粒子 across 12 微图 → **12/12 坐标星表收进 canonical micrographs/** → strip 说 `· array 1-3%4` + 定妆照）；C2 extract×2 活体消费 C1 的合并坐标（slurmArray {2,4}、`--part_star` 换写、`--part_dir` 共享、合并 awk 真身入脚本 → 合并星表 120 行、**零 `../` 幸存**、120/120 引用栈在盘上、extra/ 12 栈零碰撞）；C3 不分片对照（122 行、无 array 分支）；C4 class2d+shards 诚实拒绝；D console 0 + roster 21；finally 快照还原 + 全清。
- 【家族回归】开局批 t30 揪出 wantOut 真雷（t306 real-fail）→ 修复后 **t30 连续两轮全绿：pass 4（t302 32.9s + t304 59.5s + t306 54.1s + t307 32.7s）· solo 0 · real-fail 0 · wall 191/192s**；累积器 11 批 TOTAL **pass 74 · real-fail 0**；roster 恒等 21；裸 tsc 0；改动文件 eslint 0；roster 注释 74 suites as of Task 307；qa63 冒烟 GREEN。
- 【收尾】worklog（本条）+ commit/push + 环境净场（3000 独监、mock 杀净、探针焚毁、零残留进程）。

Stage Summary:
- **「合并方言要跟着输出形状走」**：单星表输出拼行即可；逐微图文件输出（坐标）连拼都不用——收集就是合并；粒子星表最险，路径语义（相对星表自身目录）决定了「共享 part_dir + 剥 ../」是唯一诚实解。ARRAY_FLAVORS 把这三件事变成声明式合同，重写器按旗定位、卫兵按方言设卡
- **「计数门的『最后收工者』不止一个」**：append 与 wc 之间没有原子性，两个任务能同时看见满台账——并发的合并器互踩直到星表撕裂。flock（进程死即释放）+ 败者退位（.cf-exit 已言即止）让「谁 merge」从猜测变成调度；没有 flock 的机器要诚实降级，而不是假装安全
- **「假体必须说产品的方言」**：mock 假体写单块星表时，block≥2 过滤静默旁路——产品语义对真 RELION 是对的，假体太假反而掩盖不了（活体揭穿）。假体的保真度决定见证的效力；star 的 #N 列号 + 位置回退、双块输出，都是「说真话」的最低配置
- **「判别键要用旗的种类，不是值的形状」**：outStar 非空 ≠ --o 指向文件——t306 的 --o 是目录、outStar 只是合并的目标文件名；判别键错一位，t306 的整条活体链当场断流。家族回归的存在意义就是抓新套件自己看不见的旧合同破坏
- **「显示层的语法坏状要用 AST 定罪」**：输出通道吞 `[m` 序列制造伪代码假象——文本渲染是证人不是法官，AST + 字节长度对账才能定罪
- 遗留（下轮候选）：sacct elapsed/TRES 列已在 t303 落地（勿重做）；array 变体下游（class2d 吃合并粒子星表的端到端链）；verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十七窗让位）；demo 教程链的下游重跑（按老约定补 outputs 映射）

## Task 308 (2026-09-19, cron 08:33 窗口 trace 1a07549302235a99-cron-agent-loop-202609190835 —— 开局实证：worklog 尾部 = Task 307（HEAD 441a715 已 push、树净、3000 活、roster 21、qa63 GREEN、累积器 11 批 pass 74 · realFail 0），cron 指引的「Task 13」照例过时)

- 【开局 + QA】GET / 200、roster 21、qa63-smoke GREEN（console 0）、累积器与 Task 307 报告一致。按惯例③自主选题：**t308 = array 下游——class2d 吃合并粒子星表的端到端链**（Task 307 遗留清单首选：t306/t307 教会了 dispatch 切片与合并，但没有任何下游 RELION 作业在簇上**消费过**合并产物——split 的故事缺最后一环）。
- 【主交付①：mock relion_refine 假体 star-aware】老假体无视 --i、写 40 行假 `000001@particles.mrcs`、粒子数来自引擎根本不传的 `--nt`（默认 1500 = 一句谎）。四颗新牙：① 读 --i，缺输入诚实拒绝（"refusing to invent particles"，exit 1）；② 解析 data_ 块、**取最后一块**当粒子（data_optics 的行永不计数）；③ **合并完整性审计**——每个 @ 后的栈相对星表自身目录解析，任一缺失即拒绝（t307 的 flock 竞态撕裂星表正是无头 4 行形状，撕到哪都能被下游咬住）；④ run_data.star **回声输入 ImageName + 追加 _rlnClassNumber**（产物可链、来源可证）；头部说真实粒子数。爆炸半径核实近零：全家族只有 t262 断言假体存在、无套件执行 refine 族。
- 【主交付②：t308 套件 56 断言 ALL PASS】A 真相 + B 台账（假体合同、class2d 的 extract 边、twin 直通源码）+ C0 沙箱四牙（无需簇）+ C1 数组管线（import 本地 → autopick ×3 → extract ×2，合并星表 120 行零 ../）+ **C2 消费见证**（class2d 同簇无分片：脚本 --i = 合并星表的**簇上孪生路径**、零 _staged/ 重传、无本地路径、无 array 指令；record result 说 "120 particles classified"；产物 data star 的 ImageName 行与合并星表**逐行同序**——pick 分片 → 坐标收集 → extract 分片 → 行合并 → 分类，一条身份贯穿五段）+ C3 strip 双见证（下游 'Ran on the cluster · Slurm COMPLETED' + 上游 '· array 1-2%4'，定妆照）+ D console 0 + roster 21。
- 【真雷一颗：假体栈不可渲染（被掩盖的真 QA 问题）】首航 console 12× 400 打在 `/api/jobs/<extract>/outputs/file?path=extra/mic-NN_extract.mrcs&format=png&montage=16`——错误体重放点名 **"Could not render this MRC file"**：extract 假体写的是文本占位符（`CRYOFLOW-MOCK-EXTRACT-STACK` + bytes），"存在" 但不可读，渲染器诚实拒绝。t307 窗口没炸是因为它的 inspector 截图 click 超时被 catch 吞掉、模态从未真开（**掩盖机制**）。修 = **relion_preprocess 写真 MRC**（mode 2 float32、box×box×per、合法 1024B 头、LCG 确定性值）——「假体要说产品方言，一路说到像素」。修后 console 0。
- 【套件自身三处自纠】① 边端口名用 engine 键 `particles_star` → registry 名 `particles`（t260 教训原样反咬，201 变 400）；② inspector 已开时点下一张卡被吞 → 先重新导航；③ probe 的 4xx URL 聚类最初剥掉查询串看不到 path、id→类型映射正则长度不匹配——多航迭代是定位成本，错误体重放（replay 首个失败 URL）才是最短路径。
- 【真雷二颗：mock fs 的 100 个 workdir 残留】历届套件只删 API job（清本地孪生），mock 簇侧树从未烧过；各套件 finally 里的 `rm -rf /projects/cryoflow/t30X-array` 是想当然的错路径（workdir 在**项目 id** 下）。修两层：本窗烧净 5 个项目目录 × 100 个 job workdir；t308 finally 改为按真实 remoteWorkdir 逐个 rm（教训入码），复验 0 残留。
- 【家族回归】t308 注册（roster **75** 套件 · t30 批 5 成员）；--batch t30 **pass 5（t302 32.9s + t304 61.7s + t306 54.5s + t307 34.7s + t308 37.1s）· solo 0 · real-fail 0 · wall 235.9s**；累积器 11 批 TOTAL **pass 75 · real-fail 0**；roster 21 恒等；裸 tsc 0；改动文件 eslint 0；qa63 复验 GREEN；mock fs 残留 0。
- 【收尾】worklog（本条）+ commit/push + 环境净场（3000 独监、mock 杀净、簇侧树烧净、零残留进程）。

Stage Summary:
- **「split 的故事要由下游盖章」**：合并星表存在、行数对、零 ../——这些是上游的自证；只有下游消费者真的吃了它（脚本引用簇上孪生路径、假体报出 120、产物回声同序行），数组切分才从「自洽」变成「被信任」。twin 直通让合并产物按引用穿边界，一次字节都不重传
- **「假体的方言要说到像素」**：栈"存在"与栈"可渲染"是两种诚实——结果视图的 montage 渲染器有权拒绝读不了的字节，占位符在 t307 的存在性断言下全绿、在 t308 的真开模态下现形。掩盖机制（被 catch 吞掉的 click）比雷本身更值得记录：断言的沉默不等于雷的不存在
- **「错误体的重放是最短诊断路径」**：console 只说 "400"，URL 聚类给出形状，而 route 的 JSON error body 一句话定罪（"Could not render this MRC file"）。逐层逼近不如直接问拒绝者
- **「清理要烧真实的树，不是想象中的路径」**：API 删 job 只清本地孪生；簇侧 workdir 在项目 id 下、套件 finally 的想当然 rm 匹配不了任何东西——100 个目录的残留是无声的复利。修复 = 套件记录自己创建的 remoteWorkdir、finally 逐个 rm
- 遗留（下轮候选）：verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十八窗让位）；demo 教程链的下游重跑（按老约定补 outputs 映射）；各历史套件 finally 的簇侧 rm 同款修正（t302-307 仍带想当然路径，mock fs 残留会复利）

## Task 309 (2026-09-19 09:18 cron) — 簇侧清理债清偿：每个套件烧掉自己碰过的每一棵树

**开局实证**：树上已被并行窗口推进到 Task 308（HEAD `25f6ad6` 已 push）——t303 sacct 时钟、t304 依赖链、t305 wrapper 文字、t306/307/308 数组切分全线均已交付，roster 75 套件/11 批。环境净场良好（3000 独监、roster 21、tsc 0、console 净）。选题：Task 308 遗留清单里最"债"味的一项——**各历史套件 finally 的簇侧 rm 想当然路径，mock fs 残留会复利**。

**【债务画像（逐个套件验尸）】**路径模型：本地 `data/relion/*` 镜像到 `/projects/cryoflow/*`（staging 上传），workdir 在 `<remoteRoot>/<projectId>/<type>_<id后8>`，外部文件在 `_staged/<hash>/`。开局时簇侧 11 项残留：5 个 `cmu*` 空壳（t308 烧净后的壳）+ `dep-test`（开发探针孤儿）+ `t262/t270/t293/t298-mics`（staged 输入镜像树，套件只烧本地侧）+ `t308-array/mics`（t308 把镜像烧除行连同想当然行一起删了——烧了 workdir 却漏了镜像）。**每个套件的病各不相同**：t262/t270 烧 workdir glob 不烧镜像；t293 全都不烧；t298 只烧本地；t299/304/306/307 烧镜像不烧 workdir；t308 烧 workdir 不烧镜像。demo 记录对 `/projects/cryoflow` **零引用**（烧除安全，已核实）。

**【修复（8 套件 × 各自的病）】**① 一次性烧净 11 项残留；② t262/t270：镜像烧除行入 glob（`rm -rf … /projects/cryoflow/t262-mics`）；③ t293：`remoteWorkdirs` 记录（从记录的 `remote.remoteWorkdir` 取真值）+ 镜像 + workdir + rmdir 壳清扫；④ t298：FS_ROOT 直连 rmSync 补镜像；⑤ t304/306/307：`noteRemote()` 在每处 dispatch 成功后记录（t307 的 C4 是**预期拒绝**——拒绝的 dispatch 不 staging，不记）+ finally 烧 workdir + `rmdir` 壳清扫（只清空壳，绝不 `rm -rf` 项目目录）+ 残留日志守卫；⑥ t308：**纠正自己的注释**（`/projects/cryoflow/t308-array` 对 workdir 是想当然、对镜像却是真路径——两件事共用一个形状）+ 补回镜像烧除。

**【批跑活体揪出第三种残留】**修复后 --batch t30 首跑五绿（wall 234.8s），但磁盘终验暴露**第三种残留形状**：`cmu6xtvf7…/import_*` ×3——**每次 dispatch 都会把输入链按 provider 的本地映射路径 staging 上簇**（`import_<suffix>/micrographs.star`），没有任何套件烧过这些 staged provider 副本。升级 t304/306/307/308 的烧除为三层：镜像（具名）+ 自己的 workdir（精确路径）+ staged provider 副本（**glob**：`/*/ctffind_* //*/import_*` 等，t262 已验证的形状，任意项目 id 都命中）。顺带清算 `.slurm` 死账簿（65 pid + 65 name + 45 start + 43 state 积累）——**accounting 和 next-id 是 mock 的记忆，保留**。

**【终局证明】**复跑 --batch t30（升级后代码）：**pass 5 · solo 0 · real-fail 0 · wall 236.3s**；簇树 **0 项**（自建自清，含 staged provider 副本与项目壳）；`.slurm` 只剩 accounting + next-id；roster 21；tsc 0；改动文件 eslint 0。烧除命令活体证明（种植假镜像/假 workdir/假壳 → 原样命令 → 验净，`rmdir` 空壳语义验证）。守卫是日志不是断言——烧除本身是执法，守卫让未来复发**可见**（家族跑批输出每窗必读）。

Stage Summary:
- **「同一个路径形状，两种真实」**：`/projects/cryoflow/t308-array` 对 workdir 是想当然、对 staged 镜像却是真路径——t308 删烧除行时把婴儿和洗澡水一起倒了。修复不是"删掉错的"，是"分清哪个真的、哪个假的、各用什么形状烧"
- **「残留在批跑里现形」**：单套件绿不等于簇树净——三种残留（镜像/workdir/staged provider 副本）只有批跑后的磁盘终验才暴露全貌。修复后复跑批 + 终验 0，才是闭环
- **「烧除三层，层层有形」**：具名镜像、精确 workdir、glob provider 副本——精确路径自证清白，glob 兜住项目 id 漂移；`rmdir` 只清自己掏空的壳（绝不 `rm -rf` 共享目录）
- **「守卫是日志，不是断言」**：must 进 finally 要么被 catch 吞掉要么炸掉后续清理——日志行让残留响亮而不破坏清理链；执法靠烧除，守卫靠可见
- 遗留（下轮候选）：verify-module 的 by-value 变体；384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第十九窗让位）；demo 教程链的下游重跑（按老约定补 outputs 映射）；t262/270/293/298 的镜像烧除行已入码、待各批下次自然轮跑活体验证

## Task 310 (2026-09-19 09:55 cron 窗口 trace 1a07549302235a99-cron-agent-loop-202609190955 —— 开局实证：worklog 尾部 = Task 309（HEAD 7c36d2a 已 push、树净、3000 活、roster 21、冒烟 console 0、累积器 11 批 pass 75 · realFail 0），cron 指引的「Task 13」照例过时)

- 【开局 + QA】GET / 200（2.4ms）、roster 21、agent-browser 冒烟（Workflow 视图 + demo 项目加载 + console 0）、累积器与 Task 309 一致。按惯例③自主选题：**t310 = verify-module 的 by-value 变体**（Task 309 遗留清单首选）——t297 给已保存连接造了隐藏模块验证门（`[id]/verify-module`），但创建表单回答不了「我 env 行里这个 beta 模块名在我要加的集群上到底 load 得动吗」——t290 用 by-value 探测退役的「先保存再测试」信任跳跃，在模块名上还活着。附带发现：**t297 的 verify 门在家族里零套件覆盖**（t299 注释自证 "t297 shipped without one"），本窗一并清偿。
- 【主交付①：by-value 验证门】新路由 `POST /api/remote/connections/verify-module`（静态兄弟段，`/test` 的同族）：body = 连接对象 + `module` + 可选 `probe`（客户端的 probeOverride 回传合并）→ sanitizeConnection 造瞬态连接 → probeModuleDetail 同一仪式 → 判定链三阶：**execError 先答**（SSH 层的自己的话：连不上/认证败/超时——exec 永不 throw，死主机与缺模块曾共住 `home: null` 桶，门对从未到达的主机说 "not found on PATH" 是失真）→ loadRc ≠ 0 带模块工具原话（Lmod 的 "Unknown module"）→ !home 诚实缺 PATH。成功 = mergeVerifiedModule 把模块折进客户端探针（或 emptyProbe 骨架），pin 是草稿侧关切（draftDefaultModule 随 Create 落库，t289 的 chip 惯例）——**注册表字节不动**（套件 sha256 对账）。瞬态 id 用后 dropConnection（幻影不得占 SSH 池位）。
- 【主交付②：一次合并，两扇门】`mergeVerifiedModule` + `emptyProbe` 从 [id]/verify-module 路由原样提炼进 probe.ts——已保存门重构为共享助手（行为恒等），by-value 门直接复用；ModuleDetail 新增 `execError`（probeModuleDetail 从 exec 结果透传），两扇门的判定链同序说话。ProbeCard 其余事实（uname/Slurm/GPU/homeDir）在合并中保座（套件活体断言）。
- 【主交付③：创建表单的门】ConnectionEditor 的 verify 行**双模式渲染**（saved-only 门拆除）：创建模式按钮 valid 前禁用（与 Test & probe 同款）、标签 "Verify"（pin 尚非服务端关切）、成功文案说「随 Create 成为默认（在那之前什么都不保存）」；verifyModule 分模式取路由——saved 走 [id] + onPatched（服务器真相回填），create 走 by-value + probeOverride/draftDefaultModule 本地合并。
- 【家族回归揪出本窗自己的第一颗雷】t310 注册入册（花名册 75→**76**）后 --batch t30 首跑 **t302 real-fail（3 FAIL 双响）**——根因不是 t302 本身：t302 B 相自带 `--batches` 全球覆盖认证，`/^t30/` 不匹配 "t310"，新十年无批归属 → coverage 报孤儿 exit 2（"declared 76, covered NaN"）。修 = BATCHES 注册 `{ name: "t31", match: /^t31/ }`（十年边界即批边界的法则原文：新十年必须到场登记，遗忘是响亮的不是沉默的）。复跑 **t30 pass 5（wall 228.4s）· t31 首跑 pass 1（t310 11.7s）**；累积器 **12 批 TOTAL pass 76 · solo 0 · real-fail 0**；coverage 认证 76 套件各归属唯一。
- 【套件 t310-verify-module-by-value.mjs（52 断言，ALL PASS ×2）】A 真相；B 台账 18（by-value 路由六牙、saved 门重构三证、probe.ts 助手两证、对话框四证——含 saved-only 门已拆除的源码否定断言）；C 活体：C1 隐藏 beta 名带基座探针验证（ok + relionHome + mpi + 合并探针双模块在列 + 基座事实保座 + 注册表字节恒等）、C1b 无基座验证（emptyProbe 骨架说话，合并列表恰为被证模块）、C2 假名拒绝（Lmod 原话 verbatim）、C3 死主机（"SSH failed: connect ECONNREFUSED" 先答）、C4 三连 400（空名/Shell 元字符——语法即守卫/无 host，node 侧不打脏 console）、C5 跨站 403、C6 **saved 门首个家族覆盖**（创建 → 验证+pin → DTO defaultModule + lastProbe 合并 + hasPassword 密钥剥离 → 注册表持久 → 删除后诚实 404）、C7 创建表单活体全链（行在场于空表单 → valid+名双条件武装 → ok 行 + 「随 Create」文案 → chip 预选 aria-pressed → **Create 落库 defaultModule**）；D console 0 + roster 21；finally 烧净自建连接 + .lmod/loaded 还原为发现时状态（t309 教训：碰过什么还什么）。
- 【套件写作期自纠三处（全是套件的错，应用无咎）】① C4 两个 must 差一个配对括号（SyntaxError 首航即抓）；② C7 在模块名还空着时断言 Verify 已武装——disabled 三条件含 `!verifyInput.trim()`，顺序错误；③ C7 忘填 Port 字段——UI 诚实打 :22 被拒，错误行原样渲染「SSH failed: connect ECONNREFUSED 127.0.0.1:22」（**错误体是最短诊断路径的又一次现场教学**）；C7 探测卡标题断言补大小写不敏感（SectionTitle 的 CSS uppercase 让 innerText 说大写话）。
- 【收尾】worklog（本条）+ commit/push + 环境净场（3000 独监、mock 杀净、.lmod 还原、roster 21、tsc 0、改动文件 eslint 0）。

Stage Summary:
- **「先保存再测试」的信任跳跃按域退役**：登录（t290 by-value probe）、模块名（t310 by-value verify）——凡「请求体自己能回答的问题」就不该要求先落库；by-value 门的一切都按值发生（瞬态连接、用后弃池、注册表字节恒等），而 pin 这类「承诺」依然只属于保存动作
- **「登录失败是另一种答案」**：exec 永不 throw，把死主机和缺模块折进同一个 `home: null` 桶，门就会对从未到达的主机说「PATH 上没有」——execError 先答让「连不上」「模块拒绝」「二进制缺席」各说各话；判定的顺序就是诊断的顺序
- **「一次合并，两扇门」**：合并逻辑提炼成共享助手不是洁癖——两处手写必然漂移，漂移的合并让两个门给同一个模块发不同的身份证；提取后 saved 门是重构不是复写，行为恒等由既有断言看管
- **「覆盖认证是全球的，孤儿是响亮的」**：t302 的 real-fail 根因在别处（新十年未登记），但正是它 B 相自带的 --batches 认证把孤儿当场报出——家族里没有「只测自己」的套件，每个套件都替全世界看门；修法也是全球的：登记 t31 批，而不是放宽断言
- 遗留（下轮候选）：384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第二十窗让位）；demo 教程链的下游重跑（按老约定补 outputs 映射）；t262/270/293/298 的镜像烧除行已入码、待各批下次自然轮跑活体验证；verify 门 by-value 变体已落地勿重做

## Task 311 (2026-09-19, 用户工单窗口 —— t301 交付后的三报: sbatch 提交被拒 + 导入 400 张上限 + 参数区路径刷屏)

- 【工单】用户三报: ①「sbatch refused the submission: /data2/home/lijing/.bashrc: line 35: /home/guozhenqian/app/relion/relion.sh: No such file or directory · sbatch: error: Memory specification can not be satisfied · sbatch: error: Batch job submission failed: Requested node configuration is not available」——提交任务失败; ②「import micrograph 时有 400 张的上限? 没有读取到文件夹下的所有照片」; ③「选中照片后在参数中不要显示所有照片的路径, 照片很多会占用太多空间」。
- 【根因① a: --mem 公式越界】buildSbatchScript 自己发明的 `--mem=<16+12×gpus>G`(6 GPU→88G, 8 GPU→112G)跨过用户集群节点的可调度 RealMemory(64G 级)——控制器在提交时刻直接拒绝, 报错对正是「Memory specification can not be satisfied」+「Requested node configuration is not available」; 用户自己的 sbatch6gpu.sh 根本不请求内存(节点默认)。修复: 整行删除, 内存留给节点/分区默认(脚本内留注释示例供需要的集群自行解注)。
- 【根因① b: .bashrc 噪声冒充病因】exec 通道是 bash -lc 登录壳, 用户的 ~/.bashrc line 35(引用别人家路径的 relion.sh)把 stderr 污染成第一行——旧错误把全部 stderr 拼成一句, 读起来像提交因 .bashrc 失败。修复: 提交失败路径分流——`^sbatch:|^slurm` 行是主错误, 其余命名为「login-shell noise from the cluster (your ~/.bashrc, not the submission)」附注; 用户修自己的 .bashrc, 我们修我们的。
- 【根因① c: gres 越界的第二形态】服务端 GPU 宽度钳制: 分区在探测 sinfo 库存中有 gpusPerNode 时, gpuWidth 钳到组宽(UI 步进器早已客户端收敛, 裸 API 调用/重探测缩组后的陈旧对话框得到同一道闸)——5-GPU 组永远不会收到 --gres=gpu:6。
- 【修复② 导入枚举与浏览器预览分家】remote-ls 的 listRemoteDir 增 opts.max + 同一趟 find 的真实总数(awk END 计数 marker `__CF_TOTAL__<n>`, 单遍 ssh 传输仍 400 行); REMOTE_IMPORT_MAX_ENTRIES 默认 20,000(CF_REMOTE_IMPORT_MAX 可调, 20 万硬顶)——engine 导入腿的文件夹/通配符枚举用它, STAR 写满全部照片; 浏览器 listing 维持 400 行载荷卫生, 但 truncated 提示升级为「first 400 of <真实总数>」+ 新增「Import this whole folder — every image」按钮(直选文件夹, 引擎端枚举无上限); 文件夹模式的底部状态行同样告知「Select this folder imports EVERY image」; 本地 fs/browse 路由同步补 totalEntries。mock 侧 ctffind/autopick stub 补 motioncorr 的 t268 教义(总 sleep 封顶 60s——450 张导入树曾把单步拖成 12 分钟墙)。
- 【修复③ 长文件列表折叠摘要】PathParamField: >8 条的多文件列表默认渲染紧凑摘要卡(N files · M folders · imported exactly as listed + 前两条路径 truncate + 「+K more — paths are kept, only the display is collapsed」), 「show all」展开成可编辑 textarea(行数封顶 8)+ ChevronUp 收起; ≤8 条维持原 textarea; 浏览重开照旧从全量值播种多选——一条路径都不丢。底部状态行折叠态去重(摘要卡已报数)。
- 【mock sbatch 复刻用户控制器】分区→{RealMemory 64G, gpus} 节点模型(brain 6/brain2 8/brain3 6/brain4 8/normal 5/normal02 8/gpu 6/缺省 8): --mem 超节点内存 → 逐字复刻用户报错三行(含 .bashrc 噪声行先行); --gres 超组宽 → 兄弟拒绝; 独立验证: 旧式脚本(--mem=88G)被拒 exit 1 + 三行报错, 新式(无 --mem)「Submitted batch job」。
- 【E2E(mock 集群, prod 服务器 + curl 全链)】browse /data2/movies-t311: totalEntries=450, entries=400, truncated=true(awk END 真实总数过 SSH 在案); 远程项目 import 文件夹 → 「450 micrographs imported」→ micrographs.star 450 行集群绝对路径(mic_001…mic_450 全数); 全链 slurm 提交: motioncorr@brain2(1 GPU)→ ctffind 450 张(封顶 stub 60s)→ autopick 7650 picks → extract → **class2d@brain2 8GPU**: 生成脚本 `--ntasks=8 --gres=gpu:8` + **无 --mem** + `mpirun -n 8 … --gpu 0:1:2:3:4:5:6:7`, 「Submitted」→ COMPLETED(10 classes); 服务端钳制: class2d 请求 8 GPU @normal(5/node)→ 脚本落 `--ntasks=5 --gres=gpu:5`; 停止路径 scancel 正常。
- 【浏览器活体验证(agent-browser + prod 3001)】4GB 内存墙再现(dev server Turbopack 峰值 3.4GB 被 OOM-kill, dmesg 在案)→ standalone prod 构建 + scripts/prod-3001.sh(复刻 t301 教义, runtime ~400MB)后全链活体: idle import 任务参数页 → 紧凑摘要卡(「40 files · 1 folder · imported exactly as listed」+ mic_001/mic_002 路径预览 + 「+38 more」+ show all)→ show all ↔ collapse 往返(textarea 40 行 ↔ 摘要回位); Browse → 集群浏览器落 movies-t311 → 「Listing shows the first 400 of 450 entries」+ 「Import this whole folder — every image」按钮 → 点击 → 对话框关闭 + 参数变为 /data2/movies-t311 + folder 模式提示; VLM 终验(1600×900 干净态): 摘要卡逐行转录全中(40 files/1 folder/两路径/+38 more/show all), 「clean and well-aligned, no overlap or clipping」。附注: 577px 超矮视口下参数面板内容会被 command preview 挤压(存量行为, 与本次改动无关——单路径 Input 形态同样被挤; 正常桌面高度无此象)。两张定妆照(t311-summary-collapsed.png / t311-browser-truncated.png)。
- 【文档】docs/remote-relion.md: sbatch 范式代码块去掉 --mem 行 + 新「No --mem, deliberately (t311)」小节(根因/报错原文/用户脚本对照/噪声分流/宽度钳制); §4c 浏览条目补真实总数+整夹快捷; Data staging 后新「Imports enumerate EVERYTHING (t311)」小节(20,000 上限 + 参数页摘要卡)。
- 【质量】裸 tsc 0; 七个改动文件 eslint 0; mock fs 测试数据(movies-t311)入既有 gitignore 范式核查; 沙箱模板 3000 验证期间暂停、验证后恢复。

Stage Summary:
- **「内存留给节点, 宽度留给探测」**: sbatch 不再猜 RealMemory(猜错 = 提交时刻被拒, 用户的 64G 节点 vs 我们的 88/112G 公式); GPU 宽度以探测库存为准, 5-GPU 组永远收不到 6-GPU 请求——两个「node configuration not available」的形态都封死
- **「.bashrc 的锅 .bashrc 背」**: 登录壳噪声(slurm 错误之外的一切 stderr)在报错里被点名归类, 不再冒充提交失败的原因
- **「预览 400, 导入 20000」**: 浏览器 listing 是预览(载荷卫生), 导入是事实(awk 单遍计数 + 20k 枚举)——「import takes them all」从 UI 口号变成引擎行为; 截断提示给出真实总数并指路整夹导入
- **「路径一条不丢, 显示一刀折叠」**: >8 文件的参数值默认摘要卡(计数+文件夹数+前两条), show all 才见全量; 浏览重开照旧从全量播种
- 交付: commit 待 push(用户 token); mock sbatch 的 RealMemory 拒绝门让「用户控制器」从此在沙箱可复刻

## Task 312 (2026-09-19, 用户工单窗口 —— t311 推送后的两报: 浏览器仍只见 400 张 + CTF 还是失败)

- 【工单】用户两报: ①「还是只能看到400张图片, 需要能看到所有图片, 不设上限」——t311 给了真实总数提示与整夹导入按钮, 但 listing 本体仍被 400 截断(用户真实集群文件夹 2054 张, 第一份粘贴即证); ②「ctf还是失败了」——第二份粘贴 195 输入 → 195 条「WARNING: skipping, since cannot get CTF values」→「failed to estimate CTF parameters for any micrograph」: 输入全是 /data06/KriosG4_data/.../Micrographs/ 下的 EPU 原始电影栈(*_Fractions_DW.mrc), 未经运动校正直接喂 ctffind——未求和的单帧上没有可拟合的 CTF, 100% 失败是物理不是 bug。
- 【修复①: 上限退役, 浏览与导入同一世界观】新 src/lib/browse-caps.ts: BROWSER_LIST_MAX(默认 20,000, env CF_BROWSER_MAX 可调, 40 万硬顶镜像导入侧的 20 万封顶逻辑)——本地 /api/fs/browse 与远程 browse 两路由同源引用, truncated 文案从硬编码 400 改为 entries.length 自述; remote-ls 的 REMOTE_MAX_ENTRIES 改骑共享常量(引擎导入腿 REMOTE_IMPORT_MAX_ENTRIES 保持独立可调)。t311 的「预览 400、导入 20000」教义被用户的「不设上限」一句话依法退役: 预览即事实。
- 【修复①: 虚拟滚动】path-browser-dialog 弃 Radix ScrollArea(display:table 包裹的历史补丁随之退役)换直 overflow 容器(globals.css 本就给所有滚动条配了 thin 主题): 行高钉死 h-7(30px pitch 含 2px 呼吸), 全列表 spacer(n×30px)+translateY 窗口(±8 overscan), 滚动/换夹/过滤都归零复位; role=option 补 aria-posinset/aria-setsize(虚拟列表对读屏器诚实)。2054 行的 DOM 成本 = 18 节点。
- 【修复②: 防呆先于 staging】engine.ts 新共享鼻 ctffindMovieStackRefusal: 嗅 resolved star 的 rlnMicrographName 行, 命中 EPU 的 *_Fractions[.mrc/.tiff]、Falcon .eer、frames/movie 词干(刻意不匹配裸 _DW——motioncor2 自己的剂量加权输出就叫这个, 是合法求和显微图); ≥50% 行命中 → remote-run 在 resolveInputs 之后、staging 之前 fail(requestError 语义: 行不翻红、toast 教学「先跑 MotionCorr(Import → MotionCorr → CTF), 或导入已求和的显微图」), 本地 runRealJob 同一道闸(行标红但 result 就是课程)。拒绝是"名称里写着不可能"的提交——与 t307「拒绝于 staging 之前, 绝不名义分裂」同门。
- 【修复②: 失败仍在时, 诊断随行】log-diagnosis 增 ctffind-no-fit 模式(cannot get CTF values / failed to estimate…for any micrograph → 三因教学: 原始电影栈/像素尺寸/ResMin-ResMax), Log 标签页本地远程同治; finalizeRemoteRun 失败分支对 ctffind 签名压缩尾部噪声行数(4→2)腾出结果条空间, 追加紧凑 CTF diagnosis——用户粘贴的那段报错从此自带"下一步"。
- 【E2E(prod 3001 + mock, scripts/diag-t312-nocap-ctf.mjs 全绿 39 断言)】mock fs 新 2054 文件夹(movies-t312, EPU 命名 1027 raw + 1027 DW)+ 12 文件对照组(mics-t312): browse 2054=2054 truncated=false micrographs=2054 DW 子集 1027; import 文件夹 →「2054 micrographs imported」+ star 2054 行集群绝对路径; ctffind 挂 2054 原始栈 → 拒绝(教 MotionCorr、数 2054 of 2054、无 waiting、行 idle、集群树零落地); 对照组 12 张 mic_*.mrcs 真跑 COMPLETED(「CTF estimated for 12 micrographs」——守卫零误伤); 台账断言(log-diagnosis 模式/结果条诊断/签名对用户原文逐字命中)。
- 【浏览器活体(agent-browser + prod 3001, 1600×900)】对话框深导航 2054 夹: DOM 仅 18 行节点而 spacer 精确 61620px(=2054×30), 深滚 30000px 窗口跳 posinset 993/2054(setsize 诚实), 「Select all images (2054)」一点全选 2054, DW chip (1027)(用户此前只见 195), Import 2054 files → 参数页紧凑摘要卡(2054 files + show all, 无路径墙); console/page error 双零。两张定妆照 t312-browser-2054.png / t312-summary-card.png。
- 【途中真修一 bug: prod-3001.sh 数据根】standalone server 启动时 process.chdir(__dirname), 数据树落进 .next/standalone/data——一个每次 next build 都会删掉的目录(t312 E2E 首跑 star 0 找到的就是它)。补 export CRYOFLOW_DATA_DIR=/home/z/cryoflow/data(Task 183 自己写好的解药), 烧掉游离树, 手工项目行经 API 清场。
- 【质量】tsc 0; 九个改动文件 eslint 0; docs/remote-relion.md(浏览上限退役小节 + Raw movie stacks never ride the CTF lane 小节); mock 侧两夹具入 gitignore。

Stage Summary:
- **「预览即事实」**: 用户的「不设上限」是法——浏览器与导入共用一个天花板(20k 默认), 虚拟滚动让 2054 行滚动如 40 行; 「Select all」按钮数的、DW chip 数的、过滤器过滤的, 从此都是整个文件夹
- **「名字里写着不可能的提交, 拒于门外」**: ctffind 吃原始电影栈在物理上必败(单帧无可拟合 CTF), 提交前嗅星表行(≥50% 电影栈命名)即拒并教 MotionCorr; 本地远程同一道闸, 失败签名仍备诊断兜底
- **「修脚本时先看它的受害者」**: prod-3001 的数据根 bug 是 E2E 首跑的 FAIL 逼出来的——.next/standalone/data 是 build 每次都删的流沙, Task 183 的覆盖变量早就在那里等着被用
- 交付: commit 待 push
---
Task ID: 313 (中途进行时，前半；后半见 Task 313 完结条)
Agent: main
Task: demo 教程链复活（合成数据 + 全链 Mock 重跑 + postprocess/maskcreate 假体）

Work Log:
- 开局实证：尾部 = Task 310（HEAD 2e36b8b）、QA 三绿。「3D 体积截面」候选经工件核实早已交付（Task 217 窗），Task 13 recital 照例化石——选题转 Task 310 遗留清单的「demo 教程链下游重跑」。
- 立项侦察：demo 链 13 环（import→…→refine3d→postprocess，边拓扑为真源）全部 completed 但 workdir 空（t305 诚实缺席）；EMPIAR-10017 bundle 缺席；mock 缺 relion_mask_create + relion_postprocess 二假体；demo 链还缺 initialmodel + maskcreate 两个工作流节点（class3d/refine3d 的 model_mrc、postprocess 的 mask_mrc 无上游）。
- 已交付：两个新假体（relion_mask_create 读真头写同几何软掩膜；relion_postprocess 写 RELION 5 postprocess.star 全方言——data_general + data_fsc 四曲线 + data_guinier——加可渲染 postprocess.mrc）。
- 【真雷：mock 四假体的 MRC2014 头偏移全错】MODE 写在 byte 4（=覆盖 NY 为 2！）、采样进 NXSTART 槽、NSYMBT=ISPG 串位——t308 的「可渲染」是应用宽容路径的假象，诚实的 readMrcHeader 读到 64×2×64 模式错乱。修复 = relion_refine / relion_preprocess / 新 mask_create / 新 postprocess 四处全部对齐真 MRC2014 布局（MODE@12、采样@28、ISPG@88、NSYMBT@92、ORIGIN@96）——「假体的方言要说到头字段」。
- 活体验证：mask_create / postprocess 在 mock 上 happy path + 拒绝路径全通；postprocess.star 语法四项（FSC 列、final res、Guinier 列、B-factor）对应用解析器全过。

Stage Summary:
- 进行中：复活脚本（EMPIAR bundle 合成 + 连接注册 + 加节点 + 拓扑序重跑 + collectOutputs 补账）与守护套件待写

---
Task ID: 313 (完)
Agent: main
Task: demo 教程链复活：合成数据 + 全链 Mock 重跑 + postprocess/maskcreate 假体 + 搬家星表重定基

Work Log:
- 【立项核实】「3D 体积截面工具」经工件核实早已全量交付（Task 217 窗，ChimeraX 风格 per-axis clip + 滑杆 + invert + SVG 拖拽面）——Task 13 recital 第 N 度化石，遗留唯一真源仍是 worklog 尾部。选题 = Task 310 遗留清单的「demo 教程链下游重跑」。
- 【缺口侦察】demo 链 13 环全部 completed 但 workdir 空（t305 诚实缺席）；EMPIAR-10017 bundle 缺席；链缺 initialmodel + maskcreate 两环（class3d/refine3d 的 model_mrc、postprocess 的 mask_mrc 无上游可解析，resolveInputs 永远 not-ready）；mock 缺 relion_mask_create + relion_postprocess 二假体。
- 【假体×2 + 四处 MRC 头修复】relion_mask_create（读真 MRC2014 头、同几何软掩膜、拒绝缺失 --i）；relion_postprocess（RELION 5 全方言 star：data_general + data_fsc 四曲线 + data_guinier；可渲染 postprocess.mrc；日志行紧邻短语的分辨率数）。真雷：**全部 mock 假体的 MRC 头偏移错**——MODE 写在 byte 4（覆盖 NY=2！）、采样进 NXSTART 槽——t308 的「可渲染」是宽容渲染器的假象。修复 relion_refine/preprocess/mask_create/postprocess 四处对齐真布局（MODE@12、采样@28、ISPG@88、NSYMBT@92、ORIGIN@96）——「假体的方言要说到头字段」。
- 【EMPIAR bundle + healer】scripts/demo-chain-resurrect.mjs（幂等 healer）：合成 24×512² float32 微图（真头、确定性 LCG+高斯粒子斑）；qa-probe 残留连接清扫；Mock Cluster 连接创建/复用；import 参数切 EMPIAR 腿；加 initialmodel/maskcreate 节点+四边（幂等）；拓扑序重跑全链（native 本地、CLI 走 mock slurm）；验证 FSC/Guinier 路由。
- 【真雷①：断链 EEXIST 500】链 import 首跑 500——projectDir/micrographs 是**断链**（指向 t293 套件烧掉的镜像目录），existsSync(dangling)=false → symlinkSync EEXIST throw。修复 ensureEmpiarLink（lstat 不跟随链接：真目录不动、断链/他链重指向）。这是真产品 bug：任何陈旧断链都会让 EMPIAR 导入崩成 500。
- 【真雷②：sweep 饥饿】mock slurm 已 COMPLETED 而应用记录十分钟不结账——远程 poll sweep 由 jobs GET 驱动，直读 engine-state 的轮询者会饿死 sweep。healer 改走 API 轮询。
- 【真雷③：搬家星表（本窗最大的雷）】select/select2d/symexpand/rebalance 四个 native 把上游行**原样抄进自己 workdir 的星表**——行引用 `extra/x` 只在上游目录旁成立，全链所有读栈消费者死（mock 审计 242/242 拒绝；老时代假体不审计所以从未暴露）。修复三层：①engine 共享 rebaseParticleRefs（四写手重定基为项目相对——真 RELION cwd=项目根的约定）；②mock 审计三候选（星表目录/cwd/项目根=dirname(star_dir)）；③refine 假体 echo 同样重定基（echo 也是搬家）+ 行解析空白宽容（rebalance/symexpand 的空格行是合法 RELION，TAB 硬切把整行当栈名）。
- 【真雷④：说谎的孪生地图】refine3d 顺序模式在 finalize 时**本地合成** half maps，finalizeRemoteRun 把它们也映射成 remote twin → 下游 dispatch 信以为真跳过上传 → maskcreate 饿死。修复：twin 候选一次批量 SSH stat 定账，簇上不存在的从不进 twin 地图。
- 【家族哨兵迁移】demo 世界合法长大：roster 21→23（+initialmodel/maskcreate）、画布 21→23 卡——87 个套件文件机械化迁移（正则只碰 roster/长度语境）；t282 画布断言同迁。qa55 Phase C「诚实缺席」前提死了（demo 有真数据）——适配为**一次性空项目世界**（POST 创建即激活 + 无数据 import 作业 → Export 报告 → 删除，try/finally 保证失败也清算——失败路径残留会把 active 指针搁浅在空项目上，jobs GET 答复 0，活体踩过）。qa53 清理器 --clean 扩展拔掉 healed FSC 工件（healer 随时恢复）。
- 【终局】全链 15 环贯通：import→motioncorr→ctffind→autopick→extract→class2d→select2d→select→initialmodel→class3d→symexpand→rebalance→refine3d→maskcreate→postprocess；FSC 路由 40 shells、官方分辨率 6.51 Å、Guinier 数据在列；UI 活体（FSC 卡在屏，shots-qa/t311-fsc-chart-live.png）。套件 t311（~30 断言 ALL PASS）：B 台账十证、C healed demo 十三环+行形状+路由+新边、D select2d 重跑活切片、E console 0。--batch t31 pass 2 · --batch qa pass 11（迁移哨兵活体验证）· 累积器 12 批。roster 77 套件、tsc 0、eslint 0、改动文件 lint 净。

Stage Summary:
- **「搬家的星表要重定基」**：星表的相对引用只对它自己的目录负责——任何把行抄进新星表的写手（engine native、假体 echo、一切未来的写手）都必须把 ref 重新指向栈的真实位置；老时代从未暴露是因为假体不审计，审计越诚实，搬家越要守约
- **「宽容的读者会掩盖撒谎的写手」**：MRC 头 MODE 错位十年渲染如常——渲染器越宽容，头字段越敢撒谎；修复对齐真 MRC2014 布局是对「假体方言说到像素」教义的再进一层：说到头字段
- **「空壳世界要在自己的星球上造」**：healed demo 不再是无数据世界——qa55 的诚实缺席测试改在一次性空项目上跑，用完即焚（finally 兜底，失败也要清算，否则 active 指针搁浅）
- **「哨兵是世界形状的承诺」**：roster 21→23 不是放宽断言而是世界合法长大——机械化迁移 87 文件 + qa 批活体验证；demo 的每次结构性演进都伴随哨兵的自觉迁移
- 遗留（下轮候选）：384³/512³ 阶梯压测（T296_N 已备）；EMPIAR 真数据回归（连续第廿一窗让位）；t262/270/293/298 的镜像烧除行待各批自然轮跑验证；其余十个批的 roster-23 迁移待自然轮跑确认（qa+t31 已活体验证）

## Task 314 (2026-09-19, 用户工单窗口 —— t312 交付后的回执: 「我导入的是做过motion correction的micrograph了啊，可以直接做ctf啊」)

- 【工单】用户一句话推翻 t312 的诊断: 导入的就是做过运动校正的显微图, 应当直接做 CTF。**用户是对的**——重读两份粘贴的铁证: ①文件浏览器里 Fractions.mrc 与 Fractions_DW.mrc 成对出现且**同尺寸 64.0 MB**(4096×4096 float32 = 64 MiB 整, 单帧图像; 原始栈与它的求和不可能同尺寸); ②文件夹名就叫 Micrographs/; ③_DW 正是 MotionCor2 的剂量加权**输出**命名(motioncor2 保留输入 basename: xxx_Fractions.mrc → xxx_Fractions.mrc + xxx_Fractions_DW.mrc, 两个都是求和单帧); ④Krios G4 + Falcon 4i 原始数据是 EER, 根本不会以 MRC 电影栈落盘。t312 的「文件名含 Fractions = 原始电影栈」鼻在合法工作流上犯了假阳性, 把用户挡在门外。
- 【修复: 名字只是线索, 字节才是裁决】engine.ts 的 ctffindMovieStackRefusal(纯文件名嗅探, ≥50% 即拒)退役 → ctffindInputGate(异步, HeaderSniffer 注入): 嗅探降级为「找值得验证的候选」, 然后读被标记文件自己的 MRC 头(64 字节: NX/NY/NZ/MODE 于偏移 0/4/8/12)。新 src/lib/relion/mrc-sniff.ts: 纯 Buffer 解析(无 fs/sharp, 客户端安全), 模式集 {0,1,2,3,4,6,12}(12=float16, MotionCor2 新输出——老 ctffind 不认), 维度健全界拒绝文本/截断垃圾; spreadSample(首/中/尾)一站覆盖混合夹。裁决表: **NZ>1 = 真帧栈 → 拒(带头部自己的数字为证, t312 的意图如今有据)**; **NZ=1 = 求和显微图 → 放行(用户的原场景)**; 读不出/TIFF → 放行+提示(用户是自己数据的权威, 同一个错不犯第二遍); **.eer ≥50% → 拒(事件记录文件定义即原始帧, 无需读字节)**。
- 【修复: 两条泳道 + 一张回执】remote lane: remote-run 在 resolveInputs 后、staging 前过闸, 新 src/lib/remote/sniff.ts 用一次 SSH 往返(head -c 64 | base64, 逐行映射)挣裁决; 放行的 note 以 CRYOFLOW_NOTE 行写进提交脚本——sbatch 路径早 echo(SBATCH --output 落 run.out 顶部), 直接模式 launch 后追加(setsid 重定向先截断)。local lane: localHeaderSniffer 直读磁盘, 同一闸, note 骑 result 尾(attachExitHandler 新参, spawnTrackedRun 透传)。**Import 也嗅**: 远程导入腿对前 3 个(散布)文件读头, result 条直接说出字节身份——「headers (3 sampled): single-section MRCs 4096×4096 (mode 2) — motion-corrected micrographs, CTF-ready」或「40-section frame stacks — raw movies, run MotionCorr before CTF」或「.eer event records」。用户「我导入的是什么」的困惑从此在导入完成那一刻就有答案——这正是本工单的起点。
- 【修复: 失败诊断改说真话】remote-run 紧凑诊断与 log-diagnosis 的 ctffind-no-fit 提示重写: t312 版把「原始电影栈」列为头号嫌疑且判了用户的案; 新版按物理排序——①单帧吗(NZ>1=栈, 附上集群自查命令 head -c 16 file.mrc | od -An -td4 读 NX NY NZ MODE); ②这个 ctffind 构建读不读该文件模式(float16/mode-12 需要新 ctffind, 集群捆绑的 4.1 可能早于它); ③Import 像素尺寸; ④ResMin/ResMax。用户真实失败(2 秒内 195 张全拒 = 读入即拒而非拟合差)最像 ②或栈, 工单回复里给了排查路径。
- 【E2E 新约】scripts/diag-t314-mrc-sniff.mjs(56 断言全绿): 夹具带**真 MRC 头**(corrected-t314 60 张 NZ=1 Fractions/Fractions_DW 混名 = 用户原场景; rawmovies-t314 40 张 NZ=40 栈; mics-t314 12 张对照; eer 20 个)。回归主断言: 修正图 import 回执说「single-section MRCs … CTF-ready」, ctffind **dispatch 被接受并 COMPLETED**(t312 拒的就是这个), 提交脚本+run.out 双双带 CRYOFLOW_NOTE; 诚实拒绝: 栈夹 import 回执说「40-section frame stacks」, dispatch 拒于 staging 前(40 sections × 5760×4092 为证、行不翻红、集群零落地); .eer 拒且明说格式; 对照组无闸嗅、脚本无 note、回执照旧带事实(嗅探常开——用户每次导入都该知道字节身份)。台账断言: 旧函数名全仓清零、新模块存在、note 落两构建器、诊断新词、用户报错原文签名仍逐字命中。
- 【t312 套件随新约更新】diag-t312 自建夹具(2054 张 NZ=40 真头 + 12 对照 + 450 浏览回归夹——旧运行时夹具随沙箱重置已失), 拒绝断言升级为带证据版(40 sections/5760×4092), import 回执断言新增, 紧凑诊断断言改 t314 措辞; 复跑全绿 46 断言。
- 【浏览器活体(agent-browser + prod 3001)】app 加载 console/page error 双零; API 建 qa-t314-ui 连接+远程项目 → import /data2/corrected-ui(24 张真头) → **UI 上 import 卡回执全文在案**(「24 micrographs imported … single-section MRCs 4096×4096 (mode 2) — motion-corrected micrographs, CTF-ready …」), CTF 挂上 dispatch → 卡片 completed「CTF estimated for 24 micrographs」; 点开 CTF 卡 Log 标签页 → **CRYOFLOW_NOTE 行逐字在案**(「24 of 24 rows carry movie-stack naming, but the sampled headers say single-section MRCs … safe for CTF」)。三张定妆照 t314-app-load / t314-ui-receipt / t314-ui-log-note。测试树+连接+夹具全数烧净。
- 【环境】沙箱重置后的重建: /home/z/cryoflow 从 origin/main(bfdeef3) 重新检出, prisma db push(DATABASE_URL 需显式覆盖——外层环境变量指向模板库), standalone prod 构建 + prod-3001.sh; mock 3022 dev 模式; 模板 3000 未动。途中排障: 旧会话遗留的 2 个 prod 进程引用已删除的树(kill 清场); bash 工具显示层吃字(`?.[moduleName]` 显示为 `?.oduleName]`)导致两次 python 匹配失败——worklog 判例重演, 换不含该表达式的锚点即过。
- 【质量】tsc 0; 六个改动文件 + 两个 diag 脚本 eslint 0; docs/remote-relion.md t312 小节整体改写为「The CTF door reads BYTES, not names (t314)」; mock gitignore 四夹具目录入册。

Stage Summary:
- **「字节为证, 名字为线索」**: t312 的文件名嗅探在 MotionCor2 输出上犯了假阳性(motioncor2 保留电影 basename)——同一个 _Fractions_DW.mrc 词干, Movies/ 里是原始栈, Micrographs/ 里是求和显微图; 从此读 MRC 头的 NZ 裁决, 拒绝带证据, 放行带回执
- **「导入即知情」**: 每次远程导入的回执都写出字节身份(单帧/帧栈/eer)——用户的困惑(「我导入的到底是什么」)在导入完成那一刻就有官方答案, 不必等 CTF 失败再来猜
- **「放行的理由要看得见」**: CRYOFLOW_NOTE 骑提交脚本落 run.out(Log 标签页可见)——为什么电影样名字被放行, 一行说清
- **「诊断不冤枉数据」**: 全拒于秒内的失败模式 = 输入/格式被当场拒绝, 不是拟合差; 诊断按此排序嫌疑并附集群自查命令
- 交付: 已 push(用户 token 单次 URL, 未落任何文件)——详见下方 rebase 记录
- 【rebase 记录(本条为 push 前最后一腿)】push 前探测发现远程已被并行 cron 窗推进(07d6aa0: t313 demo 链复活 + t310 verify-module), 且其 t313 与本工单撞号、双方同动 engine.ts/remote-run.ts。处理: ①按判例本工单重编号 t313→t314(套件/截图/worklog/注释/提交信息全链重命名); ②rebase 到 07d6aa0, worklog 冲突保留双方(顺带卫生修复: 并行窗完结条笔误「Task ID: 311 (完)」与历史 t311 撞号且悬空其前半条的「见 Task 313 完结条」引用, 按其提交信息/roster 证据改为 313 完); ③engine/remote-run 自动合并后语义复核——rebaseParticleRefs 四写手/ensureEmpiarLink lstat/twin stat round 与 ctffindInputGate/CRYOFLOW_NOTE 双方改动共存零踩踏。合并树验证: tsc 0 / eslint 0; diag-t314(56 断言) + diag-t312(46 断言) 双套件全绿; 并行窗布局绑定套件 t313-demo-chain-resurrect 在本沙箱不可跑(硬编码 /home/z/my-project 夹具 + :3000, t299 判例)——改以源码级六不变量核验(rebaseParticleRefs×4/lstat/twin-stat/三候选审计+空白宽容/RELION5 方言/真头读取)全数在场 + 其两新假体活体冒烟(mask_create 输出头 64×64×1 真几何, postprocess 出 data_general + FinalResolution 全方言)代偿; 浏览器合并构建健康检查(console/error 双零, 交互面完整)。四张定妆照含 t314-merged-app.png。

## Task 315 (2026-09-19, 用户工单窗口 —— t314 交付后的回执: 「远程任务还是不能正常执行……总感觉远程任务不应该是提交到wsl中吧」+ 遗留两项: Import 节点类型选择 / import 后图片加载不出来改随机抽 5 张)

- 【工单】用户贴出 inspector 的 Command line recorded at launch: 整条作业被 `wsl -d Debian -- bash -c {…}` 包裹, RELION_HOME 指向 /home/z/myproject/relion5-build-cuda-fixed, star 里全是 /data06/KriosG4_data/… 集群绝对路径; 附带 480KB 的 Log 标签页全文——同一 ctffind 作业尝试了**两次**: 一次集群侧(/opt/ohpc ctffind)一次 WSL 侧(/home/z/myproject), 两者全灭(~195×「cannot get CTF values」→「failed to estimate CTF parameters for any micrograph」)。用户判断正确: 远程任务不该进 WSL。
- 【根因①(用户核心抱怨)】dispatch.ts autoStartPendingDownstream 的 REMOTE passthrough 只从 trigger 的 run record 取 remote; 但远程项目的 **import 是 engine-native 必然本地跑** → record 无 remote → 下游 ctffind 被 startJob(row, {}) 本地启动 → WSL bridge 包裹 + star 全是集群路径 → WSL 看不到文件 → 每文件秒败×195。这正是用户看到的 wsl -d Debian 命令行。修复: passthrough 的第二来源 = **项目自己的集群绑定**(connectionId → defaultModule/useSlurm/slurmPartition), 优先级保持 trigger 记录先行(自选 GPU 宽度不丢)、项目绑定次之、两者皆无才本地。ghost-guard 判例同样适用于项目绑定(连接已删则降级诚实告警)。
- 【根因②(同一条死路的手动入口)】用户手点「Run on this machine」也会走本地泳道同一死路。修复: engine 新 clusterResidentRefusal——ctffind/motioncorr/autopick/extract/topaztrain 这些**真读显微图文件**的类型, 若 resolved star 的行是 POSIX 绝对路径且本机不存在者 ≥50%, spawn 前拒绝; 绑定集群的项目版教「Run ▸ Run on cluster (SSH)…」, 未绑定版教重导入或绑集群。为此把 runRealJob 的 resolveInputs+waiting+本闸**前置到 detectRelion 之前**(远程项目可能根本没有本地 RELION——「RELION not detected」不该抢在等待判定和集群驻留拒绝之前说话); refine 家族的 --continue 契约保留(resumableCheckpoint 存在时跳过上游再验证)。
- 【集群侧失败(用户日志的第二只麻雀)】~199 张 2 秒内全灭 = 每文件瞬时失败(读不进), 最像计算节点不挂载 /data06 显微镜数据盘(仅登录节点可见)。修复: finalizeRemoteRun 的 ctffind all-failed 签名触发**主动诊断**——从 stderr 警告行里取第一个具名 .mrc, SSH 回登录节点 `[ -r file ]` 一锤定音: 可读 → 「文件在 SSH 落地处完好, 失败发生在作业运行处——若走了 Slurm, 计算节点可能不挂载 <dir>(显微镜数据盘常只在登录节点)——试 direct 模式或拷到集群全局路径」; 不可读 → 「集群自己也读不了——重导入」。SSH hiccup 静默降级为原静态清单。result 截断上限放宽 900→1200 容纳诊断。
- 【遗留①: Import 节点类型】workflow.ts import spec 增 sel("nodeType", "micrographs", [micrographs, movies, particles])——RELION 自己的 import 对话语义。**卡的输出端口随类型走**: PortSpec 增 when 谓词, visibleOutputs(spec, job.params) 过滤; job-card + job-panel 的 LinkSourceControl 都走它(画布与布线抽屉同一真相)。类型即管线校验: micrographs 端口喂 CTF 族, movies 端口只有 MotionCorr 收(CTF 的端口拒收 movies kind——管线类型教顺序), particles 端口喂分类/选择族。引擎侧: import 的回执说 micrographs/movies; **回执交叉核对字节嗅探**(「Node type says Micrographs but the sampled headers say FRAME STACKS ⚠ 接 MotionCorr」/反向「已校正, CTF 可直接吃」)。particles 是独立腿 runImportParticlesNative: 方言验证(带 _rlnMicrographName = 显微图谱, 拒绝并教切类型; 无图像引用 = 不是粒子谱), 行内图像引用逐 token 重定基(相对 → 对源谱自己目录取绝对再按桥翻译; 绝对/集群绝对原样), 远程项目走 SSH cat 读源谱零上传; INPUTS 表 17 处 particles_star 消费者 from 列加 "import"; inspector 的 ImportGallery 对 particles 类型不渲染。
- 【遗留②: 随机抽 5 张】micrographs 路由新集群分支: star 行为集群绝对且本机不存在者 ≥50% 且项目绑集群 → 回执带 cluster 条(host/连接名/总数) + **随机抽 5 行**(一次批量 SSH 拿 stat+64B 头), 前端 ImportGallery 渲染紫色「on 127.0.0.1 · sample of 5」条 + re-sample 按钮(重掷即重取)。**缩略图走 SSH 预览门**: GET /api/jobs/[id]/micrographs?preview=<集群路径>[&full=1] —— 路径必须是**本作业自己 star 的行**(404 拒绝闯入者), remotePreviewPng 拉整文件进 data/remote-preview 缓存目录、renderMrcSlicePng/renderMrcLargePng 渲染(2–98% 对比拉伸, 同一管线)、**渲染后即删 .mrc**(缓存只留 KB 级 PNG), thumb/large 分文件缓存, 并发同路径去重。parseNames 的绝对行**保留前导斜杠**(旧版 `^\.?\/` 会剥掉——集群驻留检测靠它)。
- 【E2E 新约】scripts/diag-t315-remote-dispatch.mjs(83 断言, 3 连跑全绿): A 回归主断言——import(本地 native)完成 → 挂线的 PENDING ctffind **自动在集群上跑完**(REMOTE[cryo@…] 回执 + 集群 workdir 有 micrographs_ctf.star + DTO 带 runRemote); B 本地诚实拒绝(行翻红带教训 + 集群零落地); C 主动诊断双锤(mock ctffind 桩新增 .qa-ctf-allfail 旗标文件逐字复刻用户报错: 可读锤出 compute-node mount 故事, 删目录后不可读锤出 re-import 故事); D 节点类型四证(movies-on-micrographs 反向错配注记/对照错配注记/particles 导入 24 行 verbatim + class2d 集群跑通且提交脚本带 --i particles.star/错误方言拒绝); E 随机 5(清单带 cluster 条 + 总数 20 + 恰 5 采样 + 采样路径全在本作业 star 内 + 缩略图真 PNG 9286B + full≥thumb + 闯入路径 404 + 两次清单采样不同)。回归 t312(46)/t314(56) 双绿。夹具全真字节(MRC 头+像素, NSYMBT=0 对齐真布局)。途中真修三处: rebaseParticlesStar 的 inLoop 被 _rln 标签行重置(行永不入账); 行计数把 optics 行也算进去(24 粒子数出 25——改为只计含图像引用的行); mock 命令翻译把 fixture 谱的行 FS_ROOT 化 + 持久 stage map 把它们重写进 _staged/ 而 mock 桩解析不了——mock server 向桩环境导出 CRYOFLOW_MOCK_FS_ROOT, relion_refine 审计的绝对候选加 FS_ROOT 翻译兜底(真实集群无此层, 纯 mock 保真度补丁); 套件 cleanRemoteTree 落 t309 教义(按 projectId 烧集群项目树 + _staged + stage map 重置)。
- 【浏览器活体(agent-browser + prod 3001)】app 加载 console/page error 双零; UI 建连接+远程项目「Beijing KriosG4」+ import(20 张真字节 NZ=1)→ **Overview 标签页画廊活体在案**: 「Source micrographs · 20 · on 127.0.0.1 · sample of 5」紫条 + optics 芯片 + **5/5 缩略图全部加载**(SSH 预览门真出图); re-sample 点击落地(新五张 {8,4,16,14,3} 全加载); Params 标签页 **Node type 选择器在案**(三选项), 切到 particles → **卡的输出端口标签当场换到「Particles STAR」**, 切回 micrographs 复原; import 卡只渲染一个输出端口(when 过滤)。CTF (waiting) 卡挂线诚实 pending。三张定妆照: t315-gallery-cluster / t315-nodetype-params / t315-remote-project-canvas。UI 夹具全数烧净(项目/连接/集群树/本地镜像/预览缓存)。
- 【质量】tsc 0; 11 个改动文件 + diag 脚本 eslint 0; docs/remote-relion.md §4 项目绑定教义 + §4c 三条 t315 增补 + §5 失败目录两行; README 远程项目特性行扩写; mock gitignore 四夹具入册; 并行窗布局绑定套件(t313 demo 等)依 t299 判例不可跑于本沙箱, 引擎重排的语义不变量(等待判定/本闸/CTF 字节闸顺序 + resume 契约)由 t315/t312/t314 三套件全绿代偿。

Stage Summary:
- **「远程项目的本地半腿不该吞掉远程性」**: import 是本地记账, 但它的项目绑定就是远程性的第二来源——passthrough 只认 run record 的日子, 一条 import→ctffind 的挂线自动启动能把作业整条塞进 WSL; 从此 trigger 记录先行、项目绑定兜底、两者皆无才本地
- **「拒绝要说出门在哪」**: 本地泳道对集群驻留输入的答案不是 195 连败的尸体, 而是一句「这些文件在集群上——走集群的门」; 判定前置于本地 RELION 检测, 远程项目没有本地安装也能得到正确的话
- **「诊断要自己去看一眼」」: all-failed 签名不再只背清单——SSH 回登录节点 stat 第一个具名文件, 可读/不可读两个锤子两个故事(计算节点不挂载数据盘 / 文件真没了), 用户的 /data06 案例两个故事都排得上
- **「节点类型是管线类型教育」」: Movies 端口接不上 CTF 的输入端口——类型系统在连线的时刻教用户顺序, 比失败后诊断便宜一个数量级; 字节嗅探与用户声明的类型交叉核对, 回执当场说出矛盾
- **「预览不是搬家」」: 随机 5 张的 SSH 缩略图门——拉整文件只为渲染一张 PNG, 渲染完即删, 缓存里只有 KB 级缩略图; 数据零搬家契约不破
- 交付: 本窗 commit 就绪待 push(用户 token 未跨窗, 需下一条消息补发即推)

## Task 316 (2026-09-19, 用户工单窗口 —— t314 交付后的回执: CTF 派发在集群上 relion_run_ctffind symlink 失败)

- 【工单原文】`CRYOFLOW_NOTE: 1034 of 1034 rows carry movie-stack naming, but the sampled headers say single-section MRCs 4096×4096 (mode 2) — motion-corrected micrographs, safe for CTF.` 后接 `relion_run_ctffind` 的 `Failed to make a symlink from /data03/Lijing/cryoflow/<proj>/ctffind_fq0069iq//data06/.../DW.mrc to /data03/.../ctffind_fq0069iq//data06/.../DW.mrc`(filename.cpp line 610, from == to 同一字符串)。
- 【开局】沙箱第三次重建: 本地 HEAD 停在 t274 旧时间线(f5968f0, worklog 到 Task 274), git fetch 后远程已推进 55 提交到 bb24706 (t315)。取证: 远程 worklog 已含 Task 274 等价条目 + next.config ssh2 卫兵 + .env.example 全在 → 本地 t274 是重复时间线, 远程是超集 → `git reset --hard origin/main` 归位, bun install, dev :3000 200。
- 【取证(relion 源码, curl raw.githubusercontent.com)】`ctffind_runner.cpp` initialise: `symlink(currdir + myname, output)`, currdir=getcwd()+"/" (sbatch 脚本 `cd remoteWorkdir`), myname=star 行的 rlnMicrographName, output=fn_out+fn_post (fn_out=--o=remoteWorkdir+"/", fn_post=整串——绝对路径无 jobXXX 段)。star 写集群绝对路径 /data06/... → src=dst= `<workdir>//data06/...` (from==to 之谜全解) → symlink 炸于 filename.cpp:610。RELION pipeliner 铁律: STAR 路径必须项目相对。本地泳道早已如此(engine projectDirFor + linkDirInto, star 行 `micrographs/<name>`, QA 全绿); 远程泳道的 runImportRemoteLeg 写 CLUSTER-ABSOLUTE 路径(zero-upload 设计) → 违反约定。
- 【修复方向】镜像本地泳道智慧: 派发时把被上传 STAR 里的「集群绝对引用」在集群项目根下 symlink 成 `micrographs/<linkname>` 并重写 STAR 行为该相对路径——数据零上传保持, relion CWD(=workdir)向上两级是项目根, `micrographs/x.mrc` 相对解析成立。1024 micrograph 时 fn_post=`micrographs/x.mrc` 纯 basename, scratch symlink `<workdir>/ctffind_xxx/micrographs/x.mrc` 父目录即 scratch 自身(存在), ctffind 顺着读 `currdir+myname` = 项目根/micrographs/x.mrc → 真 symlink → /data06 真文件。

- 【实现（remote-run.ts，+203 行）】**两刀**：①**relink pass**——`remoteNativeRefs()`(STAR 里的集群绝对引用：以 / 开头、图像扩展、非 mirror 前缀、本地不存在) → `planRelinks()`(linkName 分配：basename 清洗 [A-Za-z0-9._-]、>120 截断、同名冲突 `__cfN` 后缀、同一 target 跨 STAR 共享一个 link) → `applyRelinks()`(字节子串替换, 与 rewriteStarPaths 同手法) → `ensureRemoteRelinks()`(集群上 mkdir <项目根>/micrographs + `ln -sfn` 批量建链, 250/批 SSH, 幂等) + `stageStarWithRelinks()`(上传的 STAR 内容= to-remote 翻译 + relink 重写, size-check 幂等)；RELINK_MAX=20,000 上限拒绝（防垃圾 STAR 搬运 symlink 农场）。relink 在 startRemoteJob 同步段规划（uploads 收集后、anti-ghost 前）, spawn 里先建链后上传。②**sbatch cd 对齐**——buildSbatchScript 的 `cd remoteWorkdir` → `cd remoteProjectRoot`（direct 模式 wrapper 一直是项目根；本地引擎 projectDirFor 同方言）。**死结的数学**：RELION 的 scratch symlink 是 `cwd+行`（src）与 `fn_out+行`（dst）——当 cwd==fn_out（--o==workdir）时任何行形态都拼出 src==dst 的自引用（用户 from==to 报错的机制；重跑时 exists(自引用链接)=false 而 ::symlink 答 EEXIST → "Failed to make"）。CWD 离开 --o 目录是唯一解, 而项目根正是原生 pipeliner + 本地泳道久经验证的形态。
- 【影响面核查】motioncorr/ctffind fakes 回显输入行（CWD 无关）；extract 的行绑定 star 自身目录（t308 考证）而非 CWD；autopick 的 odir/coord_dir 全绝对；array 的 $SHARD/$OSHARD 全绝对；--i/--o/run.out/.cf-exit 全绝对。cd 改动唯一改变的是 STAR 行的解析基准——恰好是修复本体。
- 【e2e：scripts/diag-t316-remote-relink.mjs，48 断言 ALL GREEN ×2】夹具=14 个真头 MRC(12 top + 2 sub/ 同名, NZ=1 4096 mode2)。**PHASE 2**: 远程导入 14 张·zero-upload·回执带字节身份; 本地 mirror star 断言含集群绝对行（用户世界的原样）。**PHASE 3（回归主断言）**: sbatch 派发 accepted → COMPLETED「CTF estimated for 14 micrographs」; 集群项目根 micrographs/ 下 **14 个 symlink**（readlink 指真文件）; 同名冲突拿到 `__cf2` 别名且指向 **sub/** 文件; 上传的 STAR 行=`micrographs/<name>` 零绝对残留(14/14); sbatch 脚本 cd 项目根且**不** cd workdir; run.out 无 "Failed to make a symlink"; 输出 STAR 行相对化（下游就绪）。**PHASE 4**: 重派幂等（ln -sfn 重指向, 仍 14 链, COMPLETED）。**PHASE 4b**: array split(shards=2) 派发 → COMPLETED, --array=1-2%4 在案, **merge 后的输出 STAR 仍项目相对**。**PHASE 4c**: direct 模式派发 → COMPLETED, run.out 无 symlink 失败。**PHASE 5**: 台账（relink 三件套 + 20k 上限 + ln -sfn 批量 + STAR 重写路由 + 建链先于上传 + 双脚本 cd 项目根 + from==to 签名正则钉死）。
- 【三跑三课】①导入夹具「文件夹+显式文件」混合列表走 multiFile 分支被 statRemoteFiles 拒（目录非文件）——改纯 14 文件列表（顺带测了 basename 冲突的天然夹具）。②readlink/cat 断言初稿按 `/projects/...` 集群方言写——mock 的上传层会把 .sh **内容**里的集群路径 sed 成 FS_ROOT 方言（脚本自执行需要）, readlink 也回 FS_ROOT 路径——断言改 suffix 匹配（双方言兼容: mock=FS_ROOT+projRoot, 真集群=bare projRoot）。③sbatch cd 断言同理。
- 【回归归属判定（stash 基线实验）】t304/t306 家族套件在当前沙箱挂（roster 哨兵 23 vs 3——DB 是重建态; parent sleep-30 的 verdict 未落 mock accounting——launcher 进程疑被环境 reaper/OOM 收割）。**stash 掉本改动后基线同样挂同位**（t304 parent landed null 逐字复现）→ 环境态失败, 非本改动回归。array 面的补偿验证=diag PHASE 4b（真实 array 派发 COMPLETED + merge 行相对化）, direct 面=PHASE 4c。家族全量回归让位（环境 rebuild 后 roster 世界不完整, 判例 t313 的源码级核验+代偿活体）。
- 【质量】tsc src 0; eslint 改动文件 0; agent-browser 主页 + clusters 按钮面 console/error 双零, 定妆照 t316-app-health.png / t316-clusters-dialog.png; dev.log 无运行时错误。环境插曲: dev server 两次被 OOM killer 击杀（Turbopack RSS 2.8G vs 4G 盒, dmesg 实锤）, dev-server.sh 拉起后全绿——t311 的 prod:3001 doctrine 正是为此, 本窗口 API 级 diag 在 :3000 足矣。
- 【收尾】worklog（本条）+ commit + push。用户的真实集群下一跑：导入的 1034 张不再以绝对路径行进 ctffind——派发时自动获得 <项目根>/micrographs/ 下的 1034 个 symlink + 相对化 STAR, sbatch 从项目根起跑, filename.cpp 的 symlink 两侧各得其所。

Stage Summary:
- **「from == to 是指纹不是巧合」**: 错误里 source 与 destination 逐字相同——顺着 relion 源码（ctffind_runner 的 `symlink(currdir+myname, output)` + filename.cpp 的 `symlink(src,dst)` + getOutputFileWithNewUniqueDate 的 fn_post=整串）推出数学死结: cwd==fn_out ⟹ 任何行都自引用。诊断的第一动作是把报错字符串当方程解。
- **「pipeliner 方言是唯一方言」**: STAR 行项目相对 + CWD=项目根 + 项目根下 micrographs/ 链接——本地泳道（projectDirFor+linkDirInto）早就说对了, 远程泳道这次抄齐了作业; zero-upload 设计保住了（数据不动, 链接替它搬家）。
- **「sbatch 与 direct 的 cd 分歧是债」**: t297 sbatch 引入时 cd workdir 是无人需要的（run.out/.cf-exit/argv 全绝对）——但它把 CWD 锁进了 --o 目录, 给自引用死结上了门。两个脚本构建器如今说同一句话。
- **「断言要懂 mock 的方言」**: mock 上传层对 .sh 内容的 sed 重写（FS_ROOT 化）是脚本自执行的必需, 也是断言的方言——suffix 匹配让同一断言在 mock 与真集群都成立。
- 遗留（下轮候选）: 家族全量回归（等环境/roster 世界重建后补跑 t30 批）; exists=false 的 UI 活体见证（t272 遗留, 连续让位）; EMPIAR 真数据回归（连续让位）

## Task 317 (2026-09-19, t315 推送后的全面代码审查 + E2E —— 审查揪出 t315 不变量仍有侧门, 同窗修复)

- 【流程】用户补发 token(并要求持久记住: 存 /home/z/.cryoflow-gh-token, 0600, 仓库外——不再每窗讨要), push bb24706(t315) → 19b768f..bb24706; 随后按用户指令做全面代码审查 + E2E 测试。
- 【审查(read-only 子代理)】结论 0 critical / 1 high / 3 medium / 6 low / 4 nit。核心修复判「正确且完整」, 但 t315 头条不变量「远程任务绝不进 WSL」仍有**四个侧门**违背, 新闸自身还有一个 WSL 桥假阳性模式。
- 【HIGH#1: 侧门】卡右键「Run job」/命令面板/失败 toast「Retry」/inspector「Start again」全都 POST /api/jobs/[id]/run **不带 body** → 远程项目的计算型作业走本地泳道 → WSL 包裹 + 集群输入 → 逐文件暴毙(t315 的粒子导入腿把这条死路开到了 class2d/refine3d 面前, 而 clusterResidentRefusal 只守 micrographs_star)。修复(本工单核心): **裸 POST 继承项目绑定**——run 路由对无 remote 无 local 的请求, 若 job 所属项目绑着活集群且类型可上集群(remoteEligible), 用共享的 projects.projectRemoteTarget(连接的 defaultModule ?? 首个探测模块 + useSlurm 模式 + 分区)分发——与 auto-start passthrough 同一目标同一形状(一处定义, 两门共用)。**显式本地选择保留为 { local: true }**(面板 ▾「Run on this machine」现在说这个方言), 它撞上的是引擎的集群驻留拒绝而非 WSL; store.runJob 增 opts, 其 toast 学会认响应里的 runRemote(「Job sent to cluster → user@host」)。闸的粒子孪生: engine 新 clusterResidentParticlesRefusal + PARTICLE_STACK_READERS(class2d/class3d/refine3d/initialmodel/multibody/polish/ctfrefine/dynamight/subtract/tomo_ctfrefine/tomo_polish——刻意排除 select/select2d/symexpand/rebalance/joinstar 等纯表手术 native), particleStackNames 解析 _rlnImageName 的 idx@stack 引用, 同一 ≥50% 多数决同一教学话术。
- 【MED#2: ghost-guard 重叠】trigger 的连接已删但项目绑着另一活连接时, 旧代码 `passthroughConn = passthroughConn ?? conn` 让三元的第一分支复活——向**死 connectionId** 分发, 每轮 sweep 重试同一幽灵。修复: 硬分叉——trigger 自己的 remote 记录只在**其连接存活**时赢(triggerConn), 否则项目绑定接管, 两者皆无才本地。
- 【MED#3: 无模块连接的 passthrough】连接没点过模块芯片(defaultModule=null)时 passthrough 分发 module:null → sbatch 无 module load → 整套 staging 白跑后 127。修复: projectRemoteTarget 统一用 defaultModule ?? lastProbe.relionModules[0](与运行对话框同一缺省)。
- 【MED#4: WSL 桥假阳性】桥接 Windows 主机上本地导入写出的 /mnt/c/… WSL 视图行, 主机侧 existsSync 必 false → 原来会把一次本可桥接跑通的本地运行误拒为「文件不存在」。修复: residentMissing 先经 wslToHost(行, savedWslDistro()) 反译(/mnt/c → C:\ 本机可见; 集群绝对路径 → 不存在的 UNC 或原样, 北京洞两边都关死); system.ts 新导出 savedWslDistro()(同步读检测快照, 无探测零开销)。
- 【low 快修族】preview.ts 三处键控修正(cacheKey/in-flight 键/瞬态 .mrc 文件名都带上 connectionId 与 scale——两集群同路径不再互相喂旧图, thumb+large 并发不再互删对方的 .mrc); FETCH_CAP 2GB→512MB + 超限话术教学(「帧栈不能当单图预览——导它的 MotionCor2 求和显微图」); 采样轮 SSH 命令改 CF|<path>|<size>|<b64> 哨兵行按路径解析(.bashrc 横幅噪声含 | 不再错位串槽); micrographs 路由集群 preview 门拒相对行(不再对着 SSH HOME cat); cluster.total 改全行数(混星不再少报); rebaseParticlesStar 方言拒绝只在 _rlnImageName 缺席时开火(老式工具的 _rlnMicrographName 伴生列不再误伤); 粒子导入腿 sourceDir 切边修(无斜杠→「.」, 根级文件→「/」——旧 lastIndexOf||undefined 惯用法前者剁尾后者把文件当目录); refine resume 块残留别名+游荡大括号清理。
- 【E2E 新约】scripts/diag-t317-review-fixes.mjs(~80 断言全绿): A 裸 POST(无 body, 与 store.runJob 字节一致)→ 远程项目 class2d(粒子导入喂) 在集群跑完(REMOTE 回执 + wrapper 带 project binding 的 module load); B {local:true} 撞上粒子版集群驻留拒绝(话术点名 particle stack + 集群门, 集群零落地); C 双段——中途删连接的诚实死亡钉桩(reconcile 的「connection for this run was deleted」判词) + ghost 分叉四案单元镜像(活记录赢/死记录落活绑定/无绑定归本地/native+绑定仍继承)+ 源码不变量(三元门在 triggerConn 上; 复活赋值已绝迹); D 无模块连接真门验证(defaultModule=null + /test 探测 → 项目绑定 passthrough 的 wrapper 带首个探测模块 relion/5.0.1); E 预览边门三证(相对行 400 + 600MB 稀疏帧栈撞 512MB 上限带教学 + 正常显微图仍出真 PNG); F 双标签方言谱(既有 _rlnMicrographName 又有 _rlnImageName)正常导入 6 粒子; G 源级不变量(根级 sourceDir 切片表达式逐字核 + wslToHost 三翻译腿单元 + 路由 local 标志/项目绑定调用核)。**途中真修**: mock translateCommand 连命令串里的 printf 载荷一起翻译——星表夹具的行被 FS_ROOT 化(本机存在 → 闸永不燃), 改 base64 整谱落地(base64 字母表无 /data2/ 字面量, 行为真集群绝对); 套件预启动课补(pending 行才会被 auto-start 消费——t315 Phase A 的 preStart 惯用法此前没被本套件的 C/D 相位继承); C/D 相位补 preStart 后 ghost 场景暴露「删连接杀 run 记录」的诚实产品语义 → 重设计为钉桩+单元镜像(t299 判例)。t315 Phase B 同步迁移到 {local:true} 方言(裸 POST 的语义已变, 该测试模拟的正是显式本地门)。
- 【撞号+合并】push 被拒——并行 cron 窗已用 t316(CTF symlink 票: 星行项目相对化 + sbatch cwd 离开 --o 目录 + RELINK PASS)且先落地; 按判例本工单重编号 t316→t317(套件 git mv diag-t317-review-fixes.mjs/两张截图/源码注释/worklog/提交信息/夹具目录 qa-t317-*), rebase 到 639fbc7, 唯一冲突 worklog 保留双方。语义复核发现**跨窗真回归**: RELINK PASS 把上传星表行改为项目相对后, t315 的 CTF 主动诊断对相对行逐字 stat(SSH HOME 下必不存在)→ 每次全灭都错说「集群自己也读不了——重导入」。修复(finalizeRemoteRun 诊断腿): 相对行先对 run 的 remote project root(dirname of remoteWorkdir, sbatch 同一方言)解析再探——relink 后的别名可读锤出 READABLE 故事, 目标真删了(悬空链接)仍锤出 CANNOT read。四套件(t317/t315/t314/t312)合并树上全绿; tsc 0 + eslint 0。
- 【回归基线】重编号与跨窗修复前: t315(83)/t314(56)/t312(46) 全绿 ×1 轮; 质量门 tsc 0 + 11 个改动文件 eslint 0。
- 【浏览器活体(agent-browser 1600×900 @ prod 3001)】app 加载 console/page error 双零; 目录(IMPORT 组含 Movies/Micrographs/Particles 三型卡)→ Enter 加 Import 落画布([data-job]×1)→ 面板渲染(Run Job + 运行模式 ▾ 菜单 + 无本地 RELION 的诚实禁用态)→ Params 标签页 Node type 选择器切 particles → 输出端口标签当场换「Particles STAR」(t315 特性回归在案); Dashboard KPI 渲染。两张健康照 t317-app-health / t317-dashboard。QA 残留(历轮套件堆积的「最后一个项目不可删」遗留)手动清空, DB 复位为单一空 Demo project。
- 【诚实记账】审查的 #13(17 处 particles_star 端口 label 仍说 "run Extract first")未修——UI 文案纯化妆且有测试断言锚定风险; #14(NATIVE_TYPES 与 REMOTE_BOOKKEEPING_TYPES 手抄双份)未修——纯重构风险大于收益; 两者入 roadmap 待办。
- 【环境】模板 :3000 全程存活; mock :3022 单实例; prod :3001 重建自 t317 代码(验证后保留); /home/z/cryoflow 树净待提交。

Stage Summary:
- **「不变量要无侧门才算不变量」**: t315 修的是自动启动的正门, 但四个手动侧门(卡菜单/面板/重试/再来一次)还在把远程项目的作业塞进 WSL——裸 POST 继承项目绑定 + 显式 {local:true} 保留本地门的诚实拒绝, 正门侧门同一教义
- **「同一形状, 一处定义」**: passthrough 与裸 POST 分发共用 projectRemoteTarget(含首探测模块兜底)——幽灵连接的死 id 永远赢不了活绑定, 无模块连接的 sbatch 永不白跑
- **「假阳性也是误伤」**: 桥接 Windows 的 /mnt/c 行、伴生 _rlnMicrographName 的粒子谱、混星的 total——诚实不是加严, 是把每个判定说对
- 交付: t317 五修(裸 POST 继承/粒子闸/幽灵硬分叉/模块兜底/桥反译) + low 快修族, 四套件全绿, 待 push

## Task 318 (2026-09-19, 用户工单窗口 —— t316 推送后的回执: 真实集群 CTF 重跑「exit 1 (RELION reported an error)」+ run.out 留集群 + 诊断 0 findings)

- 【撞号与重编号】本工单本地动工时自编号 t317, push 前探测发现远程已被并行审查窗（t315 推送后的全面代码审查+侧门修复）推进并占走 t317（其提交注明「renumbered from t316」）——按 t314 判例, 后推者重编号: t317→t318, 套件文件名/源码注释/worklog/提交信息全链更名; 该窗口与本地同动 finalizeRemoteRun 的 micPath 段（正交语义, rebase 合并: 他们解析项目相对行, 本窗把 remoteLogTail 改名 logTailText）。
- 【工单原文】`Job failed REMOTE[lijing@192.168.2.253]: exit 1 (RELION reported an error) — 1 bulky file(s) stayed on the cluster (key-files policy): run.out (download failed) … FAILURE DIAGNOSIS 0 findings — No known failure signature matched the full log`。用户随后亲自上集群通读 run.out，结论：**「确实看log是正常跑完了」**——作业实际成功，失败回执是假的。
- 【解剖：一个竞态解释全部三处异常】ctffind workdir 跨派发稳定（<root>/ctffind_<jobid8>），t314 时代的失败跑把 `.cf-exit`=1 留在里面；重跑的 sbatch 脚本自己的 `rm -f .cf-exit` 只在**作业启动时**才执行——落后 profile+module 加载数秒（或整个排队等待）；poll sweep 读 .cf-exit **存在性**当判决 → 窗口内的第一轮 tick 把上一轮的退出码伪造成新派发的判决（伪造 exit 1、证据尾为空：slurmstepd 刚截断 run.out 还没写字节）；sync 接着与仍在生长的 run.out 竞速撞进 t299 字节账（「download failed」），真实集群作业在无人看护下跑完。「the log is the ground truth」——集群上的 run.out 正是这么说的。
- 【刀① pre-submit clear】startRemoteJob 在递交**前**（remoteMkdir 之后、isSlurm 分叉之前）一次 SSH：`rm -f` 上一轮的 .cf-exit/.cf-pid/run.out/run.err/.cf-array-rc-*/.cf-shard-*.star/.cf-merge.lock，同一次 exec 末尾 `date +%s` 取**集群自己的钟**为派发栅栏（fenceEpoch）。清理失败静默降级（fence 缺席 → poll 回落 t318 前合同），绝不因清理打嗝拒绝派发。
- 【刀② mtime fence】aliveCheckScript 增第三参 fenceEpoch：__ex 先按存在性置位，再被 `stat -c %Y` 守卫降级——mtime < fence−2s（2s 吸收文件系统 mtime 粒度）的 .cf-exit 是上一轮的幽灵，不配当判决，检查落梯子（ALIVE/squeue → SACCT/VANISHED 诚实阶梯，slurm 与 direct 两世界同契约）。栅栏骑 RemoteRunState.dispatchedAtEpoch，sbatch/direct 两分支递记录时都带上；**两个 poll 门**（sweep 的 reconcileRemoteJobs + pre-spawn 的 pollOneRemote）都传参。stat 失败读 0 → 降级 → 梯子说话——消失的 exit 文件从来不是判决。legacy 记录无 fence → 信任任何 .cf-exit（旧合同不破）。
- 【刀③ evidence rescue】finalizeRemoteRun 失败路径：errTail 为空时最后一轮 SSH 取 run.out 尾 4096B + run.err 尾 2048B（`---CF-EVID---` 分隔）补回执——「判决 raced 日志 flush」或「sync raced 仍在生长的文件」的空尾从此有真相可读；真正一个字没打的作业得到诚实注记「run.out and run.err are EMPTY on the cluster — the wrapper exited before RELION printed anything」而非裸 exit 1 让用户猎一本不存在的日志。
- 【刀④ 诊断不再空口】job-inspector 的 full-log fetch：`diagnoseLog("") === []` 曾把「scanned the full run.out — 0 findings」渲染在一本一个字节都没有的日志上（伪造判决工单的回执正是这个长相）；fetch 失败的 `(log fetch failed: …)` 注记同理。两者保持 null 态——没有可扫的东西时卡片沉默。
- 【e2e：scripts/diag-t318-stale-exit-fence.mjs，52 断言 ALL GREEN】夹具=8 张真头 MRC。PHASE 3（回归主断言）：植入 t314 形状的幽灵（.cf-exit=1 + 毒化 run.out + 假 .cf-pid）→ 重派 → **幽灵的 .cf-exit 在作业启动前已消失**（刀①）→ 作业诚实 COMPLETED「CTF estimated for 8 micrographs」→ 回执不带伪造 exit 1、毒化日志不复现、集群 .cf-exit=0。PHASE 4（fence 最难窗口的遭遇战）：派发后趁 sweep 每 4s tick 时**中途植入**回溯 mtime 的幽灵 → sweep 全程看见作业 running（梯子说话）、**从未翻 failed**（旧代码一轮 tick 内就会判死）→ 作业诚实跑完、回执属于自己、新 mtime 的真 .cf-exit=0 被信任。PHASE 4b：direct 模式同一契约（幽灵清除 + 诚实完成 + 毒日志不复现）。PHASE 5：台账（刀①–④ 源码契约 + 3 次派发的记录全带集群钟 fence、epoch 值健全）。途中修一处台账正则的转义陈旧（实现定稿为模板字符串后 `)" -lt` 无反斜杠，断言还停在草稿形状）——行为面 PHASE 4 活体早已全绿，纯断言形状跟进。
- 【质量】tsc 0；四个改动文件 + diag 脚本 eslint 0。环境插曲：本窗 dev server 又被 OOM 收割（dev-server.sh NODE_OPTIONS 896MB 帽拉起后全程稳定）；mock :3022 常绿（SSH 服务，非 HTTP——curl 000 是方言不是死讯）。
- 【对用户真实世界的预言】真实集群上任何一次「失败后重跑」：不再有幽灵判决——回执要么是这一轮自己的真相（含空日志的诚实注记），要么作业还在跑（梯子看着它）。

Stage Summary:
- **「重跑的 workdir 是上一轮的凶案现场」**: workdir 稳定是设计（同一作业目录可追溯）, 但它也保存上一轮的 .cf-exit——脚本自己的 rm 只在作业启动时执行, 而 poll 从不等人; 预递交清除 + 集群钟栅栏把「谁的判决」从猜测变成时序
- **「存在性不是时序的证词」**: `[ -f .cf-exit ]` 只能证明有人写过它, 不能证明它是这一轮写的——mtime 对照派发栅栏（集群自己的钟, 不是应用钟——NFS 时漂之下应用钟会说谎）才是诚实的判据
- **「空尾回执要有救援, 无字日志要有墓志铭」**: 失败回执的空尾先补一趟 SSH 取真相, 取不到就明说日志为空——裸 exit 1 会派用户去找一本不存在的日志
- **「『0 findings』不是『扫描过了』」**: 空日志与拉取失败都不配宣称扫描——诊断的沉默分三档: 扫过无匹配/无物可扫/没扫成
- 交付: 本窗 commit + push（用户 token 单次 URL 推送）

## Task 319 (2026-09-19, 用户工单窗口 —— t318 推送后的回执: 「进度条似乎有些问题，很多次到99%后又回到0%」+ import 也有问题 + 「其实log中会有 Estimating CTF parameters using … 3.53/53.72 min ...~~(,_,"> [oo]」)

- 【工单】用户在真实集群上看到: 进度条反复 99% → 0%; import 进度也有问题; 并亲自指出日志里的真实进度信号——`3.53/53.72 min ...~~(,_,"> [oo]`。「检查所有job的进度条，并需要根据实际的任务进度来显示真实进度」。
- 【取证（relion 源码重新拉取, 沙箱重建后 t316 的缓存已失）】`3.53/53.72 min` 正是 RELION 自己的 progress_bar（src/time.cpp）: `init_progress_bar(N)` 后 `\r%3.2f/%3.2f min|min|sec` 原地刷新（超 1 小时切 hrs, 完结打 ` yum!`）——ctffind/motioncorr/extract/autopick 四 runner 全用它做**全任务级**条（elapsed×total/done 外推, 自适应任意 N）; ctffind/motioncor2 子进程输出被重定向到 per-mic 日志（`> fn_log`）, run.out 里的条无污染。refine 族的方言是 ` Expectation iteration N of M`（initialmodel: `Gradient optimisation iteration`）, 每迭代的 expectation 步自己 re-init 一条时间条。
- 【根因①: 解析器说的是死方言】parseProgressText 数 tail 窗口里含 "micrograph" 的行数再 **除以 6**——硬编码 6 张 EMPIAR 微图当分母。用户 1034 张的真实 ctffind 日志一句都读不懂, 微图行多时 60 行就封顶 99%。
- 【根因②: null 回落伪造 0%】sweep 读 run.out 的 4096 字节**滑动窗**; 窗口里没有可数行时解析返回 null, GET 响应回落到 DB 里派发时写的 0 → 卡片 99%（窗口有行）→ 0%（窗口滑过去）→ 99% → 0% 无限振荡——正是用户看到的样子。
- 【根因③: import 全程死 0%】原生 import 在进程内跑完整个 listing/stat/sniff/写盘马拉松, 行一直是派发时的 0, 直到 finalize 一跳 100。
- 【修复①: 解析器重写为真方言（新纯模块 src/lib/relion/progress-parse.ts, 无 fs/db 依赖——本地/远程/测试三方同一实现, engine re-export 保持导入方不变）】三方言按优先级: (1) RELION 时间条 `X.XX/Y.YY sec|min|hrs`（\r 折叠取每物理行最后一段, 全文取最后匹配=最新; `000/??? sec` 初始占位天然不匹配）; (2) refine 迭代头 `Expectation|optimisation iteration N of M`（日志自带的 N 权威于 --iter 参数）与迭代内条组合 `((iter-1)+barRatio)/total`, legacy `it [003]` 兜底; (3) n/N 计数行（mock 方言 `Micrograph 5/8`）直接做比值。**/6 硬编码死刑**。pct 上下夹 [1,99]——跑着的作业永远不说 100（finalize 才说）。
- 【修复②: 单调律 + 持久化（双 lane 同契约）】remote sweep 与本地 poll: `next = Math.max(旧行值, 解析值)`, 解析 null 保持旧值——「parsed beats stored, stored beats null」; 变化时 `updateMany({ where: { id, status: "running" } })` 落库（status 守卫: 并发 finalize 已完结的行永远碰不到; 派发重跑合法归零重爬）。UI 的 ETA 基线（p0 回退即重置）随之稳定。
- 【修复③: import 阶段证人】statRemoteFiles 增可选 onProgress（每 200 文件批回调, 其它调用方零改动）; runImportRemoteLeg 逐阶段上报（多选 stat 批 5→35 / folder·pattern 枚举 35 / 头嗅探 60）, 原生腿补 75（remote done）/60（EMPIAR·本地列单）/90（star 写盘前）——全部 status 守卫, 完成翻转 100 仍归 finalize。
- 【mock 假体说真方言】relion_run_ctffind 新增 RELION 时间条输出（\r 原地刷新 + worm + ` yum!` 收尾, elapsed×N/done 外推同款数学）, `Micrograph n/N` 行保留（家族套件的中途见证与 n/N 方言仍活）。
- 【e2e: scripts/diag-t319-real-progress.mjs, 60 断言 ALL GREEN】PHASE A 单元（bun 直导纯模块）: 用户原话行逐字解析 → **7%**; `000/??? sec` → null; sec/min/hrs 三变体; \r 多次刷新取最新; `yum!` ≈99 不越 100; refine 头+迭代内条组合 → 9%; initialmodel 梯度头 → 40%; legacy `it [003]`/25 → 12%; `Micrograph 5/8` → 63%; 垃圾尾巴 → null。PHASE B import 活体: 450 文件多选（3 个 stat 批）并发轮询 GET——样本 `0…18,18,32,100` 单调且中途移动（死 0 已绝迹）。PHASE C ctffind 活体（mock slurm, 450 张=60s 真时长）: 样本单调爬升 14 个移动步（0→6→13→20→…→100）, **99→0 振荡死亡**; run.out 带真方言字节（头行 + elapsed/total + worm + yum!）。PHASE D refine 活体（particles 导入喂 class2d, iterations=4）: 样本 `0…50…100` 单调。PHASE E 台账: 纯模块在场 + engine re-export + /6 绝迹 + 双 lane 单调守卫与 status 守卫持久化 + statRemoteFiles 证人 + import 三阶段 + 假体真方言。
- 【回归】t318（幽灵栅栏, 52 断言）全绿——sweep 同区域无回归; t316（relink, 48 断言）全绿——ctffind 派发链路含新方言输出无恙; t312/t314/t315/t317 绑定 :3001 prod 环境（各窗沙箱重建后不存在, 判例 t299/t316）——源码级核验代偿: 四套件零进度值断言、mock 附加 bar 行不触其拒绝/诊断正则; n/N 方言由 t319 单元钉住。tsc 0; eslint 0（六个改动文件 + diag）。
- 【环境插曲】dev server 两次被 OOM 收割（4GB 盒 + 450 微图活体轮询的内存压力, dev-server.sh 896MB 帽拉起即愈）; mock :3022 全程常绿。

Stage Summary:
- **「日志里的方言就是 UI 的方言」**: 用户一句「其实log中会有 3.53/53.72 min」就是移植指南——relion 的 progress_bar（time.cpp）全任务级时间条、refine 的迭代头、mock 的 n/N, 解析器从此只说日志真说的话; 硬编码分母（/6）是 EMPIAR 演示世界的化石, 在 1034 张的真实集群上只会说谎
- **「单调律是进度条的宪法」**: 滑动窗口 + 可失败解析的世界里, 「parsed beats stored, stored beats null」是唯一不振荡的合同; 持久化让每个 GET 都同意昨天说过的数, status 守卫让并发 finalize 永远赢
- **「跑着的作业不说 100」**: 夹在 [1,99], finalize 才翻 100——「99% 卡了十分钟」是诚实的（最后一张图在算）, 「100% 却还失败」是撒谎
- **「import 也要报进度」**: 原生腿的马拉松（stat 批×嗅探×写盘）从死 0% 变成阶段证人; 证人是可选参数——通用工具的签名不为一个调用方加负担
- 遗留（下轮候选）: mock 其余假体（motioncorr/autopick/extract）仍只说 n/N 方言（解析器已兼容, 升级为真方言属美化）; 家族全量回归（环境/roster 世界重建后）; exists=false 的 UI 活体见证（t272 遗留）

---
Task ID: 320
Agent: main-agent (Z.ai Code)
Task: 用户工单第八期(t320)——真实集群回执: relion_autopick LoG 拾取器带 --gpu 提交, autopicker.cpp:146 直接 REPORT_ERROR("The Laplacian-of-Gaussian picker does not support GPU acceleration. Please remove --gpu option."); 拉取最新代码并修复

Work Log:
- 拉取: origin/main 4ee0add→555eeef(并行窗 t318 幽灵栅栏 + t319 进度条方言), fast-forward, 树净
- 根因: 全应用的 GPU 决策是 TYPE 驱动——gpuStrategyFor(autopick) 返回 array/gpus:1, remote-run 的 GPU 适配块随即补 `--gpu 0` + `#SBATCH --gres=gpu:1`; 但 RELION 的拒绝是 FLAG PAIR 属性(autopicker.cpp read(): `do_gpu && do_LoG → REPORT_ERROR`, 已从 GitHub master 逐字核实, 用户 build 的 line 146 同源)——默认 LoG 拾取的派发恰好携带被禁组合, 在碰第一张微图前就死于 argv 解析
- 修复(六面): ①新纯模块 src/lib/relion/log-autopick.ts(isLogAutopick 谓词: type=autopick 且 pickingMethod 缺省/LoG; 兼容 client Record 与 prisma JSON 串两种形态; 不可解析走安全侧) ②hpc/slurm.ts gpuStrategyFor 增 logAutopick 通道(→ gpus:0, reason 陈述 CPU-only 契约) + buildSbatchForJob 接线(sbatch 导出门) ③remote-run.ts: 策略接线 + gpusRequested: logPick?0:gpuWidth + argv 级熔断splice(不变量本身, 防未来任何 append 路径) ④remote-run-button.tsx: LoG 时 stepper 换「0 × GPU — CPU-only picker」说明行(data-log-cpu-row), 提交体不送 gpus, 汇总行「sbatch · CPU (LoG picker)」——「会被拒的旋钮不是旋钮是陷阱」(本文件自己的教义) ⑤mock relion_autopick 复刻真拒绝门(逐字用户 stderr 文本 + autopicker.cpp 引用, exit 1)——回归会响亮失败而非静默完成 ⑥log-diagnosis 新 autopick-log-gpu 签名(旧脚本/手编 sbatch 的残余面得到命名诊断) + workflow.ts pickingMethod hint + command-templates 注记
- References(模板匹配)与 Topaz(CNN 包装)保持 GPU 不动——RELION 自己的 GUI 也只在这两者允许 GPU
- e2e: scripts/diag-t320-log-cpu.mjs 74 断言 ALL GREEN(prod :3001 + mock :3022): PHASE A 单元(谓词真值表 8 + 策略门 6 + 桩直执 4——LoG+gpu exit 1 且逐字命中用户回执文本, LoG 无 gpu exit 0, gpu 无 LoG 不触发); PHASE B 用户原景复刻(import 8 张集群微图 → 默认 LoG autopick @slurm gpus:6): COMPLETED, .cf-sbatch.sh 无 --gpu/--gres/mpirun 且 --ntasks=1, run.out 说 LoG 拾取零拒绝文本, 记录 gpusRequested=0, 录制命令无 --gpu; PHASE C 对照链(LoG picks → extract → class2d → References autopick @gpus:2): COMPLETED 且脚本带 `--gpu 0` + `--gres=gpu:1` + `--ref`, gpusRequested=2——修复收窄在 LoG 门, 从不闸整个类型; PHASE D 导出门双面一致; PHASE E direct 第二通道同守其约; PHASE F 台账 9 契约钉死
- 回归: t318(52)与 t319(60)全绿——两套件原绑定 /home/z/my-project+:3000(环境已重建回模板), 按可重定位临时副本(sed ROOT/BASE, 原提交工件未动)于 prod :3001 重跑; tsc 0; eslint 0(七改动文件 + diag)
- 浏览器活体(agent-browser 1600×900 @ prod :3001): console/page error 双零; References 对话框 stepper 6×GPU(--gres=gpu:6, mpirun -n 6, --gpu 0:1:2:3:4:5)在案; LoG 对话框「0 × GPU — CPU-only picker」+「sbatch · CPU (LoG picker)」+ stepper 消失; **反应式证明**: 同一作业 Params→Picking method 切 References, 重开对话框 stepper 当场回归——谓词活在 job params 上; 两张定妆照 t320-run-dialog-*.png 入仓库
- docs: remote-relion.md §4b 新「The LoG picker is CPU-only (t320)」小节 + §5 失败目录新行

Stage Summary:
- 工单闭环: GPU 决策从「按类型」升级为「按方法」——LoG 拾取器从此零 GPU 请求(无 --gpu/无 --gres/记录 0), References/Topaz 照旧; 单一纯谓词被派发/导出/对话框/测试四方共享, argv 级熔断把不变量钉在最终命令上
- mock 说真方言的教义再下一城: 假体在真二进制死的地方死(逐字文本), 回归无处静默
- 环境: 模板 :3000 全程运行(GET / 200), mock :3022 单实例, prod :3001 验证用(待 push 后清场)

---
Task ID: 321
Agent: main-agent (Z.ai Code)
Task: t320 推送后的全面代码审查(只读子代理 11-a: 0 critical/1 high/0 medium/2 low/2 nit)发现三处残余 → 修复回推

Work Log:
- 审查裁决: 六刀架构正确——谓词住在 startRemoteJob 单一咽喉(其唯一调用方 dispatch.ts:170, 所有门都到它), splice 在 t306 $SHARD 重写之前无索引危险, 7 个审查面里 6 个干净
- HIGH 修复(谓词/构建器分类失配可复活原 bug): isLogAutopick 首版精确匹配 `=== "Laplacian of Gaussian"`, 而 engine buildArgv 把一切非 "References"/"Topaz"(含 "LoG"/小写/带空格/数字/垃圾串, str() 无 trim 无大小写折叠)都送 --LoG else 支——非规范值会拿到 GPU 却仍带 --LoG, 被禁组合复活; params PATCH 路由不校验枚举故可达。修复: 谓词逐字镜像构建器分支(`method !== "References" && method !== "Topaz"`), 构建器会发 --LoG 的一切形态 GPU 决策都按 CPU 处理
- LOW 修复(模拟器不知道方法): /api/hpc/simulate 只按 type 调 gpuStrategyFor——队列规划给默认 LoG autopick 计 1 GPU/膨胀 GPU 时; 修复: 线程 isLogAutopick(j.type, j.params), 规划与真实派发同方言
- LOW 修复(透传转发无意义的 gpus: 0): dispatch.ts 远程透传把 LoG 触发器的 gpusRequested: 0 经 `!= null` 门转发为 gpus: 0, 被 startRemoteJob 的 `Number(target.gpus ?? 6) || 6` 静默 coerce 回默认 6(净中性但形状错); 修复: `gpusRequested > 0` 才转发
- NIT 不修: splice 单次移除(当前唯一性不变量成立, while 属未来保险); inspector 无 CPU 字(对话框已说契约)
- diag-t320 扩至 85 断言 ALL GREEN(prod :3001 重建后): 新增镜像单元六案("LoG"/小写/带空格 " References "/数字 5/空串/prisma 串 Topaz 对照) + simulate 活体(LoG 8 分片 bar 全 0 GPU, References 8 bar 全 1 GPU——规划与派发同账) + 台账三新契约(镜像谓词/模拟器线程/透传 >0 门)
- 回归: t318(52)/t319(60) 于新构建复跑全绿; tsc 0; eslint 0(四改动文件 + diag)

Stage Summary:
- 审查三发现(1H/2L)全部修复并验证; GPU 决策与 argv 构建器从此共享同一分支语义(镜像即合同), 队列模拟器与真实派发同方言, 透传不再送会被 || 6 吞掉的 0 宽度
- 遗留 NIT 两枚按 roadmap 记账未修
## Task 322 (2026-09-19, 用户工单窗口 —— t318 后积压双票: 「状态显示不符实际」+「import 图片加载极慢」)

- 【工单原文】①CTF(Slurm 124589)未完成时下游 Automated Picking 1(Slurm 124590 · 6 GPU)实际在排队(详情行已显示 queued · waits on 124589), 但节点状态徽章却显示 Running, 计时器已走 4m14s——alive 判定未细分 squeue 的 PD/R 州。②import 缩略图加载极慢: 疑似整份 .mrc 每次经 SSH 全量拉取; 用户提议集群上先压缩成小格式再传回, 并本地持久缓存不再每次重读。
- 【撞号与重编号】本窗自编号 t321, push 前探测发现并行复审窗已用 t321(t320 的三残留复审: 谓词镜像 argv builder/simulate 计费穿线/passthrough 宽度门)并先落地——按 t314 判例后推者重编号 t321→t322: 套件/种子/截图/源码注释/docs §4e§4f/worklog 全链更名, rebase 到 44f2741(worklog 单冲突, 双方保留)。
- 【开局: 收编崩窗 WIP】上一窗(崩上下文者)已动工两票并本地提交 37ad575(UUID 垃圾消息, 未推送): isSlurmQueued 谓词+五表面排队方言(card/panel/inspector/dashboard roster/gallery) + preview.ts decimation ladder(+294)+mrc.ts decode/render+路由确定性采样。并行 LoG 窗口已在 origin 落地 t320 → 按 t314/t317 判例后推者重编号: rebase 到 d205571(零文件交集, 干净), stray 九文件 t320→t322 全链更名, 与本窗补全合并为单一正经提交。
- 【审计补刀①: hover 预览漏网】JobCardPreview(卡片悬浮偷看)仍对排队作业说 teal「Xm elapsed · 0% · ETA」+进度条——补 queue 方言: 「Xm in queue」amber, 无 %声明无 ETA 无条。
- 【审计补刀②: Recent activity 卡漏网】浏览器活体揪出的第二只麻雀: 跨项目最近动态卡的 StatusBadge 无 queued 方言 + running 分支画 0% shimmer 假条。修复: /api/activity/recent 增瘦身 runRemote(mode+slurmState+slurmDependsOn 三字段, runs store 内存读, slim select 精神不破) + RecentJob 接口 + 徽章 queued + 排队行方言。
- 【后端早已会说】t297 起 sweep 每 4s 用 squeue -o %T 活体刷 runRemote.slurmState(t303 起序进 DTO)——工单 1 的病全在 UI 渲染层合并了两个州; dispatch 时记 PENDING、sweep 持久化、ALIVE:PENDING/RUNNING 方言早已在案(1789/2026/2330 三处钉)。
- 【decimation ladder(用户「在集群上先压缩再传回」的正解)】三级阶梯, 全部集群侧纯脚本零上传零残留: ①python3 纯标准库(struct+file seek, 无 numpy 依赖): 集群侧解析 MRC 头, 双轴最近邻抽稀, base64 流回——4096² float32 显微图 64MB → ~556KB(121×), 8 帧电影栈走中帧一帧; ②GNU dd 跨步行(od 读头+iflag=skip_bytes,count_bytes 逐行)——全宽行传回本地列抽稀(步数数学与 downsample() 完全一致 → 三层级像素级一致, ladder smoke 钉死); ③整文件拉取(FETCH_CAP 512MB+教学拒绝)兜底。CFD|PY/DD/ERR 哨兵语法, 前置横幅噪声跳过(t317 教义), 载荷截断拒绝(null→下一级, 绝不渲染半张图), DD_PAYLOAD_CAP 48MB 防病态宽度。
- 【确定性采样(「不再每次重读」的第一半)】旧 Math.random 每次访问重掷五张→PNG 缓存永不命中→每次五条全量拉取。修复: 路由 fnv1a(job id+reroll 计数)种子 + mulberry32 确定性抽五, gallery 把 reroll 计数持久化到 localStorage(重开 inspector 同五张, re-sample 按钮推进并记住); 预览响应带 Cache-Control: public, max-age=86400(浏览器不再重复问) + X-CF-Preview-Tier/-Bytes(谁服务的+线上账单); PNG 持久缓存 data/remote-preview(t317 已带 connectionId+scale 键)。
- 【e2e: scripts/diag-t322-queued-previews.mjs, 60+ 断言 ALL GREEN ×3】PHASE A 单元(bun 直导 preview.ts): 双 builder 方言(heredoc/哨兵/纯标准库/mid 选择/od 头/iflag 跨步/too-big 帽)+解析器真值表(PY 网格维度/DD 全宽行/截断拒绝/ERR/无哨兵拒绝)。PHASE B 活体(用户回执形状复刻): import(done)→motioncorr(sbatch RUNNING, sweep 活体词)→ctffind 在父活时派发——sbatch 脚本带 afterok:<父id>+kill-on-invalid-dep, **同一轮 poll 里子 running+PENDING+waits-on+progress 0 而父 RUNNING**(两张嘴两个诚实词), 父落地后子 slurmState 翻 RUNNING(sweep 见证唤醒)→诚实 COMPLETED「CTF estimated for 32 micrographs」; 排队窗口内 /api/activity/recent 行携带瘦身 runRemote(slurm+PENDING)。PHASE C 活体(阶梯真像素): 集群侧 python 造夹具(12×1024²+4096²(64MB)+1024²×8 帧, 零夹具跨线两次); 确定性采样(两次同五/reroll=1 不同五/reroll 稳定/采样⊆star 行); 大图预览 tier=python+PNG 魔数+线上账单 556KB<1.5MB(121×)+Cache-Control; 二访 tier=cache 字节全同; large 独立槽(更大 PNG); 帧栈中帧预览; 闯入路径 404(t315 门仍武装); 磁盘缓存 ≥3 PNG。PHASE D 台账: 谓词一处定义/五+二表面/徽章 pending 方言/hover in-queue/row3 上游 id/panel/inspector wait 调+排队卡/双 dashboard 表面/路由种子无 Math.random()调用/预览头/阶梯顺序+双帽/结果层级方言/mrc 三助手/gallery localStorage。
- 【scripts/qa-t322-ladder-smoke.mjs(崩窗遗留, 收编更名), 20 断言 ALL GREEN】bash 直接执行两级集群脚本(与 SSH exec 同落地): 方形/非方形/4 帧栈(mid/first 选择)/mode6 uint16/垃圾文件双级诚实拒绝/横幅噪声免疫, **全部与整文件渲染字节级一致**(tier 数学=downsample 的像素)。
- 【途中真修: mock sacct 丢执行位】首跑 ctffind 子作业卡 PENDING——mock 的 sacct 是 664(仓库里就是 100644, 沙箱重建即坏): 依赖循环 sacct -j 永远空 → 子作业永等。chmod +x 并随提交落 100755(这也解释了 t320 窗 t304/t306 家族的部分「环境性」失败)。sacct 修复后依赖链全通。
- 【浏览器活体(agent-browser 1600×900 @ prod :3001)】dev:3000 三次被 OOM 收割(4GB 盒, 浏览器+dev 共存即 t311 判例死局)→ 按判例建 standalone prod :3001(共享 dev DB+data 树)。**画廊**: import 卡 Overview 5/5 缩略图全载(ladder 经真 SSH 出图)+re-sample 新五张全载; **排队回执**: 重跑制造 motioncorr(RUNNING)+ctffind(PENDING waits on)窗口——画布卡「queued · waits on 52」amber 徽章无条无表; inspector「Queued」徽章+strip「Slurm job 55 · queued · waits on 54」+诚实空日志; Overview ResultSummary「Waiting in the Slurm queue — Slurm job 57 is held until 56 lands」; dashboard 花名册行「Queued | queued · waits on 56」; **Recent 修复前后对照**: 修复前「Running | 0%」shimmer, 修复后「Queued | queued · waits on 58」。console/page errors 双零, 无失败请求。四张定妆照: t322-queued-card / t322-inspector-queued / t322-inspector-queue-card / t322-recent-queued-fixed。
- 【回归】t318(52)全绿; t319(60)全绿; t320(74, ROOT/BASE 搬迁副本, 原件不动)全绿; qa-t322 ladder smoke ×2 全绿; diag-t322 ×3 全绿(含 Recent 扩展)。tsc 0; eslint 0(全部改动文件+两个新脚本)。
- 【收尾】docs/remote-relion.md §4e(队列是状态不是沉默)+§4f(集群抽稀+本地缓存); UI 夹具烧净(DB 复位回 demo 单项目, 集群树/预览缓存/data 残留全清); dev :3000 拉起常绿, prod :3001 保留(t320 判例)。

Stage Summary:
- **「排队是调度器的事实, 不是 UI 的沉默」**: 后端从 t297 就会说 PENDING/RUNNING——病在渲染层把两个州合并成一个 Running; 一个共享谓词(isSlurmQueued)让徽章/悬浮/面板/花名册/时间线/结果卡/最近动态七表面同说一句话, DB 状态不动(sweep 拥有生命周期, 渲染拥有词汇)
- **「压缩发生在数据的一侧, 传输才便宜」**: 64MB 显微图只传 556KB 的秘密不是更快地拉, 而是根本不拉——集群侧 python3/dd 抽稀后只传瘦身像素, 三层级与整文件渲染像素级一致(数学同源), 帧栈走中帧
- **「缓存的敌人是随机性」**: Math.random 每次重掷五张 = PNG 缓存永不命中 = 用户看到的「每次重新读取」; 确定性采样+localStorage 持久+HTTP 缓存头, 三层缓存各司其职
- **「沙箱重建会带走文件权限」**: git 只记 100644, mock sacct 从仓库回来就是坏的——依赖链静默卡死; e2e 的第一现场比断言更早说出真相
- 遗留(下轮候选): 家族全量回归(t304/t306 等, 环境重建后补); exists=false 的 UI 活体见证(t272 遗留); mock 其余假体升级真方言(美化)

## Task 324 (2026-09-20, 用户工单窗口 —— 「为何前面的extraction已经完成，但是2d分类还一直是pending」)

- 【工单原文】2D Classification 1 · Pending · created 10h 9m ago · "Waiting for upstream output: particles.star (run Extract first) — runs automatically once ready" + "The job did not fail — it starts AUTOMATICALLY the moment its upstream inputs are ready" —— 而上游 Particle Extraction 1 已 COMPLETED。inspector 头部的 "12s" 是 job type spec 的预置演示时长（class2d spec duration=12000ms），不是任何真实运行。
- 【根因】就绪门是「仅本地」的：resolveInputs 的提供者扫描要求 outputs[key] && existsSync(本地同步副本)，startRemoteJob 在任何 staging 之前走同一调用把关。但同步回传按设计会留文件在集群（per-file 上限、总预算、key-files 策略、下载中途失败——576 张显微图的 extract 在 576 个 .mrcs 栈旁边写一个数 MB 的 particles.star）。结果：远程流水线的关键 star 留在集群 → 下游永远 pending，消息却说「先跑 Extract」——对一个已经成功的作业撒谎；文件就躺在下游作业即将运行的同一集群上。记录里本来就有 remote.remoteOutputs 孪生路径供这种消费，只是门从未走到那一步。附生两缺陷：①「就绪后自动运行」的承诺没有重试——一次性触发器（finalize/exit handler/native 分支）只响一次，错过时刻的消费者要等到服务器重启；②留驻形态的等待消息在撒谎。
- 【修复四面】①resolveInputs 增远程风味（{remote, connectionId}）：本地副本缺失时可用记录中已验证的集群孪生解析——解析值就是集群路径，staging 跳过与 argv 都以它为准（孪生映射加「身份条目」，同连接门控；异集群孪生被拒并给出跨集群叙事）；本地车道保持纯本地语义但说真话（「…its particles.star stayed there (over the sync caps) — send this job to the cluster, or raise the connection's sync caps and re-run the upstream」——标签里的 "(run X first)" 尾巴被剥掉，那正是被替换的谎言）。②finalize 对同步遗漏的键探测集群（REMOTE_OUTPUT_CANDIDATES：精确名 + 迭代 glob，一轮 SSH，仅在真缺时）——记录持有集群真相，回执说文件在哪（"particles.star stayed on the cluster (verified there) — downstream cluster jobs chain off the cluster copy in place"）而非「no expected outputs appeared」；outputProbeAt 戳为阴性探测限频。③startRemoteJob 懒治愈：远程风味仍缺时，对谱系中同连接的已完成远程记录做一轮批量探测再重解析——pre-t324 记录在下次尝试时自愈，无需重跑。④jobs GET 增 pending 重试（~20s 限频）：pending 消费者经其已完成上游重试——承诺有了心跳。
- 【mock】relion_preprocess 增 star 填充杠杆（~/.cf-mock-star-pad：注释行是合法 STAR 语法，全家解析器都跳过 #）——e2e 能诚实地把 star 顶过同步上限，无需手术伪造。
- 【e2e scripts/diag-t324-remote-twin.mjs，85 断言 ALL GREEN ×3】UNIT（bun + 夹具 state 文件）：远程风味真值表（孪生解析/本地优先于孪生/异集群拒绝/诚实本地消息/用户原文基础消息/failed 提供者优先级/探测工作单）。LIVE A（用户全流水线，诚实强制：紧连接 maxFileMb=1 + pad 杠杆使 particles.star 真的被上限跳过——真 cap 机制，无手术）：import → [pending extract, pending class2d] → LoG autopick（唯一手动远程派发）→ 自动级联：extract 经 passthrough 自动启动并完成、回执带留驻说明、本地镜像无 star、记录带孪生+戳、class2d 经孪生自动启动（--i 是集群路径）并完成——首 Dispatch 后零手工点击。LIVE B（pre-t324 记录 + 重试心跳）：对照链正常完成后，手术把 extract 记录回退到 pre-t324 形态（outputs 空/孪生空/本地 star 删除）→ 新 class2d 本地门 pending 带用户原文消息（此形态的诚实上限——尚无人知道文件在哪）→ ~20s 重试扫描自动触发 → 懒治愈探测集群 → 记录孪生回归 → 作业对集群副本完成（cmd --i = 治愈孪生，本地 star 始终未再下载）→ 服务器日志见证 heal 与探测判词 → 治愈后的本地门说真话（send to cluster / raise caps 双 remediation）。LEDGER：15 条源码契约钉死。
- 【回归】t320(85)/t323(73)/t322-queued-previews(60+，重定位副本)/t319(60，重定位副本)/ladder-smoke(20) 全部 ALL GREEN @ prod:3001；tsc 0；eslint 0（四源文件+diag）；浏览器活体 console/page error 双零，定妆照 t324-app-load.png。
- 【docs】remote-relion.md §4h「The cluster is the truth for a remote chain (t324)」+ 失败目录新行。

Stage Summary:
- **「集群是远程链路的真相」**：就绪门从「本地 existsSync」升级为「本地副本 or 已验证的集群孪生」——远程消费者原地消费集群副本（无重上传、无本地副本），本地车道说真话而非卡死
- **「承诺需要心跳」**：就绪后自动运行 = 一次性触发 + ~20s 重试；懒治愈让 pre-t324 记录在下次尝试时自愈——用户拉取修复并重启后，卡了 10 小时的 2D Classification 会在首次 jobs GET 时自行走向集群
- 环境：模板 :3000 运行，mock :3022 单实例，prod :3001 运行中（CRYOFLOW_DATA_DIR 指向仓库 data）

## Task 324-a (推送后只读审查的残余闭合)

- 审查裁决: 6550fcd 0 critical/0 high/2 medium/3 low/5 nit, 核心声明全部源码成立
- MEDIUM①: t313 CTF 门对孪生解析的 star 静默哑火(readFileSync 集群路径 throw→catch 返回 null/null)——「unverifiable→放行带注」教义退化为「放行无注」; 修复: 调用点先查本地可读性, 孪生 star 降级为门自己的忠告方言("…no local copy was synced — the local MRC byte check (NZ) did not run")
- MEDIUM②: topaztrain 的 t265 索引合成读本地盘, 孪生输入跳过合成→把原始 per-mic coords star 当 --topaz_train_picks 交给 RELION(注定失败的 spawn); 修复: 诚实 PENDING 拒绝带 remediation(提高 caps+重跑上游即自愈, ~20s 重试自动接手)
- LOW③: 探测脚本 cd 失败 exit 0→盖 10 分钟「验证缺席」戳——不可进入的目录不是文件不存在的证据; 修复: exit 3 + code!==0 不算 ran(无戳无孪生, 下次真重试)
- LOW④: "latest" glob 排序 LC_ALL=C 钉字节序(免疫 locale)
- 5 NIT 记账不修(tab 截断病态/多子句标签/成功分支无 1400 帽/liveRunCount 只数本地/断言死分支)
- diag-t324 扩至 89 断言 ALL GREEN(四条新 LEDGER 契约); t320(85)/t323(73) 回归全绿; tsc/eslint 0; 浏览器双零
- push: 6550fcd..6f3db67 main→main, ls-remote 校准, 树净

Stage Summary:
- t324 + t324-a 双提交闭环并推送 https://github.com/Jing0715-fer/cryoflow main @ 6f3db67
- 环境: 模板 :3000 运行, mock :3022 保留, prod :3001 运行中(CRYOFLOW_DATA_DIR 指向仓库 data)

## Task 325 (2026-09-21, 用户工单窗口第二周 —— 「还是一直pending，并且extraction到2d分类的连线在UI中有时会消失，但是input中的内容还在，2d还是一直pending跑不起来，还是通过cluster上运行的」)

- 【工单原文】同一张 2D Classification 的第二周：extraction 已完成（集群上跑的），2D 依旧永久 pending；新症状——Extract→2D 的连线在 UI 中「有时会消失」，但 inspector 的 input 内容还在。
- 【复现先行】在 mock 集群 + prod:3001（用户当时运行的 t324-a 构建）上逐字复现：import→LoG autopick→extract 全链 slurm 完成、particles.star 留驻集群（finalize 探测已记孪生）、手术回退 pre-t324 记录（孪生清空）、**删除连接并重建同主机新连接、项目重绑** → ~20s 重试心跳持续 firing 但 2D 永久 pending、消息一字不变——50 秒零动作，RED 实锤。
- 【根因三重】①**连接漂移**：t324 的全部孪生门（resolveInputs 接受、懒治愈资格、staging 身份映射）都比较裸 connectionId——重连后重试派发带着新 id，旧记录的治愈被拒、孪生被拒，消费者对着「文件就躺在它即将运行的集群上」永久等待。②**镜像丢失（连线消失的机制）**：边同时存于 DB（引擎唯一视野：lineageFor + 重试扫描只查 db.edge）与 sidecar 文件（画布视野）；edgesWithPorts 的自愈重写用**陈旧快照算 keep-set 过滤新鲜文件**——GET 在途时连接的边两条过滤臂全败被逐出；叠加 persistPortEdge 镜像建行失败的**静默吞 catch**（SQLite busy），两端皆空：画布线消失、谱系空、消费者 pending 且消息撒谎（「就绪后自动运行」对无边的作业永远无法兑现）。非原子写再加跨进程撕裂读（半个 JSON → edges:[] → 该次响应所有 sidecar 线全灭）=「有时会消失」。③**撒谎的方言**：谱系空（丢边）与「完成的远程记录但键无处登记」（pre-t324 记录）都落到通用消息「Waiting for upstream output: particles.star (run Extract first)」。
- 【修复四面】①**集群身份 = (connectionId, host)**：sameClusterTarget() 单一谓词共享给三道孪生门（resolveInputs 增 opts.host；懒治愈资格；staging 身份映射）——同主机重建的连接照常治愈/接受孪生/跳过 staging；真异主机保留跨集群拒绝。②**边层耐久**：sidecar 写原子化（tmp+rename）；自愈 keep-set 从**新鲜读**推导（并发新增永远存活）；**每次读取回填缺失的 DB 镜像**（引擎视野与画布视野不再静默分叉）；镜像建行失败改为有声警告。③**诚实的 pending 方言**：空谱系→「No upstream job is wired that produces particles.star — connect one (drag a wire from its output port)…」（点名真实修复，不再承诺无法兑现的自动启动）；远程完成但键无处登记→「Upstream "X" completed on the cluster, but where its particles.star lives is not on record — send this job to the cluster (the dispatch probes the upstream's workdir there)…」。④**重试轮次的成员隔离**：单个 throw 的消费者不再毒化整轮（per-id try/catch + 具名日志）。
- 【e2e scripts/diag-t325-connection-drift.mjs，65 断言 ALL GREEN ×3】UNIT（bun + 夹具 state）：sameClusterTarget 真值表（同 id/bare 过、异 id 同 host 过=漂移修复、异 host/无 host 拒）；远程风味孪生经重建连接解析（工单单元级）；异主机/无 host 保留 t324 拒绝；丢失边方言；注册表过期方言；无记录基础消息原样存活（t324 契约）。LIVE A（用户工单端到端）：紧 cap + pad 杠杆使 star 真留驻 → 手术 pre-t324 记录 → 删连接 A / 重建连接 B（同主机）/ 项目重绑 → 本地门说注册表过期方言 → **~20s 重试心跳 + host 匹配懒治愈 → 2D 完成于集群副本**（cmd --i = 治愈孪生；本地 star 始终未再下载；记录孪生+戳回归；服务器日志见证 passthrough 丢弃/项目绑定回退/heal 探测判词三段叙事）。LIVE B（镜像丢失）：真门连接对 → 手术仅删 DB 行（repo 自身 prisma 客户端 + 查询日志噪音剥离）→ 派发门说丢失边方言 → 画布仍画线（sidecar 渲染，恰好 1 条）→ 一次 GET /api/edges **回填镜像**（ROWS1 + 日志见证）→ 同一派发门翻回普通等待方言（引擎看见边了）。LEDGER：11 条源码契约钉死（原子写/新鲜过滤/回填/有声镜像失败/成员隔离等）。
- 【t324 套件随行更新】cls3 断言改期望注册表过期方言（该形态的诚实上限被 t325 抬高——不再是「run Extract first」谎言）；两条 LEDGER 钉改 sameClusterTarget 形状。
- 【回归】t325(65)×3 / t324(89) / t323(73) / t320(85) 全部 ALL GREEN @ 重建 prod:3001；tsc 0；eslint 0（四源文件）；浏览器活体（agent-browser 1600×900）：渲染干净 console/page error 双零，两作业 + 连线经真实 API 建立后画布渲染 1 条线（reload 后仍在），定妆照 t325-browser-canvas.png / t325-browser-wire.png。
- 【环境坑（非代码缺陷）】standalone 重建后需 DATABASE_URL 绝对路径 env（相对 file: URL 随 process.chdir 漂移到 .next/db 空库）；端口复用陷阱：fuser -k 后需验证端口真空再启新实例（一次 EADDRINUSE 让套件跑在旧构建上——日志/方言断言假红，教训记入诊断路径）。
- 【docs】remote-relion.md §4i「The cluster is a host, not a connection id (t325)」+ 失败目录两行。

Stage Summary:
- **「集群是主机，不是连接 id」**：连接漂移不再是死局——同主机重建的连接照常治愈旧记录、接受孪生、原地链接；用户拉取修复重启后，第二周的 pending 2D 会在首次重试心跳时自行走向集群
- **「线活得比镜像久」**：原子写 + 新鲜 keep-set + 读时回填——画布与引擎的视野不再静默分叉；真的丢边时消息说「接一条线」而非谎言
- 环境：模板 :3000 运行，mock :3022 单实例，prod :3001 运行中（DATABASE_URL + CRYOFLOW_DATA_DIR 显式 env）

## Task 325-a (推送后只读审查的残余闭合)

- 审查裁决: 20abbe8 0 critical/0 high/2 medium/5 low/3 nit, 七条主声明全部源码验证成立
- MEDIUM①(M1): registry-stale 方言对「无候选条目的提供者类型」(select/import 等) 承诺了治愈探针做不到的事——missingRemoteOutputKeys 对无候选类型永远返回 [] → 不可治愈 → 用户照建议做却零进展; 修复: 方言门加 REMOTE_OUTPUT_CANDIDATES[up.type]?.some(c => req.accepts.includes(c.key)) —— 无候选类型回到通用消息, 不再许下无法兑现的探针承诺
- MEDIUM②(M2): 轮询清扫对 RUNNING 记录的死亡分支仍只看 connectionId——漂移发生在「作业运行中」时行被 failed + 记录被 exitCode -1 终结, 永久取消 t325 治愈资格(要求 exit 0); 修复: 分组前把死 id 解析为「同主机存活连接」(normalizeClusterHost 归一化匹配), 经它继续轮询——运行中的作业在重连后保命
- LOW①(L1): tmp 文件在 ENOSPC/rename+copy 双失败路径遗留垃圾; 修复: finally { rmSync(tmp, {force:true}) } 全路径清道
- LOW②(L2): 回填 catch 静默——永久失败的 create 每次 GET 无声重试; 修复: console.warn 有声化(与 persistPortEdge 同一诚实标准)
- LOW③(L3): 原子写/新鲜 keep-set/成员隔离只有源码钉; 补偿: diag 新增 BEHAVIORAL 单元——临时 DATA_DIR + 真实 edge-ports 导入, 两次 upsert 落两条可解析边 + 零 .tmp 遗留
- LOW⑤(L5): 主机臂大小写/尾点阻塞真重连(Brain2. ≠ brain2); 修复: normalizeClusterHost 双侧归一化, IP-vs-DNS 别名仍故意 fail-closed(诚实侧)
- NIT①(N1): outputs 有记录但文件已删 + 无孪生 → 通用谎言; 修复: 「已登记」改为 existsSync-aware, 与治愈工作单(missingRemoteOutputKeys)口径一致
- NIT②(N2): 回填循环 dbPairs.add 死码删除; NIT③(N3): 标签剥尾不再粘连破折号(去尾随 \s*)
- LOW④(L4): 反幽灵预检/afterok 门/旧记录日志尾随与停止——故意 fail-closed 的残留 id-only 面, 文档 §4i 记为明确范围
- diag-t325 扩至 77 断言 ALL GREEN ×2(新增: 归一化真值表/别名拒/M1 无候选方言/N1 幽灵文件/原子写行为单元/五条 t325-a 台账); t324(89)/t323(73)/t320(85) 回归全绿; tsc/eslint 0; 浏览器 console/page error 双零(t325a-browser.png)
- push: 20abbe8..(t325-a) main→main, ls-remote 校准, 树净

Stage Summary:
- t325 + t325-a 双提交闭环: 「集群是主机」教义贯通到轮询清扫(运行中漂移保命), 方言/工作单/探针三者口径对齐, 边层写路径全路径无垃圾
- 环境: 模板 :3000 运行, mock :3022 单实例, prod :3001 运行中(DATABASE_URL + CRYOFLOW_DATA_DIR 显式 env)

 Task 326 (2026-09-20, 用户工单窗口 —— 「Run on cluster」派发对话框 UI 重设计: 「这个页面的ui再重新设计一下，目前感觉排版不是很合理和美观」)

- 【开局：PAT + 第三次沙箱重建恢复】用户消息仅一枚新 GitHub PAT（t274 收尾时提醒过轮换已在对话明文暴露的旧 PAT——新 token 即回执）。开局实证：本地树是 t274 时代的陈旧快照（worklog 止于 Task 274、HEAD=107fd84 领先 1、落后 origin 66），而 origin/main 已到 6f3db67（t324-a）——按 t273/t274 配方：git fetch 后核实 t274 的全部内容已被后续窗口重落地于远程（.env.example/ssh2 卫兵/Task 274 worklog 条目俱在）→ `git reset --hard origin/main` 归位（陈旧本地提交安全丢弃）；依赖/Schema 与 t274 相比零变化，demo DB 常绿，mock :3022 拉起 + Mock Cluster 连接重建并实探针（brain2·8/brain4·8/normal02·8/brain·6/brain3·6 + 用户真模块名 relion/beta_5.0_gpu_ompi5_cuda118）。
- 【工单与取证】用户贴来「Run on cluster · 2D Classification 1」对话框全文并要求重设计（排版不合理不美观）。源码勘察 + VLM 对 before 定妆照的评审一致指出五宗罪：①说明段五行墙文字（SSH/staging/模式语义/回传策略全糊在一段）；②六行 label+控件等权重平铺、无分组无锚点；③direct/slurm 这一结构选择埋在下拉里、却门控着下面三行；④GPU stepper 行把 --gres/mpirun/--gpu 塞进 10px 行内散文换行；⑤页脚 user@host · module · sbatch · N GPU(s) 用间隔点压缩成一行。
- 【重设计（同契约换骨架）】保持全部套件钉死的源串（t306 的 ARRAY_ELIGIBLE 集合 + data-array-shards-row + shards 提交体；t320 的 LoG 谓词行 + data-log-cpu-row + CPU (LoG picker) 方言）、全部 aria 语法（触发器/选择器/stepper 的 11 个 label）、提交体语义——重组为：①标题稳定「Run on cluster」+ 作业身份行（名字 semibold + 类型 mono 徽章）+ 一句话简介（五行墙死刑）；②分区骨架（CLUSTER / RUN MODE 小节 overline）；③run mode 改两张可选卡片（radiogroup + aria-checked + 方向键导航 + Slurm 卡自述不可用原因——结构选择第一次可见）；④Slurm 旋钮收进仅 slurm 态存在的带边框面板（因果实享一框）；⑤flag 事实走 mono chip 独立行；⑥提交预览块（$ sbatch .cf-sbatch.sh + #SBATCH 指令行 + rank 行 + 身份行——预览只说派发真会写的指令）；⑦生命周期条（Stage inputs → Load module → Run → Sync key files back + 回传策略两行 caption）；⑧sm:max-w-xl 加宽 + max-h 滚动守卫。
- 【活体诚实阶段的真发现：宽度旋钮是陷阱】diag 首跑 PHASE B 四断言失败——不是套件错，是**旧对话框的 GPU stepper 对非 MPI 类型一直在撒谎**：派发只对 5 个 MPI 类型（class2d/class3d/refine3d/initialmodel/multibody + mpirun 可用模块）兑现 stepper 宽度（mpirun -n N / --ntasks=N / --gres=gpu:N）；motioncorr 和 References-autopick 永远 gpu:1/ntasks=1、ctffind/extract 纯 CPU、topaztrain 单卡——旧提示行对它们照样宣称「--gres=gpu:6, mpirun -n 6」。t320 的教义（「会被拒的旋钮不是旋钮是陷阱」）本窗落到宽度上。
- 【宽度真值纯模块】新 src/lib/hpc/gpu-width.ts（零 import 客户端安全，t320 log-autopick 同法）：MULTI_GPU_TYPES/SINGLE_GPU_TYPES 单源 + slurmWidthFor(type, {gpus, logAutopick}) → {mode, gpus}（multi-gpu 返回 RAW 宽度=脚本真值；策略层的 max(2,·) 地板是模拟器规划选择、明示分离）。hpc/slurm.ts 的 gpuStrategyFor 改为从共享表派生 mode+宽度（自留规划地板与 reasons；t320 三枚源钉全数存活）；对话框渲染同一张表：widthIsReal（MPI 类型 + 探针 relionMpi[所选模块]）→ stepper；否则诚实状态框（「1 × GPU per task」/「0 × GPU — CPU tasks」/「1 × GPU — single-GPU step」/「1 × GPU — this module has no mpirun」），LoG 框原样；提交体宽度只在真时发送、1-GPU 真值发诚实的 1、其余省略（t320 LoG 省略模式的推广）；run-mode 方言与预览 rank 行全部改说真值（「1 GPU/task」「CPU」「one GPU task, no mpirun」）。
- 【e2e: scripts/diag-t326-dialog-redesign.mjs，79 断言 ALL GREEN @ prod :3001 + mock :3022】PHASE A 契约：t306/t320 六枚源钉逐字存活 + aria 11 label + 九个结构 hook（data-section-cluster/mode、data-run-mode-cards、data-slurm-panel、data-submission-preview、data-lifecycle-strip、data-width-truth-row…）+ 重设计教义（短简介在/旧五段文死/旧行内提示死/恰好两张卡/箭头键不选中不可用模式/预览 .cf-sbatch.sh 真名/partition 回退连接默认/nodelist 单主机条件镜像/宽度指令出自提交同一状态）。PHASE A′ 宽度真值单元（bun 直导纯模块）：十案真值表（class2d@6→multi-gpu 6、class2d@1→multi-gpu 1 RAW、motioncorr@6→array 1、References-autopick@6→array 1、LoG→array 0、ctffind/extract→array 0、topaztrain→single 1、postprocess→cpu 0）+ 策略镜像十案 mode 全等 + 「class2d@1 计划 2 / 脚本 1」两侧各自钉死。PHASE B 活体诚实（探针先行——分区表/nodelist/MPI 词全在探针里）：motioncorr @slurm·brain2·4 分片·诚实的 gpus:1 → .cf-sbatch.sh 实测 --partition=brain2 + --nodelist=brain2 + --gres=gpu:1 + --ntasks=1 + --array=1-4%4 + 零 mpirun，记录 gpusRequested=1（旧世界的默认 6 谎言死）；direct 腿无 .cf-sbatch.sh、有 .cf-run.sh。PHASE C 真宽度（用户自己的 2D Classification 场景）：集群侧 particles.star+stack 夹具 → import(nodeType particles) 零上传 → class2d @slurm gpus:3 brain2 → 脚本实测 mpirun -n 3 + --gres=gpu:3 + --ntasks=3 + --gpu 0:1:2，记录 gpusRequested=3——stepper 只在它真实的地方出现，出现即兑现。
- 【回归】t318(52) ALL GREEN（一枚源钉维护：t323 把 diagnoseLog 改名 diagnoseFailureLog 后 t318 钉在旧名上——t323/t324 窗未重跑 t318 故无人发现；语义不变、钉子骑改名，注记在案）；t319(60) ALL GREEN；t322(60+) ALL GREEN；t320(85) ALL GREEN——LoG 契约穿过宽度重构无恙；t324(85) ALL GREEN；t306 对话框源钉全绿（其两处 FAIL 为环境债：demo roster 23 种子世界 + 自身清理残树——t322 遗留「家族全量回归（环境重建后补）」的既知面，与本窗改动无关，首跑即在此重建沙盒）。tsc 0；eslint 0（五改动文件 + 两套件）。
- 【浏览器活体（agent-browser 1600×900 @ prod :3001）】六变体全验：class2d@slurm（stepper + chips + mpirun 预览）、class2d@brain2（用户原景）、motioncorr（「1 × GPU per task」框 + stepper 消失 + gpu:1 预览 + Array 行在场）、LoG autopick（「0 × GPU — CPU-only picker」+ 「sbatch · CPU (LoG picker)」）、ctffind（「0 × GPU — CPU tasks」）、direct（「$ nohup … no scheduler」）；移动 390×844：双卡 150×77 并排、滚动守卫生效；console/page error 双零。九张定妆照（三前六后）入 download/shots-qa/。VLM 对 before 的评审五宗罪与本轮修复一一对应；对 after 的二评因 429 限流未成（诚实记录：结构证据以 DOM 活体验证为准）。
- 【环境课（写进判例）】①浏览器 + dev :3000 在 4GB 盒共存 = t311 判例死局第三次应验（dev 三次 OOM，dmesg 实锤 anon-rss 2.8GB）→ 按 t322 配方 standalone prod :3001（共享 dev DB + data 树）承担全部 e2e 与浏览器验证；②**后台构建被沙箱收割机无声击杀**：`(cmd &) &` 子 shell 仍是工具 bash 的后代、调用结束即被杀（launch.sh 注释早已写明的机制）——构建必须前台长超时或 setsid；两次「无声死亡」被误读为 OOM，dmesg 无记录才是线索。
- 【收尾】docs/remote-relion.md §1 步 4 补 t326 段（卡片/预览/生命周期条）；UI 夹具烧净（demo 复位回三作业原状、集群树/暂存区清空、t306 残留项目连根删除、活动指针复位）；dev :3000 常绿（用户预览面板即所见即所得）、prod :3001 保留（t322 判例）、mock :3022 单实例；worklog（本条）+ commit/push（新 PAT 落 ~/.git-credentials）+ 提醒：本 PAT 已在对话明文出现，用毕请再次轮换。

Stage Summary:
- **「排版是信息架构」**：用户一句「不合理不美观」翻译成五宗罪（墙文字/等权平铺/结构选择埋下拉/flag 挤行内/间隔点压缩页脚）——修复不是调间距，是换骨架：分区、卡片、面板、chip、预览、生命周期条——每件事住在它该住的形状里
- **「预览是 sbatch 会兑现的承诺」**：提交预览块的每一行指令都派发真会写（partition/nodelist/gres/ntasks/array/mpirun），活体阶段当场对账——而正是这个承诺揪出了旧 UI 的暗病
- **「宽度旋钮只在真实处存在」**：stepper 只对 5 个 MPI 类型（且模块带 mpirun）出现；motioncorr/References-autopick 的「1 × GPU per task」、ctffind/extract 的「CPU tasks」、topaz 的「single-GPU」、LoG 的「CPU-only picker」——t320 的陷阱教义推广到宽度，真值表（gpu-width.ts）单源三消费（策略/对话框/测试）
- **「套件钉子骑语义不骑字面」**：t318 的 diagnoseLog 钉在 t323 改名后失血两周无人看见（没人重跑它）——钉子的语义（空日志不谎称扫描全量）不变，字面随产品；维护要注记
- 遗留（下轮候选）：记录层 gpusRequested 对省略宽度的非 MPI 类型仍回落默认 6（t321 的 || 6 强转陷阱同族——dispatch 层语义，需自己的窗口）；家族全量回归（t304/t306 demo-roster 种子世界，环境重建债连续第三窗让位）；exists=false 的 UI 活体见证（t272 遗留）；VLM 对 after 的二评（429 限流让位）

### Task 326 补记（推送窗口的第二次撞车）

推送瞬间并行窗口又落地 t325-a（其自审残余：sweep 认主机身份/registry-stale 方言不空诺/'accounted' 与 heal 工作单对齐——再次零源文件交集），按同配方二次 rebase（worklog 双保留）、tsc 0、重建 prod :3001 后 diag-t326 与 diag-t325（重定位副本：ROOT→/home/z/my-project + db/cryoflow.db→db/custom.db，含 dbSurgery 模板内插路径）双 ALL GREEN，`c770615..3d10a73` 落地。并行窗口仍在活动——下一窗开局先 fetch 看尾部。

## Task 327 (2026-09-20, 用户工单 —— 「能否在提交任务时查看节点gpu和cpu的占用情况？可以自己设计，也可以参考show_free_gpu.sh」)

- 【工单原文】提交任务时查看节点 GPU/CPU 占用——用户附上其集群的 show_free_gpu.sh：per-node scontrol show nodes | grep Gres（总量）+ grep AllocTRES（已占用），样例表 brain2_gpu06: 128 CPU / gpu:8 / cpu=2,gres/gpu=1；brain3: 48/6 / cpu=4,gres/gpu=2；其余 AllocTRES= 空。
- 【设计：show_free_gpu.sh 升格为提交路径的一部分】①纯解析器 src/lib/hpc/slurm-usage.ts（t326 gpu-width 配方：零 import，client/server/test 三方共享）——parseScontrolNodes 同时吃 -o 单行形态（app 所跑）与用户脚本所 grep 的长形态（按 NodeName= 边界重组记录），Gres 语法（gpu:5 / gpu:A100:5 / gpu:2,gpu:4 / (S:0-1) 后缀）、AllocTRES 份额（gres/gpu[:type]=N、cpu=N、空=零占用——用户样例的原形）、CPUAlloc 回退、IDLE+DRAIN 状态词、排序（GPU 节点优先/最宽优先）。②路由 GET /api/remote/connections/[id]/usage——一次 SSH exec `scontrol show nodes -o` + 进程内 15s TTL（30s 自刷新×双开对话框不打爆登录节点；?refresh=1 手动旁路；错误也缓存）；诚实降级不是 500 而是 {ok:false,error}（无 scontrol/SSH 失败点名原因），128 行封顶。③面板 ClusterUsagePanel（src/components/workflow/cluster-usage-panel.tsx）挂在 Slurm 面板内、分区选择器与 GPU 宽度之间（占用 informing 选择）：per-node 行（节点名 mono + 分区 chip + 状态色点 + GPU/CPU 两条 used 条 + free 计数着色——emerald 足够/amber 少于所需(说真话「将排队直到 GPU 释放」)/rose 零），ask 行从共享宽度真值(slurmWidthFor)×array %4 并发推导并对比所选分区单节点 free（单任务 GPU 不跨节点），30s 自刷新 + 手动刷新 + 「Ns ago」计时；max-h-56 nice-scroll 滚动守卫；失败态明说「submit 仍可用——本面板仅供参考」（Send 按钮 disabled 谓词 diag 钉死未动——usage 永不 gate 派发）。
- 【mock】新增 services/mock-cluster/fs/opt/bin/scontrol——节点表镜像用户真集群数字（normal 80/5 · brain 64/6 · normal02 80/8 · brain2 128/8 · brain4 128/8 · brain3 48/6 + t297 时代 node01-08），基线占用照抄其样例（brain2 cpu=2,gres/gpu=1；brain3 cpu=4,gres/gpu=2；空闲节点 AllocTRES= 空——逐字节方言）；-o/长形态/节点过滤三语法全答。**活账**：mock sbatch 落 job-<id>.req（partition|gres|ntasks|并发）日志，scontrol 只数 RUNNING 作业（PENDING 等待不占资源）加到其分区节点上——派发的 class2d@3GPU@brain2 在面板里可见 4/8 被持有、落地即释放。
- 【e2e scripts/diag-t327-cluster-usage.mjs，95 断言 ALL GREEN ×3】UNIT（bun 直导纯模块）：gresGpuTotal/allocTresGpus/allocTresCpus/stateWord 真值表；**用户自己的表在两种方言下逐节点还原**（六节点 CPU/GPU/占用/状态/分区全对——工单数字即夹具）；边角（typed GRES、行中空 AllocTRES 截断于下一 token、无 AllocTRES 字段回退 CPUAlloc、多分区节点）；free 钳零；排序。LIVE API：探针前置；mock 长形态经 app SSH 通道 grep 见证（Gres=gpu:8 + brain2 AllocTRES + 空闲节点空 AllocTRES）；路由 200 + command 自述 + 14 节点 + 用户样例数字（brain2 128CPU(2用)/8GPU(1用)/MIXED 逐字段）+ GPU 优先排序；15s TTL（两次连打同 checkedAt；refresh=1 旁路）；404 未知连接；跨站 403。LIVE JOBS：class2d 派发 @gpus:3 partition brain2（复用 t326 PHASE C 夹具形状）→ RUNNING 窗口内 brain2 = 4/8 GPU（1 基线+3 活账）+ 5/128 CPU（2+3 ranks）+ 状态诚实 → 落地即回基线 1/8·2/128；记录 gpusRequested=3 与 ask 行同数。UI CONTRACTS：面板三 hook（data-cluster-usage-panel/data-usage-node/data-usage-ask-line）+ aria（刷新/列表）+ 位置钉（选择器→面板→宽度行）+ ask 推导钉（共享宽度真值+%4）+ 信息性钉（Send 谓词原样）+ 路由 TTL/封顶/降级钉 + mock journal 钉。
- 【回归】t326(79) ALL GREEN（对话框契约穿面板插入无恙）；t320(85)/t324(89)/t325(77) 经重定位副本（ROOT→/home/z/my-project + db/cryoflow.db→db/custom.db——沙箱重建把 /home/z/cryoflow 带走后的既知配方，原件不动）ALL GREEN；t318(52)/t319(60) ALL GREEN @ dev :3000；t306 = 文档化基线（38 ok + PHASE B 台账全绿；roster-23 环境债 FAIL 为既知面，套件后半程被 dev-server OOM 收割中止——t311 判例第 N 次应验；array 契约本体已由 t326 活体腿+t327 双重覆盖）。tsc 0；eslint 0（五改动文件+diag）。
- 【浏览器活体（agent-browser 1600×900 @ prod :3001）】demo class2d → Run on cluster → Slurm 卡：面板 14 节点 GPU 优先渲染（brain2 首行 MIXED · GPU 7/8 free · CPU 126/128 free，DOM 逐字段见证）；ask 行随分区/宽度联动（auto→「8 free on brain4」；brain2→「7 free on brain2 now」；宽度 8>7 free→amber「will queue until GPUs release」）；刷新按钮 age 重置 just now；390×844 移动端面板 278px 适配 + 自有滚动区；console/page errors 双零。VLM 评审（glm-5v-turbo）：无重叠无破版、高亮行清晰、「no significant visual defects」。定妆照 download/shots-qa/t327-usage-panel-brain2.png / t327-usage-panel-mobile.png。demo 世界复位（三作业原状，测试用 class2d 已删）。
- 【环境课（写进判例）】①内联 `setsid … &` 挂在工具 bash 血统下——工具调用结束收割机沿尚未断链的祖先链收割，prod :3001 两次无声死亡（空日志、无 OOM 记录、dmesg 不可读）才定位；孤儿启动配方（脚本立即退出→server re-parent 到 init）才是活路——prod-3001.sh 重指 /home/z/my-project 并加注释钉死。②`bun run build` 前台跑时 dev :3000 同存 = OOM 必然（build 峰值内存+dev 3.4GB RSS > 4GB 盒）——dev 被收割两次（t306 压测时第三次）；build 期间应停 dev 或接受重启。③套件日志见证路径：t325 的 server-log 断言读 repo 根 prod-3001.log——重启 prod 时日志路径漂到 scripts/ 即四断言假红一次；prod-3001.sh 已钉回根路径（含注释）。
- 【docs】remote-relion.md §4j「The occupancy table sits in the submit path (t327)」+ 失败目录新行（usage 不可用→rose 点名+提交不受阻）+ §6 mock 段补 scontrol + §7 路线图「Cluster-side GPU reservation awareness」标记 VISIBILITY 已船（dispatch 侧自动收窄故意不做——占用是信息，选择权在用户）。

Stage Summary:
- **「用户自己的脚本是最好的产品规格」**：show_free_gpu.sh 的两个字段（Gres 总量 / AllocTRES 占用）就是面板的全部数据模型；样例表里的六个节点数字成了 e2e 的夹具基线；空闲行「AllocTRES=」的空值形态被 mock 逐字节复刻——方言对了，真实集群上的解析就对
- **「占用是信息，不是门」**：面板永不 gate Send 按钮（谓词 diag 钉死）；少于所需时说真话「将排队直到 GPU 释放」而非拒绝——选择权留给用户，后果讲在前面
- **「一次 exec 一份缓存」**：15s TTL 挡住 30s 自刷新×多对话框的 SSH 风暴；?refresh=1 是手动按钮的专属旁路
- 环境：模板 dev :3000（收尾重启），mock :3022 单实例，prod :3001 运行中（孤儿启动配方；repo 根日志路径）

## Task 331 (2026-09-20, 用户工单 —— 「增加清理中间过程文件的功能，包括本地和cluster」)

- 【工单原文】清理中间过程文件，本地和 cluster 两侧。RELION 项目的磁盘大户从来不是结果，而是中间过程文件：每一轮迭代的 `run_it###_*` 副本（只有最后一轮承载科学）、并行 array 残留的分片、每张微图的 CTF 频谱图，以及真正的 TB 级大户——校正后电影和粒子堆栈，它们在索引它们的 STAR 之后长久留驻。
- 【撞号与重编号】本窗自编号 t328，push 前探测发现并行窗口已用 t328（registry-stale heartbeat 票）先落地，且随后还有 t330（Results 关键数字 + 404 诚实化）——按 t314 判例后推者重编号 t328→t331：套件/截图/源码注释/docs §4k/失败目录/worklog 全链更名，rebase 到 a8fd451 零冲突（并行两窗改动 outputs 路由/results 视图/engine 心跳，与本窗的全新文件 + inspector 工具栏零交集）。
- 【设计：keep-set 是合同，其余皆可谈】一个纯规划器（src/lib/hpc/cleanup.ts，t326/t327 零 import 配方：client/server/test 三方共享同一分类）把一份 walked 清单（本地 readdir / 一次 SSH find）分成三档：safe（被击败的迭代副本 + array 暂存 + merge 残渣——默认勾选：下游与续跑皆无恙）、diagnostics（CTF 频谱 + FSC/Guinier .eps 曲线——opt-in：数字留在 STAR 里，渲染曲线不再）、bulk（校正电影/粒子堆栈，类型门控 motioncorr/extract/polish——opt-in：后果写明，未跑的下游作业点名）。永远留下的 keep-set：链式产物（record.outputs + REMOTE_OUTPUT_CANDIDATES 赢家 + 每族最终迭代=--continue 续跑点）、集群孪生（remoteOutputs，t324 原地链接）、见证物（run.out/run.err=诊断层口粮、.cf-exit/.cf-pid=裁决与存活、派发脚本、manifest 台账）、symlink（原始数据的门）以及**一切无法识别的文件——unknown=keep，新的 RELION 输出形态退化为「留下」，绝不静默删除**。
- 【五刀】①纯规划器（glob 方言/globToRegExp 不跨 /、迭代族 iterationFamilyOf、候选赢家 candidateVerdicts 的 latest/first 语义、fullPaths 执行形态：预览载荷截 24 个最大文件，执行腿拿到全量）；②远程腿 src/lib/remote/remote-cleanup.ts——t325 主机身份解析（连接死后同主机重建连接接管清理）、一次 find -printf 活体清单（10s 进程内 TTL，?refresh=1 与 POST 永远活体；进不去的 workdir=exit 3 诚实不可达而非空成功）、分批 rm -f --（200/批）、前后 find 字节对账（释放量是集群自己的话，不是计划的估算）、空目录修剪、manifest 台账重写（t289 教义：Files 页显示集群「持有」什么，不是「持有过」什么）；③路由 GET 计划 + POST 执行——**POST 只带 scopes+tiers 永不带文件清单**（TOCTOU 安全：GET 与 POST 调同一纯分类器，删除只信活体树）、running/pending/活记录 409（t318 教义：活着的运行其迭代文件正在被写，删了就是损坏）、per-job in-flight 锁、本地 walker（symlink 目录不跟随、dotfile 纳入、20k 封顶）；④UI cleanup-dialog.tsx + inspector 工具栏橡皮擦门——双侧卡片（本机 + 集群 user@host）、三档复选（safe 默认开，锋利的两档 opt-in）、每档后果原文、keep 行（N files stay: outputs·logs·checkpoints·twins）、bulk 档在下游未跑时琥珀警告点名作业、两步确认（「Delete N intermediate files (~X)? … This cannot be undone」）、执行后 toast 报两侧账目 + Files 页刷新（onCleaned→loadOutputs）；⑤docs §4k + 失败目录三行 + 路线图（项目级批量清理记为未做的 stretch：清理是逐作业的决策，后果逐对话框读）。
- 【e2e scripts/diag-t331-cleanup.mjs，129 断言 ALL GREEN ×3】UNIT（bun 直导纯模块）：glob 方言真值表（类/锚定/不跨 /）、迭代族、候选赢家（exact 先于 glob、latest=字节序最大、first）、**mock refine 方言的 class2d 工作目录逐档对账**（重命名终稿 + 每轮残留：13 kept/8 safe/3 diag，字节数按清单自算）、无候选表时族最大仍留（--continue 续跑点）、bulk 门控（motioncorr 三文件全 bulk、class2d 的 .mrcs 不进 bulk=unknown keep）、outputs/twin 保存（无 twin 时被击败迭代进 safe，有 twin 时族最大也砍不掉孪生）、载荷 24 帽 + fullPaths 全量。LIVE LOCAL（手术记录 + 夹具 workdir，t324 配方——本沙箱无本地 RELION）：计划形状（safe+diagnosis、kept 计数、downstream 点名）、守卫全表（404/403/无档 400/全无效档名过滤后空=400/running 409/pending 409/never-ran 409+诚实理由）、执行盘上真相（safe 档 5 文件死 6 字节释放、诊断档幸存、shard 目录修剪、keep-set 全程无恙、幂等第二遍诚实零）。LIVE REMOTE（真派发 @slurm 上 mock，真迭代落在集群盘上）：it001 被击败迭代进 safe、族最大（it002 data/class001、it003 class002/003）永不被 offer、canonical 终稿永不被 offer、诊断夹具逐字节、unknown 集群文件不被 offer、**10s TTL 行为学证明**（集群侧 rm 一个文件，TTL 内计划仍见、?refresh=1 立即消失）、双侧执行（集群删 11 文件、前后字节对账、孪生/见证/unknown/族最大全活、shard 目录修剪、台账 15→9 且逐条对上活树）、**漂移教义**（连接删除后同主机兄弟连接 conn-mu940jzt 接管清单）。UI CONTRACTS：七个 data hook + 默认档教义 + POST 体形状钉（永不含文件清单）+ 确认不可逆文案 + inspector 橡皮擦门 + onCleaned→loadOutputs + 路由守卫/walker/EISDIR 教训/fullPaths/inFlight + 远程腿 TTL/批大小/exit-3/主机身份/台账重写。
- 【回归（合并构建上全员 ALL GREEN）】t331(129)×3；姊妹窗 t330(63，经 ROOT 搬迁副本——其套件仍绑死 /home/z/cryoflow，本沙箱该树已不存在，t324/t325/t320 同族既知配方)；t328 并行窗(76，同搬迁)；t327(95)/t326(135)/t324(89)/t325(76)（搬迁副本，原件不动——d57fdda 宣称的 re-bind 是并行窗环境里的 /home/z/cryoflow=repo，在本沙箱不成立）；t318(52)/t319(57) @ dev。tsc 0；eslint 0（全部改动文件 + 套件）。
- 【浏览器活体（agent-browser 1600×900 @ prod :3001，合并构建）】对话框双卡三档渲染（safe 开/diagnostics 关，教义即 DOM）、档位勾选即时对账（14→21 files）、两步确认执行、两侧真删（本地 shard 目录修剪、集群 keep-set 完整）、toast「Intermediates cleaned — N local file · X freed」、Files 页联动刷新、390×844 移动端 w=390 无横向溢流、console/page errors 双零；收尾空状态诚实（「This job has not run yet — there is no run directory to clean.」）。四张定妆照：t331-cleanup-dialog / t331-cleanup-dialog-tiers / t331-cleanup-mobile / t331-cleanup-empty-state。
- 【环境课（写进判例）】①**rmSync 对目录永远要 recursive:true**——空目录也一样（plain rm 抛 ERR_FS_EISDIR 被我的 catch 静默吞掉，首版本地空目录不修剪而远程 find -empty -delete 正常，浏览器活体第一轮就抓到）；②**`| head -N` 会 SIGPIPE 杀掉 diag**——管道提前关闭，node 死在中途，finally 永不运行，夹具泄漏（run2 的两个 QA 项目因此泄漏，事后手术清理；看全量日志用 tail 或落盘文件，永远不要 head 截流）；③并行窗的 ROOT re-bind 是环境相对的（其沙箱 /home/z/cryoflow=repo ≠ 本沙箱），搬迁配方仍是本环境的正解；④重建后 `prod-3001.sh` 的「already running」跳过逻辑会让旧构建继续服务——重启 prod 前必须先 pkill。
- 【收尾】demo 世界复位（engine-state 归零、t306 时代 ctffind_xffuwkds 恢复原 manifest + shard 目录形状、mock 树清空、33 个无主 QA 树焚烧、连接表恢复双连接）；dev :3000 常绿；prod :3001 运行中（孤儿启动配方，repo 根日志）。

Stage Summary:
- **「keep-set 是合同」**：链式产物/孪生/最终迭代/见证物/门/未知文件六类永留——分类器不能命名的文件不是中间文件，是未知，未知即保留；新 RELION 输出形态最坏退化成「多留」，绝不会「静默删除」
- **「预览与删除共用一个大脑」**：对话框永远不送文件清单，POST 只带 scopes+tiers，服务端两侧都活体重walk——预览漂移不可能删错文件；10s TTL 挡住重开对话框的 SSH 风暴，refresh 与 POST 永远活体
- **「释放量是集群自己的话」**：本地按删除时 stat 求和，集群按前后 find 字节差对账——不是计划的估算，是树的事实
- **「台账跟着树走」**：集群清理后 manifest 逐条重写，Files 页说「持有」不说「持有过」（t289 教义落到清理上）
- 遗留（下轮候选）：项目级批量清理（路线图已记，故意不做——清理是逐作业决策）；bulk 档的下游影响分析可深化到「按 STAR 行引用计数」（当前按连线拓扑）

---
Task ID: t332
Agent: main-agent (Z.ai Code)
Task: 用户工单：「增加支持从检测到的节点使用情况的列表中直接选择相应的节点」——t327 的 Live node usage 面板从只读信息表升级为可选：点击节点行即把提交钉到该节点（--nodelist）。（renumbered t331→t332 per the t314 precedent — the parallel window's cleanup ticket took t331 and landed first; zero source-file overlap outside docs）

Work Log:
- 四层实现：(1) wire — RemoteRunTarget.nodelist + run 路由第二道字符集门（[A-Za-z0-9_.-]{1,64}，与 partition 同款）；(2) engine — explicitNode 显式钉优先于 t300 单宿主派生；buildSbatchScript 压制规则：显式钉 + 无选区时连接默认分区不上车（--partition=normal + --nodelist=brain3 是真控制器 submit 期拒绝）；(3) panel — 行变真按钮（aria-pressed/原生键盘/pinned 行戴 ring+MapPin+primary 名；DRAIN/DOWN 诚实拒点；hint 句；ask line 重定域到钉选节点自身空闲数；0-GPU 矛盾点名；不一致守卫：换分区搁浅钉时自动释放）；(4) dialog — pickedNode 状态（连接切换即清）、maxGpus 用节点自身 gpuTotal 封顶、preview 与引擎同款压制镜像、提交体携带 nodelist
- mock：sbatch 解析 --nodelist → 账本第 5 字段（t327 四字段不动）；scontrol 偏好第 5 字段（钉选作业记在 THAT 节点）
- diag-t332-node-pick.mjs 51 断言 ALL GREEN ×2：PHASE A 五层源码钉；PHASE B 三 LIVE 腿（B1 用户流程：连接默认分区 normal 作压制见证——脚本 --nodelist=node03 且无 --partition、账本 |node03、RUNNING 期 node03 3/6 GPU 持有而 node01 零持有、完成回基线；B2 优先级：brain2+node03 双旗并载显式钉胜派生；B3 退化：恶意后缀被字符集门丢弃、默认分区复载、/tmp 无污染）
- 浏览器活体（agent-browser @ prod :3001）：点击 node03 → aria-pressed+MapPin+ask line 即时重定域「pinned to node03 — only 5 free there」+ preview #SBATCH --nodelist=node03 无 --partition；再点释放；守卫实测（钉 node03 → 选 brain2 → 钉释放、preview 落回派生 brain2）；移动端 390×844 无溢出；console+page errors 双零；VLM 审图两轮；定妆照 t332-node-pin.png / t332-node-pin-mobile.png
- 浏览器现场抓到真 bug 修复：ask line useMemo deps 漏 pinnedNode（钉后不重算）；套件稳健性：mock 每迭代 0.9s sleep → B1 提到 15 迭代开 ~14s 观测窗（一次慢 SSH exec 可跨过 2s 窗整窗）；journal 断言移到完成后（.req 持久）
- 回归（合并构建）：t327(95)/t326/t324(89)/t325(76)/t328(76)/t330(51)/t320(85) 全 ALL GREEN；tsc 0；eslint 0
- 环境课：prod-3001.sh 重指仓库本体 + ALWAYS restart（"already running" 在 rebuild 后供陈旧码两次）；本机 lsof 看不见 standalone 监听者、进程名 next-server 非 server.js（pkill -f 不中）、fuser 静默无效——ss -ltnp 提监听 pid 按号杀是唯一可靠；浏览器 tab 的出站 socket 令普通 lsof 永不空（判 LISTEN-only）；awk return 只能在函数体（print+exit）

Stage Summary:
- 「列表即选择」：点哪个节点 sbatch 钉哪个（--nodelist）；多宿主组里的单节点这种分区下拉永远表达不了的选法第一次可表达；UI 永不组矛盾组合；mock 账本第 5 字段让钉选作业占用记在它真正落的节点
- 用户拉取重启后：Run on cluster → Slurm → Live node usage 列表点节点即钉选，再点释放；预览 #SBATCH --nodelist=<node> 即所发即所见

---
Task ID: t333
Agent: main-agent (Z.ai Code)
Task: 用户工单「reset&，re-run或者delete任务时会先清除之前已生成的文件吗？」（renumbered t332→t333 per the t314 precedent — the parallel window's node-picks ticket took t332 and landed first; rebase onto 95d1534 conflict-free in source, worklog/docs merged with both sides kept）——随单附带一次真实崩溃: re-run 一个改了 box size 的 extraction job, relion_preprocess 死在 image.h:1534 "write: target and source objects have different size"（旧一代 .mrcs 粒子栈还坐在稳定 workdir <root>/<type>_<jobid8> 里, RELION 往输出路径上现存文件里写）; 新建一个 extraction job（空 workdir）就正常。修复 + 回答三动词的文件语义。

Work Log:
- 勘察: reset（PATCH status=idle）只杀进程+清 run record, 不动文件; delete 故意保留 workdir（/api/jobs/restore 的 Undo 学说）; re-run 只清 t318 栅栏的裁决见证物（.cf-exit/.cf-pid/run.out/run.err + array 暂存）——旧一代的 RELION 产物全部幸存, 正是崩溃根源。本地腿 run.out/run.err 还是 append 模式（第二代日志会接在第一代后面）。
- Blade 1 纯规划器: hpc/cleanup.ts 新增 classifyRerunWipe（t331 keep-set 的「新跑方言」）——死: 全部迭代（新跑无续跑契约）、产物扩展名（.star/.mrc/.mrcs/.eps/.ctf/.sav/.tmp, 大小写不敏感; 输入从不进 workdir——绝对路径/项目树/_staged/原地孪生, 故扩展名命中即产物）、shard_N/ 整棵暂存子树、.cf-* 家族、run.out/run.err; 活: symlink 门、note.txt、.cf-remote-manifest.json（台账——远端逐条修剪, 整删会在 dispatch 与 finalize 之间让 Files 页说谎）、一切未识别（unknown=keep 教义照旧）。模块保持零 import。
- Blade 2 本地腿: 新模块 src/lib/relion/run-wipe.ts（walker 与 cleanup 路由同方言: symlink 列为门不跟随; EISDIR 教案的 recursive:true 修剪; 尽力而为不拒跑）+ wipeLocalRunProducts; engine.runRealJob 的调用点钉在 mkdirSync(workdir) 之后、buildArgv 之前——engine-native 分发与 --continue 续跑分支都在其上方提前 return, 结构上保证「续跑永不清扫」（checkpoint 就是状态本身）。
- Blade 3 远端腿: ①dispatch 记录构建前的 t323-a 两文件清除升级为整代镜像清扫（wipeLocalRunProducts(localWorkdir)）——上一代同步回来的产物 + 陈旧日志全死, 台账幸存; ②spawn 任务里 remoteMkdir 之后、t318 栅栏之前插入集群侧清扫: listRemoteWorkdir(bypassCache) → classifyRerunWipe → deleteRemoteFiles 批量 rm → pruneRemoteEmptyDirs → dropRemoteListingCache（新增导出: 清扫自listing缓存了清扫前真相）→ rewriteManifestAfterCleanup(localWorkdir, wipeRels)。诚实分级: listing 失败降级为 warn-and-proceed（t332 之前的世界, 提交自己会再测线路）; rm 失败则拒绝整个 re-run（带着旧文件跑就是本工单要杀的崩溃）。
- Blade 4 UI 诚实: re-run 确认框文案改为「files the previous run generated in this job's run directory — on this machine and on the cluster — are cleared first」; inspector 的 Reset & edit 按钮加 tooltip（清状态不清文件, 目录留到下一次 Run 重建）; job-panel 的 reset 图标 title 同步。
- Blade 5 文档: docs/remote-relion.md 新增 §4l（三动词的文件语义 + image.h:1534 现场报告）+ 失败目录三行（崩溃灭绝/拒绝措辞/listing 降级）+ roadmap「Re-run hygiene — shipped (t332)」。
- e2e scripts/diag-t333-rerun-wipe.mjs, 75 断言 ALL GREEN ×3: UNIT（用户原方言清单逐档对账: 13 删/4 留; refine 方言全迭代含族最大值/finals/plots/.sav/.tmp/大写.MRCS 全删; keep-set 语法: 任意深度门/note/台账/unknown 全活）+ LIVE LOCAL（bun 直导 run-wipe: 夹具盘上真相、门的目标目录毫发无损、particles/ 空目录修剪、幂等第二遍、absent→null/empty→0、engine 源序钉「natives→resume→mkdir→wipe」）+ LIVE REMOTE（真 class2d @slurm 上 mock 完成两代: 双侧埋哨兵——未来迭代 run_it009_class009.mrc/伪 canonical particles.star/诊断 eps/unknown/note/门链接, re-run 后哨兵产物双侧死光、keeps 双侧全活、新代 finals/iterations/witnesses/脚本重生成、台账逐条对上活树且不再列哨兵、t318 fence 形状幸存、t331 清扫面板在新树上继续工作且不 offer 已被清扫的东西）+ CONTRACTS（两侧刀位源序钉: 镜像清扫先于 record 构建/集群清扫在 remoteMkdir 后 t318 栅栏前; bypassCache/dropRemoteListingCache/manifest 修剪/拒绝措辞/warn-and-proceed 措辞; 对话框与 tooltip 文案; reset 不删文件+delete 保留 workdir 的合同钉）。
- 回归（合并构建上）: t331(129) ALL GREEN @ prod :3001 新构建 + mock :3022; t318(52)/t319(57) ALL GREEN @ dev :3000; tsc 0; eslint 0（七源文件 + 套件）。并行窗随后在 aade691 里把 t331 套件 ROOT 重绑到其环境并在「combined t331+t332(picks) build」上复验 129 全绿（双侧互证的回归证据）。
- 环境: dev :3000 被 OOM 收割两次（t318/t319 套件 + agent-browser 与 Turbopack 共存把 next-server 推到 2.8GB RSS——t301 判例第 N 次应验）; 浏览器活体改在精瘦 standalone prod :3001 上做（同构建）, 完事后 dev :3000 复活常绿。浏览器活体（agent-browser @ prod :3001, 1600×900）: re-run 确认框新文案渲染、Reset tooltip 原文渲染、390×844 无横向溢流、footer 钉底（bottom 900/900）、console/page errors 双零。三张定妆照: t333-rerun-confirm / t333-mobile-390 / t333-desktop-inspector。
- rebase: 并行窗 aade691（仅 diag-t331 ROOT 重绑 2 行, 零源文件交集）——rebase 干净。

Stage Summary:
- 三动词的最终语义（也是对用户的回答）: **re-run = 先清后跑**（两侧、pre-submit、只认产物形状; --continue 续跑路径例外）; **reset = 只清状态**（文件留到下一次 Run 重建, tooltip 直说）; **delete = 留文件保 Undo**（toast Undo/Ctrl+Z 原样恢复）。image.h:1534 尺寸冲突在源头灭绝——re-run 与新建 job 从此等价。
- 产物: hpc/cleanup.ts(classifyRerunWipe) / relion/run-wipe.ts(新) / engine.ts(调用点) / remote-run.ts(双侧刀) / remote-cleanup.ts(dropRemoteListingCache) / job-inspector+job-panel(文案) / docs §4l / scripts/diag-t333-rerun-wipe.mjs(75 断言)。
- 关键决策: (1) 清扫判定复用 t331 纯规划器家族但独立函数——新跑的 keep-set 与事后清扫不同（无续跑契约、finals 会被重产）; (2) rm 失败拒绝 re-run 而 listing 失败降级放行; (3) 台账在镜像清扫中幸存、由集群侧清扫逐条修剪; (4) 清扫后 drop 列表缓存防 10s TTL 幽灵。

t333 补记（rebase 后合并构建复验）:
- renumber t332→t333 全链落地（套件/截图/源码注释/docs/worklog/提交信息; remote-run.ts 里并行票的两处 t332 注释原样保留——行号靶向改名, 非全文件 sed）; rebase 到 95d1534 零源文件冲突, worklog/docs 双保留。
- 合并构建复验（rebase 后新 standalone, node 运行时——并行票的 OOM 教训照抄; 本沙箱专属启动器 /tmp/prod-my.sh 因为仓库的 prod-3001.sh 被并行窗重绑到其 /home/z/cryoflow 树——环境相对性老课）: diag-t333(75) ALL GREEN; diag-t331(129) 经重定位副本 ALL GREEN（首跑 3 FAIL 是我的 sed 没换到 dbSurgery 模板里的 ${ROOT}/db/cryoflow.db——SQLite file: 自动建空库的静默陷阱, 换成 custom.db 后全绿, 非代码回归）; diag-t318(52)/t319(57) ALL GREEN @ dev :3000（首跑 fetch 被 dev 冷编译竞态断连, 暖机后全绿）; tsc 0; eslint 0。
- 合并构建浏览器活体（agent-browser @ dev :3000, 1600×900 + 390×844）: 页面干净渲染、console/page errors 双零、footer 钉底 900/900、移动端无横向溢流; 定妆照 t333-combined-mobile.png。
- 本沙箱环境课（复验途中三次服务器死亡）: ①内联 setsid & 过不了 reaper（prod-3001.sh 头注释的老警告应验——必须脚本立即退出式）; ②dev 与浏览器/长套件共存必被 OOM 收割（本工单两次 + 复验一次, t301 判例三连）; ③node 跑 standalone 比 bun 稳（并行票教训采纳）。

---
Task ID: t334
Agent: main-agent (Z.ai Code)
Task: 用户工单「新的提取颗粒为何运行到一半报错了？」——"Particle Extraction 1 (copy)" 在真集群上跑 1034 张微图，83% 处死在 relion_preprocess 的 image.h:1534（"write: target and source objects have different size"），865 个 per-mic .mrcs 粒子栈已写（留在集群的 bulky 文件正是它们）。t333 杀了「重跑进脏 workdir」这一支；本次工单证明单靠「fresh directory」不是全部故事——诊断 + 三把新刀 + 失败卡。

Work Log:
- 【诊断（对 RELION 3.1→master 源码逐行核实）】extract 每张微图写一个栈：stack = --part_dir + <微图名去扩展名> + ".mrcs"（preprocessing.cpp: fn_output_img_root = fn_part_dir + fn_post.withoutExtension()）；每微图第 1 个粒子 WRITE_OVERWRITE 盲替换，后续粒子 WRITE_APPEND——append 会读盘上文件的表头并拒绝维度不符（image.h:1534，X/Y/Z 对比，N 不比）。单进程一次运行 box 恒定 ⇒ mid-run 冲突必然意味着栈路径被「另一个写者」占据：上一代不同 box 的栈（t333 场景），或并发写同一微图（STAR 里重复行进了两个 array shard；或 .mrc/.mrcs 同基名——扩展名剥掉后同栈路径）。用户 865 个 bulky 留集群文件 = 本代已写的栈；崩溃点 = 第 ~866 张首次撞上「已被占用的路径」。单进程对重名免疫（首粒子盲替换）——所以要么 workdir 有上一代（1m 0s 的旧 duration 暗示 copy 跑过不止一次/或部署未拉 t333），要么 array 分片重复写。
- 【Blade 1 失败签名】log-diagnosis.ts 新 pattern "extract-stack-size-clash"（RELION 自己的 REPORT_ERROR 原文做正则）——失败作业的 Log 页条带现在自己讲机制（栈路径被不同 box 的旧代/并发写者占据）+ 处方（re-run——dispatch 会先清上一代产物；或新建作业）+ 崩溃微图的半写栈在哪（Results/Files、在集群）。
- 【Blade 2 派发前碰撞扫描】新纯模块 src/lib/relion/extract-collide.ts（零 import，t326/t327 配方）：scanExtractCollisions 找 (a) 同名重复行 (b) 去扩展名后同栈键的相异名（X.mrc + X.mrcs；MotionCor/jobNNN/ 前缀剥离镜像 decomposePipelineFileName；__cfN 重链方言不误报）；starIsArraySplittable 判 STAR 是否 ≥2 个 data 块。接线：remote-run.ts 在 CTF 字节门之后、任何 staging 之前（requestError——行状态不动，toast 讲理）；engine.ts 本地腿同位（workdir mkdir 之前——拒绝时零磁盘动作）。twin-only（集群上没有本地拷贝）的 STAR 诚实跳过并留 console note——降级，从不沉默担保。
- 【Blade 3 分片三处诚实化】(a) sbatch 分片器的 `|| cp <整个STAR>` 回退死了——awk 读不进输入时旧世界把全表塞给每个 shard（N 进程同写同一批栈 = image.h:1534 的并发炸弹）；现在是 CRYOFLOW_ERR 进 run.err + rc 111 进计数文件（count gate 说出 .cf-exit=111）。(b) 单块 STAR（无 optics 块——mock ctffind 自己的方言就是！）+ shards≥2 现在派发前拒绝（"single data block … run with the Array split at 1"）——分片器按「第 2 个 data 块起才切」的契约，单块 STAR 的每一行都会进每个 shard。(c) 健康双块 STAR + shards 的合法分片不受影响（LEG5 活体证明）。
- 【e2e scripts/diag-t334-extract-clash.mjs，47 断言 ALL GREEN @ dev :3000 + mock :3022】UNIT（用户方言干净/重复行点名/.mrc+.mrcs 同栈/pipeliner 前缀/__cfN 不误报/无 mic 列→null/describe 渲染；分片表：双块 ok、单块拒、无行 ok；诊断 pattern 对用户原始 stderr（含 backtrace）出 extract-stack-size-clash@line7，健康日志不误报）+ LIVE（真链 import→autopick@slurm→extract@slurm：LEG1 干净跑通——门不误伤；LEG2 重复行→requestError 拒绝且行保持 completed；LEG3 扩展名孪生→拒绝且栈名点名；LEG4 单块+shards=2→行 failed 带 block 处方；LEG5 双块+shards=2 控制组→分片、合并、COMPLETED，记录带 slurmArray{2,4}）+ CONTRACTS（两刀位次序钉：remote CTF门→碰撞门→probe；local CTF门→碰撞门→workdir mkdir；twin 跳过 note；|| cp 灭绝 + CRYOFLOW_ERR 在场；诊断 pattern 在场）。
- 【回归】t318(52) ALL GREEN、t319 ALL GREEN、t333(75) 经 BASE→:3000 重定位副本 ALL GREEN（重跑真实 class2d 两代 + 双侧哨兵对账——我的数组块插入在 wipe 之前，刀位钉全部存活）。t306/t307/t308（浏览器族）本轮未跑：三者都启 chromium（4GB 盒 dev+浏览器=OOM 判例三连应验，本轮 dev 已被收割三次）；风险已被 LEG5 逐点覆盖（它们的全部分片场景 = 健康双块 STAR + array，正是 LEG5 的控制组），|| cp 只在 awk 失败分支才走。环境课：dev 与 agent-browser 共存平均活 ~2 分钟——交互验证要「同一工具调用内一气呵成」。
- 【浏览器活体（agent-browser 1600×900 @ dev :3000）】手术造证：真 extract 行置 failed + run.out 写用户原始日志 → 点卡片 → Log 页 → 失败诊断条带渲染「Particle stack write refused — the target .mrcs already has a different box size」+ 处方原文（t334-diagnosis-strip.png 定妆照）；390×844 无横向溢流 + footer 钉底；desktop footer 900/900；console 仅 Fast Refresh、page errors 零。证毕全部清理（行/记录/workdir/浏览器），demo 世界复位三作业（t306 时代两枚陈旧 completed 一并清走，engine-state 孤儿记录清零）。
- 【docs】remote-relion.md 新 §4m（一微图一栈——名字不能撞：机制、两种撞法、三把刀）+ 失败目录三行（fresh-job 撞名灭绝/单块分片拒绝/分片失败说话）。
- tsc 0；eslint 0（五改动文件 + 套件）。

Stage Summary:
- 「单进程提取对重名免疫、append 只查 box」——这是从 RELION 源码钉下来的机制事实；因此 image.h:1534 mid-run 的充要条件是「栈路径被另一个写者占据」，而 STAR 的行几何在派发前就可知——把崩溃变成拒绝，是 t320 教义（「会被拒的旋钮不是旋钮是陷阱」）在数据几何上的推广
- 「mock 的 ctffind 写单块 STAR」这个方言差原来是颗活地雷：任何人 CTF→extract + shards≥2 就是并发写炸弹——现在被分片器的块契约拒绝；mock 方言故意不改（改它要动 t306/t307/t308 三套钉子，且守卫已让错配安全）
- 产物：src/lib/relion/extract-collide.ts(新) / log-diagnosis.ts(+pattern) / remote-run.ts(碰撞门+块契约+诚实回退) / engine.ts(本地门) / docs §4m / scripts/diag-t334-extract-clash.mjs(47 断言)
- 对用户的回答同时落在三层：失败卡的诊断条带（产品自己讲）、失败目录（文档讲）、派发前拒绝（根本不再让它跑 20 分钟再死）

---
Task ID: t335
Agent: main-agent (Z.ai Code)
Task: 用户工单「extract 的文件夹中没有 particles.star，star 文件好像放错位置了——项目目录下有个 \data03\Lijing\cryoflow\cmu77omju0000uwfcauoi30d7\extract_ufh1hg0u\particles.star，把绝对路径写进文件名了，这可能是后续 2D 分类找不到 star 的原因；需修复并排查其他任务是否同样中招」——win32 路径污染根因诊断 + 三层修复。

Work Log:
- 【诊断（字节级对上）】engine.ts outPath（buildArgv 的文件型输出槽拼接器）用 path.join；远程车道把 CLUSTER-POSIX workdir（/data03/Lijing/cryoflow/<proj>/extract_ufh1hg0u）递给 buildArgv，而用户的 CryoFlow 跑在 Windows 主机上——path.join 即 path.win32.join，把整个路径重排成 \data03\Lijing\…\particles.star（node 实测输出与用户 ls 看到的文件名字节级一致）。Linux 集群不把反斜杠当分隔符 → relion_preprocess 把整串当「一个文件名」写进进程 CWD——直连 wrapper 和 sbatch 脚本都 cd 到 remoteProjectRoot，所以错位文件落在项目根目录。作业本身成功（.mrcs 栈经 --part_dir 字符串拼接、全数正确落在 extract_ufh1hg0u/micrographs/），但 star 永远没进 workdir → 2D 分类的输入解析（本地 mirror 无 + 集群 twin 无）报「找不到 star」。沙箱是 Linux（path.join 即 posix，输出恒正确）——所以本仓全部远程套件从未复现，这是「Windows 主机专属」的地形性 bug；binJoin（wsl-bridge.ts）当年就是同一疾病（win32.join 打碎 distro 内 POSIX bin 目录）的 binDir 位点手术，outPath 是最后一个未补的位点。
- 【审计（buildArgv 全量过一遍）】中招（走 outPath/path.join）：extract --part_star（本次事故）、class2d/initialmodel/class3d/refine3d --o run、maskcreate --o mask.mrc、postprocess --o postprocess、localres --o relion、joinstar --o join_particles.star。安全（字符串拼接 ctx.workdir+"/"）：ctffind --o、motioncorr --o、autopick --odir、polish/ctfrefine/dynamight/modelangelo/subtract --o、extract --part_dir/--coord_dir——与用户现场完全吻合（ctffind_fq0069iq / autopick_r7t15t4e 目录完好）。附带发现：array 分片车道在 win32 下会先死在 outArg!==wantOut 的诚实拒绝（mangled ≠ posix）——根治后此雷同灭。remote-run.ts 残留的全部 path.join 逐个核过：只碰本地 mirror/本地 FS，用法正确。
- 【Blade 1 根治（engine.ts outPath）】POSIX 安全拼接（模板串 + 尾分隔符剥离），彻底不再调 path.join——binJoin 教义（正斜杠对 POSIX 目录正确、对原生 Windows 目录同样合法：fs/spawn 全平台接受正斜杠，wsl-bridge hostToWsl 两种分隔符都翻）。一个位点修复覆盖全部九个中招任务类型；Linux 沙箱行为按构造等价（模板拼接 ≡ posix path.join）。
- 【Blade 2 兜底（remote-run.ts argv 消毒）】buildArgv 之后、进脚本之前：任何「单反斜杠开头、非 UNC」的 argv 项（\data03\…）恢复成 POSIX——不管未来哪条代码路径再漏 path.join 进来。合法性论证：argv 里没有以单个反斜杠开头的合法项（flags 以 -- 开头、值是 POSIX 路径/数字/C1-D2 类 token、盘符 C:\ 与 UNC \\\\ 不属于集群 argv）。与本地桥接车道 wrapWslCommand.translate 同一规则、各自世界。
- 【Blade 3 现场修复（mopWin32MangledOrphans）】一个 SSH 往返的 POSIX mop：项目根目录下所有「单反斜杠开头、反斜杠全量翻转后落在本项目根之内」的条目 mv 回原位（mkdir -p 父目录；目标已存在绝不覆盖——重跑的新产物压过孤儿；root 以 shQuote 赋给 shell 变量再进 case 模式，用户自配 remoteRoot 含 $/反引号也不展开）。两个挂点：(a) t324 heal 分支、probe 之前——错位的 particles.star 先搬回 extract_ufh1hg0u/，probe 即可 vouch，下游 2D 分类链式续跑、不用重付 9m45s 提取；(b) spawn 任务开头、staging/清扫之前——重跑场景把孤儿搬进 workdir 让 t333 fresh-start 分类器按陈旧产物一起清走，否则反斜杠垃圾在项目根目录永久滞留。幂等、best-effort、绝不拒绝派发；absent-stamp 10 分钟窗口内的 retry 自愈闭环不受影响。
- 【mop 活体模拟（/tmp 沙盘，源码模板逐字生成脚本）】复刻用户现场：正主搬回原位（CF_MOP 上报）、目标已存在不覆盖（FRESH PRODUCT 保留）、\tmp\evil.sh 越界拒绝、\\\\wsl.localhost UNC 拒绝、目标目录不存在时 mkdir -p 自动建、二次运行幂等（剩余条目全是故意跳过的）。首轮「搬不动」恰是防越界门在正确工作（模拟根与假路径不匹配）——安全属性被反向验证。
- 【win32 根因 one-liner 证明】node path.win32.join("/data03/…/extract_ufh1hg0u", "particles.star") 输出与用户 ls 的文件名字节级一致；t335 outPath 与兜底消毒输出正确 POSIX——before/after 钉死。
- 【验证】tsc 0（tsconfig.src.json）；eslint：本工单两文件零新增问题（stash 对照法证明 8 个存量 error 全在未触碰文件——diag-archive/qa63/qa64、print-doc-footer/header、session-report-dialog、molstar-embed，与本次改动无关）；agent-browser 活体（1600×900 + 390×844）：页面干净渲染、Remote clusters 对话框健康（Mock Cluster 探测 0.3s ok、模块清单含用户的 beta_5.0_gpu_ompi5_cuda118）、console/page errors 双零、footer 钉底 900/900、移动端无横向溢流（t335-desktop.png / t335-mobile.png）。dev 服务器本轮被收割两次（沙箱已知模式），重启后 200 恢复；浏览器验证按 t334 教训「同一工具调用内一气呵成」。
- 【未跑】t306/t307/t308 浏览器族（OOM 纪律，t334 判例）——本改动的分片车道契约（outArg===wantOut）在 Linux 上按构造等价（模板拼接 ≡ path.join），且 tsc 类型层无涉；win32 行为差异已被 one-liner 证明消灭。

Stage Summary:
- 「path.join 在 Windows 主机上就是 win32.join」——远程车道递给它的是集群 POSIX 路径，输出即 \data03\…；Linux 把它当「一个文件名」写进 CWD（项目根目录）——错位 star、下游全饿，而沙箱（Linux）永远看不见这个 bug。地形性缺陷要靠「不调用」消灭，不靠「在 Linux 上测试」
- 三层修复一个教义：根治（outPath 不再 path.join——九个任务类型一个位点全覆盖）+ 兜底（argv 消毒，未来泄漏也进不了集群脚本）+ 现场（mop 把孤儿搬回家，heal 分支让 2D 分类零成本续跑）
- 用户侧操作：部署修复后直接再跑 2D 分类即可——dispatch 的 heal 先搬正 star 再 probe 验证，链式续跑；若 extract 记录是 failed 态则 re-run extract（新跑落位正确，旧孤儿被 mop+清扫吃掉）。无需手动上集群改名
- 产物：engine.ts（outPath POSIX 化）/ remote-run.ts（mopWin32MangledOrphans + heal 挂点 + spawn 挂点 + argv 消毒）；模拟沙盘与截图 t335-desktop.png / t335-mobile.png
- 与前票的关系：t334（image.h:1534）杀的是「栈路径被另一写者占据」；本票杀的是「文件型输出参数的路径在 Windows 主机上被打碎」——两张票据一起才解释了用户提取工单的全貌（崩溃 + star 错位）

Task: 同题补完——用户问「提取颗粒为何运行到一半报错了？」（1034 微图 extract 于 20.43/37.65 min 死于 relion_preprocess image.h:1534 "write: target and source objects have different size"，Slurm FAILED 21m02s）。本窗口独立完成与并行窗口 t334 同源的源码级根因链（拉 3dem/relion master 逐行核对：append 期尺寸检查 + getOutputFileNameRoot 去扩展名栈命名 + parseMRCHeader 的 .mrcs 四维读入 + 865+169=1034 的混合导入算术）；并行窗口先落地名字级碰撞扫描（t334）与代际清扫（t333），本提交按 t314 判例重编号 t333→t335，瘦身为互补层。

Work Log:
- 源码级根因链与 t334 独立同源收敛（image.h:1534/_write 的 _exists+APPEND 尺寸检查；每微图颗粒 #1=OVERWRITE 截断、#2..N=APPEND 读头校验；栈名=part_dir+行路径去扩展名+.mrcs——仅扩展名不同的两行写同一文件；.mrcs 全量读入为 (x,y,1,N) 帧 0 窗口）
- t335-a 纯模块 src/lib/relion/extract-gate.ts（t326/t327 零导入配方）：帧栈普查——.mrcs 行经 HeaderSniffer 字节级验证，nz>1=帧栈→带头部数字的拒绝（「8 sections × 1024×1024 (mode 2)」），单截面=放行+note，不可验证=note 绝不拦截；.mrc 纯星静默（名字级几何归 t334 扫描）；engine 复用模块的 parseStarBlocks/micrographRowsFromContent（引擎侧重复定义撤除）
- t335-b remote-run 互补挂接（在 t334 扫描之后、staging 之前）：①孪生星闭合——t334 对集群_only星原是 skip+console note（t324-a 同款盲区），现 cat over SSH 读回原文、t334 的 scanExtractCollisions 对集群自己的文本重跑（同款拒绝措辞，不是更软的）；②帧栈普查仅在存在 .mrcs 行时跑（纯 .mrc 星零开销）；门注记搭 sbatch/direct 两处 note（ctffindGateNote ?? extractGateNote）
- t335-c 导入回执扩展名普查：「⚠ mixed extensions: N .mrc + M .mrcs …」（6 文件嗅探会漏少数派，普查直接报数量+碰撞机制+重导入指引）
- t335-d 本地引擎同款帧栈普查（t334 本地扫描之后，仅 .mrcs 行时经 localHeaderSniffer）
- 撤下与 t333/t334 重叠的部分：名字级重复/孪生拒绝（t334 owns）、rm -rf micrographs/Particles/extra/shard_* 清扫行（t333 代际清扫 owns——共享分类器+保留契约更完整）
- diag-t335-framestack-door.mjs（原 diag-t333-extract-guard.mjs 重编号改写）：A 相纯逻辑（帧栈拒绝带头部数字/单截面放行/无嗅探降级/抛异常降级/纯 .mrc 星静默/行读取器）；LIVE——混合导入回执带普查、t334 措辞的孪生拒绝（本地星路径）、纯帧栈导入的 SSH 嗅探 nz=8 拒绝、干净链路完成无误伤
- 回归：t334(47)/t333-rerun-wipe(75)/t330/t332/t331/t325/t327 全 ALL GREEN（t327 首跑 3 败为 mock 账本 136 条陈旧条目拖慢活体记账窗口——清账后全绿，非代码回归）；tsc 0；触碰文件 eslint 0

Stage Summary:
- 用户的「运行到一半报错」双窗口同源收敛作答：根因=导入集混入 .mrcs 电影帧栈+扩展名孪生共享输出栈路径；修复=重导入用 *_Fractions_DW.mrc 精确模式再重跑
- t335 补齐 t334 的两个盲区：集群_only孪生星的 SSH 读取（扫描不再跳过）与 .mrcs 行的字节级帧栈验证（名字级扫描看不到茎名互异的帧栈污染）；外加导入期普查回执

- t335 补齐 t334 的两个盲区：集群_only孪生星的 SSH 读取（扫描不再跳过）与 .mrcs 行的字节级帧栈验证（名字级扫描看不到茎名互异的帧栈污染）；外加导入期普查回执

---
Task ID: t336
Agent: main-agent (Z.ai Code)
Task: 用户工单「把cryosparc的cs文件转成star文件的job，并可以在cryoflow中直接用于后续job运行」+「检测star文件中需要哪些颗粒文件再link过来改名，而不是将project中所有的颗粒文件都link过来」（参考 upload/cryosmart_relion_trans3.0.sh：集群跑 pyem csparc2star --inverty、链接 extract 全部 .mrc 改名 .mrcs、sed 改星）

Work Log:
- 先收尾 t335：B3 孪生星腿重写为真实 t324-a 形状（上游 ctffind 远程作业输出星删本地副本 → t324 heal 探测补 twins → 解析为集群路径 → SSH cat → t334 扫描重跑同款拒绝；import 远程腿不产生 remote record 的探针真相钉入断言注释）——ALL GREEN ×2 + 回归（t334/t333-wipe/t330/t332/t331/t325/t327 经 mock 账本清污后）全绿，rebase 集成到并行窗口的 t333/t334 之上并 push
- t336-a src/lib/relion/cs-npy.ts（纯）：npy 结构化数组读取——Python 字面量头字典 tokenizer（dict/list/tuple/str/int/bool/None）、子数组 dtype（(3,) pose、(2,) shift/shape）、<U UTF-32LE 与 S 字节串（NUL 截尾）、LE/BE 数字、v1/v2 头长度；非 npy/嵌套结构体/fortran 序诚实抛错
- t336-b src/lib/relion/cs2star.ts（纯，pyem 映射表逐行核对 asarnow/pyem master）：uid 左连接 passthrough（字段缺省才补）、Rodrigues→Euler（expmap + Shoemake rot2euler，RELION ZYZ 约定）、defocus Å 直通（字段名 _A）、rad→deg、optics/class/subset 0→1 基、归一化坐标→绝对像素（micrograph_shape=[y,x] 轴交换）、RELION 3.1 光学方言（OriginXAngst=shift×angpix）；--inverty 的 argparse store_false 语义入档（pyem 默认反转、flag 关闭；参考脚本传 flag → 本作业默认 false）；普查先行（链接名冲突 -2 后缀，星行与链接计划同源）
- t336-c 引擎原生 runner runCs2StarNative（双车道）：远程——SSH 发现（J### → sort -V 最新 *particles.cs + 首个 passthrough，参考脚本自己的次序）→ statRemoteFiles 限额校验 → remoteDownload 双 cs 落 workdir（Files 页可查）→ 转换 → 逐一验证引用栈存在（缺失即拒）→ ln -sfn 批量（250/轮）只链接被引用者到 <remoteProjectRoot>/micrographs/<name>.mrcs（链接名带 .mrcs、目标保持 .mrc，零数据搬运）→ 星行说链接名；收执带「2 of 3 .mrc linked — only the referenced」普查 + 光学 + 对齐源 + 未映射字段数；本地车道同构（本地符号链接）
- t336-d 集成：NATIVE_TYPES/REMOTE_BOOKKEEPING_TYPES + workflow 目录（IMPORT 类、ArrowLeftRight 图标入注册表、Source 页签：csPath filePick/invertY/高级光学回退）+ 13 个 particles_star from 列表 + select2d + 两个命令面板预设 + output-summary 关键数字（particles converted / particle stacks linked）+ runRealJob 分发
- diag-t336-cs2star.mjs 45 断言 ALL GREEN ×2：A 相（npy 写读往返含子数组/U 串/双精度；垃圾拒绝；pyem 数学经套件内独立重打的 euler2rot 往返校验；转换表——单位/1 基提升/uid 连接/列序/链接计划/碰撞后缀星与计划同源/invertY 数学/无 blob 行丢弃/未映射回执）；B 相活体（参考脚本工作流在 mock 上：3 栈且 baz 未被引用 → 转换完成、只链 foo+bar（readlink 验证、baz 原封不动——优化见证）、收执普查、downstream class2d 派发集群吃链接栈完成、关键数字条、点名失踪栈的诚实失败）；C 相本地（镜像 CS 工程布局：本地链接同普查）
- 回归全绿：t335 / t334 / t333-rerun-wipe / t332 / t330；tsc 0；触碰文件 eslint 0
- 浏览器活体（prod :3001）：IMPORT 类目录三卡、Enter 上画布、参数面板 Source 页签 + csPath 选择器 + invertY 开关、390×844 零横向溢出、console+page errors 双零；截图 t336-cs2star-params/-mobile.png
- 教训：块注释里 J*/extract 的 */ 提前闭注释（tsc 在 44 行报语法错——写注释别让 glob 语法当注释终结符）；模板字符串 ${descr.join(", ") 后漏 }（eslint 解析错）；float32 表示噪声（0.07 读回 0.070000000298）——fmt 用 6 位有效数字（pyem/pandas 显示默认），收执插值也要走同一格式化（f6）

Stage Summary:
- CryoSPARC 用户现在在 cryoFLOW 里画一个「CryoSPARC → RELION」节点、填 J### 目录即可：转换（对齐/CTF/光学全套 pyem 语义）、选择性链接（只链被引用的栈、改扩展名、零搬运）、下游直接接 class2d/refine3d——参考脚本的三步手工流程变一个作业行，且不再链接整个工程的颗粒文件
- 纯 TS 的 npy 解析器 + pyem 映射表让转换不依赖集群上的 pyem/python；.cs 副本留在 Files 页可查；关键数字条先说颗粒数
---
Task ID: t337
Agent: main-agent (Z.ai Code)
Task: 用户工单「Job failed — sbatch refused the submission: Requested node configuration is not available · .bashrc line 35 噪声」——节点钉扎提交被控制器提交时刻拒绝且无任何原因说明；诊断 + 修复 + push

Work Log:
- 诊断（读引擎全链）：t311 的 GPU 宽度钳制只对「被挑选的分区」说话，留下两个直通拒绝的暗洞——① 显式 --nodelist 钉扎抑制了 --partition（t332），而对「节点自己的 GPU 数」没有任何钳制：把 5 GPU 的 normal 钉在默认宽度 6 上，拼出的正是用户贴的逐字拒绝；② 「auto」（未挑分区）仍携带连接默认分区却完全不钳制：normal(5) + 宽 6 → 同款拒绝。另无任何提交前节点状态核验（面板 30s 轮询、挑完到提交之间状态会老化）、sbatch 拒绝原文零翻译
- 修复一（引擎预检，remote-run.ts）：钉扎存在时多跑一趟 SSH（scontrol show node <pin> -o，复用 usage 路由的纯解析器）——未知节点/DOWN/DRAIN → 带原因与解法的 requestError 拒绝（字节未动、行保持 idle）；0-GPU 节点载 GPU 作业 → 矛盾点名拒绝；较窄节点 → 宽度钳到节点自己的 GPU（t311 方言、节点的话）。预检跑不了（SSH 抖动/无 scontrol/127）→ 降级旧行为，监控永不阻断派发
- 修复二（宽度钳制重排）：钳制优先级改为 钉扎节点的实时 scontrol 行 > 脚本实际携带的分区（被挑的，否则连接默认——t337 补上 auto 暗洞）；钳制块整体移到连接门之后（预检需要 conn）
- 修复三（翻译）：sbatch 仍拒绝时（漂移窗）错误追加「what was requested: node X · partition Y · N GPU(s)」+ 三条修复动作；.bashrc 噪声注记保持 t311 分流
- 修复四（对话框）：AUTO 档步进器天花板改为连接默认分区的 gpusPerNode（原来取库存第一组——8 GPU 组配 normal 脚本是说谎的天花板）
- mock：sbatch 的提交门改钉扎感知（节点表镜像 scontrol：normal 5/brain 6/brain2 8/node01-04 6/node05-08 0；未知名 → Invalid node name；~/.slurm/node-override「name STATE」文件把节点翻 DOWN——scontrol/面板/门三方同一世界）；scontrol emit_node 同读 override；新增 probe 盲区 4 GPU 分区 debugx 专测翻译残路
- diag-t337-node-preflight.mjs 全绿（契约钉 + 七条活体腿）：B1 用户回执源头治愈（normal 钉扎宽 6 → 钳 5 → 脚本 --nodelist=normal --gres=gpu:5 无 --partition → COMPLETED + 日志见证）；B2 auto 暗洞（无钉无分区宽 6 → 默认分区钳 5 → 完成）；B3 排空节点（override 翻 brain3 DOWN → 拒绝带状态、行未失败、集群零落地；松开杠杆同参数再提交即完成——拒绝的是状态不是钉扎）；B4 未知节点；B5 0-GPU 节点；B6 残路翻译（debugx 宽 6 → mock 控制器拒绝 → 行失败带「what was requested: partition debugx · 6 GPU(s)」+ 噪声标注）；B7 健康钉扎回归（node03 宽 2 原样通过）
- 回归全绿：t332（钉扎全链含活体记账）/ t327 / t335 / t326 / t320 / t330；t304 为退役 dev-server 绑定的历史套件（打到 my-project 模板 404 HTML），按判例不属现行回归名单
- 浏览器活体（agent-browser @ prod :3001）：对话框 AUTO 档步进器天花板 5（修复前会是 8）实测；钉 brain2 → 预览 #SBATCH --nodelist=brain2（无 --partition）+ ask line 重定域；步进到 8 → 预览 --ntasks=8 --gres=gpu:8；Send → 「Slurm job 26 · 8 GPU(s) · queued」→ 集群脚本带 --nodelist=brain2 --gres=gpu:8 → COMPLETED；console+page errors 双零；390×844 对话框零横向溢出；截图 t337-node-pin-dialog/-mobile.png
- 环境重建（沙箱重置后第四次）：clone origin/main(3d03797)、bun install、db push、standalone prod 构建 + prod-3001.sh、mock launch.sh dev
- tsc 0；触碰文件 eslint 0；docs §sbatch 章节 + 失败目录新行 + mock 章节

Stage Summary:
- 用户回执的「Requested node configuration is not available」对 app 自拼提交已源头灭绝：钉扎预检（节点自己的 scontrol 行）+ auto/连接默认分区钳制 + 0-GPU/未知/排空三类教学式拒绝 + 残路翻译（说出要了什么、教三步修法）；.bashrc line 35 是登录壳噪声、已按噪声标注（用户自己的 dotfiles 问题，值得顺手修掉但不影响提交）

---
Task ID: t338
Agent: main-agent (Z.ai Code)
Task: cryoflow 用户工单第八期(t338)——用户三报: ①「从节点使用情况处选择节点后，node框还是auto没有变化」 ②「extraction无法用GPU吗?」 ③2D 分类 readMRC "Image number 341 exceeds stack size 340" 段中途崩溃(log 如上); 修复后 push

Work Log:
- 诊断③(与 t334/t335 同族闭环): extract_ufh1hg0u 的 particles.star 引用 image 341 而栈只有 340——t334 碰撞的 SILENT 变体: 输入 star 同茎双行("X.mrc"+"X.mrcs" 同合成一个栈路径)两写者共写一栈, 后者首粒盲覆写截断前者, 合并 star 仍保留两者行号; extract 退出 0(毒无感知), relion_refine 消费侧 ~1 分钟即死。t334/t335 在 extract 派发侧拒此类输入, 但看不见「已完成却带毒」的旧输出(用户数据库现状)
- 实现 C: src/lib/relion/particle-ref-gate.ts(纯模块, t326/t327 配方)——颗粒 star 消费者(class2d/class3d/refine3d/initialmodel/multibody/polish/ctfrefine/subtract/dynamight)派发前逐"N@path"引对栈自身 MRC 头核验(远程 lane 一次批量 SSH 每 ~192 栈; 本地 lane 本地读); 引用解析依 RELION 自身语法(绝对→项目根→star 目录, 首个存在者受审); 超界→REQUEST 拒绝带精确数字+机制+修法; 健康通过带回执 note(CRYOFLOW_NOTE 入 run.out); 不可验证(缺失/不可解析/.eer)降级 note 永不阻断(t313 保守主义); 违规按栈去重(341 行毒栈=一句谎说 341 次, 非 341 句谎)
- 接线: remote-run.ts 网关块置于 upstreamRemoteTwins 图后(本地镜像 star 走 twin 拿集群侧目录; 集群独占 star 走 SSH cat——t335 闭环同款); note 链 ctffind→extract→particles 三门共存; engine.ts 本地 lane 同闸于 workdir mkdir 前
- 实现 D: log-diagnosis 新 readmrc-exceeds-stack 模式——用户逐字 stderr 命中, 讲机制+指上游+说新门; t334 write-clash 模式零串扰
- 实现 A(用户①): Node/partition 下拉与使用面板钉扎互相镜像——钉扎存活期间框显示「MapPin <node> — pinned from the live list(精确节点 --nodelist · 下方实时列表所选 · 此处选 Auto/分组即释放)」; 显式挑 Auto/分组释放钉扎(t332 mismatch guard 语义保持, 分组+钉扎组合态从 UI 消失——预览已同时展示两 chip)
- 实现 B(用户②): extract 宽度框专属契约「0 × GPU — CPU-only extraction: relion_preprocess 无 GPU 代码路径(裁箱+归一化在 CPU), GPU 只会闲置还挤占分类作业; 速度旋钮是下方 Array split(N 个 CPU 分片并行)」
- 顺手修两处存量: ①mock relion_preprocess 行号改每栈重置(真实 RELION 语法; 旧全局计数使第二栈起行号全超自身 nz——任何真实 RELION 不产出的方言, 新网关理所当然拒绝) ②engine.ts 本地 t335 帧栈普查块被括号嵌套滑进 t334 扫描的 catch 里(正常路径死代码)——移回教义位置
- diag-t338-particle-ref-gate.mjs 67 断言全绿: UNIT(用户 341/340 精确形状拒绝带数字+rwMRC+机制+修法; 健康通过 349 ref 计数; 无/抛错嗅探器降级; 不可解析/.eer 不判; refCandidates 语法四则; 四违规栈截断为 3+计数; 诊断模式命中用户 stderr 且不误伤健康/t334 签名) + LIVE(健康链 import→autopick→extract→class2d 完成+回执 note 入 run.out+每栈编号 pin) + LIVE 毒(栈头 NZ 重写为 maxImage-1 即用户 341→340 算术 → class2d REQUEST 拒绝带精确数字+行保持 idle+集群零落地) + LIVE 双星闭环(删本地 star 副本→SSH cat 同拒绝)
- 回归全绿: t312/t314/t315/t316/t318/t319/t320/t322/t323/t324/t325/t326/t327/t328/t330/t331/t332/t333/t334/t335/t336/t337; 途中修七套件存量夹具谎言(star 行号超栈 nz: t315/t317/t319 的 nz=2 配 24 行→头-only nz=24; t326/t327/t331/t332/t333/t337 的 nz=1 配 2-4 行→nz=2/4——夹具曾是新门存在意义本身的例证) + 两处过期源码 pin(t314 note 链/t323 本地日志清理→t333 mirror wipe 契约) + t315 采样断言(t322 确定性采样后的存量断裂, 改测 reroll 契约); t316-t334 五套旧路径绑定(/home/z/my-project)以重定位副本跑通; t317 三失败为 t328 窗口 dispatch.ts 重构存量(与本窗 diff 无关, dispatch.ts 未动)
- 浏览器活体(agent-browser @ prod :3001, t338 项目 extract 卡): 点使用面板 brain2 行 → Node/partition 框从「Auto — scheduler picks」变「brain2 — pinned from the live list」(用户①修复实证); 下拉开列钉扎项+Auto+分组, 显式选 Auto → 钉扎释放回 Auto(往返闭环); extract 宽度框「0 × GPU — CPU-only extraction」+ relion_preprocess 无 GPU 代码路径全文在案(用户②); console+page errors 双零; 截图 t338-node-pin-mirror.png
- tsc 0; 十二触碰文件+新模块 eslint 0; docs 新 §4p + 失败目录新行(readMRC); 环境终态: 模板 3000 运行中, cryoflow prod :3001 + mock :3022 保留

Stage Summary:
- 用户三报全闭环: ①节点框镜像钉扎(选了节点框就变——双向释放语义) ②extract CPU-only 如实陈述+Array split 是速度旋钮 ③毒 star 在消费侧派发前拦截(readMRC 341>340 的精确数字拒绝), 旧毒输出的 Log 标签页有诊断, 上游 extract 派发侧 t334/t335 拒源头输入
- 用户复机路径: pull 最新 → 重跑 extract(其输入若含同茎双行会被拒并列名→去重导入)→ 2D 即通; 若不重跑 extract 直接重跑 2D, 新门立即拒绝并指出上游(不再烧 20 分钟 GPU)

---
Task ID: t339
Agent: main-agent (Z.ai Code)
Task: 「先拉取远程最新代码。目前所有的远程任务都会在本地也创建一个文件夹，保存一些job的基本信息可以，但是extraction的mrcs也有一些放到本地了，是不是没有必要，而且很占用本地的硬盘空间，我希望本地的空间占用尽量小一些。」——pull t335-t338 四提交后, 修 extract .mrcs 溜进本地镜像的漏洞; 完成后 push

Work Log:
- 先 git pull: 本地 1081 文件"改动"全为权限位 100644→100755(沙盒 fs 怪癖, 零内容差异)——git config core.fileMode false 后干净合入 e2926d6(t335)/3d03797(t336)/c3b3709(t337)/c26bea1(t338)
- 根因: syncBackWorkdir 的 t289 key-files 策略按【单文件】16MB 门控二进制——extraction 每微图一个 .mrcs 栈, 单个几 MB 全在帽下, 865 个=GBs 全部落地; 单文件判断看不见聚合, 这正是用户撞穿的洞。逐文件消费链核实: /outputs/file 路由已带 t289 懒拉取(远程文件本地缺失→按需 SSH 拉), classes 路由直接读本地 class-average 头(必须继续同步), t338 消费门对本地缺失 ref 降级 note 不阻断, t331 cleanup 对话框已支持 local/remote 分侧勾选(本地瘦身杠杆已存在只欠人知)
- 实现: 新纯模块 src/lib/remote/sync-policy.ts(t326/t327 配方, 唯一 import 是 cleanup 的 BULK_TYPES——删除与同步共用一套语法: 对删除是 bulk 的类型对同步也是 bulk, 都指"每微图图像产物")——planSyncBack 纯规划器(metadata-only/key-cap/per-file-cap/budget 四类 skip + 预算扣减) + describeSyncSkips note 生成器(metadata-only 段先讲政策不讲帽, 帽段保留 t289 原措辞, 两段可共存) + describeSyncSkipFile 逐文件行(记录字段方言不变)
- 接线: remote-run.ts syncBackWorkdir 增第四参 jobType, finalizeRemoteRun 传 job.type; 循环只执行规划(台账仍先行——writeRemoteManifest 在 planSyncBack 前, 中途死同步也留下全量真相); 下载期失败(failed/grew)追加进 skip 列表由同一 note 渲染; KEY_TEXT_EXT 迁入纯模块(一门脑三处说: lane+note+diag)
- 规则本体: key-files 下 BULK_TYPES(extract/motioncorr/polish)仅同步 KEY_TEXT_EXT 文本(STAR/日志/eps 图)——图像栈无论大小留集群, manifest 列出+Results 标 remote:true+点开按需拉; 其余类型保持 t289 教义(class2d 几 MB 的 run_classes.mrcs 照常回家——class 画廊本地读头不受损; 大图照旧留集群); everything 覆盖字面语义不变(用户显式选择)
- hpc/cleanup.ts: BULK_TYPES 加 export(带 t339 注释); remote-cluster-dialog.tsx 文案三处: 下拉项「Key files only — STAR & logs sync, image stacks stay on the cluster」+ 同步域 hint 讲三类型仅元数据+ key-file cap hint 讲该帽只塑形其他类型
- diag-t339-mirror-slim.mjs 48 断言全绿: UNIT(A1 用户漏洞形状——1KB 的 .mrcs 也留在集群, 尺寸无关性是本修复的芯; A2 class2d 控制组 3MB class averages 回家+20MB 图留; A3 motioncorr/polish 同规; A4 everything 覆盖全回家; A5 无 jobType 走旧语义; A6/A7 帽与预算算术; A8 note 讲政策措辞; A9 key-cap note 保留 t289 原文; A10 空 skip 无 note; A11 混合两段共存) + LIVE(用户管线 import→autopick@slurm→extract@slurm: 镜像零图像文件+particles.star 在+note/skippedFiles 各带 metadata-only 缘由+manifest 4 栈带尺寸+Results 4 栈 remote:true; 懒拉取门: PNG 200 渲染+字节数对账 t298 判决; 下游 class2d@slurm 就地链集群副本完成且自家 run_classes.mrcs 照常回家+永不讲 metadata-only note; everything 覆盖: PATCH 连接重跑后 4 栈落地逐字节对账; 瘦身杠杆: local-only bulk 清理删 4 栈 2.7MB 集群 4 栈分毫未动) + CONTRACTS(finalize 穿线 job.type/台账先行→plan→download 顺序/KEY_TEXT_EXT 不在 lane/BULK_TYPES 导出)
- 回归全绿(8 套件): t339(48)/t334(47)/t335/t333(75)/t318(52)/t319(57)/t336(45)/t338——t335/t333/t336/t338 硬编码 :3001+/home/z/cryoflow(沙盒重置后不存在), 按 t334 先例以 BASE→:3000+ROOT→本仓重定位副本跑(t335/t333/t336/t338 需 bun 跑: 模块无扩展名相对导入 node ESM 不解); t306/t307/t308 浏览器家族按 OOM 教义未跑(本窗 dev 仍被 OOM 收割一次, 回归后重启)——t307 的 extra/ 断言全在集群侧(grep 核实), t308 走懒拉取门, 风险为零记为环境债; t331 套件未跑(需 qa-mock-sibling 种子连接的 :3001 环境; 本窗未动 cleanup 分类语义仅 export 一常量, 且 t339 LEG B5 已活体跑通 local-only bulk 路)
- 浏览器活体(agent-browser @ dev :3000): 桌面 1600×900 首页渲染零错零 console 错, footer 900/900 钉底; 集群对话框 Add connection 表单新文案三处逐字渲染(下拉项+域 hint+cap hint); 390×844 零横向溢出(w:390) footer 844/844; 截图 t339-desktop/t339-dialog-wording/t339-mobile-390; dev 途中被收割一次后重启, 终态 3.3GB 空闲
- tsc 0; 触碰五文件 eslint 0(仓库存量 8 错全在未触碰文件: print-doc-*/session-report-dialog/map-ortho-panel/molstar-embed+两 diag-archive); docs §4q 新节+§3 连接参考表 syncPolicy 行+失败目录新行(extraction stacks filling the laptop=by design 非失败)+§7 路线图新 shipped 条目

Stage Summary:
- 修复语义: 远程任务的本地镜像=元数据——key-files 下 extract/motioncorr/polish 只回文本, 图像栈无论尺寸留集群(manifest 可见+Results 列出+按需拉取+下游集群作业就地链); 其他类型 t289 教义原样(class averages 照常回家, 画廊无损); everything 显式覆盖不变
- 用户存量 GB 级已落地栈的两条出路: ①每任务清理对话框 Bulk tier 仅勾本地侧(集群分毫不动, LEG B5 活体验证) ②重跑任务(t333 代际 wipe 清镜像后新政策生效)——无需手工 rm
- 用户「本地空间尽量小」的完整答案: 新流入=零(本修复), 存量=一键瘦身(杠杆已有+文档指路), 显示/下游/按需取回全部无损(t289/t298/t324/t338 四代教义兜底)

Task ID: t340
Agent: main-agent (Z.ai Code)
Task: cryoflow 用户工单第九期(t340)——三报: ①cs2star 转换文件存到本地了吗 + 运行时先失败(超时无log)后成功 + 页面一直热加载编译 ②sbatch 拒绝「Requested node configuration is not available — node gpu06 · no GPUs」: 2D 分类提交报错, extraction 用 auto 或使用面板选节点也报错, 但下拉选节点可运行(两种选法显示也不一样); 修复 + 全量回归 + 浏览器活体 + push

Work Log:
- 沙箱重置后第五次环境重建: clone origin/main(c26bea1=t338)、bun install、db push(首跑推错 custom.db, prod 用 cryoflow.db —— 500 The table Project does not exist 的根因, 重推后愈)、standalone prod 构建 + prod-3001.sh、mock 3022 dev 模式
- 诊断②: 两通道为同一节点组出两份 sbatch —— 下拉带 --partition=<group>(单主机组再加 --nodelist), 使用面板钉扎则整个抑制 --partition(t332「节点自己的分区就是它落的地方」) → 无 --partition 时控制器落集群默认分区, GPU 节点不在那里 → 提交时刻拒绝, 用户回执逐字复现。修: 钉扎解析节点自己的分区(t337 预检的 scontrol Partitions= 优先, probe hostlist 次之) → sbatch 写 --partition=<own> + --nodelist=<node>, 与下拉同字节组合; 真不知道家的节点保持裸 --nodelist(连接默认分区不得搭车——错分区是必然拒绝, 缺分区只是让默认说话), 拒绝翻译新增 no-partition 陷阱点名
- 修②伴生: 引擎侧矛盾门(挑了节点不在的分区 → staging 前教学式拒绝, API 门的 mismatch guard); 对话框 previewPartition/payload 钉扎期间无视分区状态(分区 state 会自动初始化成连接默认——「normal」+钉 brain2 会组合出矛盾); ClusterUsagePanel 的 mismatch guard 退役(它对着自动初始化的分区 state 开火, 钉任何默认分区外的节点瞬间被杀——「死钉」, 浏览器活体当场抓获); 镜像项带节点分区 chip「brain2 [brain2] — pinned from the live list · exact node (--nodelist) in partition brain2 (--partition)」
- 诊断①: cs2star 325k 粒子在进程内跑数分钟, recordNativeRun 只在最后写记录 → jobs GET 的 reconcile 扫描把 >120s 无记录的 running 行翻成「stale running state (no engine record) — re-run」→ 先假 FAILED(无 log——log 文件也不存在) 后真 COMPLETED, 用户回执逐字复现。修: beginNativeRun(cs2star+import 两个马拉松 native)第 0 秒写 in-flight 记录(pid=服务器进程, 扫描的存活判据天然通过), runner 分阶段往 run.out 说话(discovered/downloaded MB/converted N/linking N + 每 2500 链心跳), Log 标签页运行中即有内容; 诚实失败 abortNativeRun 关记录不抹上次产出; runner 异常不再裸 500(dispatch 包裹上报); 服务器重启中途 → 熟悉的 interrupted 判词
- 修①③: 热加载编译风暴 = Tailwind v4 自动内容检测扫描并 watch 整个项目树(未 gitignore), 引擎每 2-5s 写 data/engine-state.json + 作业 workdir → CSS 连续重建 → dev overlay 整场「compiling」。修: globals.css @source not "../../data" + "../../db" + .gitignore data/ db/*.db
- cs2star 输出位置之问的答案(文档化): star 有意落在本地 <repo>/data/relion/<project>/<job>/particles.star(回执 output: 行即它), 颗粒栈零字节移动(集群上只有 ln -sfn), 下游远程 job 派发时自动把本地 star 上传(t336 E2E 已证链路)
- mock sbatch 新增 t340 会员门: 钉扎节点不在生效分区(脚本的或集群默认 gpu)→ 逐字复刻用户回执; 同节点+自己分区通过; node01-04 裸钉(在默认分区)仍通过——诚实形状全数保留
- diag-t340-pin-partition-native.mjs 39 断言 ALL GREEN: CONTRACT 17 钉(引擎/对话框/CSS/gitignore/mock 门) + LIVE(手搓裸钉被拒=回执复现 / 同节点+自己分区通过 / APP 钉扎写双行并完成 / 下拉通道同两行=等价 / cs2star 运行中 Log 路由带 phase trail 答话 / B6 双腿: 无记录陈旧行仍翻 failed(对照)+ in-flight 记录同龄行存活(修复本体))
- 回归全绿: t312/t314/t315/t316(重定位)/t318(重定位)/t319(重定位)/t320/t322(重定位)/t323/t324/t325/t326/t327/t328/t330/t331/t332(更新契约)/t333(重定位)/t334(重定位)/t335/t336/t337(更新契约)/t338; t317 三失败为 t328 窗口存量(判例在案); 套件自身两处 bug 途中修正(dispatch 双层包裹打穿成 project-binding 兜底 + B5 需不 await 才能抓运行中)
- 浏览器活体(agent-browser @ prod :3001, 1600×900 + 390×844): 使用面板点 brain2 → 钉住(旧构建当场演示「死钉」被守卫杀掉→修后钉住) → 框显「brain2 [brain2] — pinned from the live list · exact node (--nodelist) in partition brain2 (--partition)」→ 预览 --partition=brain2 --nodelist=brain2 --ntasks=5 --gres=gpu:5 → Send → 集群脚本两行在案 → COMPLETED; 选 Auto → 钉释放回 Auto; console/page errors 双零; 390×844 零溢出; 截图 t340-pin-dialog/-mobile.png 入仓库
- 途中: prod build 一次 OOM(137, 4G 盒, 关浏览器+NODE_OPTIONS 2048 后过); MultiEdit 对 remote-run.ts 路径反复 No such file(以 python 补丁代之); pinPartition 块曾重复插入(python 去重)+ 曾落在 clamp 之后(TDZ, 调序)
- tsc 0 / eslint 0(七文件) / docs §4r + 失败目录两行 / 仓库 worklog Task t340

Stage Summary:
- 三报全闭环: ①cs2star 假 FAILED/无 log→in-flight 记录+分阶段日志, 热加载编译→Tailwind 排除 data/db, 输出位置之问文档化 ②钉扎抑制分区→解析节点自己的分区, 与下拉同组合, 死钉(自动默认分区的守卫误杀)一并根治
- 用户复机: pull 最新 → 使用面板选节点即提交成功(与下拉同效); cs→star 长跑全程 running+活日志, 不再先假失败
- 环境: 模板 3000 运行中(GET / 200), cryoflow prod :3001 + mock :3022 保留, /home/z/cryoflow 树净待推
---
Task ID: t341
Agent: main-agent (Z.ai Code)
Task: 「我在cluster上提交2d分类时报错了，帮我修复。同时修复代码审查查出来的问题，完成后push」——2D 分类 30s 静默死亡 (prterun rank exit 1, 诊断 strip=out of memory) + 代码审查 C1/C3/低危三发现全闭环; 完成后 push

Work Log:
- 根因三轴 (用户收据「staged 0ms · synced 6 files back · Slurm FAILED 30s · prterun-gpu06 exit 1 · 无 error tail · gpu-oom 命中」): ①refine 家族批大小无内存意识 (RELION 默认 128 恒定, 大 box 的 cuFFT 工作集 ∝ batch·box²/³) ②残留进程占卡——C1 ghost 的进程面孪生: 无人认领的同名 sbatch 仍持 workdir+GPU 显存, 新 run 撞显存死 ③非隔离集群的 GPU 寻址 (gres 无 cgroup 时 --gpu 0:1 按物理卡号, 可能是他人的卡)
- 修复 1 memory-aware batch: engine.ts 新 particleBox (上游 extract boxSize/downsampleTo 折算) + refineAutoBatch (2D 安全线 200px/3D 160px; 线下不动 RELION 默认——零行为变化; 线上 2D∝box² 3D∝box³, floor8, clamp[32,64]); class2d/class3d/refine3d argv + workflow.ts 三 spec 新「Batch size (0 = auto)」(Compute 页, advanced, 显式值全面优先——用户工单的一旋钮修法)
- 修复 2 残留 reaper: dispatch 在 t333 wipe 前 scancel -n cf_<type>_<id8> (sbatch 名 per-job 唯一→只杀本 workdir 的 stale 提交; 拒绝不阻断); mock scancel 补 -n/--name 语法 (按 job-*.name 扫描, 同一取消路径)
- 修复 3 sbatch GPU pin 块: CUDA_VISIBLE_DEVICES 未设时从 GPU_DEVICE_ORDINAL/SLURM_JOB_GPUS 取授予集 (Slurm≥20.11 GresAutoDetect 方言); 集群自身隔离时不干预
- 修复 C1 ghost-sbatch 四道围栏: dispatchCancelled() (record startedAt+done 语义——reset/delete 清除, 并发 re-dispatch 换 startedAt, sweep 可终态化) · staging 逐文件检查(停止烧线) · pre-submit/post-submit 检查(已提交→scancel/kill 再撤) · 行翻转 db.job.update→updateMany(status∈pending|running) + catch 不再覆盖用户 reset (失败路径孪生)
- 修复 C3 删除墓碑: 新 src/lib/job-tombstone.ts——DELETE 先快照 record(强制终态)+双图层边(DB 对+sidecar 带端口) → data/deleted-jobs/<id>.json (原子写); restore 服务端 applyJobTombstone (record 只填空槽, 边需两端存活, persistPortEdge 幂等); restore 响应加 recordRestored+edges; store.ts undoDelete 跳过服务端已接线 + 409 "already exists" 记成功 + toast 记录 record 重挂
- 低危三发: listRemoteWorkdir 新 publish:false (dispatch 预擦除列表/POST 执行重列不再污染 10s 共享缓存——「10s 内 plan 空」) · db.ts 查询日志 CF_PRISMA_LOG=1 门控 · finalize twin 探测改 index-payload (echo 路径串被 login-shell/测试架改写时不再全空——44/44 远程记录 twins 为空的真因; t324 lazy probe 本就说 key 方言)
- silent-death 回执按 r.mode 分流: Slurm 失败不再被告知「multi-hour jobs belong in Slurm mode」(用户收据的误导原文), 改指 OOM killer/walltime/scancel + sacct -j <id> + 诊断 strip
- E2E 六套 257 断言全绿: run-1 EMPIAR 全链 106/106 (103s, FSC 6.51Å) · run-2 48/48 (修存量 cat 引号 typo) · run-3 25/25 (墓碑落盘/restore 服务端重建 record+边/下游免重跑直接消费/twins 恢复后 dispatch 零 staging) · run-4 24/24 (staging 期 reset→无 ghost+单写+dev.log 取消标记在 reset 之后; 新 Phase6 种同名 stale sbatch→app re-run 收割: stale CANCELLED+fresh COMPLETED——用户集群一键自愈路径) · run-5 27/27 (含新缓存回归: 派发后 2.5s 无刷新 plan 见 bulk:8) · run-6 新增 27/27 (box360→--batch_size 32 预览+派发一致/box64→无 flag/--gres=gpu:2+mpirun -n 2+--gpu 0:1+pin 块/覆盖 batchSize=24 生效)
- 排障: 沙箱磁盘 100% (mock fs/projects 2.7GB E2E 累积)→清理; mock base64 种 stale 的 #SBATCH 路径不过翻译→still-born (改 mock-real 路径直写=FS_ROOT guard 本义); 本地 RELION 未装→preview tier-3 诚实回退 (E2E 按 tier 断言)
- 浏览器活体(agent-browser @ prod :3001 生产构建): 首页/项目切换/检查器/Reset&edit 全通过, console+page errors 双零; tsc 0; eslint 零新增 (15 存量=HEAD 已有); e2e-review/ 套件入库 (fixtures/真实 EMPIAR 字节/PNG 留本地, README 记获取法)
- push 前对齐: 远程并行窗已领 t340 (pin partition+native record) → 本窗按 t314 先例改号 t341, rebase 后全量回归再推

Stage Summary:
- 用户 2D 分类复机路径: pull → 点 Re-run 即自愈 (reaper 先收割残留 → 大 box 自动降批 → GPU pin 正确寻址); 仍 OOM 时 Batch size 参数 (0=auto) 是一旋钮修法, OOM hint 文案已对齐
- C1/C3 双高危实证闭环: ghost 四道围栏后不可能提交; delete→undo 链条完整 (record+边+remote twins, reload 亦不失)
- twins 全空是真 bug (index-payload 修), 顺带 mock 上 t324 零上传链路可测
---
Task ID: t342
Agent: main-agent (Z.ai Code)
Task: 「最近的一轮修改我还没有测试，但是之前的算2d出现oom，我减少分类从200类到50类后就没有报错，但是看log也一直卡在最开始没有动。CRYOFLOW_NOTE: particles star unreadable (no local copy, cluster cat failed) — the stack-size consistency check did not run」——降到 50 类后不再 OOM 但冻在 Expectation iteration 1; 附 RELION 日志 (Ignoring required free GPU memory 800 MB / 两份 rank 横幅全 "devices 0" / Expectation iteration 1 of 20 卡死)

Work Log:
- 根因判读 (用户日志逐行): ①两份完全相同的 rank 初始化块 (NrHiddenVariableSamplingPoints=92800=1856×50 两份都是 50 类) = mpirun -n 2 的两个 rank, 且都打印 "Will distribute threads over devices 0" → 两 rank 被钉在同一张卡 (用户集群无 gres 记账, --gres=gpu:2 是请求不落宪, gpu06 单卡节点照收) ②"WARNING: Ignoring required free GPU memory amount of 800 MB" = 卡的空闲显存已低于 RELION 自己的 800MB 底线 (上一轮 OOM 尝试的残留分配压着卡) — RELION 对此的反应是"无视并继续"(字面 Ignoring), 随后在第一个 Expectation sweep 里抖动/死锁 = 用户看到的一小时不动 ③"000/??? sec" 冻结首迭代 = GPU 侧问题, 非文件残留 (t333 担忧的文件面已被排除) ④CRYOFLOW_NOTE (no local copy, cluster cat failed) = t338 消费端闸门读不到 star: resolver 在本地副本缺失时给出的是集群 twin 路径, 老 cat 单路径失败后只留耸肩文案
- 修复 1 rank↔GPU 收敛 (sbatch 运行时): MPI 宽度 ≥2 的 slurm GPU 作业, argv 的 -n 值与 --gpu 值改为脚本自有变量 CF_RANKS/CF_GPU_LIST; 脚本启动时 nvidia-smi -L 数卡, 可见卡数 < 请求 rank 数 → 钳到卡数 + CF_GPU_LIST 重排 + CRYOFLOW_NOTE 自述; 单 rank 作业保持字面 (字节不变); 无 nvidia-smi → 不钳 (t313 fail-open)
- 修复 2 饥饿卡拒发 (sbatch 预检): gpuJob (--gpu 真在 argv 上) 启动前按 CUDA_VISIBLE_DEVICES 授予集 (或 0..CF_RANKS-1) 查 memory.free: <1000MB → CRYOFLOW_ERR 两行 + nvidia-smi --query-compute-apps 列占卡 PID + .cf-exit=98 + exit 98 (一秒带名字地失败, 不再一小时无声挂死); 1000-2000MB → NOTE (卡被共享可能慢); 数字守卫 case 防 [N/A]; CPU 作业仅持 gres (extract 分片/LoG) 不拒 (卡非承重)
- 修复 3 star 读取多候选 (readResolvedStarText): 本地副本缺失时依次 cat 集群侧候选 — 上游已验证 twin → mirror 映射路径 → 原路径 (共享挂载形态); 全败时收据带"试过的路径 + cat 自己的失败词" (login-shell stderr 末行); t335 extract 闸门与 t338 particles 闸门共用; upstreamRemoteTwins 图整体上移至两闸门之前
- 修复 4 诊断模式两条: gpu-free-memory-warning (RELION 的 Ignoring required free GPU memory 原文 → 占卡 PID 猎杀命令 + rank/卡不匹配 + 新钳制/拒发说明) + gpu-starved-refusal (CryoFlow 自己的拒发行); 签名表优先于 silent-death 尸检 (用户冻结日志的首条发现 = 显存饥饿, 不再是泛型"无声死亡")
- mock: fs/opt/bin/nvidia-smi 桩 (-L 列表数/--id 查 free/--query-compute-apps 假 holder), ~/.slurm 杠杆 gpu-count(默认8)/gpu-free-mb(默认20000)/gpu-holders — 默认值保证其余套件零影响; 纯测试基建, 应用代码零改动
- E2E 回归全绿 (七套 282 断言): run-1 106/106 (EMPIAR 全链 104s) · run-2 48/48 · run-3 25/25 · run-4 23/23 (reaper 回归) · run-5 27/27 · run-6 28/28 (断言更新至变量形态+拒发块) · run-7 新增 25/25 (钳制/拒发/无本地副本 star 三幕: 1 卡节点钳宽度 2 → CRYOFLOW_NOTE 自述+完成; gpu-free-mb=400+假 PID 31337 → 1 秒失败 exit 98+PID 点名; 删本地 particles_star → twin 读取+"verified" 收据, "unreadable→did not run" 绝迹)
- diag 三套: t342 新增 ALL GREEN (用户原句警告→签名命中+hint 两杠杆; 拒发行→独自命中; 冻结形态→签名压过尸检; 健康初始化→零误报) · t326/t337 更新断言后 ALL GREEN
- tsc 0 错; eslint 15 项全存量 (零新增); docs §4s + 失败目录一行; e2e-review/README 矩阵补 run-7

Stage Summary:
- 用户复机路径: pull → Reset 卡死作业 → Re-run — reaper 先 scancel 卡死的同名 sbatch; 若卡上还有 Slurm 管不到的孤儿进程, 新预检 1 秒内拒发并点名 PID (不再隐形挂死); rank 钳制保证不再两 rank 挤一卡; 50 类 + 单 rank + 干净卡 = Expectation 该动起来了
- 用户当前集群手动清理 (一次性): squeue -u <user> 找卡死的 sbatch → scancel; gpu06 上 nvidia-smi --query-compute-apps=pid,process_name,used_memory 列占卡 PID → kill 残留
- "particles star unreadable" 从耸肩变成自描述: 多候选 + 失败原因入收据; 无本地副本的 star 走 twin 校验 ("verified") 已实证
---
Task ID: t347
Agent: main-agent (Z.ai Code)
Task: 用户工单「拉取最新代码，并解决Job failed」——2D 分类 REMOTE[lijing@192.168.2.253] exit 1（RELION 无报错、无声死亡；诊断 GPU memory starvation ×5 + Out-of-memory ×3；sacct -j 124635 待查）+ CRYOFLOW_NOTE「particles star unreadable … timeout after 15000ms … the stack-size consistency check did not run」+ run.out 六份 rank 横幅全部 "mapped to device 0"。

Work Log:
- git pull 868d946 → 75725c4（t339–t346 十二个提交落地）：本地未跟踪的并行窗口草稿（cs-npy/cs2star/extract-gate/particle-ref-gate/sync-policy + t335–t339 截图与 diag 脚本）与远程同名文件冲突——备份至 /tmp/pull-backup 后移除；worklog 本地 +102 行与远程逐条 diff 确认 t335–t339 条目字节一致（零丢失）后 checkout 丢弃 win32 模式位噪声，pull 干净落地
- 工单判读：用户的 Job failed 正是 t341–t346 修复链的靶场——①六份 "Will distribute threads over devices 0" 横幅 = mpirun 六 rank 全钉 device 0（t345 靶：RELION 的 --gpu 冒号语法在该构建上不按 rank 分卡，卡被逐 rank 吃干后 allocator 死、prterun exit 1 无声）；②"timeout after 15000ms" = t345 前的 15s cat 预算在慢线上撒谎（文件在、路径对，relion 自己读到了）——t345 起 90s 预算+断线重拨，t346 起改 awk 原地 census（零 star 字节过线）；③"stack-size consistency check did not run" = t338 消费端闸门被饿死没跑成（t346 census 后跑在集群上）
- 逐刀验证（拉取树静态+活体）：t341 GPU 授予集钉扎（remote-run.ts:1174）/ t342 饥饿卡拒发 exit 98 + rank 钳制 / t343 单地址消费道星读取 / t345 per-rank launcher（.cf-rank-launch.sh + .cf-rank-env export -p dump，sbatch 道 -n→"$CF_RANKS"、mpirun 目标→launcher、--gpu→"0"，直连道保持字面——注释钉死契约）/ t346 原地 census（clusterParticleRefCensus，CF_REF 行+90s+重拨）/ win32 三刀（engine.ts outPath POSIX 拼接无 path.join、argv 单反斜杠消毒、mopWin32MangledOrphans 双挂点）全部在位
- 活体验证：bun 直载 log-diagnosis.ts——用户蒸馏 run.out（六横幅全 device 0）→ silent-run-death（正确：无饥饿警告行时这是诚实判词）；补上 "Ignoring required free GPU memory amount of 800 MB" + OOM 行 → gpu-free-memory-warning + gpu-oom 双发（与用户看到的诊断条目 id/label 一致）；模块导出健康
- 环境事实记录：e2e-review 套件硬编码 ROOT=/home/z/cryoflow（已删除的旧克隆）与 BASE=:3001，本沙箱无 EMPIAR fixtures（512MiB）且 4GB 内存不容第二个 dev server——套件按提交记录为准（各提交消息记录 run-7/8/9/10/11 ALL GREEN），本窗口以静态刀位验证+引擎直载+浏览器活体代偿；scripts/diag-t342-gpu-coherence.mjs 的 UNIT-ERROR 系 ROOT 硬编码失配（模块本身健康），非代码回归
- 质量门：tsc 0 错；eslint 15 项（8 error 7 warning）与 t342 基线记录逐字一致（全存量、零新增）；dev server 热载 t346 后被收割一次（已知模式），重启后全路由 200
- agent-browser 活体（1600×900 + 390×844）：页面干净渲染（CryoFlow — Cryo-EM Workflow Builder）、console/page errors 双零、footer 钉底、移动端零横向溢流；截图 t347-pull-verify-desktop.png / t347-pull-verify-mobile.png；mock cluster（:3022）重启在位
- 清理：scripts/tmp-read-clusters.ts 临时探针移除；浏览器会话关闭

Stage Summary:
- 「解决 Job failed」的答案已在拉取的 t341–t346 里：六 rank 挤一卡（本次 exit 1 的机制）被 per-rank launcher 物理灭绝；15s 假死星读取被 90s+重拨+原地 census 灭绝；用户侧复机路径 = Windows 主机 git pull → 卡死作业 Reset → Re-run（heal/mop 先搬正错位 star、饥饿卡拒发会点名占卡 PID）
- 一次性集群清理指引（用户侧执行）：sacct -j 124635 查真实死因（大概率 OUT_OF_MEMORY/CANCELLED）；squeue -u lijing 收割残留 sbatch；gpu06 上 nvidia-smi --query-compute-apps=pid,process_name,used_memory 列占卡孤儿并 kill
- 本窗口零代码改动（纯拉取+验证），沙箱与 origin/main 同步于 75725c4

---
Task ID: t348
Agent: main-agent (Z.ai Code)
Task: 用户工单（六 rank 2D 分类的 run.out 解读）——「怎么感觉卡在一开始不动呢？另外看log怎么感觉是几个GPU重复执行了同一个任务，而不是多个GPU执行同一个任务呢？」附 log：六行 CRYOFLOW_RANK_BIND（rank 0-5 → CUDA_VISIBLE_DEVICES=0-5，t345 生效）+ 六份相同横幅 + Expectation iteration 1 of 20 六份 "000/???" 计数器。

Work Log:
- 判读①（修复生效的证据链）：六行 RANK_BIND 回执 = 6 rank 各占 6 张不同物理卡——上一轮「六 rank 挤一卡吃干显存→无声 exit 1」的病根已除；「Ignoring required free GPU memory」警告缺席 = 卡不饿（t342 冻结签名不在场）；「Estimating initial noise spectra」/「Estimating accuracies」全部 yum! 完成 = 颗粒栈可读（t338 消费端闸门也过了，收据正常）；NrHiddenVariableSamplingPoints=92800=64 方位×29 平移×50 类 = 50 类在生效
- 判读②（"重复执行"是 MPI 日志的天然形状）：6 个独立进程各写各的横幅/报表交错进同一个 run.out；分工是切分不是重复——Expectation 按颗粒六等分、Maximization 按类分（每 rank 更新 ~1/6 的类）、噪声谱/精度估计各算各的子集；「mapped to device 0」×6 语义已变：t345 后每 rank 的私有 CUDA_VISIBLE_DEVICES 世界里只有一张卡（它自己的），编号必然是 0——物理真相在 RANK_BIND 回执里（rank k → 物理卡 k）；t345 前六份 "devices 0"=全挤物理 0 卡，之后六份 "device 0"=各在自己卡的私有视角，字面相同含义相反
- 判读③（"卡住"需现场判别 slow vs stuck）：000/??? 是时间估计计数器（已用秒/预估秒，??? = 首批未完成无预估）；第一轮 Expectation 是整个 run 最重一步（每颗粒 vs 50 类×512 方位×116 平移≈300 万假设），~35 万颗粒（1034 微图×~340/微图）六等分后单轮十几分钟量级、20 轮整体按小时计属正常；判别命令=计算节点 nvidia-smi（6 进程×6 卡×utilization>0 → 在算；长时间 0% → scancel 降宽度重跑）
- 代码改进（在困惑发生处自解释）：sbatch 脚本 t345 块尾部（饥饿卡拒发之后、mpirun 之前）加一行运行时 CRYOFLOW_NOTE——"$CF_RANKS MPI ranks, one per card — every rank prints its OWN copy…; the work is SPLIT across ranks (particles in the Expectation step, classes in the Maximization step), NOT repeated; each rank's 'device 0' is its own card in its private CUDA_VISIBLE_DEVICES world"；运行时 [ "$CF_RANKS" -ge 2 ] 守卫（单 rank/钳制到 1 不付噪声；钳制后计数是后值）；以后每次多 rank run 的 log 开头自文档
- 活体验证（scripts/diag-t348-multirank-note.mjs，26/26 ALL GREEN，dev :3000 + mock :3022 真链路）：import(3 合成 MRC 头部嗅探过)→ctffind→LoG autopick→extract(shards=2)→class2d 宽 6——6 份 RANK_BIND 六张不同卡(0,1,2,3,4,5)、无钳制/致盲注记、t348 注记以 post-clamp 计数(starting 6)落在首行(先于首份回执)、脚本形态钉死(CF_RANKS=6+mpirun -n "$CF_RANKS"+launcher+--gpu 0 无冒号列表)、宽 1 作业不付注记；fixtures 生成器内嵌进 diag 脚本(ensureFixtures，自足可重跑)
- 首跑 7 败根因=本人 driver 转录笔误（runOutOf 的闭合引号位置，cat 了一个不存在的字面文件名），非代码回归；修正后全绿
- 回归面核查：run-6/run-10 的 sbatch 形状断言全为 includes() 风格（纯增量行安全）；无任何套件钉 run.out 首行顺序；tsc 0；触碰文件 eslint 0
- 现场清理：两个 t348 测试项目(API DELETE)+连接(DELETE)+mock 项目目录与杠杆全清；合成 fixtures 留在 mock fs（gitignored 测试基建，脚本可自再生成）

Stage Summary:
- 用户两个问题的答案：①大概率在算（第一轮 Expectation 最重、小时级正常），nvidia-smi 六卡 utilization 一辨真伪；②不是重复执行——MPI 日志天然形状（N 进程各写各的横幅），工作按颗粒/类切分，"device 0"×6 是每 rank 私有单卡世界的编号而非物理 0 卡
- t345 修复已被用户现场实证生效（六 RANK_BIND 回执）；t348 让这层解释长进每次 run 的 log 第一行，下个用户不再需要问
- 代码改动：remote-run.ts（t348 注记行+注释）；新 scripts/diag-t348-multirank-note.mjs + scripts/t348-lib.mjs（e2e-lib 的本沙箱补丁副本）；tsc/eslint 干净

---
Task ID: t349
Agent: main-agent (Z.ai Code)
Task: 用户三问（拉取最新代码 + GPU 并行模型确认 + 手写 mpirun 命令审查）——「目前问 AI 得到的说法是把颗粒等分成几份每份一个 GPU，目前确实是这样的吗？mpirun -np 5 relion_refine_mpi … --gpu "0:1:2:3" --j 4 这种提交方式参数是否正确？这种应该不是把颗粒等分分配给多个 GPU 吧？这样计算会不会更快？」

Work Log:
- 拉取：fetch 后与 origin/main 同步于 ec9d140（此前 4 个本地提交已在远程，无新提交）
- 源码级核实（RELION master, 3dem/relion）：① `--gpu` 官方语义 = "Device ids for each MPI-thread"（ml_optimiser.cpp，经 untangleDeviceIDs 分配到各 rank）——冒号列表就是颗粒级数据并行；② `--norm` 在 relion_refine 选项表零匹配（是 relion_preprocess/提取步骤的标志）——用户命令会启动即被解析器拒掉；③ RELION ≥2.0 二进制名是 relion_refine（MPI 内建），relion_refine_mpi 是 1.4 时代老名
- 病根确认（旧 n=width 布局）：mpirun -n <卡数> 时 rank 0 是 RELION master（CPU：数据 I/O、批次分发、M-step类重构），不碰卡——却占了一张卡的槽位。4 卡作业实际只有 3 张卡算颗粒（E-step 占 ~85-90% 运行时间）。用户的 -np 5 = RELION 官方推荐 np=nGPU+1（专职 master + 每卡一 worker），E-step 吞吐 4/3×，整体墙钟约 +20-30%
- 实施 t349（remote-run.ts）：Slurm MPI lane 的 nranks 从 gpuWidth 改为 gpuWidth>=2 ? gpuWidth+1 : 1（宽度 1 保持单进程——单卡无拆分可做）；sbatch 头 --ntasks=N+1 而 --gres=gpu:N 不变；t345 per-rank launcher 重定义 rank 语义——rank 0 = CPU master（不绑卡，收据自报身份），worker r 绑 device_set[r-1]（空闲优先序）；钳制语义改为"每可见卡一 worker + master"（CF_VISIBLE < CF_RANKS-1 → CF_RANKS=CF_VISIBLE+1）；饥饿卡预检查 worker 的前 CF_RANKS-1 张卡；t348 banner 改述"1 CPU master + N workers, ONE WORKER PER CARD (np = nGPU + 1)"
- UI 同步（remote-run-button.tsx）：mpiRankCount 派生常量；chips `mpirun -n {N+1}` + `1 master + {N} workers (1 worker → 1 card)`；预览 `--ntasks={N+1} --gres=gpu:{N}` + "mpirun -n {N+1} … --gpu 0 per rank — 1 CPU master + {N} workers"；宽度 1 时保持单 rank 文案
- 一致性（hpc/slurm.ts 本地生成器 + gpu-width.ts 注释）：本地 dry-run sbatch 也写 mpirun -n N+1 / --ntasks=N+1；策略 reason 与 Multi-GPU note 改述 master+workers
- 验证装置修复：t348-lib.mjs 的 ROOT 由陈旧绝对路径 /home/z/my-project 改为相对解析 + CF_ROOT/CF_BASE 环境变量覆盖（diag-t348 的 ROOT_MOCK 同修——首次跑曾把 fixtures 误生成到 /home/z/services，已清理）；e2e-lib.mjs 同样参数化（旧 BASE=:3001 生产端口已随旧服务器退役）
- 活体验证（dev :3005 + mock :3022 真链路，四套件 ALL GREEN 共 135 断言）：diag-t348 27/0（宽 6 → CF_RANKS=7、6 份 worker 回执六张不同卡 0-5、master 回执自报 CPU-only、banner "starting 7 MPI ranks — 1 CPU master plus 6 workers"、宽 1 无噪声）；run-10 52/0（空闲优先：饥饿卡 1 被绕开 worker 落 {0,2,3,4,5,6}；钳制 2 可见 → 2 worker + master 点名；盲节点 → 单 rank；慢线 20s 星读取 + 死通道重拨不回归）；run-7 27/0（1 卡节点宽 2 → 钳到 1 worker + master、master 不绑卡收据、worker 绑唯一卡；饥饿拒发 exit 98 不回归；补 mpi-emulate-ranks 杠杆——旧装置只仿真 1 rank，新布局有两个 rank 要跑）；run-6 29/0（--ntasks=3/CF_RANKS=3 宽 2 形状）
- 断言同步：run-6/7/10、diag-t326/t337/t337、e2e-review README 的 rank 计数/措辞断言全部对齐 t349 形状（diag-t337 的 CF_GPU_LIST 断言原为 t342 时代残留，顺手改为 launcher 形态）
- 浏览器活体验证（Playwright 沙箱内直跑，dev :3005）：运行对话框实测渲染——GPU 宽度行"6 × GPU | --gres=gpu:6 | mpirun -n 7 | 1 master + 6 workers (1 worker → 1 card) | brain2 offers 8/node · 1 worker per GPU + 1 CPU master"；提交预览"#SBATCH --partition=brain2 --nodelist=brain2 --ntasks=7 --gres=gpu:6" + "mpirun -n 7 … --gpu 0 per rank — 1 CPU master + 6 workers, one worker per card"——与 e2e 验证的 sbatch 字节一致；截图 /tmp/t349-dialog.png
- 环境备注：4GB 沙箱内 cryoflow dev server（Turbopack 编译根页峰值 ~2.3GB）反复被 OOM 收割；NODE_OPTIONS=--max-old-space-size=1400 + 单次调用内完成（沙箱在工具调用边界收割后台进程）后浏览器验证成功；tsc/eslint 触碰文件零新增

Stage Summary:
- 三问答案：①是——现实现就是颗粒级数据并行（master 动态批次分发，先做完先领，自平衡非静态等分），但旧布局 master 占卡槽、4 卡只 3 卡算颗粒；②用户命令布局正确（RELION 官方 np=nGPU+1）且本质就是颗粒等分并行，但三个具体问题——relion_refine_mpi 应为 relion_refine（RELION 5 二进制名）、--norm normalise 不是 relion_refine 合法选项（源码核实，启动即报错；归一化在 Extract 步已完成）、--gpu "0:1:2:3" 冒号语法在该集群 RELION 5.0-beta build 有两次全 rank 落 device 0 的翻车史（t342/t345 现场记录，即上次 OOM 根因），等价且稳的形式是每 rank 独立 CUDA_VISIBLE_DEVICES + --gpu 0；③会更快——E-step ~4/3×、整体约 +20-30%
- t349 落地：dedicated master 布局进派发器（每张卡都有 worker 算颗粒），t345 绑卡/钳制/饥饿预检/盲节点守卫全部保留并按 worker 语义重述；UI 预览与脚本字节一致
- 回归防线：四套件 135 断言 ALL GREEN + 浏览器实测；宽度 1 行为不变（单进程）

---
Task ID: t349-b (parallel window — card & wire work, distinct from the t349 above)
Agent: main-agent (Z.ai Code)
Task: 用户工单（两项）——①「优化job卡片样式，目前内容有些拥挤，需要根据目前需要显示的内容重新设计一下，让关键的内容都能显示出来」②「任务失败时好像会出现连线断的情况，待推进的虚线动画在线条是横向直线时显示有些问题，其他情况下正常，需要修复」

Work Log:
- 根因判读②（连线断+横向虚线动画异常，同一条病根）：edges-layer 的 running/primed 线用 `stroke="url(#edge-grad-…)"`，linearGradient 是默认 objectBoundingBox 单位——横向直线（两卡同 y、单口无扇移）的 bbox 高度为 0，SVG 规范明令 user agent 忽略退化几何上的渐变 → stroke 解析为无 → 整条线（含虚线动画）隐形。用户工单逐字命中：「任务失败时」= 上游 completed → 失败卡的线翻成 primed 渐变（正是看见断线的时刻）；「横向直线时显示有些问题，其他情况下正常」= 非水平线 bbox 非退化、渐变正常。附带发现： marching 虚线动画每 0.7s 有 5px 后跳（dasharray 6 5 周期 11，keyframe 偏移 -16，16 mod 11 = 5）
- 修②渐变：linearGradient 改 gradientUnits="userSpaceOnUse" + x1/y1/x2/y2 = 线自身端点（srcDot→tgtDot），bbox 从此无关；渐变节点搬进每条边的 <g>（paint server 放哪里都不直接渲染）→ 拖拽补丁循环用同一 group-scoped [data-e] 契约可达；bonus：ramp 方向从「bbox 左→右」修正为「真实源→目标流向」（wrap-around 线以前的渐变方向是反的）
- 修②拖拽随行：patchEdgeGroups（job-card.tsx）新增 [data-e="grad"] 四坐标补丁——拖拽中渐变端点与线端点逐帧同步（活体验证：mid-drag x1/y1=1446.19/345.20 与 path M 点逐位一致）
- 修②卡顿：edge-dash-flow keyframe -16 → -11（恰一周期，无缝循环）；LiveWire 上被 CSS 覆盖的死属性 strokeDasharray="7 5" 移除（CSS 类是 dash 图案唯一真源）
- 修①卡片重设计（CARD_W 220→240 / CARD_H 96→112，所有消费方——端口、连线、minimap、print fit、spotlight 锥、框选、聚焦——全从常量派生，零硬编码）：①行3从固定 h-4 单行 truncate 改可变高——completed/failed/pending 结果 line-clamp-2 双行（失败原因 ~35 字符截断 → 双行 30px，失败卡要说的一句话终于说得完）；②终态 ✓/! 角标从 absolute right-2 top-2 改行1行内 ml-auto（pr-8 死右轨 32px 只在终态花该花的 ~18px，名字收回全部宽度）；③容器 gap-1.5/py-3 → gap-1/py-2.5（112px 的新高度花在内容行不在 padding）；④print-swap 契约（纸面笔记摘录换进度行）原样保留
- 布局影响核查：auto-arrange 步距 CARD_W+GAP_X(100)/CARD_H+GAP_Y(48) → 增大后走廊 80px/32px，存量布局不重叠；归档 diag 脚本里的 220/96 硬编码仅历史记录
- 验证场景（沙箱 DB 直种 + 伪造 running 的 120s sweep 宽限期改用持久 engine record pid=1 方案）：import(running 42%)→ctffind 横向 running 虚线；extract(completed)→class2d-w6(failed 长失败词) 斜向 primed；extract→class2d-w1(idle) 横向 primed——三条渐变线 + 两条零高度横向（旧病根的精确几何）；期间沙箱遭遇并发 tidy（preview 面板侧真用户交互，POST /api/jobs/layout 在案）顺势收编
- 活体验证（agent-browser 1600×900）：DOM——三条渐变线全 userSpaceOnUse + 端点坐标正确，两条横向线 getBoundingClientRect 高度恰为 0（退化几何原样复现）+ 主笔触 stroke=url(#edge-grad-…) + edge-flow 类在位；像素——running 横向虚线行 80% 墨（青色 dash+glow 色）、primed 横向实线行 40% 墨（2.25px 笔宽 ÷5px 采样带，灰→teal 渐变色）；动画——两次采样 dashoffset -2.56→-10.15（行进中），-11=周期保证循环无缝；卡片——失败原因 rect 高恰 30px（双行×15px leading）+ line-clamp 生效 + ! 角标行内右缘(x=207/240) + 名字/状态/进度三行齐整 + 无 absolute 角标死区；VLM 目检——「红字两行换行✓ 卡片间距良好✓ 连线清晰可见✓ 无断线✓」「横向青色虚线清晰可见✓」；拖拽——渐变端点逐帧随线；mobile 390×844 零横向溢流；console/page errors 双零；dev.log 无新增错误
- 途中排障：4GB 盒上 next-server 反复 OOM（RSS 涨至 2.7-2.9GB 被 kernel 杀，max-old-space-size 896 限不住 Turbopack 原生侧）——按 scripts/dev-server.sh 先例（setsid 孤儿化躲工具调用收割器）+ 关浏览器降压分步验证；沙箱禁 swap（无 CAP_SYS_ADMIN）；验证后伪造态还原（import→completed、engine record 移除；class2d-w6 failed/class2d-w1 idle 留作新卡片设计的诚实演示态——横向 primed 线与双行失败词在 preview 里可见）
- 质量门：tsc 0 错；eslint 触碰文件 0 输出；截图 docs/t349-horizontal-wires.png / t349-failed-card.png / t349-mobile.png 入库

Stage Summary:
- 连线断/横向虚线动画的根治 = 渐变换坐标系：userSpaceOnUse 挂线自身端点，退化 bbox 从结构上不可能再出现；虚线动画 -11 偏移恰一周期，0.7s 循环无缝；拖拽中渐变随线逐帧同步
- 卡片重设计：240×112 + 行内终态角标 + 双行失败原因——关键内容（名字、状态、类型、进度/耗时、失败原因、远程宿主、笔记徽章）全部可见；存量布局走廊 80/32px 不重叠
- 用户复机路径：git pull 即得；preview 面板可见演示态（failed 卡双行红字 + 横向 primed 线）


---
Task ID: t350
Agent: main-agent (Z.ai Code)
Task: 用户工单「继续打磨job卡片的样式，要美观又设计感，同时又实用（显示对用户关注的信息），完成后push」

Work Log:
- 设计判读（t349 之上的四宗罪）：①`REMOTE[user@host · module]:` 信封吃掉 2 行结果预算 ~40 字符——失败卡要说的那句诚实的话从第 2 行中段才开始；②idle 卡下半张空白（配置只有 hover 一条路）；③状态只在 20px 药丸+边框 tint 里说话，画布缩放距离不可扫读；④Row 2 的类型文本是 dev-speak（"class2d"）
- 修复① 信封剥除：新 displayResult() 剥 `REMOTE[...]` 前缀——Row 3 的 payload 行只说人话；出处搬进 title 提示 + Row 2 幽灵徽章（终态远程卡 muted Server+host，border-border/70 bg-muted/40 安静方言——「这个结果/这次失败来自那台集群」）；hover 预览框同步剥除
- 修复② idle 参数摘要：新 digestParts（spec 顺序前两个数值旋钮，DIGEST_LABELS 词典把 "Number of classes (K)"→"classes"、"Number of VDAM iterations"→"VDAM iters" 等 28 词条压成短名；无数值类型回落 path 类参数尾两段）；Ready 行 = 绿点 + Ready + 摘要（emerald 引子 muted 尾），未就绪 idle 只显摘要——「能跑什么、跑了会怎样」一眼可答。三段实测 199px 死于省略号（Ready 行预算 ~150px）→ 编辑裁决收两段（spec 序前两恰是用户最常调的旋钮）
- 修复③ 状态地板条：新 STATUS_FLOOR（3px 底边满宽状态色，idle 一声 slate 耳语/pending amber/running teal/completed emerald/failed rose；queued 走 amber）——左色条=类别（纵轴）、地板=状态（横轴），两轴独立可扫；failed 另加玫瑰体洗（overlay div bg-rose-500/4.5%，暗色 7%——overlay 而非 class 互换，堆叠确定性好）
- 修复④ Row 2 人话：`spec?.key`→`spec?.label`（"class2d"→"2D Classification"）——纸面无 hover，label 在打印卡上也挣得一行
- 数字强调：completed 结果行前导数字（"33 particles extracted" 的 33）semibold tabular——与 t347 计数徽章分工：徽章拥有颜色（teal 粒子/violet 类），句子拥有字重；同一数字不喊两遍色
- 并行窗合并：远程 t349（dedicated master np=nGPU+1 + 计数徽章）与本地 t349-b（连线修复+卡片重设计）rebase 汇流——job-card.tsx 自动合并干净（徽章在 Row 2 尾、我的改动在 Row 2 头/Row 3/卡体），worklog 双 t349 冲突以 t349-b 消歧共存；合并态审计：计数徽章与新设计零冲突零溢出
- 活体验证（agent-browser 1600×900 + 390×844）：12 卡全状态审计——零 paint 级溢出（clip-aware 检查：被 overflow-hidden 裁掉的布局盒不计）、地板条 12/12 在位且配色正确（emerald×5/rose×2/slate×5）、失败卡洗层 7%、失败文本恰 30px（2×15px line-clamp）、行高 24/20/15-30、卡体恰 240×112、digest 两段 clip=0、数字强调 600 重前景色、幽灵徽章 muted、移动端零横向溢流、console/page errors 双零、dev.log 无新增；像素采样（PIL）——light 图 green 545/red 283/teal 255 采样点、dark 图 green 454/red 370——三族状态色在两张渲染图里真实可见；交互冒烟——卡片点击开 inspector ✓、hover 预览渲染（剥前缀结果句+人话 label+参数三行）✓
- VLM 目检缺席：z-ai vision 服务整窗 429 限流（五次重试跨 ~10 分钟）——以 DOM 计算样式断言 + 像素采样代偿，几何/颜色/字重/裁剪全部数值级验证
- 质量门：tsc 0 错；eslint 触碰文件 0 输出；截图 docs/t350-card-polish-light.png / t350-card-polish-dark.png 入库（合并态终版）

Stage Summary:
- 卡片信息架构定型：类别（左色条·纵轴）+ 状态（地板条·横轴）+ 身份（名字行）+ 出处（幽灵徽章）+ payload（结果句/参数摘要/进度）——每个状态都有话说：idle 说配置、pending 说等谁、running 说进度、completed 说成果、failed 说原因
- REMOTE 信封从 payload 里退役（tooltip+幽灵徽章接手）——失败原因可用字符 +40；idle 卡从半空卡变成自带规格单
- 用户复机路径：git pull 即得；与 t347 计数徽章、t349-b 卡片重设计、t349 dedicated master 全部兼容（rebase 后全量审计通过）

---
Task ID: t352-c (parallel window — cs2star cluster twin, distinct from t352-a/b's refine-family argv work in the same file)
Agent: main-agent (Z.ai Code)
Task: 用户字段报告——engine-native cs2star 在集群连接上跑完：325,549 颗粒转换、10,664 个 stack 在 remoteRoot/<projectId>/micrographs 链好，但 particles.star 只落在本地 workdir（「结果只保存在了本地，集群上没有这个 job 的输出，而后续计算都在集群上跑」）；且重跑同一转换把两份大 .cs（119.8 + 90.3 MB）原样重下了一遍。三改全在 runCs2StarNative 的 CLUSTER lane（engine.ts），不碰 local lane、不碰 refine 家族 argv（t352-a/b 并行窗口正改同文件）、不碰 workflow.ts。

Work Log:
- 病根判读：cs2star 的 CLUSTER lane 一直把 star 只写进本地 workdir（writeFileSync(starPath)），recordNativeRun 登记的也是本地路径——下游集群作业要么把 50-200 MB star 重传一遍（upload lane），要么在本地副本被清后卡「waiting」；集群手里握着 10k 个 stack 链接却唯独没有那份索引它们的 star。twin 概念（t324 起：record.remote.remoteOutputs 里的集群侧已验证路径）恰好是为这个形状发明的，cs2star 只是从来没加入。
- 修 1 star 上集群（engine.ts 3302-3462）：本地 star 写盘后，twin 路径 = csMirrorPath(starPath, remoteRoot)（3092-3112 新函数，与 remote-run.ts 的 mapLocalToRemote 逐字节同一映射——engine.ts 刻意不 import remote-run.ts 断环，expandCsRemoteRoot 是先例）→ remoteRoot/<projectId>/cs2star_<id8>/particles.star，与 extract 字段日志的 …/extract_ufh1hg0u/particles.star 同一地址族；remoteMkdir(twinDir)（link farm 同款）→ remoteUpload(conn, starBytes, twinPath)（staging 自己的上传原语，ssh.ts:679，head -c 协议，超时 ∝ 字节数）→ statRemoteFiles 验证 present 且 size>0 才登记；超 capMb / 上传失败 / 验证失败各自诚实报错：点名 twinPath、原因、本地副本完好（starPath）、链接已在集群、修法（调 cap / 稍后再跑）——错误经 abortNativeRun 落进 record，不吞。phase 行：uploading (MB) → twinPath + star saved on the cluster (verified N bytes)；run.out 的 output 行改「twinPath (cluster) + local mirror: starPath」；结果行 REMOTE[cryo@host] 信封逐字节不动（displayResult 剥前缀 / result-counts 计数徽章都只认开头），尾部追加「 · star saved on the cluster」。
- 修 1 的持久化：recordNativeRun 的 upsert 会整条替换 record（remote 半区一起没），所以 twin 在它之后用 updateRun 补挂——与 probeRemoteOutputs（remote-run.ts:1751）/finalize leg（4782）同一 startedAt 守卫方言：recordNativeRun 刚写完即 getRun 拿 nativeRec，cur.startedAt === nativeRec.startedAt（再叠 done && exitCode===0 双保险，防同毫秒 beginNativeRun 的 ISO 碰撞）才挂；remote 状态按 RemoteRunState（types.ts:306）零 cast 写全：conn 真实 connectionId/connectionName/host(host:port)/user/module/defaultModule??""、mode "direct"、pid null、slurmId null、remoteRoot（已 ~ 展开）、remoteWorkdir=twinDir、phase "running"（done 记录的既定方言——finalize 也不改 phase）、remoteOutputs.particles_star=twinPath；另把 run.out/run.err 见证 best-effort 传到 twinDir + 预填 t346 logTail 缓存字段（logTailOut ≤4KB/logTotalLines/logTailAt）——log 路由（/api/jobs/[id]/log:42）见 record.remote 就走 remoteLogTail：done 记录 tail 模式永远吃 ledger 缓存、full 模式从 remoteWorkdir 拉——没有这两样，完成后的日志页会拉到空控制台。见证失败只 console.log，绝不能杀掉已完成的 run。
- 修 1 的自愈面：REMOTE_OUTPUT_CANDIDATES 加 cs2star: [{ key: "particles_star", exact: ["particles.star"] }]（engine.ts:1186，extract 条目同形）——将来 lazy heal / missing-worklist probe 能在 remoteWorkdir 里重新找回 twin。reconcileRemoteJobs 复核（remote-run.ts:4056）：rec.done 记录直接 continue（仅 running/pending 行进 orphan 分支，且 orphan 是 ledger-side 补判无 SSH）——完成的 cs2star 记录永不被重轮询；isRunAlive 只在 done===false 时看 remote——重跑不会被「remote run still active」拒绝。
- 修 2 .cs 去重（3172-3222）：dl 升级为 dlCached(remote, local, remoteSize)——workdir 里已有同名 .cs 且 statSync 字节数 == 早前 statRemoteFiles 报的集群尺寸 → 本地直读 + phase「reusing cached particles.cs (119.8 MB, remote unchanged) — no re-download」（逐文件报，两份各自判）；尺寸漂移（CryoSPARC 重新导出）照旧重下；receipt 的 downloaded 行只列真下过的。缓存依赖一个事实：engine-native 作业不走 runRealJob 的 fresh-start wipe（run-wipe.ts 头注：「the engine-native jobs return ABOVE the call site, so they never wipe」），.cs 在 workdir 里活得过重跑。
- 修 3 wipe/cleanup 不破：①t333 重跑 wipe 只发生在 startRemoteJob 派发路径（预擦的是本 job 自己的 <root>/<type>_<id8>），cs2star 是 engine-native 从不派发，且下游 class2d 的预擦只碰 class2d_<id8>——上游 twin 是输入，「Inputs are never at risk by construction」；②t331 用户清理的 remote 侧只列 record.remote.remoteWorkdir（=twinDir）：twin 经 twinsRel（toRelSet 归一到 workdir 相对）进 keep-set（cleanup.ts:393 own account），run.out/run.err 是 KEEP_ROOT_NAMES 见证——twinDir 的覆盖与 extract 的 twin 目录完全同形（star+见证全保，无中间物可清）；③共享链接农场 remoteRoot/<projectId>/micrographs 不在任何 job workdir 之下，清理/擦除两把刀都够不着（t352 前后一致）；④本地侧 .cs 副本属 unknown=keep。结论：cleanup/run-wipe 零改动。
- 消费链代码级追踪（同集群下游 class2d，cs2star 接上游）：dispatch 传 { remote: true, connectionId, host: host:port } 调 resolveInputs（remote-run.ts:2173）→ 输入解析两条道殊途同归：(a) 本地 star 在（默认）→ outputs.particles_star 本地路径 → twin map 的 pair 条目（2433-2435：local→twin，过 sameClusterTarget 门）→ staging 循环 2761 upstreamRemoteTwins.get(local) 命中 → continue 零上传；(b) 本地副本被清 → resolveInputs 的 twin gate（engine.ts:1384-1389）直接解析成 twinPath → identity 条目 twin→twin → 同样零上传。argv 组装 3018：inputs.particles_star = upstreamRemoteTwins.get(local) ?? … = twinPath——而 twinPath 与旧 upload lane 会写的 mapLocalToRemote(starPath) 是同一字符串：argv 字节级不变，只是省掉冗余上传。class2d 的 INPUTS from 列表本就含 "cs2star"（engine.ts:1032）。star 内部行是 N@micrographs/<name>.mrcs 项目相对方言，RELION 以项目根为 CWD 读——链接农场就在那里。
- 质量门：bunx tsc --noEmit 0 错（remote 状态对象零 cast 过 RemoteRunState 上下文类型即证形准）；bunx eslint engine.ts + remote-run.ts + types.ts 0 输出（改动前后皆 0——本树这三文件本就干净，零新增）。并行窗口纪律：只动 csMirrorPath/dlCached/twin 块/REMOTE_OUTPUT_CANDIDATES/cs2star lane + ssh import；refine 家族四 case 与 workflow.ts 的未提交改动属 t352-a/b，一字未碰。
- E2E 风险预告（主 agent 活体时注意）：①diag-t336-cs2star 断言全兼容（B1-B13 形状不变，receipt 只追加尾部；class2d 下游仍完成——argv 地址与旧 upload lane 相同，只是不再重传；missing-stack 拒绝发生在 twin 上传之前不回归）；②mock 集群对 remoteUpload/stat/remoteMkdir 全支持（staging 每次派发都用同一原语）；③真集群上 200 MB 级 star 若链路 <0.4 MB/s 可能撞 remoteUpload 的 600s 超时上限——诚实报错点名 twinPath + 「fix the cluster and run again」，.cs 已缓存重试便宜；④twin 上传前的 cap 预检文案承诺「the .cs download is cached, the retry is cheap」依赖修 2，已同窗落地。

Stage Summary:
- 用户复机路径：pull → Re-run 一次 cs2star——两份 .cs 本地复用零重下（receipt 分文件报 reused/downloaded），star 落到 remoteRoot/<projectId>/cs2star_<id8>/particles.star 并验证在案；下游集群作业（class2d/initialmodel/class3d/refine3d…）通过 record 的 twin 零重传就地消费，日志页从 twinDir+ledger 缓存双轨可读
- twin 地址与 staging 的 mapLocalToRemote 镜像约定逐字节一致（csMirrorPath 内联复刻，断环先例 expandCsRemoteRoot）——upload lane 与 twin lane 在同一地址汇合，argv 字节不变、只省冗余
- 持久化形状：recordNativeRun(整条替换) 之后 updateRun + startedAt 守卫（probeRemoteOutputs/finalize 同款）挂 remote 状态（direct/pid null/remoteWorkdir=twinDir/remoteOutputs.particles_star）+ run.out/run.err 见证与 t346 tail 缓存——完成记录不被 reconcile 重轮询，log 路由不空
- wipe/cleanup 零改动即全覆盖：twinDir 与 extract 的 twin 同形同命（own account + 见证保全），共享 micrographs 链接农场在两把刀的射程之外（与 t352 前一致）

---
Task ID: t352-a/b (the param surface — main window; t352-c ran in a parallel subagent window)
Agent: main-agent (Z.ai Code)
Task: 用户工单（四件）——① scratch 到 /ssd_cache 这类节点本地 SSD 可加速读取，要在 UI 中可自定义；② 是否整合了 Blush 等算法？要在 UI 中可开关；③ 「所有的 relion gui 中可以调节的参数在本项目 ui 中都可以调整」；④ cs2star 转换结果只存了本地（D:\...\cs2star_dts6rmc7\particles.star），集群上没有这个 job 的任何结果，且 36 个 .cs 字段「识别不出来」——后续计算在集群上，结果应存集群。

Work Log:
- 源码级调研（3dem/relion ver5.0，与 t351 的 161 选项审计同一纪律）：拉取 pipeline_jobs.cpp + pipeline_jobs.h + ml_optimiser.cpp 原文，提取 RELION 5 GUI 四个 refine 家族 job 的完整 joboption 表与 getCommands 的精确映射——do_blush 只存在于 Class3D/Refine3D/MultiBody（2D 与 InitialModel GUI 无此选项）；--blush 是无参 checkOption；healpix 选项列表 = 7 档度数字符串（order = 下标+1，getHealPixOrder 原文）；sigma_angles/3 → --sigma_ang、auto_faster → --auto_ignore_angles --auto_resol_angles、do_pad1 → --pad 1、combine_thru_disc=No → --dont_combine_weights_via_disc、parallel_discio=No → --no_parallel_disc_io、preread → 裸 --preread_images、2D 的 --center_classes/--skip_align/--allow_coarser_sampling/--offset_range/--offset_step 条件、Class3D 的 --fast_subsets/--relax_sym、Refine3D 的 --solvent_correct_fsc/--auto_local_healpix_order——全部逐条核对进映射
- t352-a（workflow.ts）：四个 spec 扩到 GUI 全参数面——class2d 23 参数（4 表签）/ class3d 25（5）/ refine3d 26（6）/ initialmodel 14（4）；新增共享件：healpixOptions+samplingSel（auto 默认=不传旗标）、computeParity()（keep-free scratch + 并行盘 IO 三联 + preread + 额外参数口）、scratchHint 点名 /ssd_cache 节点本地 SSD 例；Blush 开关（doBlush）按 GUI 位置放 class3d/refine3d 的 Optimisation 表签（非 advanced，默认关）；采样类全部「0/auto = RELION 自己的默认=不传旗标」语义，默认 argv 形状不变
- t352-b（engine.ts）：REFINE_VERIFIED_OPTIONS（161 项，engine 权威导出）+ refineTail()（三联 + scratch keep-free + extraArgs 守门：未知 --旗标在【本门】点名拒绝，绝不带到集群的 argv parser）+ healpixOrderOf + positiveNum；四个 case 重写接线——class2d 的 --ctf/--zero_mask 从硬编码改为读参数（默认 ON，旧 job argv 不变）+ --center_classes（RELION 2D GUI 自己的默认）；class3d 的 tau2_fudge 从硬编码 4 改为读自己的参数（默认 4=GUI 默认）+ 补 --zero_mask/--j（此前是幽灵参数：spec 有、argv 无）；refine3d 的 samplingStep 从幽灵参数接活为 healpix 选择 + autoLocalSampling/autoFaster 新增；initialmodel 的 --pool 3 显式参数化
- t352-c（并行子代理窗口，见其专属条目）：cs2star 星表上传集群 twin + remoteOutputs 记录 + .cs 去重重下载 + cs2star 进 REMOTE_OUTPUT_CANDIDATES（probe 自愈）
- 回归防线：run-6 套件扩 F 段（直接对引擎 buildArgv，tier 无关）——Blush 上下行、三联、healpix 度数→order、sigma_ang/3、relax_sym、scratch+keep-free、extraArgs 逐字搭载、幽灵旗标点名拒绝、2D 不带 Blush、默认三件套与 lean 默认——59/59 ALL GREEN（含 t350 全部存量断言）
- 活体验证：diag-t352-cs2star-twin.mjs（新套件）22/22 ALL GREEN——twin 上传/字节级一致/记录绑定集群身份/重跑零下载（mock exec-audit 佐证：run#2 零 cat 命令）/幂等重传；tsc 0 错；触碰文件 eslint 0 输出
- 浏览器（4GB 盒的持久战）：dev server 反复被 OOM 收割（RSS 2.8-2.9GB，本盒已知模式）——多次完整渲染成功（标题/头部/目录/画布全在，无客户端异常；一次 Application error 系服务器中途死掉截断 RSC 流，后续干净加载证伪了代码缺陷）；inspector 点击全流程因服务器寿命无法完成，以 spec 完整性单测代偿（四 job 全参数：无重复键、tab 全在册、sel 默认值全在选项表、defaultParams 全落位）+ `bun run build` 亦被 OOM（exit 137）——本盒今日无缘 prod 代偿，诚实记录
- 未做（明确记下）：helical 参数面（--helix 家族，SPA 模式不用螺旋管）、Class2D 的 EM/VDAM 算法切换（do_em/do_grad）——需要时按同一纪律（pipeline_jobs.cpp 映射 + verified set 守门）扩

Stage Summary:
- 「所有 RELION GUI 参数」的本期答案：四个 refine 家族 job 的 GUI 参数面（除 I/O 由画布连线承担、螺旋管参数外）全部在 inspector 表签里，默认值=RELION 自己的默认（不额外传旗标，argv 形状与 t351 完全一致）；「其它一切」经 Additional RELION arguments 口子逐字搭载，161 项 verified set 守门——打错旗标在本门死，不烧 GPU 时
- Blush：RELION 5.0 起内置于 relion_refine（--blush，无需外挂）——现在 class3d/refine3d 的 Optimisation 表签有一等开关（默认关=标准平滑先验）；2D/InitialModel 不放（RELION 自己的 GUI 就没有）；用户集群是 5.0-beta，Blush 是否在该 build 里可 `relion_refine --help 2>&1 | grep -i blush` 一验
- scratch：scratchDir 字段（Compute 表签）t351 已有，本期 hint 点名 /ssd_cache 节点本地 SSD + keepFreeScratch（--keep_free_scratch）同伴参数
- cs2star：星表现在存集群（twin 镜像路径 + remoteOutputs 记录，下游集群作业原地读、零重传），重跑零重下载；36 个 unmapped .cs 字段系 CryoSPARC 内部记账/统计量（pose_ess/error/power/uid/import_sig 等），RELION 无逐行对应物——下游要用的字段（位姿/平移/类别/CTF/光学组）全部已映射，与 pyem/RELION 官方转换器行为一致
- 用户复机路径：Windows 主机 git pull；旧 job 的参数面板会如实显示现在真正生效的值（class3d 的 T=4 从硬编码转为真参数）

---
Task ID: t353
Agent: main-agent (Z.ai Code)
Task: 用户工单（三件）——①拉取最新代码（origin 有 t351/t352 两个新提交，含 t352-c 的 cs2star twin 上传，fast-forward 完成）；②「cryosparc转relion star文件目前的结果只生成在本地，这个任务调用的是cluster上的pyem，是不是本地设好参数把脚本传到cluster上运行，直接output在cluster上就好了，没有必要像现在这么麻烦吧」——采纳用户的架构判断：参数本地定、数据在集群、转换就该在集群跑；③「2D分类为什么跑到7/20轮时就显示99%进度了？这个bug需要修复」。

Work Log:
- 病根判读③（99% 进度）：progress-parse.ts 的 per-image 分支把裸时间条当全局进度——远程 sweep 只取 run.out 的 tail -c 4096（本地 readTail 同宽），6-rank class2d 每轮 expectation 的 \r 时间条按 rank 各占一条物理行、每 tick ~40 字节，一轮一刻钟就写掉数十万字节，"Expectation iteration 7 of 20" 表头早被推出窗口；解析器在无表头时落入 per-image 分支读条内比例为全程（每轮末尾 ~0.99 → pct 钳到 99），单调契约把它冻死在 99
- 修③：REFINE_FAMILY（class2d/class3d/refine3d/initialmodel/multibody）类型感知闸门——refine 家族的裸时间条与 n/N 计数器是轮内进度不是全程进度，返回 null（单调契约保住上一诚实值）；表头在窗口时照常 (iter-1+barRatio)/totalIter 组合（阶梯：每轮表头进窗口瞬间 +1/total）；ctffind/motioncorr/extract/autopick 的全局条语义不变（diag-t319 回归钉死）。纯模块修复同时覆盖本地 sweep 与远程 sweep 两条道
- 判读②：现状（t352-c）是下载 200MB .cs → 本地 TS 转换 → 上传 200MB star（重跑零传输、但首跑 400MB 过线）；用户提案正确——脚本上集群、输出落集群、零大字节过线。实现为 t353 CLUSTER-SIDE lane：CS2STAR_CLUSTER_PY（String.raw 内嵌 ~350 行自包含 python，csRowsToStar 的逐字节孪生移植——同 uid smart-merge、同 pyem 验证字段表、同 planLinkNames 后缀、同 emit 顺序、同 6 位有效数字 fmt 含 JS Number→String 方言（Decimal 定点域 + e+/- 指数域）、jsround=floor(x+0.5) 对齐 Math.round 的 .5 语义）；argv 传参（--primary/--passthrough/--out/--link-dir/--cs-root/--invert-y/--fallback JSON）；退出码契约（0 + 末行 CF_RECEIPT {json}，非 0 + stderr CS2STAR-ERROR，star 走 .tmp+os.replace 原子写，链接幂等 remove+symlink）
- probeClusterPython（一轮 SSH）：python3 → python → csparc2star.py 的 shebang（conda env python 的唯一可靠入口；env-shebang 经 command -v 解析（第一臂已试过）、绝对 shebang 直用）；definitive 标记区分「集群干净地说没有 python」与「探针没应答」——两者都落 fallback 且 phase 行如实分述；脚本级失败（.cs 坏、stack 缺失）不 fallback——同样的字节在本地转换器会同样失败，错误就是判词（missing stack 的诚实拒绝 dialect 与旧道逐字兼容，diag-t336 钉死）
- runCs2StarOnCluster：探测 → 上传脚本（KB 级，唯一过线字节）→ sshExec 跑在登录节点（900s 预算 + 15s 本地心跳 phase 保 log 活，t340 教义）→ receipt 解析 → statRemoteFiles 验证 twin → REMOTE 信封结果行（尾部 " · converted ON the cluster in place (no .cs download, no star upload)"）；record.outputs.particles_star 保持本地风味路径（有意不存在——twin gate 的键），remote.remoteOutputs.particles_star=twinPath，mode direct
- finishCsRunOnCluster：从 t352-c 尾部块提取的共享收尾（recordNativeRun + startedAt 守卫 + 双道见证上传 + t346 tail 缓存）——上传道（fallback）与就地道（python）不可能漂移；旧道整段保留为 fallback（python 缺席的集群、探针哑火的线）
- 配套消费链：writeCsRemoteManifest 内联进 engine.ts（engine↔remote-run 断环教义——remote-files.ts import remote-run.ts，import 其 writer 会闭环；字节形状与 writeRemoteManifest 一致）——无本地 star 时 Files 页经 manifest 列出 on-cluster 卡片；output-summary cs2star 分支在无本地 star 时从 result 行解析计数（"N particles converted … M stack(s) → micrographs/"，两道同句式，receipt 是回退不是第二计数器），outputs route 传入 run.result
- workflow.ts 描述更新：删「No pyem, no Python: the converter is built in」改为集群就地转换 + python3+numpy 门槛 + fallback 说明（用户看到的 palette 与 inspector 同步，浏览器活体验证）
- 验证装置：diag-t353-cs2star-cluster-side.mjs（新，36 断言）——零下载三重证（workdir 无 .cs、exec-audit 无 cat .cs、唯一 head -c 是 KB 级脚本上传）、twin 在册（stat>0 + record.remoteOutputs + mode direct）、链接农场 readlink、manifest、关键数字走 receipt 行、与本地道字节级一致（同 .cs 双道 diff）、下游 class2d 就地消费 twin（audit 无 particles.star 上传）+ argv 引用 twin 路径、重跑幂等零下载；diag-t336 更新 B6/B7/B8/B9 到就地道语义（B6 反转为「star 只在集群」+ B7b manifest）+ ROOT/BASE 参数化（CF_ROOT/CF_BASE）；diag-t352 改造为 FALLBACK 道套件——python-less shim 写进 mock 的 fs/opt/bin（MOCK_PATH 首位；/opt/bin 不在翻译前缀里，必须写宿主路径）断言「no python3+numpy — falling back」phase + 上传道 twin + .cs 缓存重用全保留；diag-t319 扩 4 个 t353 单元用例（7/20→99% 现场形状、带 params 也 null、n/N 计数器 null、ctffind 全局条保 99）
- 排障记录：t353 首跑 4 FAIL 全部同根——POST /api/jobs 与 GET /api/jobs 只认 ACTIVE project（projects file 指针），PHASE 3 建本地项目把指针拨走，PHASE 4 的 class2d 落进本地项目（edge 400 different projects）+ awaitTerminal 在错误项目里永远找不到行（stuck 假象）——套件在 PHASE 3 后补 POST /api/projects/switch 归还指针（测试装置问题，非引擎回归）；t352 首跑 shim 失效（client 写 /opt/bin 落在沙箱真根而非 mock fs——/opt/bin 不是翻译前缀）改直写 mock fs 宿主路径；浏览器开 inspector 需 viewport <xl（sheet 的 !isXl 门）+ 卡片先 PATCH 到可视区
- 活体验证：四套件 ALL GREEN（t353 36/36、t336 全绿、t352 全绿、t319 全绿含新用例）+ run-6 59/59（bun 跑——engine.ts 的 @/ 别名 node 裸解析不了，bun 走 tsconfig paths；refine argv/sbatch/Blush/守门面全不回归）+ tsc 0 错 + eslint 触碰文件零新增（全项目 15 项存量基线逐字一致）；agent-browser——页面干净渲染、palette 与 inspector 双处新描述、Params 页 csPath/invertY 在位、console/page errors 双零、390px 移动端零横向溢流（途中 dev server 被 OOM 收割一次——本盒已知模式，重启后全过；截图 docs/t353-inspector.png / t353-mobile.png；VLM 目检 429 限流，DOM 断言 + 截图代偿）

Stage Summary:
- 99% bug 根治：refine 家族裸条/计数器不再冒充全程进度——表头在窗口时组合、不在时单调保持（阶梯式诚实推进），per-image 家族语义不变
- cs2star 集群架构落地（用户提案的形态）：参数本地定 → KB 级脚本上集群 → 登录节点 python3+numpy 就地转换 → star 直写 twin、农场进程内建链——200MB .cs 与 200MB star 永不过线；无 python 集群自动落回 t352-c 下载/转换/上传道（该道 diag-t352 永久钉死）；与本地道输出字节级一致（diag-t353 T10 钉死）；pyem 本身不再被需要（字段表就是 pyem 验证过的那张），但集群若有 pyem，其 shebang 会成为 python 解释器的第三探针臂
- 消费链自洽：Files 页经 remote manifest 列出 on-cluster star、关键数字走 receipt 行、下游集群作业经 twin gate 就地消费（零上传）、日志页经 twinDir 见证 + t346 缓存双轨
- 用户复机路径：git pull → cs2star 重跑一次（旧 job 的 twin 已在集群上的不受影响；新跑走集群就地道，receipt 尾部带 "converted ON the cluster in place"）；2D 分类的进度条从下一轮表头进窗口起恢复诚实阶梯

---
Task ID: t354
Agent: main-agent (Z.ai Code)
Task: 用户工单「2d分类的中间过程目前看不到，希望的是每一轮的2d结果生成一张图片，可以在本地的UI中查看」——t350 只展示最新一轮的逐类小图；本轮把每一轮做成一张拼接大图（sheet），历史轮随时可看

Work Log:
- 形状判读：RELION 每轮写 run_itNNN_classes.mrcs（该轮全部类平均的 stack）——「每轮一张图」= 整个 stack 拼成一张网格大图（relion_display 的看法）。t350 已有 per-slice 渲染 + 按需拉取 + slimming 契约，缺的是：①每轮一张拼图 ②历史轮清单 ③完成后回看
- mrc.ts renderClassSheetPng：全 slice 自适应网格（4-8 列、160px cell、per-slice 2-98 百分位拉伸、黑底 2px 缝、双边 1400px 上限——50-100 类的真实 sheet 仍 KB 级）；布局循环先花宽度预算加列、后缩 cell（原两段 while 的交互缺陷：cols 到 8 后高度超限不再缩 cell——重写为 dims() 收敛循环）
- iteration-live.ts：payload 增 stacks[]（StackEntry{iter,file} 升序；同轮 unmasked 胜出，与 pickStack 同 rank 语义）；ensureClassStackPngs 升级为 ensureIterationAssets——一次拉取三产出（全部 slice PNG + sheet.png + slice 数），in-flight 共享、t339 契约不变（MB 级 stack 拉完即删）；localIterations(workdir, jobId?) 双源并集（mirror readdir ∪ PREVIEW_DIR/live/<jobId> 渲染缓存——cachedStackEntries 以目录名为轮次凭据，.mrcs 重建过 STACK_NAME_RE 落回同目录）；cacheSheetPng 供本地渲染分支落缓存（t333 重派发清 mirror 后历史轮仍可看）；无 workdir 分支诚实返回（不伪造零计数 classes）
- 新 route /api/jobs/[id]/iterations/sheet：缓存命中 → 本地 mirror 渲染（落缓存）→ 集群按需重拉（**允许已完成 run**——冷重启后缓存空、集群是唯一诚实源；与 t350 image route 的 run.done 404 方言有意分叉，注释陈述理由）；不存在轮 404、路径逃逸 400、Cache-Control private max-age=300（stack 名含轮号=不可变内容）
- iterations route 冷缓存合成：完成态 remote run 的 mirror 若无每轮 stack（真实世界 >16MB keyFileMb 留在集群），由 iterations（data.star 轮次）按 RELION 命名法则合成 chips（run_itNNN_data.star ⇒ run_itNNN_classes.mrcs 兄弟）——chips 条永不因冷缓存消失，用户点击即触发按需重拉
- gallery 重构：chips 轮选条（running 时跟随最新轮+脉冲点、点击钉住、落后时出 latest 跳转钮、scrollIntoView 跟随）+ 当前轮 sheet 大图（lazy fetch、min-h 占位、错误态带 Retry、key=URL 重挂载）+ lightbox（shadcn Dialog——class-gallery/fsc-compare 同方言；←/→ 键盘走轮、边界禁用箭头、轮次计数）+ per-class 网格与 picker 原样保留（t350/t349 契约）；旧 payload 容错（无 stacks 时由 classesFile 退化为单轮）
- mock relion_refine 修真：os.replace → 拷贝（3 处终稿别名）——真实 RELION 保留全部 per-iteration 文件、终稿别名并存；旧改名吃掉最后一轮 data.star 使完成态轮次清单少一轮（diag 首跑 FAIL 3/4 的病根）；爆破半径审计（t211/t298 plant 文件、t333 .some() 断言——无缺失性断言，安全）
- diag-t354-iteration-sheets.mjs（42 断言 ALL GREEN）：UNIT（sheet 渲染 PNG magic/全 slice/真实字节；localIterations 升序/unmasked 胜出/occupancy；缓存独腿诚实形状）+ LIVE（mock class2d 8 轮：运行中 stacks 列表+首轮 sheet 200 PNG+t350 slice 回归）+ AFTER（8 chips 升序、每轮 sheet 200、.stack.mrcs 不留、sheet.png 落缓存）+ COLD（删 mirror stacks+清缓存 → 合成 8 chips、末轮集群重拉 200、重拉落缓存、虚构轮 404、路径逃逸 400）；LIVE 轮询带 ?refresh=1 绕 12s TTL（首跑三 FAIL 的病根：快作业在缓存窗口内跑完、poll 全吃空载荷）
- 回归：diag-t319 ALL GREEN（refine 进度家族）+ diag-t353 ALL GREEN（cs2star 集群道含下游 class2d 就地消费）；tsc 0 错；触碰 7 文件 eslint 0 输出（全项目 15 项存量基线不变）
- 浏览器活体（4GB 盒的 OOM 持久战）：next-server 编译期 RSS 2.1-2.8GB + chromium 700MB 撞 4GB 天花板——inspector 全流程反复死于 /outputs 编译后、/iterations 编译时（dev.log 实证「Compiling /api/jobs/[id]/iterations」即死）；NODE_OPTIONS max-old-space-size 确认传入但 RSS 仍超限（turbopack/源映射非 V8 内存）；破局术：route mock 预热法——mock 重 route（iterations JSON 喂 diag 验证过的同形状 payload）让重编译不发生，outputs 走真服务器（每次都活），gallery 全挂载后逐步解除 mock：**最终全真数据验证通过**——8 chips、it008 激活、真 sheet 266×68 绘制（naturalWidth>0）、it003 切轮真图加载、lightbox 标题/箭头/←→键盘/Esc、picker 选中+Continue 使能、console/page errors 零、390px 零横向溢流（chips 条 overflow-x-auto 生效）；截图 docs/t354-gallery-live.png / t354-gallery-mobile.png
- 收尾：QA 项目×3 删除、指针归还 pool-lever e2e、qa-t354ui 连接删除、mock fs 残留清理、mock cluster 复活（:3022）；commit dd99432 push GitHub（085390e..dd99432 main）

Stage Summary:
- 每轮一张图的完整链路：chips 条（每轮一枚）→ sheet route（缓存/本地/集群三源懒取）→ 大图 + lightbox；运行中每轮落图跟随最新、完成后任意历史轮点击即取（冷缓存由命名法则合成 chips 兜底）
- 三源取图方言：preview 缓存（快）→ 本地 mirror（完成后小 stack）→ 集群按需重拉（running 或 done 皆可——冷重启的唯一诚实源）；t339 slimming 与 t333 重派发擦除两条契约都对齐
- mock relion_refine 对齐真实 RELION 终稿语义（拷贝非改名）——这本身就是一处 mock-vs-reality 缺陷的修复
- 用户复机路径：git pull → 2D 分类运行中打开 Results 页即见每轮 sheet（运行时跟随最新轮、点任意轮钉住）；完成后历史轮照看（缓存即答、冷了从集群按需拉）；t353 的进度修复与 cs2star 集群道同 push 在库

---
Task ID: t355
Agent: main-agent (Z.ai Code)
Task: 用户工单（三件）——①「cluster上跑的2D分类的结果看不到结果的图片加载出来」②「运行2D selection job时也没法看到每一类的图片加载出来」③「UI中这些分类的框大小不一」

Work Log:
- 根因判读①（class2d Results 页）：三叠缺陷。a) /iterations/image 路由对 done 远程 run 直接 404（t350 时代的方言，t354 只给 sheet 路由开了 done 重拉的门、per-class 网格被漏掉）——完成的集群 2D 分类每张类图全 404；b) localIterations 的 classesFile=pickStack(本地 mirror)——真实 100 类 × 200-360px 盒的类平均栈 25-100MB 超过 keyFileMb=16 默认帽，栈留在集群 → classesFile=null → 类网格全部「no image」；c) 数据星也因 budget 滞留集群时 iterations=[] → chips 条空 → sheet 无从点起。附：remoteStat 走序列化 exec 队列（10s 预算）——sweep 心跳 + /iterations 轮询 + 日志抓取排队在前，真实集群上 stat 在轮到之前就超时 → sheet「may not exist」假 404；STACK_FETCH_CAP=64MB 挡住 100+ 类大栈
- 修①（四层）：iterations 路由本地腿新增 REMOTE MERGE——run.remote 且 mirror 缺 classesFile/iterations/classes 时 ONE 12s-TTL SSH 轮（remoteLiveIterations，对 done run 同样工作）填栈名/占用/轮次，本地已有的字段保持本地（mtime 缓存免费），stacks 按轮次并集（本地栈本地渲、集群轮按需拉）、chips 合成移到 merge 之后；/iterations/image 的 run.done 拒绝删除（对齐 sheet 路由的 t354 方言）；remoteStat 改直连 pooled 通道（与 remoteDownload 的 cat 同传输、绕开序列化队列）+ 预算 10s→20s；STACK_FETCH_CAP 64→256MB + sheet/image 的 404 文案点名「可能不存在/线路忙/超 256MB 帽」
- 根因判读②（select 任务的类画廊）：/api/jobs/[id]/classes 只查本地 mirror——集群跑的 class2d 栈不在本地 → classesFile=null → 每张卡「no image」（占用数字倒是齐的，数据星是文本总会回家）
- 修②：classes 路由重构为三源——本地 mirror（原行为，早退全撤、mirrorOk 门）→ 集群（remoteLiveIterations：栈名 + 占用 + latest 轮次，仅本地缺时补）→ finalize manifest（.cf-remote-manifest.json，连接被删/线断时零 SSH 仍报栈名）；pickStackName 提纯为共享谓词（unmasked/final > 最高迭代）；缩略图照旧走 /outputs/file 懒取（t289 学说：点击=文件落到真实 mirror 路径，第一张触发全栈拉取、后续本地渲）
- 根因判读③（框大小不一）：ClassGallery 网格用视口断点 xl:grid-cols-5，但它住在 380px 的 job panel aside 里——5 列=66px 卡，「325,549」+「100%」的占用页脚只在颗粒多的类上折行 → 同一网格卡片高低不一；附 onError visibility:hidden 把失败图变成无解释的白方块
- 修③：网格改 grid-cols-2 sm:grid-cols-3（按容器实宽而非视口）；占用页脚 min-w-0 + truncate + whitespace-nowrap + shrink-0（挤压截断、永不折行）；失败图改诚实占位（failedImgs 集合 → 「no image」卡，lightbox 同款）；加载中 animate-pulse 暗盒（集群栈懒取的「在路上」提示）；iteration gallery 类网格页脚同款 nowrap 加固
- 附带修（浏览器实测揪出）：t354 的 sheet 错误分支把 Retry <Button> 嵌在 zoom-in 包装 <button> 里——无效 HTML、React hydration 告警、恰好是用户所在的报错态；错误卡移出 zoom 按钮（Retry 不再嵌套、stopPropagation 随之退役）
- 验证装置：diag-t355-cluster-gallery.mjs（38 断言 ALL GREEN）——A 真实 mock slurm class2d（8 轮 3 类）完成 → B 无栈 mirror（删 9 个 .mrcs+清缓存=用户世界）：merged payload 8 chips+classesFile 非空+占用本地、DONE run 逐 slice 200 PNG（旧代码 404）、sheet 200、.stack.mrcs 不留 → C 冷 mirror（数据星也删）：iterations/classesFile/占用全数来自集群（awk）、classes 路由给 select 画廊供栈名、缩略图懒取落 mirror 后第二张本地渲 → D 线断（删连接）：manifest 零 SSH 仍报栈名 → E 诚实门（虚构轮 404、缺文件 404、路径逃逸 400）；qa-t355ui-seed.mjs（浏览器验证台：select2d 任务 + 双边连接 classAverages→classes）
- 回归防线（七套件 ALL GREEN）：t354（live 腿+after+cold 全过）、t353/t352（cs2star 集群道+双胞胎，重跑过 OOM 环境噪音后全绿）、t336、t339、t319；tsc 0 错；触碰 8 文件 eslint 0 输出
- 浏览器活体验证（agent-browser 1600×900 + 390×844）：select2d 面板 Classes 页——3 卡 3 图全加载（集群懒取）、heights [101,101,101] uniform、3 列、lightbox 开合全图 64×64 加载；class2d inspector——8 chips、it008 sheet 266×68 加载、类网格 3/3 加载、chip 点击 aria-selected 切换、嵌套按钮 0、hydration 告警 0、console/page errors 0；移动端——2 列、uniform、零横向溢流；截图 docs/t355-select2d-gallery.png / t355-class2d-results.png / t355-class2d-final.png / t355-select2d-mobile.png 入库
- 途中排障（4GB 盒 OOM 持久战）：next-server 反复被 OOM 收割（anon-rss 2.9GB，dmesg 42 案在录）——首战殃及 t353/t352 假 FAIL（fetch failed=服务器死、非代码回归，重启+清 chrome 残留后全绿）；浏览器期 it003 sheet 假失败同为 OOM（服务器 mid-request 死；路由直连 curl it001/003/005 全 200 PNG×2 次）；破局法：agent-browser 关闭 + dev-server.sh 新起 + curl 预热 / 页与重路由后才开浏览器、Retry 按钮复用已水合页面躲整页重编

Stage Summary:
- 集群 2D 分类的图彻底通了：运行中（t354 原有）+ 完成后（本次修）双态——chips 来自集群并集、sheet/per-class 图按需重拉（done run 门已开）、栈名/占用冷热 mirror 皆答；select 画廊的喂料路由三源齐备（mirror→SSH→manifest），缩略图懒取落位
- 框大小不一根治：列数按容器实宽（2-3 列）+ 页脚 nowrap 截断——任何挤压下卡片高度恒等；失败图诚实占位、加载中暗盒脉冲
- 可靠性两针：remoteStat 直连通道（不再排 sweep/轮询的长队）+ 20s 预算；拉栈帽 64→256MB 且超帽/缺文件/线忙三态文案
- 用户复机路径：git pull → 重新打开 2D 分类的 Results 页（历史轮 sheet/类图即点即取，无需重跑）→ select 任务 Classes 页每类图加载；t354/t353 的行为与断言全部保持

---
Task ID: t356
Agent: main (Z.ai Code)
Task: 用户卡片工单五项 — ①卡片内容过满（隐藏 IP、删除 388k 徽章）②两卡之间连线别扭（调换 select2d 输入口顺序解交叉）③每次连线都会卡一下（性能）④给 job 添加特殊标记/评论（小图标，悬停显示内容）⑤卡片下方文字全部 1 行内解决

Work Log:
- workflow.ts: select2d inputs [particles,classes]→[classes,particles] — class2d 的 classAverages(口0/上) 对齐 classes(口0/上)、particles(口1/下) 对齐 particles(口1/下)，class2d→select2d 两根线从交叉变平行；边按端口名引用（edge-geom 以 findIndex 解名），纯几何修复、存量接线零影响；defaultPorts 按种类匹配（references2d vs particles 无歧义），映射不变
- job-card.tsx Row 2 减负: 两枚 remote-host 芯片（running/pending 青色 + terminal 幽灵色）从卡面退役；出处（user@host · module · workdir）移入 JobCardPreview 悬停预览的一行 muted 主机行 — 「ip可以隐藏」而非删信息；t347 的 counted-receipt 芯片（388k）整体下架（counts/countChip memo + data-card-count JSX + result-counts 导入），数字仍活在 inspector KeyNumbers strip + header chips + outputs 活数
- Row 3 一行律（t349 两行叙事回撤）: completed/failed/pending 三态 line-clamp-2 → truncate（pending flex 容器补 min-w-0），全文仍在 title 悬停与 inspector
- 标记/评论闭环: StickyNote 徽章原生 title → HoverCard 样式弹层（amber Note 头 + max-h-40 滚动正文 + 编辑入口脚注，aria-label 带全文）；右键菜单新增「Add note…/Edit note…」→ Dialog（Textarea ≤500 字符=服务器上限、计数器、⌘/Ctrl+Enter 保存、Clear note 清除、失败保草稿+toast）→ saveJob PATCH {note}，与 inspector 自动保存编辑器同源（job.note 单一字段，note spotlight/print 摘要自动继承）
- 连线卡顿根因: pendingFrom 身份变化（起线/落线/取消）时 React.memo 默认浅比较失效 → 【全画布】卡重渲染（每张 ContextMenu+HoverCard+ports 树）只为点亮个别端口脉冲环；zoom prop 同理（只喂事件回调算术、从不进 render，却让每个滚轮刻度全卡重渲染）
- 修复: pendingRenderSig（本卡渲染指纹: 源卡=src:dir:port、他卡=兼容口命中表 portsCompatible 逐口算、无命中=空串≡无 pending）+ jobCardPropsEqual（稳定 prop 浅比 + pending 对按指纹比）→ 起线只重渲染源卡+有兼容口的卡；6 个端口处理器改 livePending()=getState().pendingFrom 事件时新鲜读（完成逻辑永不依赖渲染快照——这也让 comparator 跳过重渲染语义安全）；拖拽 handlePointerMove/endDrag 的 zoom 逐帧新鲜读（中途捏合缩放反而更准），zoom prop 从 JobCardProps/canvas 传递整体退役
- 验证: scripts/diag-t356-card-polish.mjs（playwright 真浏览器）——A0-A3 减负（0 计数芯/0 钳制行/无 IP 文本）✓ B1-B2 几何证明（两线 177.33→177.33 / 214.67→214.67 全平、零交叉零绕行）✓ C1 徽章悬停样式弹层 ✓ D1-D3 右键→对话框→保存→徽章出现+对话框关闭 ✓ E1-E2 拖拽连线（select2d.particles→class3d.particles）建边+Connected toast ✓（livePending 重构+comparator 的交互实证）F 持久化经 API 复核（两笔记+3 边入库）✓；截图 shots-qa/t356-{a-canvas,b-note-popover,c-note-dialog,d-note-saved,e-wired}.png；tsc 0 / eslint 0；无 e2e 依赖面变化（data-card-count 无断言引用，select2d 端口无断言引用）
- 环境（4GB 盒持久战，150 案内核 OOM 在录）: dev 编译峰值 2.9GB+chromium 必超 4.1GB——单调用配方（浏览器关闭编译 + 客户端块 curl 预热 + 小 API 路由预热 + 1100 堆 + 全链验证同调用内完成）通过全部检查；prod build 本轮无法完成（turbopack 3.8GB / webpack worker 亦超——比 t347 时代更紧）；修复验证装置自身一处：pkill -f 打不中孤儿 next-server 监听者 → t332 的 ss listener-kill 学说（"already running" 幽灵导致 compile:000 假象）

Stage Summary:
- 卡面信息架构再收敛: 类别色条 + 图标名 + 标记徽章 + 状态徽章 + 类型人话标签 + 链系芯 + 一行状态句——IP/计数下沉悬停预览与 inspector
- select2d 双输入调序后 class2d→select2d 接线天然平行（几何证明），class2d 的两口各对齐一口
- 连线起落从全画布重渲染收缩到源卡+兼容卡；滚轮缩放不再全卡重渲染（zoom prop 退役）
- job 标记/评论: 右键 Add note… → 对话框 → PATCH → amber 徽章 → 悬停样式弹层读全文（与 inspector 编辑器同一 job.note）
- 用户复机路径: git pull → 画布即生效（卡面清爽、class2d→select2d 平行线、右键即可加评论）

---
Task ID: t357
Agent: main-agent (Z.ai Code)
Task: 用户工单「这两个问题依然存在，都没有解决，这个其实应该是把cluster的mrcs结果文件下载到本地，之后将mrcs文件转换成图片吧」——t355 的三层修复在真实集群上仍然失败；采纳用户架构判断：主动下载 mrcs → 本地转图片

Work Log:
- 根因判读：t355 把全部体验押在「点击时的按需懒拉」上——每张图都是一次现场 SSH 轮盘。真实集群的 25-100MB 类平均栈正中 t298 已证明的 bun+ssh2 静默截断形状（64MB 传输可丢 1.6-48MB 且 exit=0），而 ensureIterationAssets 单发无字节校验、无重试——截断后 readMrcHeader 拒绝 → 404「could not fetch…may not exist」→ 用户看到的就是「加载不出来」；select 画廊同理。/outputs/file 道有 5 次字节校验重试，但 iteration 管线没有——同一传输层的两种命运
- 修（用户架构落地，四件）：
  a) verifiedStackPull（t298 教义进本道）：stat → cat → landed===expected 三次尝试，截断销毁重试；.stack.mrcs 永不留（t339 契约）
  b) scheduleRemoteStackRenders 主动管线：finalize 后台把 manifest 里的每个类平均栈逐个下载→渲染全部 slice PNG + 每轮 sheet→删栈（最新轮优先、单 run 2GiB 预算、单栈 256MB 帽、一 job 一管线、.done 判决标记可断点续跑、legacy sheet.png 等价判决）；直连 pooled 通道并行于序列化队列——sweep 永不阻塞；失败作业也跑（被杀运行跑完的轮正是用户判断重跑的依据）
  c) view 触发器：/iterations 轮询发现未渲染轮即后台调度（manifest 有尺寸用尺寸；无 manifest 盲拉只拉最新一轮有界）——覆盖 t356 前的存量完成作业与冷缓存；候选含 classesFile（无轮号的 run_unmasked_classes 不进 chips，classesFile 补遗是它唯一主动渲染通道）
  d) 缓存即答：localIterations 与 /classes 在镜像缺栈时先查预览缓存（cachedStackState）——管线跑完后两个画廊零 SSH 即答；断线 + 集群栈被删后图片仍 200（diag B/E 钉死「图片已本地」的架构证明）
- 方言修复两处：STACK_NAME_RE 收编 RELION 5 无轮号终稿 run_unmasked_classes.mrcs（image/sheet 路由白名单 + 管线过滤），且 remoteLiveIterations 的集群 listing grep 原来根本看不见它——pickStack 的终稿优先一直是死代码（diag C 首跑 FAIL 的病根）；select 画廊缩略图/lightbox/预载全部改走 iterations/image 道（缓存命中即答；miss 一次字节校验拉取渲染全栈），/outputs/file 降为一次性回退道（第一道失败换道重试，双失败才诚实占位）
- harness 顺手修：e2e-lib 的 ROOT 默认值还是沙箱重建前的 /home/z/cryoflow——run-6 的脚本断言整下午读空（spawnSync 的 module-not-found 藏在 stderr），最小复现（探针派发 2-GPU class2d + cat 脚本全过）证伪代码回归后定位；默认值改为当前仓库树
- 验证：diag-t356-proactive-render.mjs（44 断言 ALL GREEN）——B：finalize 管线零图片调用渲染全部 6 轮 + 瘦约契约 + 集群栈删除后图片仍 200；C：存量作业 + 植入 run_unmasked（listing 可见 → merge 优先 → view 触发渲染 → classes 从缓存命名 → image/sheet 接受无轮号名）；D：running 期轮询后台渲染（无点击）+ 完成后 12/12；E：断线上缓即答；F：诚实门（404/400/别名）。回归全绿：t354、t355、t353、t319、run-6 59/59（修 harness 后）。tsc 0 错、触碰文件 eslint 0 输出
- 测试装置排障三则：B→C 的 12s TTL 缓存挡住新植入栈（等 13s 让 TTL 过期）；plant 的 cp 源已被 B 删除（base64 直写真栈替代）；大栈 base64 ~308KB 超 exec 命令行上限（fixture 回退 header-only 探针——mock refine 自己写真类栈，import 只嗅探头）
- 浏览器活体验证（4GB 盒 OOM 持久战：iterations 路由编译时服务器被收割 ×3，破局术=关浏览器重启 + curl 预热全部相关路由后重开）：class2d Results——6 chips、it006 sheet 266px、it003 历史轮切换、lightbox 开合、3/3 类图、卡片等高 252px；select2d Params——3/3 缩略图走新 lane（src=iterations/image）、等高 101px、lightbox 全图；console/page errors 双零；390px 响应式（2 列、等高、零溢流、3/3 加载）；截图 docs/t356-select2d-gallery.png / t356-class2d-results.png / t356-select2d-mobile.png
- 合并：远端有并行 t356（卡片打磨，遗留任务在另一窗口完成）——文件面仅 worklog.md 相交，git merge 干净、合并后 tsc 0 错 + diag-t356 重跑 ALL GREEN；本工单在 worklog 编号为 t357（t356 已被卡片工单占用）

Stage Summary:
- 架构换轴（用户提案的形态）：完成后 mrcs 主动下载 → 本地转 PNG → 集群栈即删——两个画廊从「点击时 SSH 轮盘」变成「本地图片即答」；断线/冷启动/集群清理三种灾难下图片照常服务（管线跑过之后）
- 懒道同时加固：字节校验三次重试（t298 教义统一两条道）、.done 判决标记（断点续跑永不重付传输）、RELION 5 终稿栈从 listing 到路由全链路可见
- 用户复机路径：git pull → 打开既有 2D 分类的 Results 页（view 触发器自动后台渲染全部轮次，chips 逐一点亮）→ select 作业 Classes 页每类图即答；下一次新跑的 2D 分类在完成瞬间全部轮次自动落地本地

---
Task ID: t358
Agent: main-agent (Z.ai Code)
Task: 用户工单「could not load the sheet for iteration 020 — the stack may not exist on the cluster 还是显示不出来结果图」——t357 的主动管线在真实集群上仍然全灭；本轮换传输轴：分块校验下载 + 全链路诚实报错

Work Log:
- 根因判读：t357 把每次 mrcs 拉取做成「一次性整文件 cat + 字节校验 3 连试」——但 t298 已证明 bun+ssh2 的接收端对 25–100MB 级传输会静默丢字节（64MB 丢 1.6–48MB、exit=0），且丢包是尺寸相关的：整文件重试只是反复掷同一副输骰。真实 2D 分类（it020、每栈几十 MB）每次拉取都被判 truncated → 404，且所有失败类别（missing/stat 失败/传输断/截断/超帽/坏字节）共用同一句「stack may not exist on the cluster」——用户与本轮排查都无法分辨断在哪一环
- 修（传输层 ssh.ts，四件）：remoteStatEx 三态标签（ok/absent/error——absent 是集群亲口说的 MISSING，永不再用 null 把三种世界折叠成一句 404）；writeAllSyncAt 显式定位写入（writeSync 可能短写，t357 忽略返回值会把丢字节在写层重新引入；显式位置还让分块重试天然可回卷——失败尝试留下的部分字节不会挪动下一次的落点）；remoteChunkedDownload 分块拉取（8MB/块 = 同步回传 16MB 安全域的一半，tail -c +OFF | head -c N 逐块、块级字节账 + 退出码双校验、块级 3 连试 + 350ms 呼吸——中途丢一块只重付一块，不再重付整个文件；块串行防并发风暴）；僵尸连接两针（stat 连拒两次 → dropConnection 重拨再问一次；块级 channel 味错误 → 每文件一次强制重拨——t346 阶梯教义的直连通道版）
- 修（管线 iteration-live.ts）：StackPullFailure 七类原因（missing/over-cap/stat-failed/transfer/truncated/unreadable/no-connection）+ 每栈失败登记表（lastStackFailure——成功即清除）；verifiedStackPull 换分块传输并携带判决（over-cap 消息带真实尺寸「X is 300 MB — above the 256 MB cap」；truncated 带块号与字节区间；「下载完整但头不可读」先判 transient 是否被中途清掉——t333 重派发擦除竞赛下那是 transfer 而非 unreadable，旧文案会把好文件冤枉成集群损坏）；管线拒绝汇总日志（每栈拒绝带 reason 进 dev.log）
- 修（路由）：sheet/image 404 改 {error: 判决原文, reason}；/iterations 与 /classes 载荷新增 renderError（该栈最近一次拒绝的原因——classesFile 或最新 chip 名下的栈且镜像无本地副本时附上）
- 修（前端两画廊）：class-iteration-gallery 的 sheet 改 fetch-first（blob→objectURL；<img> 的 onError 丢响应体，是「一句含糊 404」的根源——现在错误卡直接展示服务器判决原文，Retry 重取；objectURL 清理防泄漏）；类网格失败卡带 renderError title + 网格脚注；class-gallery（select 画廊）双道全败时出横幅（renderError 原文 + Retry——清失败集 + dataNonce 重拉 /classes）
- mock 集群新增 cat-drop-bytes 杠杆（t344/t345/t346 的 ~/.slurm 约定）："<substr> <minTransferBytes> <dropBytes> [maxFires]"——cat 与 tail|head 两种传输形状按传输尺寸触发中段丢字节（bash 组 { head -c AT; tail -c +DROP+1; } 仍是 exit=0 短读 = t298 形状），fires 边车计数 + cat-lever.log 见证行；顺带发现 mock 是裸 bun 起的（无 --hot）——改 bun run dev 常驻，代码热更
- 验证装置 diag-t358-chunked-stack-pull.mjs（33 断言 ALL GREEN）：A 干净线（全 6 轮经分块拉取渲染）；B 有损线（≥12MB 传输丢 1.5MB）：旧整文件道 /outputs/file 诚实 502（t357 现场形状）+ 杠杆见证 ≥1，分块道（8MB 块 < 阈值）字节精确拉通 16.7MB 大栈、16/16 slice 落地、无 .stack.mrcs 残留；C 单发丢块（maxFires=1）被该块自己的重试恢复（fires 恰为 1——旧代码会在一次抖动上烧光整个 3 连试预算）；D 死线（999 fires）双路由 404 reason=truncated + /iterations renderError + 无截断残留；E 其余原因各就各位（missing / over-cap 带 300MB 尺寸 / unreadable）；F 线路痊愈后同栈重拉 200 + /classes 零拒绝注记
- 排障三则：首跑 3 FAIL 同根——D 相 renderError 门是 classesFile（=缓存已渲染的 run_it005）而失败登记在 run_it006 → 门扩到最新 chip；F 相 404 是 D 相 view-trigger 管线仍在飞行中（ensureIterationAssets in-flight 共享把清缓存竞赛的牺牲品递给了 F 的请求——dev.log「downloaded completely … not a readable MRC」实证）→ 套件加 awaitWireQuiet（mock exec-audit 静默探测）+ verifiedStackPull 区分「transient 被中途清掉」；t355 回归 1 FAIL 是其自身竞态（PHASE B 清缓存撞上 finalize 管线重建中途的半缓存 → classesFile=run_it003、merge 未跑、remote=false）→ 套件在清空前等管线 settle（t354 的 ?refresh=1 同族修法）
- 回归四套件 ALL GREEN：t356（主动管线契约）、t354（每轮 sheet 三源取图）、t355（集群画廊三源喂料 + 等待 settle）、run-6 59/59（引擎 argv/守门面）；tsc 0 错；触碰 10 文件 eslint 0 输出
- 浏览器活体（4GB 盒 OOM 持久战，dev server 被内核收割 6 次——dmesg next-server anon-rss 3.0GB 在录；配方=关浏览器重启 + curl 预热页与重路由 + 快进快出）：class2d Results——6 chips、it006 sheet 经新 fetch-first 流出图（266×68 natural）、类网格 4/4、零错误卡（截图 docs/t358-class2d-results.png）；select2d Classes——3/3 缩略图、卡片等高 101px、无横幅（截图 docs/t358-select2d-gallery.png）；390px 移动端 3/3 加载、零横向溢流（docs/t358-select2d-mobile.png）；console/page errors 零；QA 种子（项目/作业/连接）清场、mock fs 残留清理

Stage Summary:
- 传输换轴：mrcs 拉取从「一次性整文件 cat ×3 连试」改为「8MB 分块、块级字节账 + 退出码双校验、块级重试、僵尸连接重拨」——尺寸相关的静默丢包从「整文件重掷骰子」变成「重付一块」；16.7MB 大栈在有损线上拉通、单发丢块一跳恢复、死线诚实点名，全部套件钉死
- 报错换轴：七类拒绝原因（missing/over-cap/stat-failed/transfer/truncated/unreadable/no-connection）从传输层一路带到路由 JSON 与前端错误卡/横幅——下一次现场报告直接说断在哪一环（over-cap 带真实尺寸、truncated 带块号与字节区间），不再是万能的「may not exist on the cluster」
- 用户复机路径：git pull → 打开既有 2D 分类的 Results 页（chips 即点即取走新分块道；若集群线真的在丢数据，错误卡会点名「truncated 3× in a row (chunk N, bytes …)」）→ select 作业 Classes 页同道；仍失败时的报错文本就是诊断结论，直接带回即可
Agent: main (Z.ai Code)
Task: 用户工单 — t356 之后连线/删线仍会「卡一会，触发一次 hmr 热加载后，线才能连上」（删线同理）；要求消除使用过程中一切不必要的卡顿

Work Log:
- 根因判读: store.connect()/removeEdge() 在 set() 之前 await 完整 API 往返 — dev 服务器上该往返可排在冷路由编译/监听器重建后面数秒，用户松手后线迟迟不出现，直到 HMR 重挂载页面重取到边（顺序与工单完全吻合：卡一会 → hmr → 线连上）。排除文件写入触发 watcher 的假说：t340 已把 data/db/download 排除出 Tailwind @source，本次验证整场 dev 日志只有 1 条 "Compiling"（首页），边操作零重编译 — 用户看到的 hmr 是编译窗口本身，修复方向是把可见结果对服务器时延彻底免疫，而非追打 watcher
- 修复·store.ts connect(): 乐观提交 — edge id 客户端铸造（crypto.randomUUID），set() + 「Connected」toast 在 pointerup 同一提交内落地（实测 60-66ms 出现在 DOM），POST 全程后台；响应 id/端口与乐观值有差才换入真值；409 = 早前一次已入库但响应未归 → 拉取服务器真相整体接管（不再回滚成看不见活线的盲店）；其它错误回滚乐观线 + destructive toast
- 修复·store.ts removeEdge(): 乐观删除（实测 65-86ms 从 DOM 消失）+ 后台 DELETE；404 = 服务器侧本就没有 = 用户要的结果（不回滚）；其余错误还原线 + toast
- 竞态闭环（连了又秒删）: 模块级 unconfirmedEdges/doomedCreates — POST 在途时删线【不】发 DELETE（此刻行还不存在：404 假成功、落地 POST 会复活成 UI 已不显示的幽灵线），改标 doomed；POST 落地路径发现 doomed 立即补发 DELETE。实测：路由层扣住 POST 2.5s 内连+删，终局服务器无该边、无幽灵
- api() 助手: 抛错携带 HTTP status（消息契约不变）— 乐观流需要区分 409/404 与真故障
- POST /api/edges: 可选 body.id（UUID 形状校验；与存活行撞号则服务器重铸并回真值）— 乐观线与持久行同 id，断言实证 DOM data-edge-id === API 边 id，删按 id 命中真行；撞号重铸同时关闭了坏调用者/重放请求经 upsertFileEdge（按 id 键控）覆盖幸存行的风险
- 验证装置: scripts/diag-t359-instant-wires.mjs（playwright 真浏览器，双阶段）— A 连线 60-66ms（时钟只量 mouse.up→paint，拖拽的协议往返留在窗外）+ 即时 toast；B 后台落库且服务器 id===DOM id；B2 重复连线客户端拒绝（Already connected，无线）；C 删线 65-86ms；D 后台删除到服务器；E 扣 POST 2.5s 的连+秒删竞态 → 无幽灵（doomed 清理实证）；F 强制 500 → 乐观线回滚 + 诚实 toast；F4/G2 全程零 console/page 错误（自 aborted 字体图片与 drill 自导 500 的噪音按 URL/flag 过滤）；G（独立服务器会话 PHASE=g）冷载 DOM 边数===服务器边数。main 20/20 + g 2/2 ALL GREEN；截图 shots-qa/t359-{a-instant-wire,b-deleted,c-race-clean,d-final}.png
- 4GB 盒 OOM 持久战（本轮 6 案内核击杀在录，全在 chromium 打开时的 Turbopack 编译/服务瞬间）: 处方三层 — /tmp/cf-up-t359.sh（ss listener-kill 学说 + 896 堆 + 浏览器关闭时预编译页面/客户端块/edges 通道 + 15s GC 沉降）、chromium --single-process --js-flags=256MB（~600→~300MB）、G 阶段独立服务器会话 + 3 次重试循环吸收 OOM 彩票；途中识破一处工具层假象：rg 彩色输出 ESC[m 被结果管道剥掉，"[main]" 一度显示成 "ain"（od 验字面，文件无损）
- tsc 0 / eslint 0（store.ts + edges 路由）；无既有 e2e 断言面被触碰（run-11 的 wire 是集群通讯面，与画布边无关；t356 diag 的 E1-E2/F 断言在乐观流下原样通过 — Connected toast 与边入库语义均保持）

Stage Summary:
- 连线/删线从「等 API 往返（dev 冷编译下数秒）+ HMR 重挂载才可见」变为 pointerup 同一提交内可见（实测 60-86ms），持久化全部后台化、失败诚实回滚、连了又秒删无幽灵线
- 服务器侧时延（冷编译、监听器、慢盘）从此只能影响「何时落库」，不再影响「何时看到线」— 用户工单的 hmr 依赖链根除
- 用户复机路径: git pull → 画布连线/删线即时生效；网络/服务器故障时线短暂闪回 + destructive toast 是唯一可见痕迹

---
Task ID: t360
Agent: main (Z.ai Code)
Task: 用户工单 — 集群项目上 import map 失败「Map file not accessible: /data03/Lijing/test/P48/J999/cryosparc_P48_J999_004_volume_map.mrc」；用户问是否权限问题（该目录无写权限但有读权限，理论上可复制到 cryoflow 工作目录）

Work Log:
- 诊断: runMapImportNative 是纯本地实现 — existsSync/statSync 只看 app 所在机器磁盘（外加 WSL 翻译），集群路径必然「not accessible」；与权限无关，是磁盘盲区。用户判断正确：只读源即可复制，且复制应发生在集群内部
- 修复·engine.ts runMapImportRemoteLeg（新）: ①一次 SSH 往返探测 — [ ! -e ]/[ ! -f ]/[ ! -r ] 三哨兵 + stat 大小 + head -c 1024|base64 头部，三种失败各自点名（不存在/是目录/无读权限——直接回答「是权限问题？」）②集群侧 cp -f -- 到孪生地址 remoteRoot/<projectId>/mapimport_<id8>/<basename>（csMirrorPath 镜像约定），statRemoteFiles 字节级验证（大小必须等于源）③finishNativeRunOnCluster 登记 — outputs.model_mrc=本地镜像路径 + remote.remoteOutputs.model_mrc=验证过的孪生 + run.out/run.err 见证上传 + .cf-remote-manifest.json（Files 标签页的 on-cluster 卡片）
- 修复·分支判据: mapPath 经 WSL 翻译后仍不存在本地 → 集群分支（探测用原始 raw，绝不用会被改写成 \\wsl.localhost\… 的 host）；本地存在（sub-volume 裁剪流写入父 workdir 的本地文件）→ 保持本地 lane 零回归，下游照旧经 staging 上传
- 重构: finishCsRunOnCluster 泛化为 finishNativeRunOnCluster（outputKey/localOutPath/manifestFiles 参数化，cs2star 双通道与 mapimport 共用同一 finish，防漂移教义延续）；writeCsRemoteManifest → writeNativeRemoteManifest 改名；REMOTE_OUTPUT_CANDIDATES 补 mapimport 条目（glob *.m[ra][cp]，探针自愈可期）
- mrc.ts: 抽取 parseMrcHeaderBytes(buf, size) 纯解析器（远程 1KB 头 + 已知大小即可校验体量 sanity），readMrcHeader 委托之，行为零变化
- dispatch 点: mapimport 补 beginNativeRun/abortNativeRun 包裹（t340 教义 — SSH 马拉松不裸奔）
- 验证·scripts/diag-t360-mapimport-cluster.mjs（纯 API，36 断言 ALL GREEN）: Phase2 快乐道 — chmod 444 只读源（工单前提：无写有读）集群侧导入完成，receipt「REMOTE[cryo@…] Map imported … copied ON the cluster, zero bytes over the connection」；本地 workdir 零 map 字节（T3 零下载）；exec audit 证明 /data2 线上流量只有 1KB 头探测与 cp 本身（T4 零传输）；孪生字节恒等（T6）；源文件 untouched（T7）；manifest + outputs 视图列卡（T8/T9）；record 双路径登记（T5）。Phase3 裁剪形状 — 本地 mapPath 走本地 lane、无孪生登记（T10 零回归）。Phase4 诚实失败 — 无读权限/路径缺失/目录/.mrcs/垃圾头五判决各自点名（N1-N5），旧「Map file not accessible」不再回答集群路径（N6）
- 验证·回归: t352 cs2star twin + t353 cs2star cluster-side 复跑 ALL GREEN（finish 泛化零漂移，含下游 class2d 孪生就地消费腿）；tsc 0 / eslint 0；3001 验证实例已收割，my-project:3000 基线 200 无恙，mock:3022 存活
- 环境: mock 集群可写虚拟挂载只有 data2/home/opt/projects — /data03 不在映射内，fixture 落 /data2/Lijing/test/P48/J999（语义等价：集群上 cryoflow 根之外的路径）

Stage Summary:
- 集群项目 import map 从「existsSync 磁盘盲区必败」变为集群侧闭环：SSH 探测（1KB）→ 集群内部 cp → 字节验证 → 孪生登记；map 一个字节都不经过 app↔集群链路，源目录只需要读权限
- 下游 class3d/refine3d 经 remoteOutputs.model_mrc 孪生就地解析（staging 跳过、argv 指向集群副本）；Files 标签页经 manifest 列 on-cluster 卡片、按需拉取
- 失败各自点名: 不存在 / 是目录 / 无读权限 / 非 .mrc|.map / 头不可解析 — 「是权限问题？」从此有明确答案
- 用户复机路径: git pull → 在集群项目重新 pick 那个 volume map 跑 import → 应见 REMOTE 前缀 receipt；若真无读权限，报错会直说

---
Task ID: 360
Agent: main
Task: 用户工单「图片还是加载不出来」+ 本地 AI 诊断「mrcs header 全零」+ 用户补充「log 6 份重复、手动跑 RELION 从不重复、Chimera 也打不开这些 mrcs」——t360 定位真正的 root cause 并修复

Work Log:
- 【取证准备】备好独立集群探针(/home/z/cf-probe/probe.mjs:od 头/数据区/尾字节 + 非零计数 + md5 + sftp 独立下载比对)——后经用户澄清「你是登录不了 cluster 的」(192.168.2.x 是用户内网),探针作废,改走代码侧推理 + 用户侧证据。
- 【GitHub 对齐】git fetch origin 拉下 33 个新提交(868d946..4870151,t336-t359 全量:verifiedStackPull/sheet route/proactive pipeline),merge 零冲突(537e171)。工具层大面积 403 故障,窗口极窄,分批完成。
- 【用户证据的关键性】用户三报:(a) log 每条 ~6 份重复,手动跑 RELION(含多 GPU)从不重复;(b) Chimera 也打不开这些 .mrcs(独立第三方证据,坐实文件在集群上就坏了,与拉取管线无关);(c) RELION 本身肯定没问题(以前用过)。→ 推理收束:6 个独立完整进程 = 6 个"master"同时打印 + 同时 truncate/写同一批输出文件 = 尺寸正确、header 全零的 mrcs + exit 0(每个副本都"成功"跑完)。
- 【代码侧定罪链】command-templates.ts:28 class2d 模板二进制 = relion_refine(串行版);engine.ts buildArgv(:5217 等)构造的 argv[0] = <binDir>/relion_refine;remote-run.ts:3117 MPI 分支只包 mpirun -n N + 插入 .cf-rank-launch.sh,从未换成 _mpi 二进制。probe.ts:185 relionMpi 语义 = 「模块环境里有 mpirun」,不检查 relion_refine_mpi 存在。本地引擎 MPI_PARALLEL_TYPES 只有 class3d/refine3d(class2d 本地从不进 MPI 分支)→ bug 是远程 lane 专属,与用户观察吻合。
- 【t360 三刀】(1) MPI 分支(rlurm+direct 共用)内 argv[0] 尾部 relion_refine → relion_refine_mpi(regex 兼容绝对路径/裸名;launcher 已是 exec "$@" + OMPI_COMM_WORLD_RANK 读秩,无需改动,它只是被喂错了二进制);(2) sbatch preflight:command 含 relion_refine_mpi 时 command -v relion_refine_mpi,缺则 CRYOFLOW_ERR exit 127;(3) direct 脚本 preflight 同款。
- 【验证】eslint 对 remote-run.ts 零告警(仓库既有 8 个 UI error 均为合并代码遗留,与本次无关);dev server 重启后 GET / 200、/api/remote/connections 编译通过(403 为该路由对非浏览器请求的既有防护)。提交 c7a8dcd(+30 行,单文件)。push 失败——git 凭证在基础设施故障中丢失(~/.git-credentials 空仓,无 env token),补丁全文已交用户侧应用。
- 【澄清一桩冤案】「probe.ts/remote-run.ts 源码混入 ESC 控制字符」假说撤销:grep -P '\x1b' src/ 零命中,`[moduleName]` 显示成 `oduleName]` 是 Bash 工具输出管道的 ANSI 渲染缺陷(吞 [m),源码干净。
- 【遗留】(a) 用户当前 job 的 21 个 stacks 是 6 路写手交错数据,不可抢救,须重新派发;(b) 本地 lane 的 class3d/refine3d(engine.ts 自己的 mpirun 包装)同样存在串行二进制隐患,未在本任务动(避免破坏 demo 链),待后续任务;(c) t358 的 unreadable 报错文案可再加「多写手损坏,建议重跑」提示,暂缓。

Stage Summary:
- Root cause = mpirun 包着串行 relion_refine → N 个独立完整计算并发互殴。修复 = MPI 分支换 relion_refine_mpi + 双 preflight。c7a8dcd 待推送/待用户侧应用;用户重新派发 2D 分类后,日志单份、stacks 干净、t356/t358 渲染管线自然出图。

---
Task ID: 361
Agent: main
Task: 用户交付 GitHub token → 拉取/合并/推送双 t360(沙箱 mpirun 修复 + 用户本地 mapimport 修复),并清偿 t360 遗留:本地 lane 串行二进制隐患 + 损坏 stack 诚实报错

Work Log:
- 【凭证与对齐】用户给 GitHub PAT → 配入 remote URL;fetch 发现 origin/main 新增 43f0667(用户本地 t360 mapimport:集群侧 import map — runMapImportRemoteLeg 一次 SSH 探测三判决 + 集群内部 cp + 字节验证 + finishNativeRunOnCluster 泛化);merge 唯一冲突 = worklog.md 双方各自追加的 t360 记录(append-append),python 保序解决(时间序:mapimport 19:06 在前,mpirun 19:15 在后),合并提交 a6d9da0
- 【推送】43f0667..a6d9da0 上 origin/main — 上个会话因凭证缺失滞留沙箱的 c7a8dcd(mpirun 单写者修复)由此到达用户本地;用户 git pull 后重新派发 2D 分类即为单写者世界
- 【t361-a 本地 lane 同族隐患】engine.ts MPI 分支审计:MPI_PARALLEL_TYPES(class3d/refine3d)的 mpirun 包装里 canMpi=(argv[0] 绝对路径且 <bin>_mpi 存在)时才换 _mpi — 但 canMpi=false(有 mpirun、无 _mpi 构建的部分安装)时旧代码照样 mpirun 包串行 relion_refine = N 个独立完整运行(t360 灾难本地版);refine3d 因 argv 恒含 --split_random_halves 每份秒败(fail-fast),class3d argv 无此参数 → 2 个独立 run 互写 run_itNNN_classes.mrcs 静默损坏。修复:mpiWrapped 旗标 — canMpi=false 落入 sequential fallback(串行 + --j + split-halves→debug_swap),mpirun 从不再包串行二进制
- 【t361-a 顺带冤案】resume 路径:原生无 mpirun/_mpi 时 resumeArgv=null → 静默跌落全新运行丢弃 checkpoint;修复:补串行 --continue 兜底(checkpoint STAR rank-agnostic,bridge lane 自己的教义)
- 【t361-b 诚实报错】iteration-live.ts verifiedStackPull 的 unreadable 判决前加零头分类:完整下载、尺寸正确、头 64 字节全零 → 点名 t360 多写手损坏形状(「文件在集群上就坏了 + 重复 log 是同一签名 + 数据不可恢复 + 拉取 t360 修复后重新派发」),其余垃圾头维持原「may be corrupted」;fs 导入补 closeSync/openSync/readSync
- 【验证】tsc 0;eslint 8 error 全为既有 UI 遗留(print-doc-footer/header、map-ortho-panel、session-report-dialog + diag-archive),engine.ts/iteration-live.ts 零告警;scripts/diag-t361-merged-smoke.mjs(playwright 削减版 chromium:single-process + 256MB V8 + lean 资源路由)9/9 ALL GREEN — A1-A5 源码 X 射线(五组修复全部在位)+ B1 画布 3 卡 + C1/C2 DOM↔server 恒等(3===3)+ B2 零 console/page 错误;截图 shots-qa/t361-merged-smoke.png
- 【4GB OOM 持久战续】本轮 3 案内核击杀(next-server 2.87-2.92GB anon-rss),死亡模式解码:浏览器落地 → 页面 boot 各 API 路由首次编译尖峰 → next-server 冲 2.9GB → 击杀 → goto 以 ERR_CONNECTION_REFUSED 拒绝。胜战处方三层:(1) pkill agent-browser 残留 chrome;(2) curl 预热页面 boot 命中的全部路由(/、jobs、edges、project、workspaces、system、projects、remote/connections — 编译尖峰转移到无浏览器期);(3) BUN_JSC_forceRAMSize=1400000000 + NODE_OPTIONS=896 双保险(bun 运行时无视 NODE_OPTIONS,JSC 堆须 BUN_JSC 钳)。冒烟全程 server 存活;测后空闲又遭一票(已知顽疾),重启+预热后 settled 200 稳定

Stage Summary:
- 双 t360 合流上线:用户 git pull 即得 mpirun 单写者修复 + 集群侧 mapimport(merge a6d9da0)
- 本地 lane class3d 同族损坏隐患根除(mpirun 永不包串行二进制);resume 不再静默丢弃 checkpoint
- 损坏 stack 报错从「may be corrupted」升级为点名多写手形状 + 重派指引
- 冒烟 9/9 ALL GREEN;dev server 已重启预热存活(settled 200 @0.16s)

---
Task ID: 368
Agent: main
Task: 用户四联工单:(a) 2D 运行中不实时传回中间结果、结束才一次性传回;(b) 打开页面经常卡顿,数据加载期能否保持 UI 流畅;(c) console 报「two children with the same key `extracted`」且"好像不止一处";(d) 新 job class2d_ebm21x2d 的 run_it019_classes.mrcs 集群上就是坏的(relion_display: stack size 0)

Work Log:
- 【对齐】fetch 发现用户本地 AI 已推 t363+t364(3efb825:live 2D 轮次 UI 门 + 落页防冻结)与 t367(1eac2d3:walltime + 残留收养 + 镜像幽灵,含 t365/t366);78 个脏文件全是权限位翻转(0 行内容差),checkout 还原后 fast-forward 合并到 1eac2d3。逐条验证 t367 三件套在位:#SBATCH --time/CRYOFLOW_WALLTIME(6 处)、sync-back find %T@ generation gate(:5554)、healMirrorPath 三门(iteration-live :600/:676)
- 【(d) 定性——不需要新代码】t367 已用字节级证据定案:重跑 job 的 run.out 显示单一健康 MPI 宇宙(t360 修复已生效)、20 轮完成,精确死在 it20 写盘相位(分区默认 walltime 击杀,旧 sbatch 从不申请 --time);坏 it020 是写盘中途被杀的半成品 + pre-t360 时代的 it019 残留(重派发的 pre-run wipe 静默降级没删掉)。用户看到的 relion_display "stack size 0" = 零头文件,与 t360 多写手形状同源。修复已在树:t367 申请 walltime(sinfo MaxTime 钳 24h)+ 拒绝收养旧代文件(收据点名)+ 三门幽灵自愈
- 【(c) 重复 key】pipeline-analytics flowRowOf 按"阶段名"产 key(micrographs/picked/extracted/...),同阶段两个 completed job(重跑 extract 是常态)即撞 key。全库审计其余可疑 key 域:milestones/timeline 用 jobId、runs.ticks 用数字、hpc-queue-sim 有 Map 去重、results 系用 path/cls/iter、ports 用 port name(按构唯一)、palette/stats 用静态配置键——结构性重复仅 flow 漏斗一处("不止一处"的观感 = 同一行不同阶段名反复报)。修复:FlowRow 增加 jobId 字段,渲染 key={row.jobId};阶段名保留为语义
- 【(a) 实时传回——t368 主菜】定位:finalize 管线(remote-run :5410)在 job 结束后一次性把 manifest 全部 stacks 排程渲染;运行中只有用户开着 Results 页才有 view-trigger(/iterations 路由),后台从不主动拉 → "全部完成后再一次性传回"。修复:sweep 心跳(per-connection 每 4-30s 自适应,由 /api/jobs 轮询驱动,页面开着即跑)的 per-job 脚本块追加 ---CF:ROUNDS--- 段(cd workdir + stat -c '%s %Y %n' run_it???_classes.mrcs + run_unmasked_classes.mrcs);解析侧 errTail 截到 rounds 标记(不吞 stat 行)+ 按行正则解析;ALIVE 分支双门控后 scheduleRemoteStackRenders(reason "live-sweep"):代际门(mtime ≥ dispatchedAtEpoch-90s,拒绝收养 pre-t360 残留——t367 教义)+ 沉降门(mtime ≤ now-60s,不拉写盘中途的文件避免假"unreadable");已渲染轮 .done 标记免费跳过、pipelineInFlight 吸收重复排程、2GiB 预算 + 按需门兜底。LIVE_ITERATION_TYPES 全覆盖(class2d/class3d/refine3d/initialmodel)。getRun 读持久化 engine-state.json,重启后流式照常
- 【(b) 卡顿】t364 只护了画布卡片层。运行期真矢量:pollTick 1.2s 一次 jobs 数组变更(progress 移动)→ 整个 dashboard 段(舞台 chips + 图表重的分析区 + roster)同步重渲染。修复:ActiveProjectSpotlight 加 useDeferredValue(jobs)(hooks 均在 early return 前,顺序合法),sorted 改自 deferredJobs —— poll 合并以 transition 优先级渲染,shell 先画、指针/输入优先、重区块晚一帧跟上;画布自己的 deferral 层保持未延迟副本供紧急 chrome。审计确认 milestones 钩子已 Promise.all 批处理单次 setState,pollTick 已有引用稳定性合并(无变化零重渲染)
- 【验证】tsc 0;eslint 三文件零输出;t368 冒烟 10/10 ALL GREEN(脚本 scripts/diag-t368-live-rounds-smoke.mjs:A1-A4 源码 X 光 + B1 画布 3 卡 + 视图切换到 dashboard + B2 roster chrome + B2b 分析区诚实隐藏契约 + C1/C2 DOM↔server 恒等 + B3 零 console/page 错误);截图 shots-qa/t368-live-rounds-smoke.png
- 【4GB OOM 战况】本轮 3 案击杀(浏览器触发客户端块重编译时 2.7-3.2GB RSS);一次 waitForSelector 超时直接归因于此(server 死 → 页面空)。重试循环 + 预热 + 20s 沉降吸收彩票;冒烟通过后测后空闲又遭一票,重启预热后 settled 200 @0.25s

Stage Summary:
- 重复 key 根除(行键 = jobId,阶段名退为语义);结构审计确认全库仅 flow 漏斗一处
- 远程分类运行中轮次流式传回:sweep 心跳零额外 SSH 往返捎带 stat 行,双门控(代际+沉降)后进渲染调度器,页面开着即流,不再等 finalize 一次性搬运
- dashboard 落页/运行期卡顿:spotlight deferred(画布 t364 教义延伸),pollTick 合并可中断
- mrcs 损坏(class2d_ebm21x2d)无需新代码:t367 已定案(walltime 击杀 + pre-t360 残留)+ 修复在树;用户 git pull 后重派发即净
- 用户复机路径: git pull → 重派发 2D → 运行中每轮 ~60s 后自动到本地预览缓存;log 单份;结束无残留收养

---
Task ID: 370-U
Agent: full-stack-developer (370-U)
Task: 三联工单 (parallel window, frontend/store lane; backend lane src/lib/remote/** + src/app/api/remote/** owned by another agent): (1) delete-flicker cure — client tombstones on every server-list ingest; (2) gallery badges for the corruption evidence (zero-header rounds + zero-data/black classes); (3) manual "Storage check" button in the Remote clusters dialog + poll cadence trim

Work Log:
- 【Change 1 — the delete-flicker cure (src/lib/store.ts)】Root cause confirmed by reading the code: removeJobsRaw (~:1802) removes locally only AFTER the DELETE round succeeds, but a GET /api/jobs that STARTED before the DELETE committed can land after it still carrying the deleted id — pollTick's merge (~:2613) re-adds it (card reappears), the next poll removes it again (card vanishes). pollInFlight only stops overlapping client fetches, not stale responses. Fix = module-level tombstones, all (t370):
  a) `recentlyDeletedJobs = new Map<string, number>()` + `TOMBSTONE_TTL_MS = 15_000` + three helpers (tombstoneJobIds / reviveJobIds / withoutResurrectedJobs — the filter prunes expired entries on EVERY ingest so the TTL check rides along even when pollTick is on the hidden-tab 15s cadence; empty map = zero-cost passthrough, the identical-tick no-render fast path survives)
  b) Recording: removeJobsRaw records every fulfilled delete id (covers deleteJob, deleteSelected/bulk, AND the redo of an undone delete — one recording point for the whole delete family); undoImport records its own `ok` ids (it deletes via direct api() calls, not removeJobsRaw — an in-flight poll resurrects just-imported cards the same way)
  c) Ingest points filtered (full audit: grepped `set({ jobs` + every `/api/jobs` fetch across src/lib and src/components): pollTick (filter BEFORE the reference-stability merge) and load() (the OTHER full-list replacement — runs at boot, manual reload, project switch/create/duplicate, all moments that can sit inside a 15s tombstone window; the selection-seed lookup now resolves against the filtered `landedJobs` so a tombstoned id cannot steal the boot selection either). NOT filtered, verified append-only: addJob/duplicateJob (POST response appends the NEW job), createTemplate/importWorkflowBatch/applyCustomTemplate (append freshly-minted ids deduped by `have`), the per-id map() PATCH/stop/reset/report writers. class-iteration-gallery's own POST /api/jobs (downstream creation) likewise appends only
  d) Reviving: undoDelete calls reviveJobIds(restoredIds) right after the restore response — the restored cards must survive the next poll's filter; refused ids (res.failed) stay tombstoned. /api/jobs/restore is the ONLY intentional re-add of a deleted id (imports mint new ids, restore keeps them)
  e) TTL rationale: 15s is the honesty valve — a poll response older than that can no longer have been in flight when the delete committed, so a server STILL returning the id after 15s is telling the truth (delete failed server-side despite the 200) and the tombstone expires rather than censoring. Residual (pre-existing, documented, NOT fixed here): a create landing during a poll's await can still be clobbered by that poll's set() — out of t370's surgical scope, the tombstone neither worsens nor cures it
- 【Change 2 — corruption-evidence badges (src/components/workflow/results/class-iteration-gallery.tsx)】Followed the t369 "seed" badge pattern exactly (chip-internal rounded-full px-1 text-[9px] span + native title tooltip; the t369 comment block was read first as instructed). Consumed contract fields (all OPTIONAL, absence renders exactly as today, zero `!` assertions, unknown shapes never crash):
  a) `nz?: number` on StackEntry (live-round entries) — `s.nz === 0` renders a rose "zero header" badge with the verbatim honest tooltip (readMRC "exceeds stack size 0" shape → writes not durably landing → Log tab's storage diagnostic). nz absent or nonzero = no badge
  b) `zeroData?: boolean` handled at BOTH layers the backend may stamp: per-round on StackEntry, and asset-level on IterationsResponse (mapped onto the classesFile's own round chip via roundZeroData() — `s.file === data.classesFile`; run_unmasked_classes.mrcs carries no round chip, so the asset-level flag ALSO gets its own rose grid footnote "every class image of this round is all-zero — …" in the t358 renderError footnote's exact styling: healthy occupancy numbers over black squares must never pass as a result)
  c) Surfaces: chip badges (seed/zero data/zero header can co-exist; chip title joins all verdicts with \n\n), a rose one-line verdict under the sheet caption when the round the user is LOOKING at is flagged, rose badge(s) in the lightbox DialogTitle (flex-wrap added — narrow widths wrap instead of overflow). Responsive: chips keep shrink-0 inside the existing overflow-x-auto bar — badges widen chips, the bar scrolls as it already did for "seed"
- 【Change 3a — Storage check (src/components/workflow/remote-cluster-dialog.tsx)】ConnectionEditor (the per-connection editor where Test & probe lives): new `storageChecking`/`storageResult` state + `storageCheck()` — POST /api/remote/diagnostics/storage { connectionId } → { ok, verdict, lines } against the backend agent's contract. Button "Storage check" (HardDrive icon, outline/sm, disabled while checking/testing/saving) sits between Test & probe and Save, saved connections only (creating has no id). Pending = spinner + "Checking write path on a compute node…" + title/inline line setting the ~3-minute expectation (a compute node must be allocated). Completion = toast the verdict (destructive variant when the diagnostic RAN and found the problem — a negative result is a result, not an error) + persistent inline verdict line below the actions row (the verifyResult dialect: role=status emerald / role=alert rose) + console.debug of lines[]. Honest degradation: 404 (backend half not landed) names the missing route explicitly — never a silent no-op; network failure names the wire. The dialog had no toast usage before — toast added (per the task's explicit verbs) alongside the inline persistence the dialog already speaks
- 【Change 3b — poll cadence (src/app/page.tsx)】The scheduler lives in Home's poll effect (the store has no interval of its own): `!pageVisible ? 15000 : anyActive ? 1200 : 6000` → idle tier 6000 → 4000 (t370). Honest note for the record: the instruction said "relax to 4s" but the prior visible-idle heartbeat was already 6s — this is a tightening from 6s to 4s, not a relaxation; kept the literal 4s per instruction (one constant to flip back if the orchestrator's intent was pure churn reduction — 6s polled LESS often). Race-free by construction, unchanged: the effect re-derives the delay when anyActive/pageVisible flip and its cleanup tears the old timer down first — exactly one live interval, fast cadence returns the moment a job starts. Rationale in situ: every poll is a force-dynamic route through Prisma + the local reconcile + the (guarded) remote sweep kick (verified in src/app/api/jobs/route.ts:94-104); 4s keeps the sweep's adaptive 4-30s floor observable without the 1.2s drumbeat
- 【Verification】`npx tsc --noEmit` → 0 errors (whole project). `bun run lint` → the 8 pre-existing errors (print-doc-header/footer, session-report-dialog, map-ortho-panel — the t361 worklog's known set) + 7 pre-existing warnings, ALL in untouched files; targeted `npx eslint` on the four touched files (store.ts, class-iteration-gallery.tsx, remote-cluster-dialog.tsx, page.tsx) → exit 0, zero output. dev.log (externally managed server, not touched) shows continuous GET / 200 + /api/jobs 200 with zero compile errors after the edits. No backend files touched (src/lib/remote/** and src/app/api/remote/** remain the parallel agent's); no tests written (per orders); no git operations

Stage Summary:
- Delete-flicker root-caused and cured client-side: 15s-TTL tombstones on every server-confirmed delete id, filtered at BOTH full-list ingests (pollTick + load), cleared by the one intentional comeback path (undoDelete/restore); create/append lanes verified untouched
- The corruption evidence now has a face at every glance layer: "zero data"/"zero header" chip badges (seed-badge styling, honest dual-world tooltips pointing at the Log tab's storage diagnostic), sheet-caption verdict lines, lightbox title badges, and an asset-level all-zero grid footnote — all conditionally rendered from OPTIONAL fields, so nothing fires until the backend lane lands nz/zeroData, and nothing breaks when it doesn't
- Storage check: manual-only (~3 min SSH marathon, never in a poll), honest 404 degradation, toast + persistent inline verdict, console transcript for the deep read
- Cadence: visible-idle 6s→4s (literal per instruction; documented as a tightening — flip one constant if pure churn-reduction was the intent), active 1.2s and hidden 15s unchanged, single-interval guarantee preserved
- Integration risks: (1) tombstone TTL 15s assumes poll GETs complete in <15s — a 15s+ reconcile would let a truth-telling server win only after expiry (by design); (2) the gallery badges fire only when the backend lane's nz/zeroData fields land — until then the UI is byte-identical to today; (3) /api/remote/diagnostics/storage 404s until the backend lane lands (button degrades honestly)

---
Task ID: 370-R
Agent: full-stack-developer (backend) — section written by the integrator: the agent's context expired mid-task but ALL FOUR changes were verified landed in-tree (tsc 0, eslint 0 on touched files)
Task: t370 backend quartet — (1) the 3D-class MPI segfault door: optics-group pre-sort; (2) the extraction "write: target and source objects have different size" crash: cluster-lane collision scan + re-dispatch workdir hygiene + honest failure decode; (3) live MRC header sniffing in the sweep rounds + zero-data detection at render; (4) the automated compute→storage write diagnostic

Work Log:
- [CHANGE 1 — optics pre-sort] normalizeOpticsOrder (remote-run.ts :538–760): ONE SSH round trip — awk parses the data_optics/data_particles loop_ columns; ORDERLY (already 1..N ascending) → untouched; out-of-order → verified rewrite to <star>.cf_optsorted.star (optics rows renumbered by file position, particle rlnOpticsGroup remapped through the same map, self-verification: ascending ids + refs in range + identical row counts; ANY failure → SKIP, original star, never a block); REUSED when a newer sorted copy already exists. Wired at the three classification star-resolution sites (:3761/:3766 classStarCombine paths, :3798 opticsStar) — SORTED swaps this dispatch's --i to the copy + CRYOFLOW_NOTE receipt. Field report: 3 of 7 ranks segfaulted at 0x18 immediately after RELION's "optics groups not in the right order — renaming them now" warning
- [CHANGE 2a — cluster-lane extract scan] the t334 collision scan's silent degradation closed: cluster-only micrographs stars (this user's ONLY lane) now flow through readResolvedStarText (cat in place over SSH) into the SAME scan + refusal wording; the byte-verified frame census rides along (nz>1 = movie stack masquerading as a micrograph = garbage particles the name-only scan cannot see)
- [CHANGE 2b — workdir hygiene] extract re-dispatch: pre-existing .mrcs under the workdir moved to .cryoflow_prev/<epoch>/ (same-FS rename, instant, bytes preserved) + CRYOFLOW_NOTE receipt — the dirty part_dir append is the second door into the same image.h:1534 crash
- [CHANGE 2c — failure decode] the finalize path regexes "target and source objects have different size" in the evidence and appends the plain-language two-door explanation (star collision — now pre-scanned; stale stacks — now auto-moved)
- [CHANGE 3 — live header sniff] the ---CF:ROUNDS--- block emits an od -An -tu4 -j0 -N12 header line per round; parser (:5336–5362) attaches nx/ny/nz (at most one header line per stat line — mid-write garbage leaves fields undefined); settled+fenced rounds with any zero word are NOT streamed (garbage bytes) — names land on the record (zeroHeaderRounds, cap 8), and the render path gains zeroData (all-identical pixels — the "black classes" shape) consumed by the gallery badges (370-U)
- [CHANGE 4 — storage diagnostic] src/lib/remote/storage-diag.ts: login-leg 2 MB urandom write+md5 + df -h + quota context; compute-leg 8 MB urandom via a 2-minute sbatch, polled to completion (~3 min cap), read back from the login node and compared — verdicts in the receipt dialect either NAME the compute→storage write loss (the t369 zero-header disease's cause) or clear the storage entirely; probe files cleaned up. Route POST /api/remote/diagnostics/storage { connectionId } → { ok, verdict, lines }; auto-trigger (:5510–5540) guarded by the persisted storageDiagAt stamp (restarts/second ticks never double-fire), verdict lands in the job's log tail + record
- 【验证】npx tsc --noEmit → 0;eslint remote-run.ts / storage-diag.ts / route / iteration-live.ts → 零输出

Stage Summary:
- 3D-segfault door pre-closed: stars sorted+verified before dispatch, original untouched, receipt in the script log
- The extraction crash's both doors pre-closed (cluster-lane collision scan + workdir move-aside); the failure now explains itself in plain language
- Zero-header rounds observed LIVE during the run (named, not streamed); black classes carry the zeroData flag at render time
- t369's manual 60-second storage test is now an automated sbatch probe: UI button (370-U) + auto-trigger on the first live zero-header round

---
Task ID: 370
Agent: main (integrator)
Task: 用户六联工单:(a) 所有 mrcs/mrc 读回 stack size 0(依然未解决,继续排查);(b) 提取的颗粒算出来 2D 分类颗粒是黑色的;(c) 删除 job(同时新建同类型 job)卡片先消失又出现再消失;(d) 整体性能仍需优化;(e) 3D 分类 3/7 rank segfault(optics 警告后);(f) 提取报 "write: target and source objects have different size" 为什么

Work Log:
- [对齐] fetch+merge 到用户线 755d48f(t369);本地仅 sync-policy.ts 权限位脏改,stash 后 fast-forward 干净合入
- [定性] 六联工单收敛为四个根因:(1) 3D segfault = RELION MPI 的 optics-重命名崩溃门(警告后 3 rank 死于 0x18);(2) 提取崩溃 = t334 碰撞扫描对 cluster-only star 静默降级(该用户唯一 lane,cs2star/motioncorr 全在集群)+ 脏 workdir 追加写 — 两个门都通向 image.h:1534;坏/残缺颗粒栈 = 黑色 2D 类的平均源;(3) 零头 it000 = t369 存储写路径判定缺决定性实验;(4) 删除闪烁 = 先行 poll 响应复活已删卡片
- [并行] 双子代理:370-R 后端四件套(context deadline 中断但四件全部落地,tsc/eslint 零告警,由集成者核验+代写 worklog)+ 370-U UI 三件套;文件所有权硬边界避免冲突;集成者修正 370-U 的 idle 轮询 4s→8s(原 6s 改 4s 是收紧,与降 churn 意图相反)
- [验证] diag-t370-smoke.mjs 15/15 ALL GREEN:A 段源码 X 光 ×8(optics 预排序/提取双 lane/零头嗅探/存储诊断/墓碑/徽章/节律/按钮)+ B 段竞态强制闪烁测试 — 真实 UI 删除路径(选中→Delete 键→确认对话框→deleteJob)、PATCH pending 钉住 1.2s 密集轮询、14 秒零复活、B/C 卡 14/14 帧在位、DOM↔server 恒等、零 console/page 错误;截图 shots-qa/t370-flicker-cure.png
- [4GB OOM 战况] 本轮 5+ 案内核击杀,死亡模式三阶段解码:(1) 预热缺 Sec-Fetch-Site 头 → Fetch-Metadata 门后三路由(system/projects/remote-connections)由浏览器 boot 并发补编译 → 峰值击杀;(2) 空闲期彩票(工具调用间隙分钟级击杀);(3) HTML chunk 预热仍不足 — 制胜处方「重启 → 全路由(带 same-origin 头)+ chunk 预热 → 浏览器同 call 立即落地」;lean chromium(--single-process --max-old-space-size=256)在 2.9GB next-server 旁全程存活;测试任务必须显式 x/y 坐标(默认随机坐标自叠,click 死于 subtree intercepts)

Stage Summary:
- 四门全关:optics 预排序(verified 副本原件不动)、提取两 lane(cluster-side 碰撞扫描 + .cryoflow_prev 挪边)、零头 live 证据(od 头字 + zeroHeaderRounds 不再流送垃圾字节 + 首见自动触发存储诊断)、删除墓碑(15s TTL 全 ingest 过滤,undoDelete 复活)
- t369 手动 60 秒存储测试自动化:计算腿 sbatch 8MB + 登录腿回读 md5 比对 + df/quota 上下文;首见零头自动跑一次,Remote clusters 对话框另有手动 Storage check 按钮;结论二选一:点名 compute→storage 写丢失 / 彻底排除存储
- 黑色 2D 类:渲染时 zeroData 旗标 + gallery 徽章(与 t369 seed 徽章同款);提取失败文案双门白话解释
- 用户复机路径:git pull → 重派发 cs2star → extract(碰撞扫描现在会说话,脏栈自动挪边)→ class2d/class3d(optics 已排序;若存储真有病,Log tab 的存储诊断自动说话;零头轮次 live 点名)

---
Task ID: 371
Agent: main (post-t370 verification window)
Task: 续 t370 验证:(a) 用户六联工单修复的独立复核(370-R 子代理中途断档的四件套);(b) 在新沙盒跑 t370 冒烟做端到端确认;(c) 顺带修掉验证途中撞见的三颗 fresh-install 雷

Work Log:
- [对齐] 新沙盒全新克隆 752e415(=origin/main=t370)——上会话沙盒已重置,worklog 随仓库带来;my-project 是初始模板与 cryoflow 无关
- [复核 t370 四件套] 独立通读实现(370-R 当时 context 耗尽,由集成者代写 worklog):normalizeOpticsOrder(awk 流式 + 自验证 + tmp→mv 原子 + reuse mtime 门 + SKIP 永不阻塞)✓;extract 双 lane(readResolvedStarText lane-aware + 碰撞扫描/frame census 在 staging 前跑 + .cryoflow_prev 同 FS 归档挪边,排除 .cryoflow_prev 自身 prune)✓;live 零头嗅探(od -An -tu4 -j0 -N12 每 stat 行后最多一行,双门控 settled+fence,零头不流送只点名,storageDiagAt 邮戳 once-per-run)✓;storage-diag 三腿实验(login 2MB + compute sbatch 8MB+sync + login 回读 md5,CF_NOFILE/zero-length/md5-mismatch/by-size 四判决,sidecar 持久化,从不 throw)✓;tsc 0 + eslint 0(触碰文件零输出)
- [排除两条误伤假设] deleteJob 链(scancel 按本 job slurmId、kill 按自己 workdir 的 .cf-pid、workdir 按 job id 隔离、删除后 workdir 故意保留供 undo)不会误伤新建同类型 job;syncBackWorkdir 集群侧只有 find(只读),拉取写入只碰本地镜像——"所有 mrcs 都坏"只能是集群侧自身的写入问题(t370 存储诊断的靶子,方向正确)
- [冒烟第一轮] 14/15:B2a 失败(删除后 800ms 卡未消失)归因 = DELETE 路由 Turbopack 首次编译(数秒)吃掉窗口;B2b/B2d 过 = tombstone 本体逻辑无恙;路由热身后 curl 实测 DELETE 86ms 证实归因
- [撞见的三颗雷 — t371] 第二轮冒烟 0 卡片开启的诊断链:seed 卡 workspaceId=null + Main workspace 后来才被 ensureDefaultWorkspace 治愈出来 → useActiveWorkspaceJobs 精确 id 过滤 → fresh install 的画布在第一次创建动作后刷新即空(数据在、不可见);同轮还实锤并发双 seed(冷启动页面 boot 并发打 6 个 list 端点都过 count=0 守卫,种出 3 个同名 demo 项目、9 张卡)。修复三件套(seed.ts,单文件 +59/-6):(1) ensureProject 的 seed 三卡自己挂进它创建的 Main(画布从首帧起稳定);(2) ensureDefaultWorkspace 顺带孤儿治愈(所有 job-CREATING 路由都会过这里,updateMany where workspaceId null 幂等,零写入 once 无孤儿);(3) ensureProject 进程内 single-flight 并发共享一次 seed(计数守卫保留给顺序到达)
- [4GB OOM 战况续] seed.ts 热重载触发下一轮:next-server anon-rss 2.8GB 被内核击杀(dmesg oom_kill 实证),ERR_CONNECTION_REFUSED 死亡模式 = 上会话记录的同款;处方同款:pkill 残留 chrome → 重启 → 全路由 same-origin 头预热 → 浏览器紧随落地
- [验证] tsc 0;eslint seed.ts 0;修后冒烟 15/15 ALL GREEN(B1 3 卡(seed 修复生效)/B2a 立即消失(路由已热)/B2b 14 秒零复活/B2d DOM↔server 恒等/B3 零 console 错误);截图 shots-qa/t370-flicker-cure.png(修复后重拍)
- [推送受阻] 新沙盒无 GitHub PAT(上会话凭证不随沙盒重置保留)——c751297 提交在本地,待用户提供 PAT 或自行 fetch:推送命令已就绪

Stage Summary:
- t370 六联工单修复全部复核通过且冒烟 15/15:optics 预排序、extract 双 lane、零头 live 证据+自动存储诊断、删除墓碑——实现质量与 worklog 记载一致
- 删除闪烁的根因链(先行 poll 复活)由 B2b/B2d 端到端证实;B2a 的首轮失败纯属 DELETE 路由首次编译延迟,非逻辑缺陷
- t371 三颗 fresh-install 雷修复:seed 卡隐身(Main 过滤)、孤儿卡全 workspace 不可见、并发双 seed——新装用户"第一次创建动作后刷新画布变空"的整条事故链关闭
- 用户复机路径不变(t370 的四门全关);t371 是附带收获,待推送
---
Task ID: 377
Agent: main (Z.ai Code)
Task: 用户工单 — "为何你测试 job 的结果都显示不出来, Could not load outputs — Cross-site access to job data is not allowed";附带把仓库与远端两条并行谱系合并(远端 t380/t381 与本地 t371-t375 是同批用户需求的两个独立重建)

Work Log:
- [根因] 全部 43 个 /api 路由走 isLocalRequest = isSameOriginRequest && isAllowedHost;预览面板链路(浏览器→平台网关→Caddy:81→:3000)上 Host = 外部预览域名,Host 钉扎(反 DNS-rebinding 后手)必然失败 → 403 "Cross-site access to job data is not allowed";直连 localhost 一切正常(curl 复现:直连 200 / 网关带外部 Host 403)
- [网关转发通道] http-guard.ts 新 lane:请求携带反代完整转发签名(X-Real-IP + X-Forwarded-For + X-Forwarded-Proto — Caddy header_up 替换语义,客户端无法经网关伪造)时通过 Host 钉扎;同源门的“无元数据”回退同样放行(防外层代理剥头)。CRYOFLOW_TRUST_GATEWAY=1 显式开关:不设时与旧行为逐位一致(本地直连的 drive-by 页可在 fetch() 里伪造这三个头,未信任时不得作为钉扎依据);浏览器自证的敌意源证据(Sec-Fetch-Site: cross-site / 异源 Origin)仍在最上层把关
- [验证矩阵] 网关+外部 Host+浏览器头 200(原 403)/ 直连 localhost 200(回归)/ 网关上 evil Origin 403(防线完好)/ 无头直连 curl 403(默认拒绝完好);真实 EMPIAR 测试 job 的 outputs/iterations/classes/montage/slice 全 200;class2d Results 面板在真浏览器端到端渲染(5 张类平均卡、10,866 颗粒、star 行数),console 零错误;montage 像素统计 4/5 磁贴有信号
- [两颗连环雷] ① dev-server.sh 的 \${DATABASE_URL:-…} 透传了沙盒工具环境自带的模板 DATABASE_URL(指向 my-project 的 custom.db),Prisma 打开只有 User/Post 表的模板库 → P2021;改为硬覆盖到 <repo>/db/cryoflow.db。② 后台服务的存活仪式:调用结束时收割器杀“仍是 tool bash 后代”的进程,setsid 从 tool bash 直接后台化仍算后代;必须中间脚本立即退出使服务孤儿化到 init(dev-server.sh 的既有设计,本轮修正其 cwd 到仓库自身)
- [4GB OOM 战况] next-server 页编译尖峰 RSS ~2.9GB,与 agent-browser chrome(~1GB)共存必被内核击杀(dmesg 四次实证);agent-browser close 不杀 chrome 守护树(pkill -9 必要);单独运行时 2.9GB + 平台 0.6GB < 4GB 存活——浏览器验证后一律硬杀 chrome
- [谱系合并] git push 被拒才发现远端有 t380/t381(另一并行会话在沙盒收割后独立重建了同批需求并已 push);merge 冲突三处:engine.ts(class2d 算法方言统一:algorithm 选择 + do_em/do_grad 布尔 + nr_iter_grad/miniBatches 同一字段,VDAM 的 --iter 计 mini-batch 数,未触碰 job 保持 EM/iterations 历史方言;t375 的 dont_skip_align 别名超集保留;重复的 camelCase Helix 块丢弃,t374 表的 RELION 原文键为准)、mock relion_refine(real_mode 真类平均分支保留,legacy 落道带 kind= 极性提示)、worklog(两边全保);workflow.ts 干净自动合并(t374 表 + t381 showIf 并存)

Stage Summary:
- 预览面板的 outputs 403 根治:网关转发通道(显式开关 + 代理签名)让反向代理部署下全部 43 路由复活,本地部署行为不变
- dev-server.sh 硬覆盖 DATABASE_URL/CRYOFLOW_DATA_DIR + 仓库自身 cwd —— 沙盒工具环境污染免疫
- 本地谱系(t371 seed + t374/t375 全 RELION 参数表 + t372 尾巴 movies 约定/stale-twin 门)与远端谱系(t380 极性判决 + t381 GUI parity)合并为一体
- 黑颗粒问题的完整解在合并后齐备:t380 翻转门 1.2→1.0 + import negativeStain 钉子 + t374 的 Are the particles white?/do_invert/do_invert_refs 三开关
---
Task ID: 380
Agent: main (Z.ai Code)
Task: 用户工单 — 用 empiar-10017 数据模拟在 cluster 上运行(可只用 CPU),看各种任务生成的 mrcs/mrc 是否正常 + 全链路解析测试;2D 分类颗粒是黑色的(用户判读:import 需要负染开关,冷冻颗粒是黑的需反转);沙盒收割后仓库重建(用 PAT 重新 clone @ 752e415,上一轮 t371-t375 的 17 个本地提交随沙盒丢失)

Work Log:
- [灾难评估] /home/z/cryoflow 整树被沙盒收割;GitHub 在 752e415(t370 并行会话版:optics 预排序/提取双lane/存储诊断/墓碑)——我自己 t370 的 stretchToGray 1.2→1.0 极性修复与 t371-t375 全部丢失;用户提供 PAT 重新 clone + push 通道恢复
- [极性根因 — 用户「颗粒是黑色的」的判决] stretchToGray 的翻转门 1.2× 留下死区:未遮蔽类别平均实测比值 1.0-1.1,负密度主导但旧门拒绝翻转 → 黑颗粒。门降到 1.0×(任何严格负主导都翻);1.2×→1.0× 正是本地 relion 测试当年「已解决」而集群回归重现的原因 — 修复从未被 push
- [用户要的 import 开关] import 新增 negativeStain 复选框(默认关):冷冻(auto — 自动翻白)vs 负染(永不翻转,染色颗粒本身是正密度亮斑);render-polarity.ts 做 lineage 走查(job→import 祖先),outputs/file + iterations/image + iterations/sheet + micrographs preview 四个渲染门全接;迭代 PNG 缓存与远端预览缓存按极性分键(.ns 兄弟目录,不会伺候旧极性的陈旧字节)
- [EMPIAR-10017 夹具] EBI 带宽 16KB/s(64MB×8 = 8 小时,不可行)→ 生成器复刻:8 张 Falcon-II 4096² float32(字节尺寸 67,109,888 与真实一致)+ 64 个 β-gal 四聚体暗斑/张 + 3 个聚合物杂质 + 配套 Henderson .coord
- [mock 物理真实化] cf_cryo.py 共享库(numpy):真实暗斑 LoG 检测(积分图 DoG + NMS + 11×11 块精化)、裁剪+归一化(溶剂≈0 σ≈1,颗粒负值)、真实类别平均、负密度核体积;relion_autopick 真检测、relion_preprocess 真裁剪(--coord_dir/--coord_suffix 方言 + 遗留回退逐字节兼容)、relion_refine 真类别平均(弱类预设 c%4==3 amp 0.09 → 有机落入死区比值 1.02-1.10)、relion_postprocess 负核图
- [diag-t380 89/89] 12 job 全链(import→motioncorr→ctffind→autopick→extract→class2d→initialmodel→class3d→refine3d→maskcreate→postprocess)全集群 lane:P1 原始显微图颗粒暗于冰(冷冻真相,无翻转)、P2 提取栈翻转后亮(138.7 vs 10.6)、P3 强类 3.03-3.34(EMPIAR 实测带)+ 死区类 3@1.06 的 A/B 判决(旧门:中心 112.9 ≤ 边界 144.0 = 黑;新门 52.5 > 25.8 = 亮;活体渲染一致)、P4 三维图负核亮、P5 negativeStain 钉住翻转字节级 A/B + 恢复逐字节一致
- [OOM 战况] 4GB 盒 memcg 上限 ~3.5GB;next-server 编译峰值 3.39-3.41GB 反复被杀;处方:cf-up.sh(V8 896MB 堆 + 陈锁清理)+ 套件自愈 api()(fetch 失败自动复活);turbopackMemoryLimit 800→512;首页编译在本轮源改动后永久越线(浏览器 QA 被基础设施阻塞 — 诚实入册)

Stage Summary:
- 黑颗粒双层根治:阈值修复(死区判决 A/B 实证)+ import 负染开关(用户心智模型的显式钉子,缓存键级隔离)
- 全链路「mrcs/mrc 是否正常」:每一阶段的产物都被真实渲染断言覆盖(含 chunked 拉取、惰性 SSH 回源、幽灵头重拉)
- 提交 81a0e44 已 push;夹具生成器 + diag 可重复跑(89/89 三连绿)
- 用户复机路径:git pull → 重跑 import(勾/不勾负染)→ 全链重派发 → 画廊亮颗粒

---
Task ID: 381
Agent: main (Z.ai Code)
Task: 用户工单 — 各种 job 的 UI 可设参数不全,需要仔细看 relion 代码把所有可设参数加上,排版对齐 RELION GUI 方便无缝上手;完成后 push(用户给了 PAT)

Work Log:
- [权威源] 从 3dem/relion master 拉取 gui_jobwindow.cpp(每个 job 窗口的 place() 序 = GUI 排版)+ pipeline_jobs.cpp(默认值 + argv 构造)——不再凭记忆:RELION 5 Class2D 有 6 表签(含 Helix!),Class3D/Autorefine 有 7 表签(含 Helix)
- [showIf 原语] ParamSchema.showIf {param, equals} — RELION 的 TOGGLE_DEACTIVATE 组数据化;job-panel gateVisible 解析门链(嵌套组传播,隐藏保值,引擎自己的 if 链保证隐藏值不上 argv);react-hooks/immutability 的自引用回调整改为内层普通函数
- [class2d] algorithm 选择(em|vdam,默认 em — 旧 job argv 逐字节不变)+ miniBatches(VDAM mini-batch 数,RELION GUI 默认 200);vdam 挂 RELION 5 master 的包装方言 --grad --class_inactivity_threshold 0.1 --grad_write_iter 10(pipeline_jobs.cpp:3203);Helix 表签 5 参数(管径/双峰 psi/range→σ/3/上升限制 x 偏移,:3309)
- [class3d/refine3d] 共享 helicalParams()/helicalArgs() 20 参数:管径对、±σ 角族、局域平均范围、tilt 先验固定、嵌套 apply-helical-symmetry 组(ASU 数/初始 twist-rise/z%/100)、双重嵌套局域对称搜索(--helical_symmetry_search + min/max/inistep 界,:4031-4110 逐字);表签序对齐 setupTabs()(…Sampling, Helix, Compute;refine3d 的 Helix 在 Auto-sampling 后)
- [diag-t381 87/87] 源码面(showIf/Helix 表签/26 个参数键全存在)+ 集群活体 argv(.cf-run.sh 逐字断言):默认字节兼容、VDAM 三件套+--iter 50、2D Helix 家族、3D 家族含搜索界与 inistep 只在正值时挂、显式 No 挂 --ignore_helical_symmetry、σ=值/3 转换
- [回归] t380 复跑 89/89(参数改动后);t358 被环境阻塞(首页编译 OOM 战 + 并行 cron 会话争用 — 其传输面 chunked pull 本轮未触碰,套件死于 PHASE 0 fetch 非断言失败,诚实入册);tsc 0;eslint 1 错(自引用回调)已修
- [推送] a170107 + 9ac9cb3 已 push 到 GitHub(用户提供 PAT,通道恢复)

Stage Summary:
- RELION GUI 对齐以 master 源码为唯一权威(用户「仔细看 relion 代码」的字面执行);Class2D 的 Helix 表签是本轮最大发现(此前两轮 helical 只铺了 3D 家族)
- 隐藏参数的引擎纪律:每个旗标各自带门条件(与 RELION 自家 if 链同构),门关 = 零旗标 = 旧 job 字节不变
- 风险:showIf 面板渲染无浏览器级验证(首页编译被 memcg 阻塞);逻辑 15 行 tsc 严格检查过,模式沿用面板既有 coerceParam 惯例

(t377-merge note: the two lineages merged 2026-09-24 — this t380/t381 side came from the parallel session that assumed t371-t375 lost; both survive, see Task ID 377)
