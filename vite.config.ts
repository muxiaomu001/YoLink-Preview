import path from 'node:path'
import { copyFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

/** 静态托管的 SPA 兜底：把 index.html 复制一份成 404.html，刷新子路由不 404 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      try {
        copyFileSync(path.resolve(import.meta.dirname, 'dist/index.html'), path.resolve(import.meta.dirname, 'dist/404.html'))
      } catch {
        // 开发模式没有 dist，忽略
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // 部署到子路径（如 GitHub Pages）时用 VITE_BASE=/repo-name/
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
})
