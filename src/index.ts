import dotenv from 'dotenv';
import { AugustIndexer } from './core/AugustIndexer';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info('Starting AugustIndexer...');
    
    const indexer = new AugustIndexer({
      port: parseInt(process.env.PORT || '3000'),
      database: {
        url: process.env.DATABASE_URL || '',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        database: process.env.DATABASE_NAME || 'august_indexer',
        username: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || '',
      },
      chains: {
        ethereum: {
          rpcUrl: process.env.ETHEREUM_RPC_URL || '',
          wsUrl: process.env.ETHEREUM_WS_URL || '',
        },
        solana: {
          rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        },
        augustium: {
          rpcUrl: process.env.AUGUSTIUM_RPC_URL || '',
        },
      },
      storage: {
        enableIpfs: process.env.ENABLE_IPFS === 'true',
        ipfsUrl: process.env.IPFS_NODE_URL || 'http://localhost:5001',
        arweaveWalletPath: process.env.ARWEAVE_WALLET_PATH,
      },
      zkProofs: {
        enabled: process.env.ENABLE_ZK_PROOFS === 'true',
        augustZkEndpoint: process.env.AUGUST_ZK_ENDPOINT,
      },
      plugins: {
        directory: process.env.PLUGINS_DIR || './plugins',
        enableMlOptimization: process.env.ENABLE_ML_OPTIMIZATION === 'true',
      },
    });

    await indexer.start();
    
    logger.info(`AugustIndexer started successfully on port ${process.env.PORT || 3000}`);
  } catch (error) {
    logger.error('Failed to start AugustIndexer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
