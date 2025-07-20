/**
 * Envelope transformation for text-to-svg
 * Based on the original implementation by Kazuya Nagata
 */

import { SVGPathData } from 'svg-pathdata'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ArcTransformOptions {
  /** Arc angle in degrees (positive = upward arc, negative = downward arc) */
  angle: number
  /** Text width for arc calculation */
  textWidth?: number
  /** Center point of the arc transformation */
  centerX?: number
  /** Center point of the arc transformation */
  centerY?: number
}

export interface EnvelopeTransformOptions {
  /** Arc transformation options */
  arc?: ArcTransformOptions
}

/**
 * Mathematical utilities for envelope transformations
 */
class MathUtils {
  /**
   * Convert degrees to radians
   */
  static degToRad(deg: number): number {
    return (deg * Math.PI) / 180
  }

  /**
   * Convert radians to degrees
   */
  static radToDeg(rad: number): number {
    return (rad * 180) / Math.PI
  }
}

/**
 * Arc transformation implementation
 * 
 * Algorithm:
 * 1. Calculate arc radius from text width and arc angle
 * 2. Map each point from linear coordinate system to arc coordinate system
 * 3. Apply rotation based on tangent angle at each point
 */
class ArcTransform {
  private options: ArcTransformOptions
  private radius: number
  private angleRad: number

  constructor(options: ArcTransformOptions) {
    this.options = options
    this.angleRad = MathUtils.degToRad(Math.abs(options.angle))
    
    // Handle zero angle case
    if (this.angleRad === 0) {
      this.radius = 0
      return
    }
    
    // Calculate radius: R = textWidth / arcAngle (in radians)
    // For small angles, use arc length approximation
    if (this.angleRad < 0.1) {
      this.radius = (options.textWidth || 100) / this.angleRad
    } else {
      // For larger angles, use chord-to-radius formula
      this.radius = (options.textWidth || 100) / (2 * Math.sin(this.angleRad / 2))
    }
  }

  /**
   * Transform a single point from linear to arc coordinates
   */
  transformPoint(x: number, y: number): { x: number, y: number, rotation: number } {
    const { textWidth = 100, centerX = 0, centerY = 0, angle } = this.options
    
    // Handle zero angle case - no transformation
    if (this.angleRad === 0) {
      return {
        x: centerX + x,
        y: centerY + y,
        rotation: 0
      }
    }
    
    // Normalize x position to [-0.5, 0.5] range to center the text on the arc
    const normalizedX = (x / textWidth) - 0.5
    
    // Calculate the angle for this point on the arc
    const pointAngle = normalizedX * this.angleRad
    
    // For positive angles (upward arc), the arc bends upward
    // For negative angles (downward arc), the arc bends downward
    const isUpward = angle > 0
    
    // Calculate transformed coordinates
    const transformedX = centerX + this.radius * Math.sin(pointAngle)
    const transformedY = isUpward
      ? centerY - this.radius * (1 - Math.cos(pointAngle)) + y
      : centerY + this.radius * (1 - Math.cos(pointAngle)) + y
    
    // Calculate rotation angle (tangent to the arc)
    const rotation = MathUtils.radToDeg(pointAngle)
    
    return {
      x: transformedX,
      y: transformedY,
      rotation: isUpward ? rotation : -rotation
    }
  }

  /**
   * Transform SVG path data by applying arc transformation
   */
  transformPath(pathData: SVGPathData): SVGPathData {
    const transformedCommands = pathData.commands.map(cmd => {
      switch (cmd.type) {
        case SVGPathData.MOVE_TO:
        case SVGPathData.LINE_TO: {
          const transformed = this.transformPoint(cmd.x, cmd.y)
          return {
            ...cmd,
            x: transformed.x,
            y: transformed.y
          }
        }
        
        case SVGPathData.CURVE_TO: {
          const transformed = this.transformPoint(cmd.x, cmd.y)
          const cp1 = this.transformPoint(cmd.x1, cmd.y1)
          const cp2 = this.transformPoint(cmd.x2, cmd.y2)
          
          return {
            ...cmd,
            x: transformed.x,
            y: transformed.y,
            x1: cp1.x,
            y1: cp1.y,
            x2: cp2.x,
            y2: cp2.y
          }
        }
        
        case SVGPathData.QUAD_TO: {
          const transformed = this.transformPoint(cmd.x, cmd.y)
          const cp = this.transformPoint(cmd.x1, cmd.y1)
          
          return {
            ...cmd,
            x: transformed.x,
            y: transformed.y,
            x1: cp.x,
            y1: cp.y
          }
        }
        
        case SVGPathData.ARC: {
          // For arc commands, transform the end point
          const transformed = this.transformPoint(cmd.x, cmd.y)
          
          return {
            ...cmd,
            x: transformed.x,
            y: transformed.y
          }
        }
        
        default:
          return cmd
      }
    })
    
    return new SVGPathData(transformedCommands)
  }
}

/**
 * Main envelope transformation class
 */
export class EnvelopeTransform {
  /**
   * Apply envelope transformation to SVG path data
   */
  static transform(pathData: string, options: EnvelopeTransformOptions): string {
    const svgPathData = new SVGPathData(pathData)
    
    if (options.arc) {
      const arcTransform = new ArcTransform(options.arc)
      const transformedData = arcTransform.transformPath(svgPathData)
      return transformedData.encode()
    }
    
    // Return original path if no transformations specified
    return pathData
  }
  
  /**
   * Calculate bounding box of SVG path data
   */
  static calculateBoundingBox(pathData: string): BoundingBox {
    const svgPathData = new SVGPathData(pathData)
    
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    
    svgPathData.commands.forEach(cmd => {
      switch (cmd.type) {
        case SVGPathData.MOVE_TO:
        case SVGPathData.LINE_TO:
        case SVGPathData.CURVE_TO:
        case SVGPathData.QUAD_TO:
        case SVGPathData.ARC:
          minX = Math.min(minX, cmd.x)
          minY = Math.min(minY, cmd.y)
          maxX = Math.max(maxX, cmd.x)
          maxY = Math.max(maxY, cmd.y)
          
          // Also check control points for curves
          if ('x1' in cmd && 'y1' in cmd) {
            minX = Math.min(minX, cmd.x1)
            minY = Math.min(minY, cmd.y1)
            maxX = Math.max(maxX, cmd.x1)
            maxY = Math.max(maxY, cmd.y1)
          }
          if ('x2' in cmd && 'y2' in cmd) {
            minX = Math.min(minX, cmd.x2)
            minY = Math.min(minY, cmd.y2)
            maxX = Math.max(maxX, cmd.x2)
            maxY = Math.max(maxY, cmd.y2)
          }
          break
      }
    })
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
}