# _legacy-archive — 早期 era 遗产的检疫区（Task 274）

本目录是**本项目早期 era（real-RELION 验证时代，工作树快照见提交 5a72d14）**
遗留数据树的统一检疫点。它们是**未跟踪的运行时数据**，产品代码（src/、scripts/、
配置）对它们**零运行时引用**——唯一的引用曾是构建排除规则本身（那是在为它们
的存在付费）。

## 为什么检疫（而不是删除 / 而不是放着）

- **删除不可接受**：`relion-projects/empiar-10017-真实全流程/` 内含 641MB 的
  EMPIAR 真实原始数据（10 微图 + 10 Henderson .coord）与三个真实验证项目——
  不可再生的实验资产。
- **放着不可接受**：2026-09-17（Task 273 窗）这些树把构建三条内存账单全部打爆：
  Turbopack file-tracer 全树枚举、tailwind v4 自动内容检测全项目扫描、以及
  3.3G 树对任何"扫仓库"的新工具都是同类地雷。检疫到单根后，排除规则从四行
  收敛为一行，未来工具只需知道一个名字。
- **mv 即时光**：同文件系统 rename，零拷贝成本；verdict 可逆（`mv` 回根目录
  即恢复原状——但那会让检测器 qa68 大叫，这是设计而非缺陷）。

## 内容清单

| 条目 | 内容 | 归属证据 |
|------|------|----------|
| `persist/` | RELION 5.0.1 栈备份（123 二进制 + MPICH + ctffind）、`RESTORE.md` 灾后恢复指南（含 Task 277 现拓扑翻译节）、worklog 快照 | 自述"跨容器回收存活"，恢复路径指向 `/tmp/my-project/`（旧挂载拓扑，Task 277 起文末附现拓扑翻译表） |
| `relion-projects/` | beta-gal 教程数据集、empiar-10017 真实全流程、real-relion 验证项目（共 2.9G） | RESTORE.md 引用的 EMPIAR 数据宿主 |
| `mini-services/relion-ws/` | 早期 era 的 mini-service 实验（bun + index.ts） | 当前产品无此架构（src/ 零引用） |
| `molstar/` + `molstar.css` | 23M 独立 molstar bundle 副本 | 产品实际从 node_modules 导入 molstar（`import "molstar/build/viewer/molstar.css"`），此副本全仓库零引用 |
| `qa-shots/` + `qa-shots-17/` | 旧 QA 截图（~3.7M） | 早期 era 的定妆照，已由 shots-qa/ 世代取代 |

## 需要里面的数据时

1. RELION 栈 / EMPIAR 数据：读 `persist/RESTORE.md`（正文描述旧挂载点
   `/tmp/my-project/` 下的恢复流程；文末「当前拓扑翻译」节已给出新旧路径映射表）。
2. 旧截图：直接看文件。
3. 之后请**放回本检疫区**，不要留在仓库根——qa68 检测器会拒绝根目录复现。

## 2026-09-18 沙箱回滚注记（Task 298 窗取证）
12:25:20 整机重启将工作区回滚到 Task-272 时代快照；本检疫区内的负载
（persist/、relion-projects/、mini-services/、molstar、molstar.css、qa-shots/、
qa-shots-17/）均为未跟踪运行时数据，随回滚灭失且不可恢复。目录结构按
check-foreign-trees.mjs 的台账保留（「根目录无遗留、检疫区结构完整」的契约
是结构性的）——负载本身与产品零运行时引用，灭失不影响任何功能。

## 湮灭记录（t525，2026-10-03）

本检疫区的隔离物（persist/、relion-projects/、mini-services/ 等）是**未跟踪的
运行时数据**——某次沙箱重置将它们整体湮灭（README 随 git 幸存，数据没有）。
`check-foreign-trees.mjs` 自 t525 起讲湮灭态语义：成员缺失 + 根干净 = 资产损失
入档（本节），不等于检疫失败。同批湮灭的还有 /home/z/empiar-10017（EMPIAR
10017 原始微图）与本地 RELION 构建——EMPIAR 数据可从公开库重取，继承池的
「EMPIAR 真数据回归」因此仍挂池。

## 复活记录（t527，2026-10-03）——EMPIAR-10017 真数据归位

上面「可从公开库重取」的悬账本窗兑现：EBI 带宽实测 ~644 KB/s（4 并发 ~4 MB/s），
t380 时代 16 KB/s 的「重下 8 小时」借口作废。`scripts/t527-fetch-empiar.sh` +
`scripts/qa-t527-empiar-real-seed.mjs`（双车道：bash 快取 / node 法典，身份律 =
67,109,888 B + 4096² float32 + 全正冰采样）把 **10 张真微图 + 10 个 Henderson
.coord 送回 /home/z/empiar-10017/micrographs**（641 MB，与湮灭前的史档一字不差），
并把前 8 张硬链接进 mock cluster 的 /data2 镜像（8+8，diag-t380 的考题形状）。
本检疫区的 `relion-projects/empiar-10017-真实全流程/` 仍是湮灭态——那是带 RELION
工程语义的档案（STAR 全链 + 验证项目），真数据回去不等于档案回去；但 diag-t380
fidelity 大考自此在真字节上判卷（REAL-data 模式 90/0），「EMPIAR 真数据回归」
池项由本窗摘牌。合成 fallback（qa-t526-empiar-seed.mjs）降为 16 KB/s 世界的
 documented 备胎，永不满足 fidelity 考试。
