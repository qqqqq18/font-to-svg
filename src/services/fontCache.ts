import TextToSVG from './textToSvg'
import * as fs from 'fs/promises'
import * as path from 'path'

interface CachedFont {
  textToSVG: TextToSVG
  size: number // Size in bytes
  lastAccessed: number
  fontPath: string
}

export class FontCache {
  private cache = new Map<string, CachedFont>()
  private totalSize = 0
  private readonly maxSize = 256 * 1024 * 1024 // 256MB in bytes
  
  /**
   * Get or load a TextToSVG instance for the specified font
   */
  async get(fontFile?: string): Promise<TextToSVG> {
    const cacheKey = fontFile || 'default'
    
    // Check if already cached
    const cached = this.cache.get(cacheKey)
    if (cached) {
      // Update last accessed time
      cached.lastAccessed = Date.now()
      return cached.textToSVG
    }
    
    // Load font
    return await this.load(cacheKey, fontFile)
  }
  
  /**
   * Load a font and add to cache
   */
  private async load(cacheKey: string, fontFile?: string): Promise<TextToSVG> {
    let fontPath: string
    let textToSVG: TextToSVG
    
    if (fontFile) {
      // Custom font from uploads
      fontPath = path.join(process.cwd(), 'uploads', fontFile)
    } else {
      // Default font
      fontPath = path.join(process.cwd(), 'fonts', 'SourceHanSerifJP-Light.otf')
    }
    
    // Get file size
    const stats = await fs.stat(fontPath)
    const fileSize = stats.size
    
    // Check if we need to make space
    if (this.totalSize + fileSize > this.maxSize) {
      await this.evictLRU(fileSize)
    }
    
    // Load font
    textToSVG = await TextToSVG.loadSync(fontPath)
    
    // Add to cache
    const cachedFont: CachedFont = {
      textToSVG,
      size: fileSize,
      lastAccessed: Date.now(),
      fontPath
    }
    
    this.cache.set(cacheKey, cachedFont)
    this.totalSize += fileSize
    
    console.log(`Font cached: ${cacheKey} (${this.formatBytes(fileSize)}), Total cache size: ${this.formatBytes(this.totalSize)}`)
    
    return textToSVG
  }
  
  /**
   * Evict least recently used fonts to make space
   */
  private async evictLRU(requiredSpace: number) {
    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    
    let freedSpace = 0
    
    for (const [key, cached] of entries) {
      if (this.totalSize - freedSpace + requiredSpace <= this.maxSize) {
        break
      }
      
      // Remove from cache
      this.cache.delete(key)
      freedSpace += cached.size
      
      console.log(`Evicted font from cache: ${key} (${this.formatBytes(cached.size)})`)
    }
    
    this.totalSize -= freedSpace
  }
  
  /**
   * Clear all cached fonts
   */
  clear() {
    this.cache.clear()
    this.totalSize = 0
    console.log('Font cache cleared')
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      count: this.cache.size,
      totalSize: this.totalSize,
      maxSize: this.maxSize,
      usage: (this.totalSize / this.maxSize) * 100,
      fonts: Array.from(this.cache.entries()).map(([key, cached]) => ({
        key,
        size: cached.size,
        lastAccessed: new Date(cached.lastAccessed).toISOString()
      }))
    }
  }
  
  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Singleton instance
export const fontCache = new FontCache()