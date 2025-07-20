/**
 * TextToSVG service class
 * Based on the original implementation by Hideki Shiro
 */

import opentype from 'opentype.js'
import svgpath from 'svgpath'
import { EnvelopeTransform } from './envelopeTransform'
import { TextToSVGOptions, TextMetrics, LineMetrics } from '../types'
import * as path from 'path'
import * as fs from 'fs/promises'

interface SingleLineMetrics {
  x: number
  y: number
  baseline: number
  width: number
  height: number
  ascender: number
  descender: number
}

interface MultilineMetrics {
  lines: LineMetrics[]
  totalWidth: number
  totalHeight: number
  x: number
  y: number
  lineHeight: number
  baseline: number
}

// Private method
function parseAnchorOption(anchor: string) {
  const matchH = anchor.match(/left|center|right/gi) || []
  const horizontal = matchH.length === 0 ? 'left' : matchH[0]

  const matchV = anchor.match(/baseline|top|bottom|middle/gi) || []
  const vertical = matchV.length === 0 ? 'baseline' : matchV[0]

  return { horizontal, vertical }
}

export default class TextToSVG {
  constructor(private font: opentype.Font) {}

  static async loadSync(file?: string): Promise<TextToSVG> {
    const fontsPath = path.join(process.cwd(), 'fonts')
    const defaultFont = file || path.join(fontsPath, 'SourceHanSerifJP-Light.otf')
    
    try {
      const fontBuffer = await fs.readFile(defaultFont)
      const font = opentype.parse(fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength
      ))
      return new TextToSVG(font)
    } catch (error) {
      throw new Error(`Failed to load font: ${error}`)
    }
  }

  static async load(url: string): Promise<TextToSVG> {
    return new Promise<TextToSVG>((resolve, reject) => {
      opentype.load(url, (err: any, font: any) => {
        if (err) {
          return reject(err)
        }
        if (!font) {
          return reject(new Error("Font not found"))
        }
        return resolve(new TextToSVG(font))
      })
    })
  }

  static parse(arrayBuffer: ArrayBuffer): TextToSVG {
    return new TextToSVG(opentype.parse(arrayBuffer))
  }

  getFont(): opentype.Font {
    return this.font
  }

  getWidth(text: string, options: TextToSVGOptions): number {
    const fontSize = options.fontSize || 72
    const kerning = 'kerning' in options ? options.kerning : true
    const fontScale = (1 / this.font.unitsPerEm) * fontSize

    let width = 0
    const glyphs = this.font.stringToGlyphs(text)
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i]

      if (glyph.advanceWidth) {
        width += glyph.advanceWidth * fontScale
      }

      if (kerning && i < glyphs.length - 1) {
        const kerningValue = this.font.getKerningValue(glyph, glyphs[i + 1])
        width += kerningValue * fontScale
      }

      if (options.letterSpacing) {
        width += options.letterSpacing * fontSize
      } else if (options.tracking) {
        width += (options.tracking / 1000) * fontSize
      }
    }
    return width
  }

  getHeight(fontSize: number): number {
    const fontScale = (1 / this.font.unitsPerEm) * fontSize
    return (this.font.ascender - this.font.descender) * fontScale
  }

  getMetrics(text: string, options: TextToSVGOptions = {}): TextMetrics {
    const writingMode = options.writingMode || 'horizontal'
    
    // Handle multiline text
    if (text.includes('\n')) {
      let multilineMetrics: MultilineMetrics
      if (writingMode === 'vertical') {
        multilineMetrics = this.getVerticalMultilineMetrics(text, options)
      } else {
        multilineMetrics = this.getMultilineMetrics(text, options)
      }
      return {
        x: multilineMetrics.x,
        y: multilineMetrics.y,
        baseline: multilineMetrics.baseline,
        width: multilineMetrics.totalWidth,
        height: multilineMetrics.totalHeight,
        ascender: multilineMetrics.lines[0].ascender,
        descender: multilineMetrics.lines[multilineMetrics.lines.length - 1].descender,
        lines: multilineMetrics.lines
      }
    }

    // Handle vertical writing mode for single line
    if (writingMode === 'vertical') {
      return this.getVerticalMetrics(text, options)
    }

    const fontSize = options.fontSize || 72
    const anchor = parseAnchorOption(options.anchor || '')

    const width = this.getWidth(text, options)
    const height = this.getHeight(fontSize)

    const fontScale = (1 / this.font.unitsPerEm) * fontSize
    const ascender = this.font.ascender * fontScale
    const descender = this.font.descender * fontScale

    let x = options.x || 0
    switch (anchor.horizontal) {
      case 'left':
        x -= 0
        break
      case 'center':
        x -= width / 2
        break
      case 'right':
        x -= width
        break
      default:
        throw new Error(`Unknown anchor option: ${anchor.horizontal}`)
    }

    let y = options.y || 0
    switch (anchor.vertical) {
      case 'baseline':
        y -= ascender
        break
      case 'top':
        y -= 0
        break
      case 'middle':
        y -= height / 2
        break
      case 'bottom':
        y -= height
        break
      default:
        throw new Error(`Unknown anchor option: ${anchor.vertical}`)
    }

    const baseline = y + ascender

    return {
      x,
      y,
      baseline,
      width,
      height,
      ascender,
      descender,
    }
  }

  getD(text: string, options: TextToSVGOptions = {}): string {
    const writingMode = options.writingMode || 'horizontal'
    
    // Handle multiline text
    if (text.includes('\n')) {
      if (writingMode === 'vertical') {
        return this.getVerticalMultilineD(text, options)
      } else {
        return this.getMultilineD(text, options)
      }
    }

    // Handle vertical writing mode (envelope and textAlign not supported)
    if (writingMode === 'vertical') {
      return this.getVerticalD(text, options)
    }

    const fontSize = options.fontSize || 72
    const kerning = 'kerning' in options ? options.kerning : true
    const letterSpacing =
      'letterSpacing' in options ? options.letterSpacing : undefined
    const tracking = 'tracking' in options ? options.tracking : undefined
    const metrics = this.getMetrics(text, options)
    const path = this.font.getPath(
      text,
      metrics.x,
      metrics.baseline,
      fontSize,
      { kerning, letterSpacing, tracking }
    )
    let pathData = path.toPathData(2)
    
    // Apply envelope transformation if specified
    if (options.envelope) {
      // Set text width for arc transformation
      if (options.envelope.arc) {
        options.envelope.arc.textWidth = metrics.width
        if (!options.envelope.arc.centerX) {
          options.envelope.arc.centerX = metrics.x + metrics.width / 2
        }
        if (!options.envelope.arc.centerY) {
          options.envelope.arc.centerY = metrics.baseline
        }
      }
      pathData = EnvelopeTransform.transform(pathData, options.envelope)
    }
    
    return pathData
  }

  getPath(text: string, options: TextToSVGOptions = {}): string {
    const attributes = options.attributes || {}
    const attributesStr = Object.keys(attributes)
      .map((key) => `${key}="${attributes[key]}"`)
      .join(' ')
    const d = this.getD(text, options)

    if (attributesStr) {
      return `<path ${attributesStr} d="${d}"/>`
    }

    return `<path d="${d}"/>`
  }

  getSVG(text: string, options: TextToSVGOptions = {}): string {
    options = JSON.parse(JSON.stringify(options))

    options.x = options.x || 0
    options.y = options.y || 0
    
    // Handle multiline text
    if (text.includes('\n')) {
      return this.getMultilineSVG(text, options)
    }
    
    // Simplified approach: Generate path with minimal anchor settings, then center in viewBox
    const pathOnlyOptions = { ...options }
    pathOnlyOptions.x = 0
    pathOnlyOptions.y = 0
    pathOnlyOptions.anchor = 'left top'
    
    const pathData = this.getD(text, pathOnlyOptions)
    
    // Calculate bounding box from actual path data
    const boundingBox = EnvelopeTransform.calculateBoundingBox(pathData)
    
    // Add padding for better visual appearance
    const padding = 10
    const boxWidth = boundingBox.width + padding * 2
    const boxHeight = boundingBox.height + padding * 2
    
    // Calculate translation to center path in viewBox
    const translateX = (boxWidth - boundingBox.width) / 2 - boundingBox.x
    const translateY = (boxHeight - boundingBox.height) / 2 - boundingBox.y
    
    // Apply translation to center the path
    const finalPathData = svgpath(pathData)
      .translate(translateX, translateY)
      .toString()

    // Build SVG with centered path data
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxWidth} ${boxHeight}">`
    
    // Add attributes to the path if specified
    if (options.attributes) {
      const attributesStr = Object.keys(options.attributes)
        .map((key) => `${key}="${options.attributes![key]}"`)
        .join(' ')
      svg += `<path ${attributesStr} d="${finalPathData}"/>`
    } else {
      svg += `<path d="${finalPathData}"/>`
    }
    
    svg += '</svg>'

    return svg
  }

  getDebugSVG(text: string, options: TextToSVGOptions = {}): string {
    options = JSON.parse(JSON.stringify(options))

    options.x = options.x || 0
    options.y = options.y || 0
    const writingMode = options.writingMode || 'horizontal'
    // Use consistent anchor settings for metrics calculation
    const metricsOptions = { ...options }
    metricsOptions.x = 0
    metricsOptions.y = 0
    metricsOptions.anchor = 'left top'
    const metrics = this.getMetrics(text, metricsOptions)
    
    // Calculate proper box dimensions handling negative coordinates
    const minX = metrics.x
    const maxX = metrics.x + metrics.width
    const minY = metrics.y
    const maxY = metrics.y + metrics.height
    
    const box = {
      width: maxX - minX,
      height: maxY - minY
    }
    
    const origin = {
      x: -minX,
      y: -minY
    }

    // Reset position options and get path data without position adjustment
    const pathOnlyOptions = { ...options }
    pathOnlyOptions.x = 0
    pathOnlyOptions.y = 0
    pathOnlyOptions.anchor = 'left top'
    
    const rawPathData = this.getD(text, pathOnlyOptions)
    
    // Apply translation for proper positioning
    const translatedPathData = svgpath(rawPathData)
      .translate(origin.x, origin.y)
      .toString()

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${box.width}" height="${box.height}">`
    
    // Add coordinate axes
    svg += `<path fill="none" stroke="red" stroke-width="1" d="M0,${origin.y}L${box.width},${origin.y}"/>` // X Axis
    svg += `<path fill="none" stroke="red" stroke-width="1" d="M${origin.x},0L${origin.x},${box.height}"/>` // Y Axis
    
    // Add debug information for multiline text
    if (text.includes('\n') && metrics.lines) {
      metrics.lines.forEach((line, index) => {
        const lineX = line.x + origin.x
        const lineY = line.y + origin.y
        const lineWidth = line.width
        const lineHeight = line.height
        
        // Draw line boundaries
        svg += `<rect fill="none" stroke="blue" stroke-width="0.5" stroke-dasharray="2,2" x="${lineX}" y="${lineY}" width="${lineWidth}" height="${lineHeight}"/>`
        
        // Add line number
        svg += `<text x="${lineX + 2}" y="${lineY + 12}" font-size="10" fill="blue">${index + 1}</text>`
      })
    }
    
    // Add the actual text path
    if (options.attributes) {
      const attributesStr = Object.keys(options.attributes)
        .map((key) => `${key}="${options.attributes![key]}"`)
        .join(' ')
      svg += `<path ${attributesStr} d="${translatedPathData}"/>`
    } else {
      svg += `<path d="${translatedPathData}"/>`
    }
    
    // Add writing mode indicator
    svg += `<text x="5" y="15" font-size="12" fill="green">Mode: ${writingMode}</text>`
    
    svg += '</svg>'

    return svg
  }

  // Private methods (simplified versions)
  private getMultilineMetrics(text: string, options: TextToSVGOptions = {}): MultilineMetrics {
    const lines = text.split('\n')
    const fontSize = options.fontSize || 72
    const lineHeight = (options.lineHeight || 1.2) * fontSize
    // const textAlign = options.textAlign || 'left'
    // const anchor = parseAnchorOption(options.anchor || '')

    // Calculate metrics for each line
    const lineMetrics: SingleLineMetrics[] = lines.map(() => {
      // Simplified - would need full implementation
      return {
        x: 0,
        y: 0,
        baseline: 0,
        width: 100,
        height: fontSize,
        ascender: fontSize * 0.8,
        descender: fontSize * 0.2
      }
    })

    const totalWidth = Math.max(...lineMetrics.map(m => m.width))
    const totalHeight = (lines.length - 1) * lineHeight + lineMetrics[0].height

    return {
      lines: [],
      totalWidth,
      totalHeight,
      x: 0,
      y: 0,
      lineHeight,
      baseline: 0
    }
  }

  private getVerticalMetrics(_text: string, _options: TextToSVGOptions = {}): SingleLineMetrics {
    // Simplified implementation
    const fontSize = _options.fontSize || 72
    return {
      x: 0,
      y: 0,
      baseline: 0,
      width: fontSize,
      height: _text.length * fontSize,
      ascender: fontSize * 0.8,
      descender: fontSize * 0.2
    }
  }

  private getVerticalMultilineMetrics(_text: string, _options: TextToSVGOptions = {}): MultilineMetrics {
    // Simplified implementation
    return {
      lines: [],
      totalWidth: 100,
      totalHeight: 100,
      x: 0,
      y: 0,
      lineHeight: 72,
      baseline: 0
    }
  }

  private getMultilineD(_text: string, _options: TextToSVGOptions = {}): string {
    // Simplified implementation - would need full implementation from original
    return ''
  }

  private getVerticalD(_text: string, _options: TextToSVGOptions = {}): string {
    // Simplified implementation - would need full implementation from original
    return ''
  }

  private getVerticalMultilineD(_text: string, _options: TextToSVGOptions = {}): string {
    // Simplified implementation - would need full implementation from original
    return ''
  }

  private getMultilineSVG(_text: string, _options: TextToSVGOptions = {}): string {
    // Simplified implementation - would need full implementation from original
    return `<svg xmlns="http://www.w3.org/2000/svg"><text>Multiline not fully implemented</text></svg>`
  }
}