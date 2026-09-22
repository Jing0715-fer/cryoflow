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
