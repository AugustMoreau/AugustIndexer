#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

async function deployUniswapExample() {
  try {
    console.log('🚀 Deploying Uniswap V3 indexer example...');

    // Read the Augustium DSL file
    const augustiumFile = path.join(__dirname, '..', 'examples', 'uniswap_pools.augustium');
    const augustiumCode = fs.readFileSync(augustiumFile, 'utf8');

    // Deploy to AugustIndexer
    const response = await fetch('http://localhost:3000/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: augustiumCode
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Uniswap indexer deployed successfully!');
      console.log('\n📊 Available queries:');
      console.log('- TopPoolsByLiquidity');
      console.log('- RecentSwapsForPool');
      console.log('- PoolsWithToken');
      console.log('- SwapVolumeByTimeRange');
      
      console.log('\n🔗 Example usage:');
      console.log('curl -X POST http://localhost:3000/query/TopPoolsByLiquidity \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log('  -d \'{"limit": 10}\'');
      
      console.log('\n📡 WebSocket endpoint: ws://localhost:3000');
      console.log('💡 Check health: curl http://localhost:3000/health');
    } else {
      console.error('❌ Deployment failed:');
      result.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Deployment error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure AugustIndexer is running:');
      console.error('   npm run dev');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  deployUniswapExample();
}
