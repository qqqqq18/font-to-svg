import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { svgGenerateRequestSchema } from '../middleware/validation'
import { handleValidationError, handleFontError } from '../middleware/errors'
import { SVGGenerateRequest, SVGGenerateResponse, SVGPathResponse } from '../types'
import { fontCache } from '../services/fontCache'

const svgRoutes = new Hono()

/**
 * POST /api/svg - Generate complete SVG element
 */
svgRoutes.post(
  '/',
  zValidator('json', svgGenerateRequestSchema, (result, c) => {
    if (!result.success) {
      return handleValidationError(c, result.error)
    }
    return
  }),
  async (c) => {
    try {
      const body: SVGGenerateRequest = await c.req.json()
      const { text, options = {}, fontFile, debug = false } = body

      const textToSVG = await fontCache.get(fontFile)
      
      let svg: string
      if (debug) {
        svg = textToSVG.getDebugSVG(text, options)
      } else {
        svg = textToSVG.getSVG(text, options)
      }
      
      const metrics = textToSVG.getMetrics(text, options)
      
      const response: SVGGenerateResponse = {
        svg,
        metrics
      }
      
      return c.json(response)
    } catch (error) {
      return handleFontError(c, error)
    }
  }
)

/**
 * POST /api/svg/path - Generate SVG path data only
 */
svgRoutes.post(
  '/path',
  zValidator('json', svgGenerateRequestSchema, (result, c) => {
    if (!result.success) {
      return handleValidationError(c, result.error)
    }
    return
  }),
  async (c) => {
    try {
      const body: SVGGenerateRequest = await c.req.json()
      const { text, options = {}, fontFile } = body

      const textToSVG = await fontCache.get(fontFile)
      const path = textToSVG.getD(text, options)
      const metrics = textToSVG.getMetrics(text, options)
      
      const response: SVGPathResponse = {
        path,
        metrics
      }
      
      return c.json(response)
    } catch (error) {
      return handleFontError(c, error)
    }
  }
)

/**
 * POST /api/svg/metrics - Get text metrics only
 */
svgRoutes.post(
  '/metrics',
  zValidator('json', svgGenerateRequestSchema, (result, c) => {
    if (!result.success) {
      return handleValidationError(c, result.error)
    }
    return
  }),
  async (c) => {
    try {
      const body: SVGGenerateRequest = await c.req.json()
      const { text, options = {}, fontFile } = body

      const textToSVG = await fontCache.get(fontFile)
      const metrics = textToSVG.getMetrics(text, options)
      
      return c.json({ metrics })
    } catch (error) {
      return handleFontError(c, error)
    }
  }
)

export default svgRoutes