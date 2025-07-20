// Simple example to test the API

async function testAPI() {
  const baseURL = 'http://localhost:3000';

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await fetch(`${baseURL}/health`);
    console.log('Health:', await healthResponse.json());

    // Test 2: Generate simple SVG
    console.log('\n2. Testing simple SVG generation...');
    const svgResponse = await fetch(`${baseURL}/api/svg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello World',
        options: {
          fontSize: 72,
          attributes: {
            fill: '#333333'
          }
        }
      })
    });
    const svgResult = await svgResponse.json();
    console.log('SVG generated:', svgResult.svg.substring(0, 100) + '...');
    console.log('Metrics:', svgResult.metrics);

    // Test 3: Multiline text (horizontal)
    console.log('\n3. Testing multiline text...');
    const multilineResponse = await fetch(`${baseURL}/api/svg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello World\nこんにちは世界',
        options: {
          fontSize: 48,
          attributes: {
            fill: '#333333'
          }
        }
      })
    });
    const multilineResult = await multilineResponse.json();
    console.log('Multiline SVG generated');
    console.log('Lines:', multilineResult.metrics.lines.length);

    // Test 4: Vertical writing mode
    console.log('\n4. Testing vertical writing mode...');
    const verticalResponse = await fetch(`${baseURL}/api/svg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello World',
        options: {
          writingMode: 'vertical',
          fontSize: 48,
          attributes: {
            fill: '#333333'
          }
        }
      })
    });
    const verticalResult = await verticalResponse.json();
    console.log('Vertical SVG generated');
    console.log('Dimensions:', { width: verticalResult.metrics.width, height: verticalResult.metrics.height });

    // Test 5: Vertical multiline
    console.log('\n5. Testing vertical multiline...');
    const verticalMultilineResponse = await fetch(`${baseURL}/api/svg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello\nこんにちは',
        options: {
          writingMode: 'vertical',
          fontSize: 48,
          attributes: {
            fill: '#333333'
          }
        }
      })
    });
    const verticalMultilineResult = await verticalMultilineResponse.json();
    console.log('Vertical multiline SVG generated');
    console.log('Lines (columns):', verticalMultilineResult.metrics.lines.length);

    // Test 6: Arc transformation
    console.log('\n6. Testing arc transformation...');
    const arcResponse = await fetch(`${baseURL}/api/svg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Curved Text',
        options: {
          fontSize: 48,
          envelope: {
            arc: {
              angle: 30
            }
          },
          attributes: {
            fill: '#333333'
          }
        }
      })
    });
    const arcResult = await arcResponse.json();
    console.log('Arc transformed SVG generated');
    console.log('Original metrics:', arcResult.metrics);

    // Test 7: List fonts
    console.log('\n7. Testing font list...');
    const fontsResponse = await fetch(`${baseURL}/api/fonts`);
    console.log('Available fonts:', await fontsResponse.json());

    // Test 8: Check cache stats
    console.log('\n8. Testing cache statistics...');
    const cacheStatsResponse = await fetch(`${baseURL}/api/cache/stats`);
    const cacheStats = await cacheStatsResponse.json();
    console.log('Cache stats:', {
      count: cacheStats.count,
      totalSize: cacheStats.totalSize,
      maxSize: cacheStats.maxSize,
      usage: cacheStats.usage.toFixed(2) + '%'
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Wait a bit for server to start, then run tests
console.log('Make sure the server is running on port 3000...');
console.log('Run: npm run dev\n');

// Uncomment to run tests:
testAPI();