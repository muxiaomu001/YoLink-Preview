# YoLink 交互演示 · 恒信财富

管理后台、客服工作台、客户手机屏三合一的可点击演示。数据全在浏览器里（localStorage），不需要后端；三个入口开在不同窗口会实时同步。

演示企业「恒信财富」及其中所有人物、对话、金额均为虚构。

## 跑起来

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5173 。生产构建 `pnpm build`，产物在 `dist/`，任何静态托管都能放。

演示数据存在浏览器 localStorage，键是 `yolink-demo-v6`（`src/store/store.ts` 的 `STORAGE_KEY`）；模型改了就把版本号加一，老数据自动作废、重新灌种子。

## 三个入口

| 入口 | 路径 | 以谁的视角 |
|---|---|---|
| 管理后台（完整版） | `/admin` | 管理员 周敏；侧边栏按 PRD 05 章节分组，P1/P2 标记对应正式产品优先级，钱包/签到/推荐等模块由「模块启停」控制显隐；「群发管理」旁是「话术库」（企业分类与条目、图片 / 文件上传、启停、使用次数） |
| 客服工作台 | `/workbench` | 顾问 林薇，以「林顾问」身份。按 PC 客户端布局：左侧图标栏导航（按员工能力与模块显隐：会话、客户、群发、邀请链接、群活跃助手、提现审核、设置）、三栏可拖宽、右栏可收起；话术库（右栏「话术」页签，左侧分类标签列 + 图片两列网格 + 打字自动匹配全文命中 + 图片 / 文件直发）；右下角浮钮是演示控制（切换登录员工、打开手机屏 / 后台） |
| 客户手机屏 | `/phone` | 未登录时是注册页；右侧演示控制可切到任一已有客户。每个按钮按策略渲染，后台切开关立即生效 |

首页 `/` 有两条穿越流程的分步说明，和「重置演示数据」按钮。

## 两条穿越流程

**注册即分配**：后台看「直播间组」放了哪两个坐席 → 客户屏输邀请码 `LIVE88` 注册「张先生」→ 客户屏立刻出现林顾问、恒信合规通知两条会话与欢迎语 → 客户回一句 → 工作台「待我回复」多了张先生，AI 已给出草稿。

**换人零感知**：后台把「林顾问」交接给王芳 → 工作台切换登录员工为王芳，顶部身份是林顾问，历史全在 → 客户屏一个字没变 → 消息审计里交接前的消息背后是林薇，之后是王芳。

## 代码结构

```
src/
  domain/
    types.ts      领域模型，与 docs/prd/00 预留清单一一对应
    seed.ts       种子数据：企业、员工、坐席、邀请组、头衔、客户、对话
    seed-admin.ts 管理后台完整版的种子：策略矩阵（POLICY_ITEMS 39 项）、举报、敏感词、钱包、签到、推荐、横幅、AI、画像同步、日报、插件、系统
    seed-groups.ts 群管理字段（管理员、群设置、公告、置顶、限制、群链接、管理员日志）与群活跃助手（机器人、剧本、规则、运行记录）的种子
    seed-quick-replies.ts 话术库种子：演示附件（public/media 下的费率表、流程图、说明书 PDF 等）、企业 / 个人分类、18 条话术（含图片、文件、停用；没有关键词字段，匹配走全文）
    labels.ts     枚举的中文文案（审计事件、模块、权限清单、API scope…）
    ai.ts         AI 回复推荐（演示版，按关键词 + 知识库拼草稿）
    time.ts       时间格式
  store/
    store.ts      zustand 仓库：核心动作（注册、交接、挂头衔、群发…）
    policy.ts     策略解析与群内角色：resolveCap / customerCan / seatCan / seatGroupPerm / customerCanSpeakIn / senderName / visibleText
    actions/      各模块的动作：settings / people / policy / content / modules / integrations
                  groups.ts（群设置、公告、置顶、成员、管理员、限制、群链接）
                  workbench.ts（消息引用 / 转发 / 撤回 / 删除、会话置顶 / 静音 / 标未读、客户拉黑 / 禁言 / 重置密码、个人偏好、客户端发言判定）
                  quickReplies.ts（话术与分类的增删改、启停、使用计数；企业 / 个人两层）
                  bots.ts（机器人账号、剧本、规则、一键暂停、模拟触发、审核、手动发言）
                  D-extra.ts（提现审核记审核人与原因 / 凭证）
    selectors.ts  派生数据：会话视图、待回复、未读、按交接反推实操员工
  ui/             通用组件（按钮、表格、弹窗、二次确认、SVG 图表、头衔与内部标签的 chip）
                  media.tsx（图片缩略图 + 大图 Lightbox、文件卡、本机文件读成附件）
  apps/
    admin/        管理后台 40 余页，nav.ts 是侧边栏与路由清单；pages/QuickRepliesPage.tsx 话术库
    workbench/    工作台（PC 客户端布局）：components/layout 图标栏 / 坐席切换 / 拖拽把手 / 演示浮条 / 系统通知，
                  三栏会话（ChatPage：全部 / 待我回复 / 未读 + 筛选弹层）、components/customer 资料卡（顶部快捷动作 + 折叠分区）、
                  components/group 群摘要卡 + 群管理弹窗（按权限显示分页）、客户（CustomersPage）、邀请链接、群发（全部好友一键群发）、
                  components/quick-replies 右栏「话术」页签（分类标签列）、打字自动匹配浮层、`/` 列表，
                  群活跃助手（BotsPage）、提现审核（WithdrawalsPage）、设置（含快捷键）；useLocalPref.ts 记本机栏宽与折叠状态
    phone/        客户手机屏：注册、消息、联系人、我的、聊天（图片 / 文件消息真实显示，会话列表预览 [图片] / [文件]）；screens 下每个页面按策略渲染
    landing/      演示首页
```

## 策略如何生效（技术团队看这里）

管理后台 → 策略 里切一个开关，客户手机屏对应的按钮立即出现或消失，不需要刷新。链路：

1. 页面动作调 `actions/policy.ts` 的 `setPolicyCap / addPolicyOverride` 改 `policyMatrix` 或 `policyOverrides`，zustand `persist` 写进 localStorage，另一个窗口通过 `storage` 事件同步。
2. 手机屏、工作台每个按钮都不直接读矩阵，而是问 `store/policy.ts`：客户端 `customerCan(s, customerId, key, groupId?)`，坐席端 `seatCan(s, seatId, key, groupId?)`，群管理权限 `seatGroupPerm(s, g, seatId, staffId, perm)`。
3. `resolveCap` 的裁决顺序（03 文档）：**模块授权**（`enterprise.modules[item.module]` 关了直接 false）→ **角色硬边界**（官方群 `group.leave` 对客户强制关）→ **策略矩阵**（企业默认，只有「客户」「坐席」两列：客户只有手机 App，坐席只有桌面工作台）→ **群级覆盖**（只作用于客户在该群里的能力）→ **用户级覆盖**（客户或坐席）。后一层覆盖前一层，返回 `{ allowed, source }`，`source` 说明是哪一层决定的。
4. 员工角色能力（`Role.caps`，如 `manage_bots / review_withdrawal`）与坐席策略是两套：前者管"这个人能不能进这个页面"，后者管"这个坐席在聊天层能不能做这件事"。工作台入口两个都查。

## 模型要点（技术团队看这里）

- **坐席（Seat）与员工（Staff）分离**。坐席是客户看到的官方身份，是一条官方类型的用户记录，不能登录；员工是真人登录账号，客户永远看不到。一个员工可持有多个坐席。
- **消息同时记 `seatId` 与 `operatorId`**。客户看到的是坐席署名，审计查到的是真人。`selectors.operatorAt` 按交接记录反推，与 `operatorId` 互为双保险。
- **坐席交接记录永久保留**（`handovers`），交接后显示名、头像、历史消息不变。
- **客户与坐席多对多**（`customerSeats`），一行一个官方联系人，其中一个是主归属。
- **邀请组放几个加几个**（`inviteGroups.seatIds`）。改组默认不追溯老客户，`backfillSeat` 是显式动作。
- **头衔与内部标签分表**（`titles` / `tags`）。头衔官方发、所有人可见、只能从库里选；内部标签客户永远看不到。

对应的产品文档在 `../docs/prd/`。
