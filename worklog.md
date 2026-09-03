# CryoFlow — 项目交接工作日志

## 项目当前状态描述/判断

- **重要：环境已重置**。上一阶段的 RELION CryoSPARC 风格 UI 项目代码已全部丢失（沙箱重建），当前 `/home/z/my-project` 是全新 Next.js 16 脚手架（shadcn/ui 全组件集 + Prisma + next-themes + zustand 均已安装）。
- dev server 运行于 3000 端口（Turbopack 热更新，勿重启/勿 build）。
- Git：`main` 分支，2 个初始提交，工作区干净；已确认 GitHub token 有效（账号 **Jing0715-fer**，api.github.com 可达）。
- 本阶段用户需求：**① 构建浅色主题优先的完整 UI；② 完成后新建 GitHub 仓库并 push**。

## 当前目标/已完成的修改/验证结果

### Task 1（已完成）主题基础设施
- `src/app/globals.css`：全新「Cryo Ice 浅色主题」（默认 light：冷调纸白 + cryo-teal 主色 oklch(0.615 0.108 186)）与「Deep Ice 深色主题」双调色板；含画布点阵网格 `.canvas-grid`、卡片分层阴影 `.card-lift`、连线流动动画 `.edge-flow`、进度条 shimmer、自定义细滚动条、端口 hover 缩放等工具类。
- `src/components/theme-provider.tsx`：next-themes 封装（attribute="class", defaultTheme="light", enableSystem）。
- `src/app/layout.tsx`：接入 ThemeProvider + Toaster，metadata 更新为 "CryoFlow — Cryo-EM Workflow Builder"。
- `prisma/schema.prisma`：Project / Job / Edge 三模型（Job 含 x,y 坐标、status、progress、params JSON 字符串、startedAt/duration 模拟运行；Edge 有 @@unique([fromJobId,toJobId]) 与级联删除）；已 `db:push` 成功。
- `.gitignore`：追加 `/db/*.db`、`/agent-ctx`（防止推送数据库与代理产物）。

### 产品定义（供后续任务遵循）
**CryoFlow**：RELION 风格单颗粒 cryo-EM 工作流构建器，单页应用：
- 顶栏：品牌、项目名、统计 chips（作业总数/运行中/已完成）、主题切换（Sun/Moon）、GitHub 链接
- 左侧栏：作业类型调色板（按分类分组：Import/Motion/CTF/Picking/Extract/2D/3D/Refine/PostProcess/Mask），点击添加到画布
- 中央画布：作业卡片（绝对定位、可拖拽、端口在左右边缘）、SVG 贝塞尔连线、点击输出端口→点击输入端口建边、缩放
- 右侧面板：选中作业详情 + 参数表单（按类型 schema 渲染）+ Run/删除
- 运行模拟：服务端时间驱动（startedAt + durationMs → GET 时推导 progress/status），前端轮询
- 底部粘性页脚；移动端响应式（侧栏变抽屉、面板变 Sheet）
- 默认浅色主题（本次需求核心），深色可切换且持久化

## 未解决问题或风险，建议下一阶段优先事项

1. **Task 2（进行中）**：full-stack-developer 子代理构建应用主体（见其工作记录）
2. Task 3：agent-browser 全链路 QA（主题切换无闪烁、增删拖拽作业、连线、运行、响应式、粘性页脚）
3. Task 4：GitHub 建仓 + push（push 前必须 grep 确认无 token/敏感信息；`git config user.email` 为 z@container，push 前需设置正式提交身份）
4. 4GB 内存约束：tsc/浏览器/dev 并发有 OOM 风险，agent-browser 用完即 close

---
Task ID: 2
Agent: full-stack-developer
Task: Build the complete CryoFlow application (RELION-inspired cryo-EM workflow builder) on top of Task 1's theme/DB foundation — frontend first, then API routes, then wiring.

Work Log:
- **Shared libs (client/server safe)**
  - `src/lib/types.ts`: JobDTO / EdgeDTO / ProjectDTO / ParamSchema / JobTypeSpec (params typed `Record<string, number|string>`).
  - `src/lib/workflow.ts`: 10 job types in 7 groups (Data Import/Motion/CTF/Picking/Classification/Refinement/Post) with per-type lucide icon NAME string + light/dark color fragment map (teal/violet/amber/rose/orange/emerald/green/cyan/pink/slate — no indigo/blue), params schema (numbers with min/max/step/unit, selects with options), durations, result templates; constants CARD_W=220 / CARD_H=96 / CANVAS 2400×1600 / ZOOM 0.6–1.5; `resultFor()` deterministic string-hash pseudo results (counts 800–4200; refine/post → resolution 3.10–8.49 Å).
  - `src/lib/store.ts` (zustand): jobs/edges/project/selectedId/pendingFrom/zoom/loading/error + actions load/addJob (auto-position: selected → x+CARD_W+80/y+40, else cascade 6 per row)/moveJobCommit (optimistic)/saveJob/runJob/resetJob/deleteJob (clears selection + local edges)/connect (client DFS cycle check + duplicate check → server authoritative)/removeEdge/pollTick (toasts running→completed transitions). Uses standalone `toast()` from use-toast.
- **Components (`src/components/workflow/`)**: `icons.tsx` (switch-based `<TypeIcon>` — avoids the react-hooks/static-components lint error that a map-lookup variable component triggers), `theme-toggle.tsx` (mounted-guard, identical SSR markup), `help-popover.tsx`, `header.tsx` (Snowflake logo tile, project chip, Boxes/Loader2/CheckCircle2 stat chips hidden md/lg, help + theme + GitHub), `footer.tsx` (mt-auto sticky, jobs·edges + tech line), `palette.tsx` (search + grouped catalog, ghost buttons, works in sidebar AND mobile Sheet), `edges-layer.tsx` (SVG cubic beziers, subtle arrowhead triangles, hover thickening, running edges `.edge-flow` + var(--primary), 14px invisible hit strokes), `job-card.tsx` (fixed 220×96, clipped left color bar, 3 content rows: icon+name / status badge + type key / progress-with-shimmer | result | Ready-dot, input/output port dots with `.port-dot`, connect-mode pulse rings, pending source solid, pointer-capture drag with rAF transform and dx/zoom division, click-vs-drag suppression; exports StatusBadge + MiniProgress), `canvas.tsx` (scroll container + sizer + scaled `.canvas-grid` workspace, background-click cancel/deselect, connect hint chip, zoom controls incl. reset, empty + loading skeletons), `job-panel.tsx` (remount-per-job body: editable name, params form with number inputs + unit suffix spans + Selects, dirty-gated Save Parameters, Run/Re-run with Loader2, live progress + seconds-left, Reset, connection chips with remove X, AlertDialog delete, MousePointerClick empty state with tips).
- **`src/app/page.tsx`**: 'use client' single page — min-h-screen flex flex-col root, sticky header, 3-column main (palette lg:flex w-64 / canvas flex-1 / panel xl:flex w-80), mt-auto footer, mobile FAB → left Sheet palette, <xl job Sheet (mounted + matchMedia guard, no hydration flash), 1200ms polling only while any job running, ESC cancels connect → deselects.
- **Backend**: `src/lib/seed.ts` (server: `ensureProject()` idempotent seed of β-Galactosidase Tutorial + import(completed,100%)/motion(idle)/ctf(idle) at 140/480/820 × 200 with default params + 2 edges; toJob/toEdge/toProject DTO mappers with JSON params parsing; `reconcileRunning()` derives time-based progress and persists completion; ±15% duration jitter). Routes: GET /api/project; GET+POST /api/jobs (type validation 400, auto `${label} ${count+1}` naming); PATCH+DELETE /api/jobs/[id] (x/y, name trim 1–60, params merge sanitized against schema, status:'idle' reset; cascade delete); POST /api/jobs/[id]/run (re-jittered duration, startedAt=now); GET+POST /api/edges (400 self/missing, 409 duplicate, 400 cycle via recursive DFS, 201); DELETE /api/edges/[id]. All wrapped in try/catch → 500 {error}, `dynamic = "force-dynamic"`, Next 16 Promise params.

Verification:
- `bun run lint` → 0 errors (fixed the single `react-hooks/static-components` error by replacing variable-component icon lookups with a switch-based TypeIcon).
- `npx tsc --noEmit` → 0 errors in src/** (only pre-existing errors in examples/ and skills/ folders, untouched).
- curl: GET /api/project → seeded project JSON; GET /api/jobs → 3 jobs; POST job → 201; POST run → progress 0.4%→46.9%→completed "1535 particles picked"; POST edge cycle/duplicate/self → 400/409/400 with messages; PATCH move/name/params/reset → 200; DELETEs → {ok:true}.
- agent-browser smoke test (1440×900 + 390×844): no console/page errors; job select → panel; Run → live progress → completion toast; port-to-port connect creates edge; mouse drag commits PATCH (480,200 → 580,280); theme toggle flips html.dark and back; VLM review of light + dark screenshots confirms polished readable UI. Demo state restored to pristine seed afterwards.
- dev.log: GET / 200, no compile errors.

Deviations (minor, intentional):
- Spec said "5 groups" but the per-type group labels enumerate 7 (Data Import, Motion, CTF, Picking, Classification, Refinement, Post) — followed the explicit per-type groups.
- `icons.tsx` added as a dedicated client icon-map file (spec said "lucide icons imported only in a client iconMap"); implemented as a switch component instead of a Record<string, LucideIcon> lookup to satisfy the new react-hooks/static-components ESLint rule.
- JobDTO includes `startedAt: string | null` (spec's field list omitted it, but "all fields serialized" requires it; panel uses it only via duration math).
- Canvas card color bar sits inside an overflow-hidden inner card (wrapper div hosts the external ports) so the bar follows the rounded corners without clipping ports.
- Extra niceties beyond spec: completion toasts on poll transitions, connections "seconds left" estimate, canvas empty state, palette search no-match state.

Stage Summary: CryoFlow is fully functional end-to-end on `/`: seeded 3-job demo pipeline renders in the light-first Cryo Ice theme, jobs can be added (palette/FAB), dragged (persisted), connected (with cycle prevention client+server), parameterized, run (server-simulated progress via 1.2s polling) and deleted; responsive down to mobile (Sheet palette + Sheet details), dark mode fully tokenized; lint/tsc clean and no runtime errors. Ready for Task 3 (agent-browser QA pass) and Task 4 (GitHub repo + push).

---
Task ID: 3/4/5
Agent: main (Z.ai Code)
Task: 独立 QA（agent-browser + VLM 视觉审查）→ 修复缺陷 → GitHub 建仓推送 → cron 巡检设置

Work Log:
- agent-browser 全链路测试：浅色默认渲染 ✓、深/浅切换（html.dark 断言）✓、调色板添加作业 ✓、端口连线（Motion→2D Classification，API 确认 edge 创建）✓、运行模拟（2.5s→completed + result）✓、拖拽（(280,220)→(130,380) 精确持久化）✓、参数保存（boxSize 600 落库）✓、删除（级联删边 2→1）✓、移动端 FAB/双 Sheet ✓、无 console/page errors ✓
- VLM 视觉审查 3 轮，发现并修复两个真实缺陷：
  1. 种子布局裁切：卡片 x=140/480/820 在 1440px 视口下第三张被右面板遮住 → 改为 16/280/544（兼容 lg 768px 画布）；store 级联落点同步改为 3 列折行（16+(n%3)*284, 220+floor(n/3)*156）
  2. 粘性页脚失效：页面根容器 min-h-screen 但画布无高度约束 → docH 1692px 超视口 → 根容器改 h-dvh（应用外壳模式，画布内部滚动）；页脚加 iOS 安全区 pb-[max(0.5rem,env(safe-area-inset-bottom))] + min-h-9。修复后移动端/桌面端 footerBottom == innerHeight 精确贴底
- 数据库经 python sqlite3 清空重播种，验证新种子布局
- `bun run lint` 零错误；演示状态重置为纯净种子（Import completed + Motion/CTF idle + 2 edges）
- GitHub：git rm --cached .env 与 db/custom.db（初始提交曾误追踪）→ 新增 .env.example / README.md（完整功能说明+架构图+快速开始）/ LICENSE(MIT, 2026 Jing0715-fer) → git 身份设为 229732103+Jing0715-fer@users.noreply.github.com → API 建仓（token 验证账号 Jing0715-fer）→ 远程含 license_template 自动 LICENSE 提交故 force push 覆盖 → 推送前 grep 确认源码/worklog 无 token 字面量
- cron：创建 webDevReview 巡检 job 355015（fixed_rate 900s，含 push 指引与内存约束提示）
- agent-browser 用毕 close（4GB 内存约束）

Stage Summary:
- 仓库已上线：**https://github.com/Jing0715-fer/cryoflow**（public, MIT, main 分支, 110 文件，.env/db 均已排除）；remote origin 已含 token（仅存于本地 .git/config，可继续 push）
- CryoFlow 浅色优先 UI 全部 QA 通过：13 项交互 + 3 轮 VLM 视觉审查 + lint/tsc 零错误
- 用户两项需求（浅色主题 UI + GitHub 建仓推送）均已交付

未解决问题或风险，建议下一阶段优先事项（供 cron 巡检代理参考）：
1. 潜在增强项：真实 RELION CLI 执行引擎接入（run 端点已预留替换位）、作业运行日志面板、画布框选/多选、edge hover 高亮删除、撤销(undo)栈、键盘 Delete 删作业、URL 状态同步
2. 样式细节可继续打磨：画布 minimap、卡片右键上下文菜单、FSC/分辨率结果可视化图表（recharts 风格）
3. 运行时长 2.5–12s 为演示值，接入真实数据前勿改 PRAGMA；4GB 内存下避免 tsc+浏览器并发

---
Task ID: 6 (本轮用户需求)
Agent: main (Z.ai Code)
Task: EMPIAR-10017 真实数据全流程测试 + 真实 RELION 5 后端（全部 SPA+TOMO 算法）+ RELION5 环境检测（含 WSL）+ 拖拽连线跟随修复 + push GitHub

Work Log:
- 已修复拖拽连线不跟随：store 增加 dragLive 瞬态切片 {id,dx,dy}；job-card rAF 拖动时 setDragLive；edges-layer 订阅 dragLive 实时平移被拖卡片的端点；松手先清 dragLive 再乐观提交 x/y（同一 React 批次，无回跳）。验收待 agent-browser。
- EMPIAR-10017 数据已下载：/home/z/empiar-10017/micrographs/（6×MRC 4096×4096 float32 + 6×.coord 手选坐标，β-gal 教程数据，已预运动校正）
- 发现沙箱会回收工具调用拉起的后台进程（sleep 600 测试 25s 内被杀）→ RELION 构建改用「分块前台续跑」：/home/z/relion-build/chunk.sh（幂等、make 自动续、每块 ≤540s）
- **重大决策：不改 Prisma schema**（dev server 由系统 /start.sh 管理、不可自行重启）→ 引擎状态（pid/workdir/cmd/log）存 data/engine-state.json 文件；Project mode(spa/tomo)/engine(sim/relion) 也走文件。Job 表复用现有 status/progress/result/startedAt 字段
- RELION 5 权威作业清单已从 pipeline_jobs.h 提取：SPA 21 类（import, motioncorr, ctffind, manualpick, autopick, extract, select, class2d, initialmodel, class3d, refine3d, multibody, maskcreate, joinstar, subtract, postprocess, localres, polish, ctfrefine, dynamight, modelangelo）+ TOMO 11 类（tomo_import, tomo_aligntiltseries, tomo_tomograms, tomo_ctfrefine, tomo_exclude, tomo_polish, tomo_reconstruct, tomo_denoise, tomo_picks, tomo_extract）+ external = 32 类
- 源码参考文件已就位于 /home/z/relion-build/：pipeline_jobs.cpp(7559行, getCommands 权威命令构造)、pipeline_jobs.h、gui_jobwindow.cpp(参数 GUI 定义)、gui_mainwindow.cpp
- Task 7（full-stack 子代理）并行启动：作业目录扩至 32 类、RELION 检测模块、真实执行引擎、EMPIAR 项目种子、系统状态 UI
- RELION 构建分块推进（MPICH→FFTW→ctffind→RELION 5.0.1, CPU-only 2核）

构建进度追踪（chunk.sh status.txt）：
- [进行中] MPICH → FFTW → ctffind → RELION

Stage Summary:
- 本段为规划与基础设施阶段；真实管线测试在 RELION 构建完成后进行

---
Task ID: 7 (cont.)
Agent: main (Z.ai Code)
Task: RELION 5.0.1 从源码构建 + EMPIAR-10017 真实管线逐作业打通

Work Log:
- RELION 5.0.1 构建完成（约 15 分钟 make）：123 个二进制 → /home/z/relion-install/bin；`relion_refine --version` → "RELION version: 5.0.1-commit-d476e6" ✓；含全部 tomo 算法（relion_tomo_align/reconstruct/subtomo/refine_ctf 等）与 relion_mask_create/relion_particle_select（RELION 5 新命名）
- MPICH 4.2.3 ✓（hydra mpirun 可用；**--oversubscribe 是 OpenMPI 旗标，MPICH 不认 → 已从引擎移除**）；FFTW 3.3.10 ✓；ctffind 4.1.14（官方预编译 linux64 二进制，grigoriefflab.umassmed.edu）
- /api/system 检测全绿：found=true, source=known-path, binaries 全 present（含 WSL 探测分支，本机 wsl 不可用 → 正确报告）
- 关键架构修复（引擎路径学，三次迭代）：
  1. **项目根 CWD 模式**：所有真实 CLI 作业 spawn cwd = data/relion/<projectId>/（镜像 RELION pipeliner 从项目根启动）；ctffind_runner 的 symlink 机制 = (cwd + 星表相对路径) → (--o 目录 + 路径)，仅在此模式下自洽
  2. **import 星表**：光学组表第一列必须整数（rlnOpticsGroup=1，名字放 rlnOpticsGroupName 列）；微图表补 _rlnOpticsGroup 列（否则 ctffind 写 0 → 下游 obs_model 报 "optics groups not defined"）；路径用 "micrographs/X.mrc" 项目相对 + 项目根 symlink → EMPIAR 目录
  3. **坐标传递**：--coord_list 需要"微图→坐标文件"映射而非坐标本身 → manualpick native 额外写 <workdir>/micrographs/*.coord 纯文本（RELION readCoordinates 原生格式），extract 用 --coord_dir/--coord_suffix
  4. **RELION 5 输出扩展名**：class averages 是 .mrcs（非 .mrc）→ collectOutputs 模式已修；class2d 额外产出 particles_star（迭代 data.star）供下游链式使用
- ctffind wrapper 不搜 PATH → 引擎 env 注入 RELION_CTFFIND_EXECUTABLE=/home/z/relion-build/deps/ctffind/bin/ctffind
- 真实管线进展（经 App 自身 API 端到端）：
  - Import ✓（引擎原生，6 显微照片，1.77 Å/300kV/Cs2.7/Q0 0.1）
  - CtfFind ✓（真实 ctffind：DefocusU≈34890Å、FOM 0.063、maxres 6.04Å，EPS 图 + PDF 日志 + .ctf:mrc 诊断文件）
  - ManualPick ✓（Henderson 3476 坐标原生导入）
  - Extract ✓（relion_preprocess：box128→downsample64，3.54Å，真实 .mrcs 粒子栈 + 完整 CTF 列）
  - Select ✓（引擎原生子集：1000/3476）
  - Class2D ✓（mpirun -n 2 relion_refine，12 迭代 ×~15s，10 类 .mrcs）
  - InitialModel：运行中（VDAM 梯度优化 50 迭代）
- 引擎状态文件 data/engine-state.json 跨热重载存活 ✓

Stage Summary:
- RELION 5.0.1 全套二进制 + MPI + FFTW + ctffind 就绪；引擎路径学已按 RELION 源码逐行对齐（ctffind_runner.cpp/preprocessing.cpp/obs_model.cpp/filename.cpp 佐证）
- 真实管线 6/10 作业完成，剩 InitialModel(运行中)/Refine3D/MaskCreate/PostProcess

未解决问题或风险：
- InitialModel VDAM 输出文件名模式待实测（glob class*.mrcs?）；Refine3D 15 迭代非 auto（时长可控）
- countStarRows 计数含光学组行（显示 7/3477 微小偏差，纯展示）

---
Task ID: 6/7 (final)
Agent: main (Z.ai Code)
Task: EMPIAR-10017 真实全流程测试完成 + GitHub 推送

Work Log:
- **EMPIAR-10017 全流程 10/10 作业真实完成**（全部经 App 自身 API 端到端驱动）：
  1. Import ✓（引擎原生，6 真实显微照片，1.77 Å/300kV/Cs2.7/Q0 0.1，光学组整数修复）
  2. CtfFind ✓（真实 ctffind 4.1.14：DefocusU≈34890Å，FOM 0.063，maxres 6.04Å，EPS/PDF/ctf:mrc 诊断）
  3. ManualPick ✓（Henderson 3476 真实坐标，.coord 原生格式直读）
  4. Extract ✓（relion_preprocess box128→64，3.54Å，真实 .mrcs 栈+CTF 列）
  5. Select ✓（1000 子集）
  6. Class2D ✓（mpirun 12 迭代 10 类 .mrcs）
  7. InitialModel ✓（VDAM 50 梯度迭代，4 类初始模型）
  8. Refine3D ✓（3 MPI 进程金标准 FSC，D2 对称，15 迭代，run_it015_half1/2）
  9. MaskCreate ✓（relion_mask_create 软边掩膜）
  10. PostProcess ✓（**真实 FSC(0.143)=7.08 Å** + postprocess.mrc 锐化图 + FSC 曲线 + PDF 报告）
- 管线期间修复 4 个真实引擎缺陷：MPI 二进制切换（relion_refine_mpi）、refine3d 需 3 进程（leader+2 half-mapper）、RELION 5 half-map 命名（it<N>_halfX）、initialmodel/class2d 链式 particles_star 输出
- 版本探测正则修复（现显示 "RELION 5.0.1"）
- 拖拽连线实时跟随修复已验证：拖动中 4 条边路径同步更新（dragLive 瞬态切片）、松手持久化 (0,396)、无 console 错误
- 浏览器 QA：项目切换器（demo SIM / EMPIAR RELION 双项目）、RELION 状态弹层（版本/来源/路径/WSL/二进制矩阵）、参数面板、日志查看对话框（18.8KB 真实引擎日志）、运行中 Run 按钮禁用、VLM 确认 10 卡全 completed + 真实结果串
- lint + tsc 零错误
- /data/（1.7GB 真实输出）与 /tool-results/ 已 gitignore；token 扫描干净

Stage Summary:
- 用户四项需求全部交付：①EMPIAR-10017 真实数据全流程测试（FSC 7.08Å）②真实 RELION 5 后端（32 类 SPA+TOMO 目录，10 核心 CLI 全真跑，其余真命令模板+诚实失败）③RELION 5 环境检测含 WSL 分支（/api/system + 头部状态徽章）④拖拽连线实时跟随已修复验证
- 待办：git commit + push

未解决问题或风险（下阶段建议）：
- countStarRows 计数含表头行（7/3477 展示微偏）
- class2d 曾以 2 个串行副本跑完（mpirun+串行二进制）——输出有效但浪费；后续运行已用 _mpi
- refine3d 可加 auto_refine 参数路径（现 false 走固定 15 迭代）
- TOMO 作业有完整命令模板但无倾斜序列数据（运行会诚实失败——正确行为）
- 建议下阶段：结果可视化（FSC 曲线图/2D 类平均值画廊/3D 地图 MolStar）、多项目画布布局持久化

---
Task ID: 8 (main, foundation)
Agent: main (Z.ai Code)
Task: UI/UX 大改造 — 项目管理面板、目录折叠、按需右侧面板、RELION 精准参数、结果展示(MRC/STAR/FSC/Mol*)、多端口连线、避障路由、滚轮缩放+左键平移、拖拽建作业、一键整理

Work Log:
- 基础层全部重写完成（三个子代理 B/C/D 将并行构建其上）：
  - types.ts：ParamValue+boolean；ParamSchema.tab/advanced（RELION GUI 标签页+专家选项）；PortKind/PortSpec 多端口体系；JobTypeSpec.category/tabs/inputs/outputs；EdgeDTO.fromPort/toPort；ProjectDTO.stats
  - workflow.ts：32 作业全量端口定义（inputs/outputs 按 RELION pipeliner 节点类型 movies/micrographs/coords/particles/references2d/volume/halfmap/mask/star/tiltseries/tomograms）+ 13 个折叠分类（RELION job-browser 风格）+ RELION 真实标签页（I/O/Optimisation/Sampling/CTFFIND-4.1/autopicking/extract/Polish/Reconstruct…gui_jobwindow.cpp 原名）+ 真实参数补全（postprocess.adhocBfac 引擎实读、class2d tau2Fudge 等已在）；bool 参数类型转换（autoRefine/autoBfac/fitDefocus 等）；coerceParam/mergedParams/tabsFor/portsCompatible/defaultPorts/portY 辅助
  - store.ts：viewport{x,y,zoom} 平移缩放；pendingFrom{jobId,port} 端口级连线；paletteDrag 拖拽建作业状态；addJobAt(x,y)；applyLayout()（调 lib/layout.ts 拓扑分层 + POST /api/jobs/layout）；connect 携带端口；createProject/renameProject/deleteProject
  - lib/layout.ts：Kahn 分层 + 层内按上游序 + 4/列换行 + 垂直居中
  - lib/edge-ports.ts：data/edge-ports.json 端口 sidecar（Prisma schema 冻结决策延续）；DB 镜像策略保持引擎上游解析可用；GET 合并去重（file 边取代同 pair 旧 DB 边；旧边推断默认端口）
  - api/edges：POST 校验端口兼容（portsValid）+ 去重(含端口) + 环检测(union)；[id] DELETE 双层删除；jobs/layout 批量位置端点
  - 引擎/seed/参数 PATCH 类型放宽至 boolean（flag() 经 String() 天然兼容）
  - molstar 5.11.0 已安装；API 调研完成：createPluginUI + RawData→ParseCcp4→VolumeFromCcp4→VolumeRepresentation3D
- 子代理分工（文件所有权严格隔离，勿越界）：
  - 8-b canvas/job-card/edges-layer/palette/icons：变换视口(滚轮缩放+左键平移)、端口随卡拖动（重构进 transform 节点）、A* 避障连线、多端口圆圈、目录折叠+拖拽建作业、一键整理按钮
  - 8-c api/jobs/[id]/outputs/*、lib/mrc.ts、lib/starfile.ts、results/*：输出文件 API、MRC→PNG(sharp)、STAR 表、FSC 曲线(recharts)、Mol* 查看器（覆盖 results-view.tsx stub）
  - 8-d project-panel、api/projects/[id]、page.tsx、job-panel.tsx：项目管理面板、右侧面板按需显示、RELION 标签式参数 UI（I/O/Params/Results/Log）
- 主代理随后集成 QA（agent-browser）+ lint + push GitHub

Stage Summary:
- 基础层就绪；站点在 B/D 落地前短暂不可用（canvas 引用旧 store API）属预期

---
Task ID: 8-d
Agent: Subagent D (panels)

Task: 项目管理面板 + 按需右侧作业面板 + RELION 精准标签式参数 UI

Work Log:
- **lib/projects.ts（扩展，原导出全部保留）**：新增 `ProjectStats` / `ProjectSummaryWithStats`（extends ProjectSummaryDTO + createdAt + stats）、`removeProjectMeta(id)`（删除 meta；active 被删时修复为 createdAt 最早的剩余项目或 null）、`listProjectsWithMeta()` 升级为返回 stats（一次 `db.job.groupBy(projectId+status)` 聚合）+ createdAt ISO。
- **GET /api/projects**：响应中每个 project 现含 `createdAt` 与 `stats {total,running,completed,failed}`（types.ts 冻结 → 前端用本地 `ProjectCard extends ProjectSummaryDTO` 接口收窄 cast）。
- **api/projects/[id]/route.ts（新）**：PATCH {name} 1–80 校验（400）/404/更新+返回 {ok, project}；DELETE → 404 缺失、400 最后一个项目、先清 edge-ports.json sidecar（readFileEdges+removeFileEdge 按 projectId 过滤）、显式 deleteMany edges→jobs→project（schema 虽有级联但防御性双保险）、removeProjectMeta 修复 active。engine-state.json 有意不动（主代理负责）。
- **project-panel.tsx（新）**：卡片列表（滚动、全局细滚动条）——名称 truncate、mode 徽章（SPA teal / TOMO cyan outline）、engine 徽章（RELION emerald / SIM slate outline）、统计 chips（Boxes/Loader2 spin/CheckCircle2）、date-fns formatDistanceToNow 创建时间、ACTIVE（border-primary+ring+顶部 mini badge）；点卡片 switchProject（pending 双击守卫）；hover 显露 Pencil（行内改名 Input，Enter/blur 提交、Escape 取消且 stopPropagation 不误关面板）/Trash2（AlertDialog 确认；仅剩一个项目时禁用+title 说明）；头部 "Projects"+计数+New（Plus）→ Dialog（name 1–80 校验、mode/engine Select、engine=relion 且 system.found=false 时琥珀警告 "RELION not detected — jobs will fail to start honestly"）；空状态。
- **page.tsx（重写）**：桌面左栏 w-72 改为 shadcn Tabs「Catalog(Boxes) | Projects(FolderGit2+计数 badge)」切换 JobPalette/ProjectPanel（palette.tsx 未动）；右侧作业面板**按需挂载**（selectedId != null 才渲染 w-[380px] aside，animate-in slide-in-from-right-4 duration-200，hidden xl:flex；null 时画布全宽）；<xl 沿用右侧 Sheet；保留初始化 load、1.2s 运行轮询、ESC（先取消连线→取消选中）、mounted 门、FAB+调色板 Sheet、Footer/ThemeProvider。
- **job-panel.tsx（重写）**：根 flex h-full；头部（图标+名称 Input+关闭 X(select(null))、StatusBadge+EngineBadge、group·category·tier 行、描述、动作行 Run(Play/Re-run，relion 阻断时 Tooltip+琥珀警告)/Reset/RotateCcw/Log(Terminal→跳 Log 页签)/Delete(Trash2 AlertDialog)、运行中 MiniProgress+剩余秒数）；主体 Tabs「I/O|Params|Results|Log」各自 overflow-y-auto：
  - **I/O**：按 spec.inputs/outputs 端口逐行（端口点 PORT_COLORS[first accepts/kind]、RELION 标签、multiple 提示）；连接 chips 匹配 toPort/fromPort（无端口的旧边归首个端口），chip 可 removeEdge；未连接显示虚线 "not connected"；无输入显示 "Source job — data enters the pipeline here."
  - **Params**：内层 Tabs = tabsFor(spec)（+未标 tab 参数入 "Additional" 尾签），2 列网格（select/bool 占整行）；number 带 unit 后缀 chip/min/max/step、hint 走 title；bool 为 Switch 行（bg-secondary/40 圆角行）；advanced 参数收进每 tab 的 "Expert options" Collapsible（ChevronsDownUp 旋转动画）；底部固定 Save 条（Reset 还原未保存编辑/Save 主色，dirty 经 coerceParam 比较；保存提交强类型值）；"{n} parameters · RELION 5 defaults" 说明。
  - **Results**：结果摘要框（completed emerald/failed destructive）+ 未运行提示 + `<JobResults job>`（8-c 的 stub，命名导入，agent C 覆盖即可）。
  - **Log**：挂载即 fetchLog + Refresh 按钮 + 4s 运行中自刷新；pre max-h-96 mono；空/无日志回退文案。
  - PanelBody 仍 key={job.id} 重挂载；relionBlocked 逻辑保留（engine=relion && system && !found）。
- **验证**：tsc 我的 6 个文件 0 错误；eslint（我的文件）0 错误 0 警告；curl 全通：GET projects 带 stats、POST→PATCH 改名→PATCH 空名 400→DELETE ok（projects.json meta 清除+active 修复）→switch 恢复、404 路径；agent-browser 桌面+移动全链路：侧栏双 tab、项目卡片（创建/行内改名/删除/点击切换+自动 active）、右面板按需出现（aside 数量 2→ESC→1）、四页签（I/O 端口 chips、Params 内层 RELION tabs+单位 chip+专家折叠+1.77→1.8 保存落库回读、Log 拉到真实 CTFFIND 引擎日志、Refresh）、390px 移动 Sheet、VLM 两轮截图审查通过（触控尺寸/无溢出/页签可读）。
- **事故与处置**：测试中 dev server 被 OOM-killer 杀死（dmesg：next-server anon-rss 2.5GB；tsc+多代理并发编译+browsers 叠加所致，4GB 约束）。已用 `bun run dev`（用户 z，端口 3000）重启并确认 / 与 /api/projects 200。注意：dev.log 被 dev 脚本的 tee 重置过一次。
- **未动文件**：store.ts / workflow.ts / types.ts / canvas.tsx / job-card.tsx / edges-layer.tsx / palette.ts / outputs API（8-b、8-c 所有物）。

Stage Summary:
- 8-d 三大件全部落地并端到端验证：项目管理（创建/改名/删除/切换/统计徽章）+ 右侧面板按需渲染（桌面滑入、移动 Sheet、ESC/X 关闭）+ RELION 精准参数 UI（I/O 端口视图、GUI 标签页+专家选项、结果与日志页签）。
- 已知风险：① `src/app/api/projects/empiar-seed/route.ts` 存在 TS 错误（ParamValue boolean 与 `Record<string,string|number>` 不兼容）——非我所有权，留给主代理/所有者修；② canvas.tsx 仍引用旧 store API（zoom/setZoom）属 8-b 进行中状态；③ store API 缺口：store.projects 类型为 ProjectSummaryDTO[]（types.ts 冻结），stats/createdAt 只能靠前端 cast —— 建议主代理后续在 types.ts 解冻时给 ProjectSummaryDTO 加可选 stats/createdAt；④ 多代理共享 4GB 沙箱时 dev server 有 OOM 风险（并发编译/浏览器需节制）；⑤ dev server 曾死亡并已由本代理重启（详见上）。

---
Task ID: 8-b
Agent: Subagent B (canvas)
Task: 重建画布交互层 —— 变换视口（滚轮缩放到光标+左键平移）、端口随卡零延迟拖动、多端口连线（拖拽连线+点击连线）、A* 避障连线、调色板目录折叠+拖拽建作业、一键整理按钮

Work Log:
- **canvas.tsx（重写）**：根 `<section data-canvas="viewport">`（调色板投放检测锚点，touch-none/cursor-grab/no-drag-select）；工作区 2400×1600 div 以 `translate(x,y) scale(zoom)` + origin 0 0 变换（无滚动条），`.canvas-grid` 内联 `backgroundSize:22/zoom` 保持点阵屏幕恒距；滚轮缩放走 useEffect 里的非被动 `addEventListener("wheel",…,{passive:false})`（React onWheel 被动无法 preventDefault），缩放锚定"光标下工作区点不动"；左键按下背景（跳过 [data-job]/[data-canvas-ui] 目标）→ root 指针捕获平移（4px 阈值，panBy 增量），无移动单击 → pendingFrom?cancelConnect:select(null)；缩放控件组（出/百分比/入居中锚定/复位 {0,0,1}/**新增 Wand2 一键整理 → store.applyLayout()**）；连线提示 pill 显示源作业名+RELION 端口 label（pendingFrom 现为 {jobId,port} 对象）；新增 LiveWire 悬浮连线（工作区内 SVG、跟随光标、起点为精确输出端口、虚线 primary+edge-flow）；paletteDrag 期间显示虚线 "Drop to place <label>" 覆盖层（pointer-events-none）；空态/加载骨架保留；模块级 store action 代理保证 memo 卡片 props 稳定。
- **job-card.tsx（重写）**：结构重构修"端口滞后"——外层定位 div(data-job) → wrapper(inset-0, touchAction none, **承接拖拽 transform**) → 卡身 + 端口按钮同为 wrapper 子节点，拖动时 dx/zoom 直接写 wrapper.style.transform，端口与卡身零延迟同步 + setDragLive({id,dx,dy}) 供连线跟随，pointerup 先清 dragLive 再乐观 moveJobCommit（画布边界钳制），pointercancel 回弹不提交；多端口：spec.inputs/outputs 全量渲染（16px 命中按钮内 12px 圆点，data-port=in:NAME/out:NAME，y=portY(i,n)，输入空心 bg-background+2px类型色环、输出实心 PORT_COLORS[kind]），hover 缩放+RELION 端口 label 小 chip；连线两模式：拖拽连线（输出端口 pointerdown 即 setPendingFrom+捕获，pointerup 经 elementFromPoint→closest('[data-port]') 解析 in:NAME + closest('[data-job]') → connect(from,to,fromPort,toPort)，拖空取消、纯点击保留待接）与点击连线（兼容输入端口 portsCompatible 判定后 pulse，点击 connect；再点源端口取消）；键盘：输出端口 Enter/Space 切换 pending、输入端口走原生激活→onClick connect、卡身 Enter/Space 选中；选中 z30/拖拽 z20；StatusBadge/MiniProgress 导出保持（job-panel 依赖）。
- **edges-layer.tsx（重写）**：A* 避障路由——20px 网格 120×80，障碍=作业矩形外扩 12px（保 64px 间隙走廊可用），四周恒留 1 格自由环；起点取源卡右缘外 3px、终点目标卡左缘外 3px 的最近自由格（螺旋搜索）；8 方向、对角 1.414、禁切角（两正交邻格均需空闲）、曼哈顿启发、二叉小根堆、2 万次迭代上限，失败回退 S 形贝塞尔；路径经共线合并→精确端口端点拼接→Q 圆角(r≈10) SVG path+按末段方向的箭头；16px 不可见命中描边 hover 高亮+悬停中点显 × 删除按钮（data-canvas-ui，title "Remove connection"→removeEdge）；dragLive 时端点与障碍网格同步平移；路径缓存=模块级 WeakMap<jobs数组, Map<端点key,路径>>（拖拽中仅被拖卡相关边重算，提交后全量重算；用模块级 WeakMap 而非 ref——新 react-hooks/refs 规则禁止渲染期访问 ref）；running 边 var(--primary)+edge-flow、hover 加粗。
- **palette.tsx（重写）**：签名不变 `JobPalette({onAdded})`；13 个 JOB_CATEGORIES 折叠区（chevron 旋转+计数徽章+hint title），默认仅首个展开，搜索时自动展开含匹配项的类目并隐藏空类目；条目无 onClick 添加，改为 pointerdown 记录+window pointermove/up/cancel 监听（+尽力指针捕获），5px 阈值激活 → setPaletteDrag(type)+**portal 到 body 的 fixed 幽灵卡**（图标+label，translate(-50%,-50%)，z-50，位置用直接 DOM transform 更新零重渲染），释放时 elementFromPoint→closest('[data-canvas="viewport"]') → (client-rect-viewport)/zoom 换算工作区坐标 → store.addJobAt(type,wx,wy) → onAdded?.()；键盘回退 Enter/Space → addJob（传统视口中心落点）+onAdded；aria-label "Drag to canvas to add X (or press Enter)"；表头新增 "Drag a job onto the canvas" 提示。
- **icons.tsx**：补 Brush（tomo denoise）、DynaMight→Brain、ModelAngelo→Network（避免 Boxes 兜底）。
- 验证：`bun run lint` 全项目 0 错误 0 警告（修了两处新 react-hooks/refs 渲染期 ref 访问：onAdded ref 移入 effect、路径缓存改模块级 WeakMap）；`npx tsc --noEmit` 我的 5 文件 0 错误；A* 逻辑在 /tmp 草稿脚本验证（挡路卡场景 0 压格/0 穿越障碍、64px 走廊可通行）；SSR GET / 200 且输出含新标记（data-canvas="viewport"、"Drag to canvas to add…"）。
- **报告的他人文件缺陷（未越界修复）**：① src/lib/workflow.ts 的 sel()/bool() 简写只收 4 参而目录传 5 参（{tab,advanced}），14 处 TS2554——需给两简写加 `extra?: Partial<ParamSchema>`（同 num()）；② empiar-seed 路由 ParamValue→Record<string,string|number> 9 处 TS2322（8-d 也已报告）。修复前 tsc 全局红（Turbopack 编译不受影响）。

Stage Summary:
- 画布交互层五件套全部落地：变换视口（缩放到光标/左键平移/一键整理）、端口零延迟拖动、多端口拖拽+点击双模式连线（store 端口兼容校验兜底）、A* 避障连线（含 hover 删除、拖拽实时重路由、失败贝塞尔兜底）、调色板折叠目录+拖拽建作业（幽灵卡+投放检测）；lint/tsc（我的文件）双清，SSR 冒烟通过。8-d 报告的 "canvas 引用旧 store API" 随本任务完成而消除。
- 已知风险：移动端触屏添加作业暂无点击路径（规范禁止 onClick 添加；触摸拖拽常被浏览器滚动接管 pointercancel，Sheet 又遮画布）——建议 8-d/主代理补触屏专用落点；未实现双指捏合缩放（触摸用缩放按钮）；拖拽中被拖卡静止后无关边沿用缓存路径、松手提交即全量重算；运行轮询每 1.2s 换 jobs 数组身份 → 全边重路由（30 边亚毫秒级，可接受）。

---
Task ID: 8-c
Agent: Subagent C (results/molstar) — context-deadline'd before writing this record; main agent verified and appended on its behalf
Task: 输出结果系统 — outputs API + MRC→PNG + STAR 表 + FSC 曲线 + Mol* 3D 查看器

Work Log:
- GET /api/jobs/[id]/outputs：workdir 递归扫描（深度3，跳隐藏，kind=mrc/star/text/image + slices + 友好标签如 "Half-map 1"/"Sharpened map"）
- GET /api/jobs/[id]/outputs/file?format=png|raw|text：路径安全校验（resolve+前缀校验）；PNG 用 lib/mrc.ts（mode 0/1/2/6 头解析 + 2–98 百分位对比度拉伸 + sharp raw 1ch→PNG，≤384px 降采样，&scale=large 大图；montage 栈拼贴）
- GET /api/jobs/[id]/outputs/star?rows=100：lib/starfile.ts 解析 loop_ 表 + FSC 检测（rlnAngstromResolution + rlnFourierShellCorrelation* 列）
- results-view.tsx (597行)：FSC 图置顶 + Maps 画廊（点击大图/3D）+ STAR 表 + 日志报告 + workdir 展示；空态诚实提示 sim 无盘输出
- fsc-chart.tsx：recharts LineChart + 0.143 参考线 + 阈值穿越插值徽章
- mol-viewer.tsx + molstar-embed.tsx：next/dynamic ssr:false 懒加载 molstar 5.11（~2MB 不进主 chunk）；createPluginUI+renderReact18+DefaultPluginUISpec；RawData→ParseCcp4→VolumeFromCcp4→VolumeRepresentation3D(isosurface)；相机 boundingSphere 聚焦；错误回退为中央切片 PNG
- 已实测（dev.log）：outputs 列表 200、postprocess.mrc PNG 200（273ms 首次编译）、raw 200、FSC 列解析含 33 行真实数据
- tsc src 零错误 + eslint 零错误

Stage Summary:
- C 的交付完整落地（除 worklog 本节由主代理补记）；Mol* 打包在 Turbopack 下编译通过

---
Task ID: 8 (final)
Agent: main (Z.ai Code)
Task: 三子代理交付集成 + agent-browser 全量 QA + 修复 + push

Work Log:
- 基础层修复：sel()/bool() 简写第 5 参 extra（14 处 TS2554）；empiar-seed ParamValue boolean；refine3d.autoRefine 布尔化
- layout.ts 修复：同层多卡垂直堆叠 + 溢出子列；自适应层距（8 层管线 262px 步距恰好 2400px 画布放满）；**fit-to-view**：store.layoutEpoch + canvas useEffect 计算包围盒 → 视口居中缩放（一键整理后自动取景）
- molstar-embed 日志前缀清理（[molstar]）
- agent-browser 全量 QA 通过（会话 qa8）：
  - 首屏：目录 13 分类仅 IMPORT 展开、卡片全部端口就位（Refine3D 4 输出/PostProcess 3 输入）、无右侧面板（按需显示）✓ VLM 确认
  - 点 PostProcess 卡 → 面板滑入，I/O tab 端口级连线（half1 连 Refine3D、half2 未连、mask 连 MaskCreate）✓
  - Params tab：Sharpening 子标签 + Switch(autoBfac) + 单位 Å + Expert options 折叠 + "4 parameters · RELION 5 defaults" ✓
  - Results tab：真实 FSC 曲线（≈6.70 Å @0.143 阈值插值 + RELION 7.08 Å 对照）+ Maps 画廊(64³ 缩略图) + STAR 33 行 ✓
  - Mol* 3D：点 Sharpened map → View in 3D → createPluginUI + isosurface 橙色密度面渲染成功（VLM 确认 3D 表面+坐标轴）✓
  - 调色板拖出：pointerdown→拖拽 ghost→canvas 释放 → 新卡精确落点(坐标换算验证 left=222=top 数学吻合) ✓
  - 滚轮缩放：defaultPrevented=true、1.0→1.1、光标焦点数学精确(-30,-20 平移) ✓
  - 左键平移：+60,+40 拖拽 → translate 同步 ✓
  - 多端口连线：Refine3D out:half2 → PostProcess in:half2 → 新边 fromPort/toPort=half2 入库（DB+file 双层），与 half1 形成真实 RELION 双半图拓扑 ✓
  - 一键整理：全卡拓扑分层 + 无重叠 + fit-view 取景（VLM 确认"clean pipeline, edges route around cards"）✓
  - 卡片拖动：端口随 transform 节点实时同移（1:1 位移验证）→ 圆圈延迟 bug 修复确认 ✓
  - 项目面板：Projects tab 卡片(统计/模式/引擎徽章/ACTIVE)、新建对话框→自动切换、删除→active 自动回退 ✓
  - 真实引擎回归：新 UI 跑 Import 作业引擎原生执行成功；删除测试作业 ✓
  - 边悬停 → 中点 × 删除钮渲染 ✓
  - 移动端 390px：FAB+Sheet 调色板可用、无横向溢出、footer 底部贴合 ✓
  - 深色模式：VLM 确认无对比度问题 ✓
  - console 零错误、dev.log 零错误、lint 0/0、tsc src 零错误
- 清理：测试 Import 作业已删（EMPIAR 回到 10 作业 + 11 边含 half2 新边）、QA 项目已删、画布已重新整理
- 已知小瑕疵：agent-browser 无法模拟真实滚轮/触摸（合成事件 setPointerCapture 限制）→ 交互用真实 CDP 事件验证通过；Next.js dev 徽章仅开发环境

Stage Summary:
- 用户本轮 14 项需求全部交付并 QA 验证：项目管理面板 ✓ 目录折叠 ✓ 右面板按需 ✓ RELION 真实参数(标签页+专家选项) ✓ 结果输出 UI(图/表/FSC) ✓ Mol* 整合 ✓ 端口随卡实时移动 ✓ 多端口按类型/输入数连线 ✓ 避障路由 ✓ 滚轮缩放 ✓ 左键平移 ✓ 拖拽建作业 ✓ 一键整理 ✓ push(待执行)

---
Task ID: 9-a
Agent: Subagent A (canvas UX)
Task: 卡片连线优化（避免折线/线不重叠/离卡片更远）+ 新建 job 输入的多方式连线（拖拽、画布连线、反向连线、面板选择）

Work Log:
- 本轮为断点续跑：上一进程已写完全部 5 个文件但未验证/未记账。本轮完成了完整性审查、修复了一个真实路由缺陷并全量验证。
- **edges-layer.tsx（829 行，核心重写）**：
  - A* 转向惩罚：state = cell×8 方向（N_STATES=COLS×ROWS×8，模块级 Float64/Int32 世代复用缓冲，避免每次搜索 ~1MB 分配），方向改变付 TURN_COST=2.2 → 长直段优先、阶梯彻底消失。
  - 8 向无切角（对角需两正交邻格均空）+ 曼哈顿启发 + MinHeap + MAX_ITER=15000；失败回退 S 形贝塞尔（控制偏移 dx=max(60, 0.45·|ex-sx|)，回退贝塞尔也采样 9 点折线进占用栅格）。
  - INFLATE 12→24（卡片四周 24px 让线走廊）；端点 stub=18px：源端口向右出、目标端口从左入，A* 在 stub 之外（nearestFree 于 sx+STUB+2 / ex-STUB-2，等价 spec 的 INFLATE±6 因 perEdgeGrid 已豁免端点卡光环）；源/目标卡以裸体重新盖章 → 端口通道可用。
  - **String-pull（≤3 趟）改为含 stub 端点的 [stubA, …cellCenters, stubB] 拉直 + LOS 感知占用栅格**（本轮修复）：原实现只拉直格心折线，端口 y 与格心 y 差 ≤10px 会在两端留下折点（S1 场景实测 pts=6/折 4 次）。现在清走廊时整条线塌缩为端口到端口直线（S1 实测 pts=2/折 0）；LOS 同时被障碍格与占用格阻挡 → 后续边不会被拉直回前一条线的走廊；占用仅在两 stub ±30px 口袋内局部豁免（扇出/扇入共享端口通道不可避免）。
  - 边分离：按 fromJobId|fromPort|toJobId|toPort 确定性排序 → 顺序路由 → 每条路由完成即 Bresenham 采样 + 1 格膨胀写入共享 Uint8Array occ；后续 A* 对占用格付 OCC_COST=1.8 软代价 → 平行线取邻走廊。RoutedEdge 增加 pts: Pt[]。
  - 全量重算（jobs 数组新身份）：忽略缓存顺序路由全部边、写回缓存、逐条栅格化；dragLive 两趟：无关边复用缓存 pts（栅格化进占用），被拖卡相关边重路由 —— 端点零延迟跟随不变。routeMemo 内容签名（>64 清空）防 no-op 轮询抖动。
  - 圆角 10→16；箭头/悬停删除（中点 ×）/edge-flow/16px 命中描边全保留；pathClearOfBodies 终检（端 stub 段豁免）。
- **store.ts（463 行）**：PendingFrom 增 dir?: "out"|"in"（缺省 out，全兼容旧调用）；connect 端口兼容/去重/环检测逻辑不变。
- **job-card.tsx（611 行）**：输入端口反向拖拽 —— pointerdown → setPendingFrom({dir:"in"}) + 指针捕获 + 5px 阈值；pointerup elementFromPoint → closest('[data-port]') 命中他卡 out:NAME → onConnect(他卡, 本卡, NAME, 本端口)；拖空取消、纯点击保留 pending（点击兼容输出端口续接）、再点同一端口取消。输出端口对称支持"完成 in 悬线"（complete 模式）。pending 存在时对侧兼容端口 ring-2 ring-primary/60 + animate-pulse 高亮（dir=out 高亮他卡输入、dir=in 高亮他卡输出，portsCompatible 判定），data-port-compatible="true"。键盘 Enter/Space 双向全支持。
- **canvas.tsx（462 行）**：LiveWire 支持 dir="in"（锚点 = job.x, job.y+portY(idx,n) 左缘输入口）；连线提示 pill 文案双向适配（"drop on a matching output port ◉" vs "click a matching input port"）；背景单击/ESC 取消对两方向均生效（page.tsx ESC 处理器按 pendingFrom 泛化判断，无需改动）。
- **job-panel.tsx（1051 行）**：I/O 页每个未连接输入端口行下新增虚线 "Link source…" 幽灵按钮（Plus 图标）→ shadcn Popover 列出所有他卡兼容输出端口（"<作业名> · <RELION 端口 label>"，按作业名+端口序排序，max-h-64 滚动）→ 选中即 store.connect；无可兼容源时禁用态 "No compatible source yet"；已连接端口保留原 chips（footer 仅未连接时渲染）；sr-only label + title 全覆盖。
- **验证（遵守 4GB 约束：未重启/未 build/未 tsc/未 agent-browser）**：
  - `bun run lint` 全项目 exit 0（0 错误 0 警告）。
  - SSR 冒烟：GET / → 200 且含 data-canvas="viewport"（dev.log 尾部无编译错误；中途一条 "Can't resolve 'lib/workflow'" 是上次写文件半程的瞬态记录，之后 3 次 ✓ Compiled + GET / 200）。
  - /tmp/edge-sanity.ts 算法离线演练（提取纯算法段，9 场景 25 断言全过）：对齐直线 pts=2/折 0；40px 偏移折 2；挡路卡 clearance 54.9px/折 4；平行线间距 220px；扇出中段间距 200/200/400px；**共线扇出陷阱（同源端口+共线目标，直连线本应叠线）实测间距 231px**；反向边正常；密集墙 2ms；10 边链 1ms 全直线（跨列折 2）。
- 修改面：5 个文件（全部属本代理所有权），818+/169-；未触碰 workflow.ts / relion / api / prisma / types.ts / page.tsx。

Stage Summary:
- 连线质量四件套全部落地并离线验证：直线化（turn-penalty A* + stub 感知 string-pull）、不重叠（顺序路由 + 软占用代价 + 占用感知拉直）、离卡片 24px 走廊（INFLATE=24）、圆角 16。
- 输入侧四种连线方式可用：正向拖拽（输出→输入）、反向拖拽（输入→输出，LiveWire 反向锚点）、点击-点击两步式（两方向）、面板 "Link source…" 下拉选择；ESC/背景/× 取消全覆盖。
- 未验证项：①未用 agent-browser 做视觉 QA（规则禁用）——stub 高亮脉冲、Popover 交互、拖拽手感建议主代理集成 QA 时过一遍；②routeMemo 在极端拖拽下每帧新签名（上限 64 条防涨）；③移动端触屏反向拖拽依赖 setPointerCapture，与正向拖拽同样受浏览器手势抢占风险（pointercancel 已兜底取消）。

---
Task ID: 355789-wsl-detect
Agent: main (Super Z)
Task: 修复 dashboard WSL 探针误报（用户报告：RELION 5 已装在 WSL 但不在 PATH，dashboard 误报"WSL 不可用"）；加"重新检测"按钮。

Work Log:
- 根因：probeWsl 用 `wsl -e which relion_refine`（非登录 shell，不加载 ~/.bashrc 的 PATH 修改）且把"RELION 未找到"与"WSL 不可用"混为一谈；无 Re-detect 按钮（store 仅 load 时 fetch 一次 + 60s 服务端缓存）。
- types.ts：新增 WslStatusClient —— unavailableReason ("no-wsl"|"no-distro")、relionPath/relionHome、version、source ("login-shell PATH"|"RELION_HOME env"|"filesystem search")、distro、note（多行可执行指引）。
- system.ts：probeWsl 三段式发现（默认 distro 内）：① bash -lc 登录 shell `command -v relion_refine`（吃 .bashrc PATH，即用户方案 A）② $RELION_HOME env（方案 C）③ 文件系统兜底搜索常见布局（~/relion*/bin、~/myproject/relion*/bin、~/my-project/relion*/bin、~/src|build|code/relion*/bin、/usr/local/relion*/bin、/opt/relion*/bin 等，一次 bash 调用有界超时）。win32 宿主直接用 wsl.exe（不依赖 which）；distro 名用 `echo $WSL_DISTRO_NAME`（避开 wsl --list 的 UTF-16LE）。未找到时输出诚实的三选一修复指引（A/B/C）。probeVersion 加 relion_refine_mpi 回退。candidateDirs 加 searchHomeCandidates()（原生 Linux 也扫 ~ 一层 dev 目录里的 relion 安装）。
- /api/system：支持 ?force=1 绕过 60s 缓存。
- store.ts：systemRefreshing 状态 + refreshSystem() action（force 探测、错误 toast）。
- header.tsx：WSL 行三态渲染（绿点 "RELION 5.0.1 in WSL (distro)" / 琥珀点 "WSL ok · RELION not on PATH" / 灰点 "WSL not installed|no distro"）+ WSL source 行 + note 多行渲染（A/B/C 命令行 font-mono 高亮）+ 底部 Re-detect 按钮（RefreshCw 旋转、disabled 防抖）。
- 验证：tsc src/ 0 错误（examples/skills 的历史错误与本次无关）；eslint 5 个改动文件 0 输出；/api/system?force=1 实测 found=true version=5.0.1 path=/home/z/relion-install/bin（_mpi 回退生效），WSL 正确报 "no-wsl"；agent-browser 实测 popover 渲染三态行 + Re-detect 点击后 checked 时间戳刷新（12:05:19→12:06:10），用后即 close。
- 未做：WSL 桥接执行引擎（wsl -e 跑 job）——本次只做检测与指引，执行桥接需路径翻译（/mnt/c/...），留待后续。

Stage Summary:
- dashboard 不再误报"WSL 不可用"：WSL 本体、RELION 是否在 PATH、如何被找到三者独立报告；用户修完 PATH 点 Re-detect 即可看到版本号与路径。
- 三种用户方案（A bashrc / B symlink / C RELION_HOME）全部被探针覆盖；常见安装布局（含用户的 relion5-build-cuda-fixed、relion5-pkg）自动发现，多数情况下无需改 PATH。
