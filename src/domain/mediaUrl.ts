/** 静态演示附件随部署子目录定位，同时兼容浏览器里已保存的 /media/ 旧地址。 */
export function mediaUrl(url: string): string {
  return url.startsWith('/media/') ? `${import.meta.env.BASE_URL}${url.slice(1)}` : url
}
