import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export class AppError extends HTTPException {
  constructor(status: 400 | 401 | 403 | 404 | 500, message: string, details?: any) {
    super(status, { message })
    this.name = 'AppError'
    if (details) {
      Object.assign(this, { details })
    }
  }
}

export const handleValidationError = (c: Context, error: any) => {
  if (error.issues) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid request data',
        details: error.issues.map((issue: any) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      },
      400
    )
  }
  throw error
}

export const handleFontError = (c: Context, error: any) => {
  if (error.message?.includes('Font not found')) {
    return c.json(
      {
        error: 'font_not_found',
        message: 'The specified font file was not found'
      },
      404
    )
  }
  if (error.message?.includes('Invalid font')) {
    return c.json(
      {
        error: 'invalid_font',
        message: 'The font file is invalid or corrupted'
      },
      400
    )
  }
  throw error
}