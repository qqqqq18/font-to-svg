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
  
  getVerticalHeight(text: string, options: TextToSVGOptions): number {
    const fontSize = options.fontSize || 72
    const letterSpacing = 'letterSpacing' in options ? options.letterSpacing : undefined
    const tracking = 'tracking' in options ? options.tracking : undefined
    
    // Calculate character spacing margin (10% of font size)
    const charSpacing = fontSize * 0.1
    
    let height = 0
    const glyphs = this.font.stringToGlyphs(text)
    
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i]
      
      const char = String.fromCharCode(glyph.unicode || 0)
      if (char && char.charCodeAt(0) > 32) {  // Skip control characters and spaces
        // Get bounding box for this character
        const tempPath = glyph.getPath(0, 0, fontSize)
        const bbox = tempPath.getBoundingBox()
        const charHeight = bbox.y2 - bbox.y1
        
        // Add character height and spacing
        height += charHeight
        if (i < glyphs.length - 1) {
          height += charSpacing
        }
        
        // Apply additional letter spacing if specified
        if (letterSpacing) {
          height += letterSpacing * fontSize
        } else if (tracking) {
          height += (tracking / 1000) * fontSize
        }
      } else if (glyph.advanceWidth) {
        // For spaces in vertical text, use a more appropriate height
        // Use 60% of font size for better visual spacing
        const spaceHeight = fontSize * 0.6
        height += spaceHeight
      }
    }
    
    return height
  }

  getVerticalWidth(fontSize: number): number {
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
    const textAlign = options.textAlign || 'left'
    const anchor = parseAnchorOption(options.anchor || '')

    // Calculate metrics for each line
    const lineMetrics: LineMetrics[] = lines.map((line: string) => {
      const singleLineOptions = { ...options }
      delete singleLineOptions.lineHeight
      delete singleLineOptions.textAlign
      
      // For left alignment, force consistent anchor to ensure lines start at same position
      if (textAlign === 'left') {
        singleLineOptions.anchor = 'left top'
      }
      
      const metrics = this.getMetrics(line, singleLineOptions) as SingleLineMetrics
      return {
        text: line,
        x: metrics.x,
        y: metrics.y,
        baseline: metrics.baseline,
        width: metrics.width,
        height: metrics.height,
        ascender: metrics.ascender,
        descender: metrics.descender
      }
    })

    // Calculate overall dimensions
    const totalWidth: number = Math.max(...lineMetrics.map((m: LineMetrics) => m.width))
    const totalHeight: number = (lines.length - 1) * lineHeight + lineMetrics[0].height

    // Calculate positioning
    let x = options.x || 0
    let y = options.y || 0

    // Apply horizontal anchor to overall text block
    switch (anchor.horizontal) {
      case 'left':
        x -= 0
        break
      case 'center':
        x -= totalWidth / 2
        break
      case 'right':
        x -= totalWidth
        break
      default:
        throw new Error(`Unknown anchor option: ${anchor.horizontal}`)
    }

    // Apply vertical anchor to overall text block
    switch (anchor.vertical) {
      case 'baseline':
        y -= lineMetrics[0].ascender
        break
      case 'top':
        y -= 0
        break
      case 'middle':
        y -= totalHeight / 2
        break
      case 'bottom':
        y -= totalHeight
        break
      default:
        throw new Error(`Unknown anchor option: ${anchor.vertical}`)
    }

    // Position each line
    for (let i = 0; i < lineMetrics.length; i++) {
      const lineMetric = lineMetrics[i]
      
      // Horizontal alignment for each line
      switch (textAlign) {
        case 'left':
          lineMetric.x = x
          break
        case 'center':
          lineMetric.x = x + (totalWidth - lineMetric.width) / 2
          break
        case 'right':
          lineMetric.x = x + totalWidth - lineMetric.width
          break
      }
      
      // Vertical positioning
      lineMetric.y = y + i * lineHeight
      lineMetric.baseline = lineMetric.y + lineMetric.ascender
    }

    return {
      lines: lineMetrics,
      totalWidth,
      totalHeight,
      x,
      y,
      lineHeight,
      baseline: y + (lineMetrics.length > 0 ? lineMetrics[0].ascender : 0)
    }
  }

  private getVerticalMetrics(text: string, options: TextToSVGOptions = {}): SingleLineMetrics {
    const fontSize = options.fontSize || 72
    const anchor = parseAnchorOption(options.anchor || '')

    const height = this.getVerticalHeight(text, options)
    const width = this.getVerticalWidth(fontSize)

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
        // For vertical text, baseline means the starting point of the first character
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

  private getVerticalMultilineMetrics(text: string, options: TextToSVGOptions = {}): MultilineMetrics {
    const lines = text.split('\n')
    const fontSize = options.fontSize || 72
    const lineHeight = (options.lineHeight || 1.2) * fontSize
    const anchor = parseAnchorOption(options.anchor || '')

    // Calculate metrics for each line (column in vertical writing) without position adjustments
    const lineMetrics: LineMetrics[] = lines.map((line: string) => {
      const singleLineOptions = { ...options }
      delete singleLineOptions.lineHeight
      delete singleLineOptions.textAlign
      delete singleLineOptions.envelope
      delete singleLineOptions.x
      delete singleLineOptions.y
      delete singleLineOptions.anchor
      singleLineOptions.writingMode = 'vertical'
      const metrics = this.getVerticalMetrics(line, singleLineOptions) as SingleLineMetrics
      return {
        text: line,
        x: metrics.x,
        y: metrics.y,
        baseline: metrics.baseline,
        width: metrics.width,
        height: metrics.height,
        ascender: metrics.ascender,
        descender: metrics.descender
      }
    })

    // In vertical writing, total height is the max height of all lines (columns)
    // and total width is the sum of all line widths plus spacing
    const totalHeight: number = Math.max(...lineMetrics.map((m: LineMetrics) => m.height))
    const totalWidth: number = lineMetrics.length > 0 ? 
      lineMetrics[0].width + (lines.length - 1) * lineHeight : 0

    // Calculate base positioning
    let x = options.x || 0
    let y = options.y || 0

    // Apply horizontal anchor to overall text block
    switch (anchor.horizontal) {
      case 'left':
        x -= 0
        break
      case 'center':
        x -= totalWidth / 2
        break
      case 'right':
        x -= totalWidth
        break
      default:
        throw new Error(`Unknown anchor option: ${anchor.horizontal}`)
    }

    // Apply vertical anchor to overall text block
    const fontScale = (1 / this.font.unitsPerEm) * fontSize
    const ascender = this.font.ascender * fontScale
    
    switch (anchor.vertical) {
      case 'baseline':
        y -= ascender
        break
      case 'top':
        y -= 0
        break
      case 'middle':
        y -= totalHeight / 2
        break
      case 'bottom':
        y -= totalHeight
        break
      default:
        throw new Error(`Unknown anchor option: ${anchor.vertical}`)
    }

    // Position each line (column)
    // In vertical writing, lines progress from right to left
    for (let i = 0; i < lineMetrics.length; i++) {
      const lineMetric = lineMetrics[i]
      
      // Horizontal positioning - columns go right to left
      lineMetric.x = x + totalWidth - (i + 1) * lineHeight + (lineHeight - lineMetric.width) / 2
      
      // Vertical positioning
      lineMetric.y = y
      lineMetric.baseline = lineMetric.y + lineMetric.ascender
    }

    return {
      lines: lineMetrics,
      totalWidth,
      totalHeight,
      x,
      y,
      lineHeight,
      baseline: y + lineMetrics[0].ascender
    }
  }

  private getMultilineD(text: string, options: TextToSVGOptions = {}): string {
    const multilineMetrics = this.getMultilineMetrics(text, options)
    const fontSize = options.fontSize || 72
    const kerning = 'kerning' in options ? options.kerning : true
    const letterSpacing = 'letterSpacing' in options ? options.letterSpacing : undefined
    const tracking = 'tracking' in options ? options.tracking : undefined
    const textAlign = options.textAlign || 'left'

    // For left alignment, compensate for different left side bearings to align visual left edges
    if (textAlign === 'left') {
      // Get bbox.x1 for first character of each non-empty line
      const firstCharOffsets: (number | null)[] = multilineMetrics.lines.map(lineData => {
        if (lineData.text.trim() === '') return null
        const firstChar = lineData.text[0]
        const glyph = this.font.charToGlyph(firstChar)
        const path = glyph.getPath(0, 0, fontSize)
        const bbox = path.getBoundingBox()
        return bbox.x1
      })
      
      // Find minimum offset (leftmost visual edge)
      const validOffsets = firstCharOffsets.filter(offset => offset !== null) as number[]
      if (validOffsets.length > 0) {
        const minOffset = Math.min(...validOffsets)
        
        // Adjust each line's x position to align visual left edges
        multilineMetrics.lines.forEach((lineData, index) => {
          const offset = firstCharOffsets[index]
          if (offset !== null) {
            lineData.x -= (offset - minOffset)
          }
        })
      }
    }

    let combinedPathData = ''

    for (const lineData of multilineMetrics.lines) {
      if (lineData.text.trim() === '') {
        // Skip empty lines
        continue
      }

      const path = this.font.getPath(
        lineData.text,
        lineData.x,
        lineData.baseline,
        fontSize,
        { kerning, letterSpacing, tracking }
      )
      
      let linePathData = path.toPathData(2)
      
      // Apply envelope transformation to each line if specified
      if (options.envelope) {
        // Set text width for arc transformation
        if (options.envelope.arc) {
          options.envelope.arc.textWidth = lineData.width
          if (!options.envelope.arc.centerX) {
            options.envelope.arc.centerX = lineData.x + lineData.width / 2
          }
          if (!options.envelope.arc.centerY) {
            options.envelope.arc.centerY = lineData.baseline
          }
        }
        linePathData = EnvelopeTransform.transform(linePathData, options.envelope)
      }
      
      combinedPathData += linePathData
    }

    return combinedPathData
  }

  private getVerticalD(text: string, options: TextToSVGOptions = {}): string {
    const fontSize = options.fontSize || 72
    const letterSpacing = 'letterSpacing' in options ? options.letterSpacing : undefined
    const tracking = 'tracking' in options ? options.tracking : undefined
    
    const startX = options.x || 0
    const startY = options.y || 0
    
    // Calculate character spacing margin (10% of font size)
    const charSpacing = fontSize * 0.1
    
    // Get vertical column width for centering
    const columnWidth = this.getVerticalWidth(fontSize)
    
    const glyphs = this.font.stringToGlyphs(text)
    
    let combinedPathData = ''
    let currentY = startY
    
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i]
      
      // Get the character as a string for path generation
      const char = String.fromCharCode(glyph.unicode || 0)
      if (char && char.charCodeAt(0) > 32) {  // Skip control characters and spaces
        // Get bounding box for this character
        const tempPath = glyph.getPath(0, 0, fontSize)
        const bbox = tempPath.getBoundingBox()
        const charWidth = bbox.x2 - bbox.x1
        const charHeight = bbox.y2 - bbox.y1
        
        // Calculate horizontal centering offset
        const centerOffset = (columnWidth - charWidth) / 2 - bbox.x1
        const charX = startX + centerOffset
        
        // Position character with its top at currentY
        const charY = currentY - bbox.y1
        
        // Get the path for this single character at the calculated position
        const charPath = this.font.getPath(char, charX, charY, fontSize, { kerning: false })
        const pathData = charPath.toPathData(2)
        
        if (pathData) {
          combinedPathData += pathData
        }
        
        // Move to next character position (character height + spacing)
        currentY += charHeight + charSpacing
        
        // Apply additional letter spacing if specified
        if (letterSpacing) {
          currentY += letterSpacing * fontSize
        } else if (tracking) {
          currentY += (tracking / 1000) * fontSize
        }
      } else if (glyph.advanceWidth) {
        // For spaces in vertical text, use a more appropriate height
        // Use 60% of font size for better visual spacing
        const spaceHeight = fontSize * 0.6
        currentY += spaceHeight
      }
    }
    
    return combinedPathData
  }

  private getVerticalMultilineD(text: string, options: TextToSVGOptions = {}): string {
    const multilineMetrics = this.getVerticalMultilineMetrics(text, options)

    let combinedPathData = ''

    for (const lineData of multilineMetrics.lines) {
      if (lineData.text.trim() === '') {
        // Skip empty lines
        continue
      }

      const lineOptions = { ...options }
      lineOptions.x = lineData.x
      lineOptions.y = lineData.y
      lineOptions.writingMode = 'vertical'
      
      const linePathData = this.getVerticalD(lineData.text, lineOptions)
      combinedPathData += linePathData
    }

    return combinedPathData
  }

  private getMultilineSVG(text: string, options: TextToSVGOptions = {}): string {
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
}