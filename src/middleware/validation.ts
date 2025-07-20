import { z } from 'zod'

// Schema for text-to-svg options
export const textToSVGOptionsSchema = z.object({
  fontSize: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  tracking: z.number().optional(),
  kerning: z.boolean().optional(),
  anchor: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  attributes: z.record(z.any()).optional(),
  envelope: z.object({
    arc: z.object({
      angle: z.number(),
      textWidth: z.number().positive().optional(),
      centerX: z.number().optional(),
      centerY: z.number().optional()
    }).optional()
  }).optional(),
  lineHeight: z.number().positive().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  writingMode: z.enum(['horizontal', 'vertical']).optional()
}).optional()

// Schema for SVG generation request
export const svgGenerateRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  options: textToSVGOptionsSchema,
  fontFile: z.string().optional(),
  debug: z.boolean().optional()
})

// Schema for font upload
export const fontUploadSchema = z.object({
  name: z.string().min(1, 'Font name is required'),
  family: z.string().optional(),
  style: z.string().optional()
})