import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { fontUploadSchema } from '../middleware/validation'
import { handleValidationError } from '../middleware/errors'
import { FontInfo } from '../types'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

const fontRoutes = new Hono()

/**
 * Get list of available fonts
 */
async function getAvailableFonts(): Promise<FontInfo[]> {
  const fonts: FontInfo[] = []
  
  // Default fonts
  const defaultFontsDir = path.join(process.cwd(), 'fonts')
  try {
    const defaultFiles = await fs.readdir(defaultFontsDir)
    for (const file of defaultFiles) {
      if (file.match(/\.(ttf|otf)$/i)) {
        fonts.push({
          name: file.replace(/\.(ttf|otf)$/i, ''),
          file: file,
          family: 'Default',
          style: 'Regular'
        })
      }
    }
  } catch (error) {
    console.error('Failed to read default fonts directory:', error)
  }
  
  // Uploaded fonts
  const uploadsDir = path.join(process.cwd(), 'uploads')
  try {
    await fs.mkdir(uploadsDir, { recursive: true })
    const uploadedFiles = await fs.readdir(uploadsDir)
    for (const file of uploadedFiles) {
      if (file.match(/\.(ttf|otf)$/i)) {
        fonts.push({
          name: file.replace(/\.(ttf|otf)$/i, ''),
          file: file,
          family: 'Uploaded',
          style: 'Regular'
        })
      }
    }
  } catch (error) {
    console.error('Failed to read uploads directory:', error)
  }
  
  return fonts
}

/**
 * GET /api/fonts - List all available fonts
 */
fontRoutes.get('/', async (c) => {
  try {
    const fonts = await getAvailableFonts()
    return c.json({ fonts })
  } catch (error) {
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to list fonts'
      },
      500
    )
  }
})

/**
 * POST /api/fonts/upload - Upload a new font file
 */
fontRoutes.post(
  '/upload',
  zValidator('form', fontUploadSchema, (result, c) => {
    if (!result.success) {
      return handleValidationError(c, result.error)
    }
    return
  }),
  async (c) => {
    try {
      const body = await c.req.parseBody()
      const file = body['font'] as File
      
      if (!file) {
        return c.json(
          {
            error: 'missing_file',
            message: 'No font file was uploaded'
          },
          400
        )
      }
      
      // Validate file extension
      if (!file.name.match(/\.(ttf|otf)$/i)) {
        return c.json(
          {
            error: 'invalid_file_type',
            message: 'Only TTF and OTF font files are supported'
          },
          400
        )
      }
      
      // Generate unique filename
      const ext = path.extname(file.name)
      const baseName = path.basename(file.name, ext)
      const hash = crypto.randomBytes(4).toString('hex')
      const filename = `${baseName}-${hash}${ext}`
      
      // Save file
      const uploadsDir = path.join(process.cwd(), 'uploads')
      await fs.mkdir(uploadsDir, { recursive: true })
      
      const filePath = path.join(uploadsDir, filename)
      const buffer = await file.arrayBuffer()
      await fs.writeFile(filePath, Buffer.from(buffer))
      
      // Return font info
      const fontInfo: FontInfo = {
        name: body['name'] as string || baseName,
        file: filename,
        family: body['family'] as string || 'Uploaded',
        style: body['style'] as string || 'Regular'
      }
      
      return c.json({
        message: 'Font uploaded successfully',
        font: fontInfo
      }, 201)
    } catch (error) {
      console.error('Font upload error:', error)
      return c.json(
        {
          error: 'upload_failed',
          message: 'Failed to upload font file'
        },
        500
      )
    }
  }
)

/**
 * DELETE /api/fonts/:filename - Delete an uploaded font
 */
fontRoutes.delete('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename')
    
    // Prevent deletion of default fonts
    const defaultFontsDir = path.join(process.cwd(), 'fonts')
    const defaultPath = path.join(defaultFontsDir, filename)
    
    try {
      await fs.access(defaultPath)
      return c.json(
        {
          error: 'forbidden',
          message: 'Cannot delete default fonts'
        },
        403
      )
    } catch {
      // File doesn't exist in default fonts, continue
    }
    
    // Delete from uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads')
    const uploadPath = path.join(uploadsDir, filename)
    
    try {
      await fs.unlink(uploadPath)
      return c.json({
        message: 'Font deleted successfully'
      })
    } catch (error) {
      return c.json(
        {
          error: 'not_found',
          message: 'Font file not found'
        },
        404
      )
    }
  } catch (error) {
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to delete font'
      },
      500
    )
  }
})

export default fontRoutes