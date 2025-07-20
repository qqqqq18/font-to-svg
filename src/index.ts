import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import svgRoutes from './routes/svg'
import fontRoutes from './routes/fonts'
import cacheRoutes from './routes/cache'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors())
app.use('*', prettyJSON())

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'font-to-svg-api'
  })
})

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Font to SVG API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      svg: {
        generate: 'POST /api/svg',
        path: 'POST /api/svg/path',
        metrics: 'POST /api/svg/metrics'
      },
      fonts: {
        list: 'GET /api/fonts',
        upload: 'POST /api/fonts/upload'
      },
      cache: {
        stats: 'GET /api/cache/stats',
        clear: 'POST /api/cache/clear'
      }
    }
  })
})

// Mount routes
app.route('/api/svg', svgRoutes)
app.route('/api/fonts', fontRoutes)
app.route('/api/cache', cacheRoutes)

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'not_found',
      message: 'The requested endpoint does not exist'
    },
    404
  )
})

// Error handler
app.onError((err, c) => {
  console.error(`${err}`)
  return c.json(
    {
      error: 'internal_server_error',
      message: err.message || 'An unexpected error occurred'
    },
    500
  )
})

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})