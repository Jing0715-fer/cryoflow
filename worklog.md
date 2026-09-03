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
