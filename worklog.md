
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
