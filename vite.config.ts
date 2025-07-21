import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  build: {
    target: 'node18',
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'font-to-svg-api',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: [
        // Node.js built-in modules
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
        'os',
        'child_process',
        'util',
        'events',
        'assert',
        'zlib',
        'tls',
        'net',
        'dns',
        'readline',
        'vm',
        // Node.js prefix
        /^node:/,
        // Dependencies (these should not be bundled)
        '@hono/node-server',
        'hono',
        '@hono/zod-validator',
        'zod',
        'opentype.js',
        'svg-pathdata',
        'svgpath'
      ],
      output: {
        format: 'es'
      }
    },
    minify: false,
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  ssr: {
    noExternal: []
  }
})