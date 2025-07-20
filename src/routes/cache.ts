import { Hono } from 'hono'
import { fontCache } from '../services/fontCache'

const cacheRoutes = new Hono()

/**
 * GET /api/cache/stats - Get cache statistics
 */
cacheRoutes.get('/stats', (c) => {
  const stats = fontCache.getStats()
  return c.json(stats)
})

/**
 * POST /api/cache/clear - Clear the font cache
 */
cacheRoutes.post('/clear', (c) => {
  fontCache.clear()
  return c.json({
    message: 'Font cache cleared successfully'
  })
})

export default cacheRoutes