# CryoFlow HPC 集群对接与调度系统设计

> **目标**：同一张工作流图，既能本机跑（现有引擎），也能一键投递到 Slurm HPC 集群，
> 支持多 GPU 并行（数据分片 array / 单作业多 GPU / 单 GPU 深度学习），并保持
> CryoFlow 现有的进度、日志、断点续跑、诚实失败体验完全不变。
>
> **状态**：`src/lib/hpc/slurm.ts` + `/api/hpc/*` 已落地为可用的 dry-run 实现 ——
> 本文档描述完整设计，代码是其中第一阶段的实现。

---

## 1. 总体架构（三层）

```
┌──────────────────────────────────────────────────────────────────┐
│  L1 · 浏览器工作流画布                                             │
│  job 图 / 参数 / 连线 —— Run 按钮旁新增 HPC 按钮（SBATCH 生成器）     │
└──────────────┬───────────────────────────────────────────────────┘
               │ REST (现有 /api/jobs /api/edges ...)
┌──────────────▼───────────────────────────────────────────────────┐
│  L2 · CryoFlow 服务端（提交节点 / 登录节点）                          │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐      │
│  │ engine.ts  │──▶│ hpc/slurm.ts │──▶│  SlurmBackend       │      │
│  │ buildArgv  │   │ GPU策略/翻译  │   │  sbatch/squeue/scancel │  │
│  └────────────┘   └──────────────┘   └─────────┬──────────┘      │
│   dispatch.ts（执行后端选择：local | slurm）                        │
└──────────────────────────────────────────────┼───────────────────┘
                                               │ ssh / 本地 slurm 客户端
┌──────────────────────────────────────────────▼───────────────────┐
│  L3 · Slurm 集群                                                  │
│  登录节点：sbatch/squeue/sacct/scancel                             │
│  GPU 分区：node-01..04 × 4×A100（示例 profile）                     │
│  共享文件系统：/lustre/project/cryoflow（项目数据 + 日志 + 产物）      │
└──────────────────────────────────────────────────────────────────┘
```

**核心设计决策：argv 单一来源**。HPC 提交不重新拼命令 —— `buildSbatchForJob`
复用引擎的 `buildArgv`（与本地运行完全相同的构造器），只做三件事：
① 路径翻译（`data/relion` → `/lustre/project/cryoflow`）；
② GPU 适配（追加 `--gpu 0:1:…`、mpirun 前缀）；
③ 包上 `#SBATCH` 指令与 module 环境。这保证「本机跑通的命令 = 集群跑的命令」。

---

## 2. 执行后端抽象（ExecutionBackend）

```ts
interface ExecutionBackend {
  submit(job, argv, workdir, profile): Promise<{ schedulerId: string }>;
  poll(schedulerId): Promise<SchedulerState>;   // PENDING|RUNNING|COMPLETED|FAILED
  cancel(schedulerId): Promise<void>;           // scancel
  accounting(schedulerId): Promise<ElapsedTRES>; // sacct 计费
}
```

- **LocalBackend**（现状）：spawnTrackedRun 直接拉起二进制，RunRecord 记 pid。
- **SlurmBackend**（本设计）：`sbatch script.sbatch` 返回 JobID；RunRecord 扩展
  `schedulerId / slurmState / arrayProgress / nodeList` 字段。
- dispatch.ts 在 startJob 时按 profile 选择后端 —— **图、参数、连线、结果可视化
  全部后端无关**，这就是「不仅支持本机运行」的实现路径。

## 3. 多 GPU 并行策略（按 job 语义分类）

| 模式 | 适用 job | Slurm 形态 | 原因 |
|---|---|---|---|
| **array 数据并行** | motioncorr / ctffind / extract / autopick / tomo 重构类 | `#SBATCH --array=1-N%并发` 每 shard 1 GPU 或 CPU | 微图级尴尬并行；单 shard 失败不污染其余；`%N` 限流防挤占 |
| **单作业多 GPU** | class2d / class3d / refine3d / initialmodel / multibody | 1 个 job 申请 N GPU：`mpirun -n N relion_refine … --gpu 0:1:…` | RELION 需要全局统计（FSC 半图、类占有率）—— 拆数据集会破坏收敛性；GPU 间按 MPI rank 分粒子 |
| **单 GPU** | topaztrain / dynamight / modelangelo | `--gres=gpu:1` | CNN 训练单卡收敛（多卡需 DDP）；外部程序自身单卡 |
| **CPU** | import / select / joinstar / maskcreate / postprocess / symexpand / rebalance … | batch 分区，不占 GPU 队列 | 记账/后处理无 GPU 收益，把 GPU 让给分类精修 |

**array 分片实现**：prologue 用 `awk` 按 `SLURM_ARRAY_TASK_ID` 切
micrographs.star（每 shard 取第 (i % N) 行），失败自动 `--requeue`；
全部 shard `afterok` 后 joinstar 合并 —— 与 RELION pipeliner 的
Split/Star-combine 语义一致。

## 4. 数据流转（Data Staging）

```
EMPIAR/本地磁盘 ── stage-in ──▶ /lustre/project/cryoflow/<projectId>/
                                ├── import_xxx/micrographs.star (+ mrc 符号链接)
                                ├── ctffind_xxx/…
                                └── logs/cf_class2d_xxx-1234.out
```

- 路径翻译表内置于 profile（localRoot → dataRoot），buildArgv 输出的所有
  输入/输出路径自动映射 —— 已在 `/api/hpc/sbatch/[id]` 实现。
- 大数据集 stage-in：rsync / Globus / Aspera（profile 可配 `stageCommand`）；
  产物回传：postprocess 的 map/FSC 等通过现有 outputs 路由按需拉取。
- **断点续跑**：refine 家族中断（scancel / preemption / 超时 requeue）后，
  引擎现有的 `--continue <optimiser.star>` checkpoint 逻辑对集群同样成立
  （checkpoint STAR 与 rank 无关）。

## 5. 监控与生命周期闭环

| Slurm 侧 | CryoFlow RunRecord 映射 | 用户可见 |
|---|---|---|
| `squeue -j ID` PENDING (Resources) | job.pending + waitReason | 卡片 idle→pending 徽章 |
| RUNNING (+ array 元素数) | running + progress = done_shards/total | 进度条 |
| `sacct -j ID` COMPLETED / ellapsed | completed + duration | 结果徽章 |
| FAILED / TIMEOUT / NODE_FAIL | failed + rootCause（sacct reason + 日志尾扫描） | toast 直出真因 |
| `scancel` | stopRun 现有路径 | 停止按钮 |
| TRES billing (gpu-hours) | accounting 面板 | 成本统计 |

轮询节奏：squeue 5–10s（仅活动 JobID 列表，一条命令），sacct 仅在完成时
查询一次 —— 与现有 pollTick 完全同构，只是「进程存活探测」换成「调度器状态
探测」。

## 6. 容错与多集群

- **时间预算**：profile.timeLimitMin → `#SBATCH --time`；refine 家族加
  `--requeue`，节点故障/preemption 自动重启并由 `--continue` 恢复。
- **依赖链**：`sbatch --dependency=afterok:<上游JobID>`（图边即依赖）；
  失败传染用 `afterok:` 严格模式；并行 fan-out（Import→{CTF,ManualPick}）
  天然无依赖竞争。
- **多集群 profile 注册表**：`/api/hpc/profiles`（local-workstation /
  A100 分区 / H100 burst 三个内置，可自定义保存）。每个 profile 声明
  分区、QOS、GPU 型号、并发上限、module 环境 —— 提交时按 job 的 GPU
  策略自动选择 profile（训练类投 H100 burst、重构类投 A100 长队列）。

## 7. 集群模拟器（无集群也能验证调度）

`/api/hpc/simulate` 用**当前真实项目图**跑事件驱动模拟：
- 节点/GPU 池 first-fit + 优先级 FIFO + afterok 依赖边
- array 元素独立调度、共享 JobID、%并发限流
- 时长 = 引擎实测秒数（GPU 任务按 profile 加速比缩放）
- 输出 Gantt 时间轴 + makespan + GPU 利用率 + 平均等待

它回答「这套工作流在 8×A100 上要多久、排队在哪、利用率多少」——
在真集群上，同样的输入对应 squeue/sacct 的真实输出。

## 8. 落地路线

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | argv 复用 + SBATCH 生成 + 策略表 + 路径翻译 | ✅ 已实现（dry-run） |
| P0 | 集群模拟器 + profile 注册表 + 检查器 HPC 对话框 | ✅ 已实现 |
| P1 | SlurmBackend.submit/poll/cancel（登录节点 ssh 执行 slurm 客户端） | 设计定稿 |
| P1 | RunRecord 扩展 slurmId/state；pollTick 接 squeue | 设计定稿 |
| P2 | stage-in/rsync 向导；sacct 成本面板；多 profile 自动路由 | 待做 |
| P3 | K8s/Batch 后端（同一 ExecutionBackend 接口） | 待做 |
