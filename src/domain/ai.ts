/**
 * AI 回复推荐（演示版）：按客户最后一句的关键词，从"知识库 + 合规口径"里拼出 2 到 3 条草稿。
 * 真实产品里这一步调用企业配置的 AI 服务，这里用规则模拟，结构与 14 文档模块 A 一致。
 */
import type { Customer, KnowledgeItem, Seat } from './types'

interface DraftInput {
  lastCustomerText: string
  customer: Customer
  seat: Seat
  knowledge: KnowledgeItem[]
}

export interface AiDraft {
  text: string
  basis: string
}

const COMPLIANCE = '以上仅为信息分享，不构成投资建议，请结合自身情况谨慎决策。'

export function draftsFor(input: DraftInput): AiDraft[] {
  const t = input.lastCustomerText
  const name = input.customer.nickname
  const kb = (title: string) => input.knowledge.find((k) => k.title.includes(title))

  if (/开户|材料|资料/.test(t)) {
    const k = kb('开户')
    return [
      { text: `${name}，开户需要三样：身份证正反面、近三个月地址证明、资金来源说明。在 App 里上传后一个工作日内审核完，通过后托管账户自动开通。需要我把清单发您一份吗？`, basis: `知识库「${k?.title ?? '开户流程与材料'}」` },
      { text: `好的，开户材料我让客户服务同事发您一份清单，您准备好上传就行，一般三个工作日内全部办完。`, basis: '知识库「开户流程与材料」+ 话术「开户材料」' },
    ]
  }
  if (/到账|汇款|入金|汇的/.test(t)) {
    return [
      { text: `收到，我帮您查。跨境汇款一般 1 到 2 个工作日到账，到账后系统会推送通知，我这边也会跟您确认。`, basis: '知识库「入金与到账时效」' },
      { text: `${name}，您这笔款正常今天下午能看到，我盯着，到了第一时间告诉您。`, basis: '知识库「入金与到账时效」+ 会话上下文' },
    ]
  }
  if (/还能进|能不能买|涨太多|高位|进吗/.test(t)) {
    return [
      { text: `${name}，短期能不能进我不敢下判断，谁也判断不了。您现在这类资产的占比在合理区间，如果担心高位，新增资金分三个月分批进，不用一次到位。${COMPLIANCE}`, basis: '知识库「合规口径」+ 客户组合' },
      { text: `研究部的看法是"不追高、按纪律配"。您的风险测评是${input.customer.tagIds.includes('tag_aggr') ? '进取型' : '稳健型'}，我建议按配置区间来，不看单日涨跌。${COMPLIANCE}`, basis: '知识库「风险测评与配置区间」+ 内部标签' },
    ]
  }
  if (/每次多少|分批|多少合适/.test(t)) {
    return [
      { text: `按您计划的新增金额平均分三份，每月同一天买入，波动大小都不改节奏。这样三个月下来成本是均摊的。`, basis: '会话上下文' },
      { text: `我建议每次三分之一，固定日期，机械执行。方案我写好发您确认。`, basis: '会话上下文' },
    ]
  }
  if (/赎回|跌|难受|不踏实/.test(t)) {
    return [
      { text: `理解您的感受。先说事实：当前回撤 8%，同期指数回撤 11%，产品跑赢指数。赎回随时可以，T+3 到账。想先问一句，这笔钱近期有用途吗？`, basis: '知识库「赎回规则」+ 客户购买记录' },
      { text: `给您两个选择：一是现在赎回落袋为安；二是保留但把占比减一半，难受的程度也减一半。您定，我都执行。`, basis: '知识库「合规口径」' },
    ]
  }
  if (/发我|看看|发一下|发过来/.test(t)) {
    return [
      { text: `好的，我今天整理好发您，晚上前给到。`, basis: '会话上下文' },
      { text: `${name}，资料我这就发您。看完有任何不清楚的，随时问我。`, basis: '话术 + 客户资料' },
    ]
  }
  if (/续费|到期|会员/.test(t)) {
    return [
      { text: `会员的核心是每季度的组合复盘，您今年两次调仓都是复盘时定的。我把这两次记录整理给您看看，再决定要不要续。`, basis: '知识库「私享会员权益」+ 会话上下文' },
      { text: `好的，我今天把这两次复盘记录整理好发您。`, basis: '会话上下文' },
    ]
  }
  if (/保守|太少|七成|比例/.test(t)) {
    return [
      { text: `测评看的是您能承受多大回撤，不是您想赚多少。先按四成跑三个月，看实际波动您舒不舒服，再往上调。${COMPLIANCE}`, basis: '知识库「风险测评与配置区间」' },
      { text: `可以调高，但我建议先跑一个季度。方案我今天整理好发您确认。`, basis: '会话上下文' },
    ]
  }
  if (/黄金|加一点|加仓/.test(t)) {
    return [
      { text: `您现在黄金占 8%，研究部的区间是 5% 到 12%。可以加到 10%，从货币基金里转，不动其他仓位。您确认我就下单。`, basis: '知识库「风险测评与配置区间」+ 每日策略' },
    ]
  }
  if (/谢谢|辛苦|收到|好的|行|确认/.test(t) && t.length <= 8) {
    return [
      { text: `不客气，有问题随时找我。`, basis: '话术库' },
      { text: `好的，${name}，我这边跟进，有进展第一时间告诉您。`, basis: '会话上下文' },
    ]
  }
  return [
    { text: `${name}，收到。我先了解一下您的情况：这笔资金大概计划放多久，一年以内还是三年以上？`, basis: '通用开场 + 客户资料' },
    { text: `好的，我看一下再回您，大概 10 分钟。`, basis: '话术库' },
    { text: `${COMPLIANCE}`, basis: '知识库「合规口径」' },
  ]
}
