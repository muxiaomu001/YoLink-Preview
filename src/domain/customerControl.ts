/**
 * 客户管控动作的共用文案与选项。
 *
 * 同一个动作在工作台（资料卡「更多」菜单）和管理后台（客户详情）各有一套界面，
 * 但确认框里对客户说的话必须一字不差——两处写两遍，改了一处忘了另一处，
 * 演示时就会出现"后台说会移出所有群、工作台说不会"这种自相矛盾。
 */

export const MUTE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '1 小时', hours: 1 },
  { label: '24 小时', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '永久', hours: null },
]

export const CONTROL_COPY = {
  resetPassword: '生成一次性新密码，只显示一次；客户首次登录强制修改。此操作记审计。',
  password: '只显示这一次，关闭后不能再查看。客户用它登录后会被强制修改密码。',
  blacklistOn: '拉黑后客户在所有官方号与群里都发不出消息，群发也会自动跳过他。',
  blacklistOff: '解除后客户可以重新发消息。',
  mute: '禁言期间客户在任何群与频道都发不了言，私聊不受影响。单个群的禁言在群信息卡里做。',
  forceLogout: '立即撤销该客户的全部登录 session，所有设备被登出。账号不停用、不影响消息，客户用原密码可以重新登录。',
  shadowOn: '开启后他在群里发的每条消息，只有他自己和坐席看得见，其他客户完全看不到。客户端没有任何提示，他会以为消息正常发出去了。适合已经确认在拉人、发广告，但还不想打草惊蛇的号。',
  shadowOff: '关闭后他之后发的消息恢复正常可见。影子期间发的那些消息仍然不对其他客户显示，不会突然集体冒出来。',
  delete: '账号不再出现在工作台，从所有群移出；数据保留供审计。此操作不可撤销。',
} as const

export function muteLabel(hours: number | null): string {
  return hours == null ? '永久' : `${hours} 小时`
}
