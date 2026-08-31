import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 输出到 Worker 的静态资源目录，由 wrangler 一并部署
    outDir: '../worker/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // 开发时将 /api 请求转发到本地 wrangler dev（默认 8787 端口）
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
