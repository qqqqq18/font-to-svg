// TypeScript type definitions for the API

export interface TextToSVGOptions {
  fontSize?: number
  letterSpacing?: number
  tracking?: number
  kerning?: boolean
  anchor?: string
  x?: number
  y?: number
  attributes?: Record<string, any>
  envelope?: EnvelopeTransformOptions
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right'
  writingMode?: 'horizontal' | 'vertical'
}

export interface EnvelopeTransformOptions {
  arc?: ArcTransformOptions
}

export interface ArcTransformOptions {
  angle: number
  textWidth?: number
  centerX?: number
  centerY?: number
}

export interface SVGGenerateRequest {
  text: string
  options?: TextToSVGOptions
  fontFile?: string
  debug?: boolean
}

export interface SVGGenerateResponse {
  svg: string
  metrics?: TextMetrics
}

export interface SVGPathResponse {
  path: string
  metrics?: TextMetrics
}

export interface TextMetrics {
  x: number
  y: number
  baseline: number
  width: number
  height: number
  ascender: number
  descender: number
  lines?: LineMetrics[]
}

export interface LineMetrics {
  text: string
  x: number
  y: number
  baseline: number
  width: number
  height: number
  ascender: number
  descender: number
}

export interface FontInfo {
  name: string
  file: string
  family?: string
  style?: string
}

export interface ApiError {
  error: string
  message: string
  details?: any
}