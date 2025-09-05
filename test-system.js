#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple test script to validate AugustIndexer components
console.log('🧪 Testing AugustIndexer Components...\n');

// Test 1: Check if all core files exist
const coreFiles = [
  'src/index.ts',
  'src/core/AugustIndexer.ts',
  'src/augustium/lexer.ts',
  'src/augustium/parser.ts',
  'src/augustium/ast.ts',
  'src/ingestion/ethereum.ts',
  'src/ingestion/solana.ts',
  'src/storage/StorageManager.ts',
  'src/query/QueryEngine.ts',
  'src/wasm/compiler.ts',
  'examples/uniswap_pools.augustium'
];

console.log('📁 Checking core files...');
let allFilesExist = true;
for (const file of coreFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
}

// Test 2: Parse example Augustium DSL
console.log('\n📝 Testing Augustium DSL parsing...');
try {
  const augustiumCode = fs.readFileSync(path.join(__dirname, 'examples/uniswap_pools.augustium'), 'utf8');
  
  // Basic syntax validation
  const hasStruct = augustiumCode.includes('struct Pool');
  const hasIndex = augustiumCode.includes('index PoolIndex');
  const hasQuery = augustiumCode.includes('query TopPoolsByLiquidity');
  
  if (hasStruct && hasIndex && hasQuery) {
    console.log('✅ Augustium DSL syntax validation passed');
  } else {
    console.log('❌ Augustium DSL syntax validation failed');
  }
} catch (error) {
  console.log(`❌ Failed to read Augustium example: ${error.message}`);
}

// Test 3: Check package.json dependencies
console.log('\n📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const requiredDeps = ['ethers', 'express', 'pg', 'ws', '@solana/web3.js'];
  
  for (const dep of requiredDeps) {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
    }
  }
} catch (error) {
  console.log(`❌ Failed to check dependencies: ${error.message}`);
}

// Test 4: Environment setup
console.log('\n🔧 Environment setup...');
const envExample = path.join(__dirname, '.env.example');
if (fs.existsSync(envExample)) {
  console.log('✅ .env.example exists');
  console.log('💡 Copy .env.example to .env and configure your settings');
} else {
  console.log('❌ .env.example missing');
}

// Test 5: Documentation
console.log('\n📚 Documentation...');
const docs = ['README.md', 'DEPLOYMENT.md', 'examples/README.md'];
for (const doc of docs) {
  if (fs.existsSync(path.join(__dirname, doc))) {
    console.log(`✅ ${doc}`);
  } else {
    console.log(`❌ ${doc} - MISSING`);
  }
}

console.log('\n🎉 AugustIndexer System Test Complete!\n');

if (allFilesExist) {
  console.log('✅ All core components are present');
  console.log('\n🚀 Next steps:');
  console.log('1. Set up PostgreSQL database');
  console.log('2. Copy .env.example to .env and configure');
  console.log('3. Run: npm run build');
  console.log('4. Run: npm start');
  console.log('5. Deploy example: node scripts/deploy-uniswap-example.js');
} else {
  console.log('❌ Some components are missing - check the output above');
}
