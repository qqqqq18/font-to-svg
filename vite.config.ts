import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'font-to-svg-api',
      fileName: 'index',
      formats: ['cjs']
    },
    rollupOptions: {
      external: [
        /^node:/,
        'fs',
        'fs/promises',
        'path',
        'url',
        'buffer',
        'stream',
        'crypto',
        'http',
        'http2',
        'https',
        '@hono/node-server',
        'hono',
        '@hono/zod-validator',
        'zod',
        'opentype.js',
        'svg-pathdata',
        'svgpath'
      ],
      output: {
        format: 'cjs'
      }
    },
    target: 'node18',
    ssr: true
  }
})