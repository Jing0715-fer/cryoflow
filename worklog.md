
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
