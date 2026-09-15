const LINK_HOST = 'https://hxwm.example/i/'

export function linkUrl(code: string): string {
  return `${LINK_HOST}${code}`
}
