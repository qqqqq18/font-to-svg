# Font to SVG API

A REST API service built with Hono that converts text to SVG using custom fonts. This is a port of the original [text-to-svg](https://github.com/shrhdk/text-to-svg) Node.js library to a web API.

## Features

- Convert text to SVG with custom fonts (TTF/OTF)
- Multiple text rendering options (size, spacing, kerning, etc.)
- Support for multiline text with alignment options
- Vertical writing mode support
- Arc transformation effects
- Font management (upload, list, delete)
- Debug mode for visualizing text metrics
- Font caching with 256MB size limit and LRU eviction

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### SVG Generation

#### POST /api/svg
Generate a complete SVG element from text.

**Request Body:**
```json
{
  "text": "Hello World",
  "options": {
    "fontSize": 72,
    "anchor": "center middle",
    "attributes": {
      "fill": "#ff0000"
    }
  },
  "fontFile": "custom-font.otf",
  "debug": false
}
```

**Response:**
```json
{
  "svg": "<svg>...</svg>",
  "metrics": {
    "x": 0,
    "y": 0,
    "width": 100,
    "height": 50,
    "baseline": 40,
    "ascender": 40,
    "descender": 10
  }
}
```

#### POST /api/svg/path
Get only the SVG path data without the SVG wrapper.

**Request Body:** Same as `/api/svg`

**Response:**
```json
{
  "path": "M10,20 L30,40 ...",
  "metrics": { ... }
}
```

#### POST /api/svg/metrics
Get only the text metrics without generating SVG.

**Request Body:** Same as `/api/svg`

**Response:**
```json
{
  "metrics": { ... }
}
```

### Font Management

#### GET /api/fonts
List all available fonts.

**Response:**
```json
{
  "fonts": [
    {
      "name": "SourceHanSerifJP-Light",
      "file": "SourceHanSerifJP-Light.otf",
      "family": "Default",
      "style": "Regular"
    }
  ]
}
```

#### POST /api/fonts/upload
Upload a new font file.

**Request:** Multipart form data
- `font`: Font file (TTF or OTF)
- `name`: Display name for the font
- `family`: Font family name (optional)
- `style`: Font style (optional)

**Response:**
```json
{
  "message": "Font uploaded successfully",
  "font": {
    "name": "MyCustomFont",
    "file": "MyCustomFont-a1b2c3d4.ttf",
    "family": "Uploaded",
    "style": "Regular"
  }
}
```

#### DELETE /api/fonts/:filename
Delete an uploaded font (default fonts cannot be deleted).

**Response:**
```json
{
  "message": "Font deleted successfully"
}
```

### Cache Management

#### GET /api/cache/stats
Get font cache statistics.

**Response:**
```json
{
  "count": 2,
  "totalSize": 5242880,
  "maxSize": 268435456,
  "usage": 1.95,
  "fonts": [
    {
      "key": "default",
      "size": 3145728,
      "lastAccessed": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

#### POST /api/cache/clear
Clear the font cache.

**Response:**
```json
{
  "message": "Font cache cleared successfully"
}
```

## Options

### Text Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fontSize` | number | 72 | Font size in pixels |
| `letterSpacing` | number | 0 | Additional spacing between letters |
| `tracking` | number | 0 | Tracking value (in 1/1000 em) |
| `kerning` | boolean | true | Enable font kerning |
| `anchor` | string | "left baseline" | Anchor point (combination of horizontal: left/center/right and vertical: top/middle/bottom/baseline) |
| `x` | number | 0 | X coordinate |
| `y` | number | 0 | Y coordinate |
| `attributes` | object | {} | SVG attributes to add to the path element |

### Multiline Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lineHeight` | number | 1.2 | Line height multiplier |
| `textAlign` | string | "left" | Text alignment (left/center/right) |

### Writing Mode

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `writingMode` | string | "horizontal" | Writing mode (horizontal/vertical) |

### Envelope Transform

| Option | Type | Description |
|--------|------|-------------|
| `envelope.arc.angle` | number | Arc angle in degrees (positive = upward, negative = downward) |
| `envelope.arc.centerX` | number | Arc center X coordinate |
| `envelope.arc.centerY` | number | Arc center Y coordinate |

## Examples

### Basic Text

```bash
curl -X POST http://localhost:3000/api/svg \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello World",
    "options": {
      "fontSize": 48,
      "attributes": {
        "fill": "#333"
      }
    }
  }'
```

### Multiline Text with Center Alignment

```bash
curl -X POST http://localhost:3000/api/svg \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Line 1\\nLine 2\\nLine 3",
    "options": {
      "fontSize": 36,
      "lineHeight": 1.5,
      "textAlign": "center",
      "anchor": "center middle"
    }
  }'
```

### Arc Transformation

```bash
curl -X POST http://localhost:3000/api/svg \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Curved Text",
    "options": {
      "fontSize": 60,
      "envelope": {
        "arc": {
          "angle": 45
        }
      }
    }
  }'
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Font License

The default font (Source Han Serif JP) is licensed under the SIL Open Font License, Version 1.1.
- Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.
- Source Han Serif is a trademark of Adobe in the United States and/or other countries.

For more information about the font license, visit: https://github.com/adobe-fonts/source-han-serif

## Credits

This project is a REST API implementation based on the original [text-to-svg](https://github.com/shrhdk/text-to-svg) library by Hideki Shiro.

### Dependencies

- [opentype.js](https://github.com/nodebox/opentype.js): Copyright (c) 2015 Frederik De Bleser
- [svg-pathdata](https://github.com/nfroidure/svg-pathdata): Copyright (c) 2017 Nicolas Froidure
- [svgpath](https://github.com/fontello/svgpath): Copyright (c) 2013-2015 Vitaly Puzrin
- [hono](https://github.com/honojs/hono): Copyright (c) 2021-present Yusuke Wada
- [zod](https://github.com/colinhacks/zod): Copyright (c) 2020 Colin McDonnell

All of the above are released under the MIT license.