/**
 * 话术库种子：企业分类与话术（文字 / 图片 / 文件）+ 林薇的个人话术。
 * 图片和文件放在 public/media 下，消息里也复用同一批附件。
 */
import type { MessageMedia, QuickReply, QuickReplyCategory } from './types'
import { ago } from './time'

/** 演示附件：public/media 下的静态文件 */
export const MEDIA = {
  feeTable: { url: '/media/fee-table.svg', name: '产品费率表.svg', size: 2529, mime: 'image/svg+xml', width: 800, height: 500 },
  accountFlow: { url: '/media/account-flow.svg', name: '开户流程图.svg', size: 2659, mime: 'image/svg+xml', width: 800, height: 500 },
  riskLevels: { url: '/media/risk-levels.svg', name: '风险等级对照.svg', size: 2159, mime: 'image/svg+xml', width: 800, height: 500 },
  poster: { url: '/media/strategy-poster.svg', name: '四季度策略会海报.svg', size: 1799, mime: 'image/svg+xml', width: 600, height: 800 },
  productGuide: { url: '/media/product-guide.pdf', name: '恒信产品说明书.pdf', size: 612, mime: 'application/pdf' },
  checklist: { url: '/media/account-checklist.pdf', name: '开户材料清单.pdf', size: 624, mime: 'application/pdf' },
} satisfies Record<string, MessageMedia>

export const QUICK_REPLY_CATEGORIES: QuickReplyCategory[] = [
  { id: 'qrc_account', scope: 'enterprise', name: '开户与入金', sortOrder: 1 },
  { id: 'qrc_product', scope: 'enterprise', name: '产品与费率', sortOrder: 2 },
  { id: 'qrc_compliance', scope: 'enterprise', name: '合规口径', sortOrder: 3 },
  { id: 'qrc_event', scope: 'enterprise', name: '活动与海报', sortOrder: 4 },
  { id: 'qrc_lin_daily', scope: 'personal', staffId: 'st_lin', name: '我的常用', sortOrder: 1 },
]

export const QUICK_REPLIES: QuickReply[] = [
  // 开户与入金
  { id: 'qr_1', scope: 'enterprise', categoryId: 'qrc_account', kind: 'text', title: '开户材料', keywords: ['开户', '材料', '身份证', '地址证明'], text: '开户需要：身份证正反面、地址证明（近三个月水电或银行账单）、资金来源说明。上传后一个工作日内审核完成。', enabled: true, useCount: 46, lastUsedAt: ago(0, 3) },
  { id: 'qr_img_flow', scope: 'enterprise', categoryId: 'qrc_account', kind: 'image', title: '开户流程图', keywords: ['开户', '流程', '步骤', '怎么开'], text: '', media: MEDIA.accountFlow, enabled: true, useCount: 38, lastUsedAt: ago(0, 5) },
  { id: 'qr_file_checklist', scope: 'enterprise', categoryId: 'qrc_account', kind: 'file', title: '开户材料清单', keywords: ['开户', '清单', '材料'], text: '清单在附件里，按上面准备就行。', media: MEDIA.checklist, enabled: true, useCount: 21, lastUsedAt: ago(1, 2) },
  { id: 'qr_2', scope: 'enterprise', categoryId: 'qrc_account', kind: 'text', title: '入金时效', keywords: ['入金', '到账', '汇款', '多久', '打款'], text: '跨境汇款一般 1 到 2 个工作日到账，到账后系统自动通知，我这边也会跟您确认。', enabled: true, useCount: 33, lastUsedAt: ago(0, 8) },
  // 产品与费率
  { id: 'qr_img_fee', scope: 'enterprise', categoryId: 'qrc_product', kind: 'image', title: '产品费率表', keywords: ['费率', '管理费', '手续费', '多少钱', '收费'], text: '', media: MEDIA.feeTable, enabled: true, useCount: 57, lastUsedAt: ago(0, 1) },
  { id: 'qr_file_guide', scope: 'enterprise', categoryId: 'qrc_product', kind: 'file', title: '产品说明书', keywords: ['说明书', '产品', '介绍', '资料'], text: '这是产品说明书，重点看第二部分的配置区间。', media: MEDIA.productGuide, enabled: true, useCount: 29, lastUsedAt: ago(0, 6) },
  { id: 'qr_img_risk', scope: 'enterprise', categoryId: 'qrc_product', kind: 'image', title: '风险等级对照', keywords: ['风险', '测评', '等级', '保守', '稳健'], text: '', media: MEDIA.riskLevels, enabled: true, useCount: 24, lastUsedAt: ago(2, 1) },
  { id: 'qr_4', scope: 'enterprise', categoryId: 'qrc_product', kind: 'text', title: '风险测评', keywords: ['风险', '测评', '问卷'], text: '风险测评在 App"我的 → 风险测评"，大约 3 分钟。结果出来后我会结合您的情况给配置建议。', enabled: true, useCount: 40, lastUsedAt: ago(0, 4) },
  { id: 'qr_redeem', scope: 'enterprise', categoryId: 'qrc_product', kind: 'text', title: '赎回规则', keywords: ['赎回', '取出', '退出', '到账'], text: '赎回随时可以提交，T+3 个工作日到账，不收赎回费；部分赎回按份额比例。', enabled: true, useCount: 18, lastUsedAt: ago(3) },
  // 合规口径
  { id: 'qr_3', scope: 'enterprise', categoryId: 'qrc_compliance', kind: 'text', title: '合规声明', keywords: ['合规', '风险提示', '声明', '免责'], text: '温馨提示：以上内容仅为信息分享，不构成投资建议。投资有风险，请根据自身风险承受能力谨慎决策。', enabled: true, useCount: 88, lastUsedAt: ago(0, 0, 40) },
  { id: 'qr_no_promise', scope: 'enterprise', categoryId: 'qrc_compliance', kind: 'text', title: '不承诺收益', keywords: ['收益', '保本', '承诺', '稳赚', '多少利息'], text: '我们不承诺收益，也不预测短期涨跌。可以给您看历史区间和波动，具体怎么配还是要结合您的风险测评。', enabled: true, useCount: 35, lastUsedAt: ago(1) },
  { id: 'qr_old_promo', scope: 'enterprise', categoryId: 'qrc_compliance', kind: 'text', title: '（已停用）首月费率减免', keywords: ['减免', '优惠'], text: '首月管理费减免活动已结束。', enabled: false, useCount: 12, lastUsedAt: ago(30) },
  // 活动与海报
  { id: 'qr_img_poster', scope: 'enterprise', categoryId: 'qrc_event', kind: 'image', title: '四季度策略会海报', keywords: ['策略会', '活动', '报名', '线下', '海报'], text: '', media: MEDIA.poster, enabled: true, useCount: 61, lastUsedAt: ago(0, 2) },
  { id: 'qr_event_signup', scope: 'enterprise', categoryId: 'qrc_event', kind: 'text', title: '策略会报名', keywords: ['策略会', '报名', '活动', '席位'], text: '{{customer.nickname}}，10 月 12 日"四季度全球配置展望"线下策略会开放报名，回复"报名"我帮您登记席位。', enabled: true, useCount: 27, lastUsedAt: ago(0, 7) },
  // 未分类
  { id: 'qr_greeting', scope: 'enterprise', categoryId: null, kind: 'text', title: '问候开场', keywords: ['你好', '您好', '开场', '打招呼'], text: '{{customer.nickname}} 您好，我是 {{company.name}} 的 {{staff.name}}，很高兴为您服务。', enabled: true, useCount: 73, lastUsedAt: ago(0, 1) },
  // 林薇个人
  { id: 'qr_5', scope: 'personal', staffId: 'st_lin', categoryId: 'qrc_lin_daily', kind: 'text', title: '约时间', keywords: ['约', '时间', '电话', '方便'], text: '您看明天下午 3 点或 5 点，哪个时间方便？我们电话过一遍，20 分钟左右。', enabled: true, useCount: 19, lastUsedAt: ago(0, 9) },
  { id: 'qr_6', scope: 'personal', staffId: 'st_lin', categoryId: 'qrc_lin_daily', kind: 'text', title: '稍后回复', keywords: ['稍等', '一会', '看一下'], text: '好的，我看一下再回您，大概 10 分钟。', enabled: true, useCount: 31, lastUsedAt: ago(0, 2) },
  { id: 'qr_lin_thanks', scope: 'personal', staffId: 'st_lin', categoryId: null, kind: 'text', title: '结束语', keywords: ['谢谢', '不客气', '随时'], text: '不客气，有问题随时找我。', enabled: true, useCount: 44, lastUsedAt: ago(0, 1) },
]
