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

    // Test 3: List fonts
    console.log('\n3. Testing font list...');
    const fontsResponse = await fetch(`${baseURL}/api/fonts`);
    console.log('Available fonts:', await fontsResponse.json());

    // Test 4: Check cache stats
    console.log('\n4. Testing cache statistics...');
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