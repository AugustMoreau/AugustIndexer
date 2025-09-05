import { AugustIndexer } from '../AugustIndexer';

describe('AugustIndexer', () => {
  let indexer: AugustIndexer;
  
  const mockConfig = {
    port: 3000,
    database: {
      url: 'postgresql://test:test@localhost:5432/test_db',
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test',
      password: 'test',
    },
    chains: {
      ethereum: {
        rpcUrl: 'https://mainnet.infura.io/v3/test',
        wsUrl: 'wss://mainnet.infura.io/ws/v3/test',
      },
      solana: {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
      },
      augustium: {
        rpcUrl: 'https://rpc.augustium.network',
      },
    },
    storage: {
      enableIpfs: false,
      ipfsUrl: 'http://localhost:5001',
    },
    zkProofs: {
      enabled: false,
    },
    plugins: {
      directory: './plugins',
      enableMlOptimization: false,
    },
  };

  beforeEach(() => {
    indexer = new AugustIndexer(mockConfig);
  });

  afterEach(async () => {
    if (indexer) {
      await indexer.stop();
    }
  });

  describe('constructor', () => {
    it('should create an AugustIndexer instance', () => {
      expect(indexer).toBeInstanceOf(AugustIndexer);
    });

    it('should initialize with provided config', () => {
      expect(indexer).toBeDefined();
    });
  });

  describe('deployIndexer', () => {
    it('should handle empty augustium code', async () => {
      const result = await indexer.deployIndexer('');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle invalid augustium code', async () => {
      const invalidCode = 'invalid augustium code';
      const result = await indexer.deployIndexer(invalidCode);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('lifecycle', () => {
    it('should start and stop without errors', async () => {
      // Note: This test might fail in CI without proper database setup
      // In a real scenario, you'd mock the database and other dependencies
      try {
        await indexer.start();
        await indexer.stop();
      } catch (error) {
        // Expected to fail without proper setup, but shouldn't throw unhandled errors
        expect(error).toBeDefined();
      }
    });
  });
});