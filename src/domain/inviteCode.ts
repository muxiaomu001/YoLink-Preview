/**
 * 邀请码：邀请组和邀请链接共用一个命名空间——注册时先按邀请组的码查，
 * 查不到再按邀请链接的码查，所以两边不能重复。
 *
 * 随机生成的码去掉了 I O 0 1：客服口播邀请码时「HELLO1」和「HELL01」会天天出事。
 * 自定义的码不拦这几个字符——写年份、写品牌缩写都绕不开 0 和 1，是不是好记由填的人自己判断。
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const INVITE_CODE_MIN = 4
export const INVITE_CODE_MAX = 16
export const INVITE_CODE_HINT = `${INVITE_CODE_MIN}-${INVITE_CODE_MAX} 位大写字母或数字`

/** 随机生成一个邀请码 */
export function newInviteCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i += 1) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return code
}

/** 统一大小写与空白，输入小写自动转大写 */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/**
 * 校验自定义邀请码，通过返回 undefined。
 * taken 传入已占用的码（含邀请组与邀请链接），改码时记得把自己排除掉。
 */
export function inviteCodeError(raw: string, taken: Iterable<string>): string | undefined {
  const code = normalizeInviteCode(raw)
  if (!code) return '请填写邀请码'
  if (code.length < INVITE_CODE_MIN || code.length > INVITE_CODE_MAX) return `邀请码需 ${INVITE_CODE_MIN}-${INVITE_CODE_MAX} 位`
  if (!/^[A-Z0-9]+$/.test(code)) return '邀请码只能用大写字母和数字'
  const used = new Set([...taken].map(normalizeInviteCode))
  if (used.has(code)) return '这个邀请码已被其他邀请组或邀请链接占用'
  return undefined
}
