// PostgreSQL storage manager for indexed blockchain data

import { Pool, PoolClient } from 'pg';
import { DatabaseConfig, IndexDefinition, IndexedData, AugustiumSchema } from '../types';
import { logger } from '../utils/logger';

export class StorageManager {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('PostgreSQL pool error:', err);
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      
      logger.info(`Connected to PostgreSQL database: ${this.config.database}`);
      logger.info(`Database time: ${result.rows[0].now}`);

      // Create core tables
      await this.createCoreTables();
      
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error}`);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('PostgreSQL connection pool closed');
  }

  private async createCoreTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create indexes metadata table
      await client.query(`
        CREATE TABLE IF NOT EXISTS august_indexes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          chain VARCHAR(50) NOT NULL,
          network VARCHAR(50) NOT NULL,
          contract_address VARCHAR(255) NOT NULL,
          schema_definition JSONB NOT NULL,
          mapping_code TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create queries metadata table
      await client.query(`
        CREATE TABLE IF NOT EXISTS august_queries (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          from_index VARCHAR(255) NOT NULL,
          parameters JSONB,
          where_clauses JSONB,
          order_by JSONB,
          limit_value INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create ingestion status table
      await client.query(`
        CREATE TABLE IF NOT EXISTS august_ingestion_status (
          id SERIAL PRIMARY KEY,
          index_name VARCHAR(255) NOT NULL,
          chain VARCHAR(50) NOT NULL,
          last_processed_block BIGINT NOT NULL DEFAULT 0,
          last_processed_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(index_name, chain)
        )
      `);

      // Create events log table for debugging
      await client.query(`
        CREATE TABLE IF NOT EXISTS august_events_log (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(255) NOT NULL,
          index_name VARCHAR(255) NOT NULL,
          chain VARCHAR(50) NOT NULL,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(255),
          contract_address VARCHAR(255) NOT NULL,
          event_name VARCHAR(255) NOT NULL,
          event_data JSONB NOT NULL,
          processed_at TIMESTAMP DEFAULT NOW(),
          INDEX(block_number),
          INDEX(contract_address),
          INDEX(processed_at)
        )
      `);

      await client.query('COMMIT');
      logger.info('Core storage tables created successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createIndexTables(indexes: IndexDefinition[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const index of indexes) {
        // Create table for indexed data
        const tableName = `august_index_${index.name.toLowerCase()}`;
        const createTableSQL = this.generateCreateTableSQL(tableName, index.schema);
        
        await client.query(createTableSQL);
        
        // Insert index metadata
        await client.query(`
          INSERT INTO august_indexes (name, chain, network, contract_address, schema_definition, mapping_code)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (name) DO UPDATE SET
            chain = EXCLUDED.chain,
            network = EXCLUDED.network,
            contract_address = EXCLUDED.contract_address,
            schema_definition = EXCLUDED.schema_definition,
            mapping_code = EXCLUDED.mapping_code,
            updated_at = NOW()
        `, [
          index.name,
          index.source.chain,
          index.source.network,
          index.contract,
          JSON.stringify(index.schema),
          index.mapping.code
        ]);

        logger.info(`Created table for index: ${index.name}`);
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private generateCreateTableSQL(tableName: string, schema: AugustiumSchema): string {
    let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    sql += '  id SERIAL PRIMARY KEY,\n';
    
    // Add schema fields
    for (const field of schema.fields) {
      const pgType = this.augustiumTypeToPgType(field.type);
      const nullable = field.nullable ? '' : ' NOT NULL';
      sql += `  ${field.name.toLowerCase()} ${pgType}${nullable},\n`;
    }
    
    // Add metadata fields
    sql += '  block_number BIGINT NOT NULL,\n';
    sql += '  transaction_hash VARCHAR(255),\n';
    sql += '  event_id VARCHAR(255) UNIQUE NOT NULL,\n';
    sql += '  indexed_at TIMESTAMP DEFAULT NOW(),\n';
    sql += '  INDEX(block_number),\n';
    sql += '  INDEX(transaction_hash),\n';
    sql += '  INDEX(indexed_at)\n';
    sql += ')';
    
    return sql;
  }

  private augustiumTypeToPgType(augustiumType: string): string {
    switch (augustiumType) {
      case 'Address':
        return 'VARCHAR(42)'; // Ethereum address format
      case 'U256':
      case 'U128':
        return 'NUMERIC(78, 0)'; // Large integer
      case 'U64':
        return 'BIGINT';
      case 'U32':
        return 'INTEGER';
      case 'String':
        return 'TEXT';
      case 'Bool':
        return 'BOOLEAN';
      case 'Bytes':
        return 'BYTEA';
      default:
        return 'TEXT'; // Fallback
    }
  }

  async storeIndexedData(indexName: string, data: IndexedData): Promise<void> {
    const tableName = `august_index_${indexName.toLowerCase()}`;
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Store in index-specific table
      const fields = Object.keys(data.data);
      const values = Object.values(data.data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const fieldNames = fields.map(f => f.toLowerCase()).join(', ');
      
      const insertSQL = `
        INSERT INTO ${tableName} (${fieldNames}, block_number, transaction_hash, event_id)
        VALUES (${placeholders}, $${values.length + 1}, $${values.length + 2}, $${values.length + 3})
        ON CONFLICT (event_id) DO UPDATE SET
          ${fields.map((f, i) => `${f.toLowerCase()} = $${i + 1}`).join(', ')},
          block_number = $${values.length + 1},
          transaction_hash = $${values.length + 2},
          indexed_at = NOW()
      `;
      
      await client.query(insertSQL, [
        ...values,
        data.blockNumber,
        data.transactionHash,
        data.id
      ]);

      // Log event for debugging
      await client.query(`
        INSERT INTO august_events_log (event_id, index_name, chain, block_number, transaction_hash, contract_address, event_name, event_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (event_id) DO NOTHING
      `, [
        data.id,
        indexName,
        'unknown', // Would be passed from the calling context
        data.blockNumber,
        data.transactionHash,
        'unknown', // Would be passed from the calling context
        'unknown', // Would be passed from the calling context
        JSON.stringify(data.data)
      ]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to store indexed data for ${indexName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async queryIndexedData(indexName: string, whereClause?: string, orderBy?: string, limit?: number): Promise<any[]> {
    const tableName = `august_index_${indexName.toLowerCase()}`;
    
    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateIngestionStatus(indexName: string, chain: string, blockNumber: number): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        INSERT INTO august_ingestion_status (index_name, chain, last_processed_block, last_processed_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (index_name, chain) DO UPDATE SET
          last_processed_block = EXCLUDED.last_processed_block,
          last_processed_at = NOW()
      `, [indexName, chain, blockNumber]);
      
    } finally {
      client.release();
    }
  }

  async getIngestionStatus(indexName: string, chain: string): Promise<{ lastProcessedBlock: number; lastProcessedAt: Date } | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT last_processed_block, last_processed_at
        FROM august_ingestion_status
        WHERE index_name = $1 AND chain = $2
      `, [indexName, chain]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return {
        lastProcessedBlock: result.rows[0].last_processed_block,
        lastProcessedAt: result.rows[0].last_processed_at
      };
      
    } finally {
      client.release();
    }
  }

  async getIndexStats(indexName: string): Promise<{ totalRecords: number; latestBlock: number; oldestBlock: number }> {
    const tableName = `august_index_${indexName.toLowerCase()}`;
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_records,
          MAX(block_number) as latest_block,
          MIN(block_number) as oldest_block
        FROM ${tableName}
      `);
      
      return {
        totalRecords: parseInt(result.rows[0].total_records),
        latestBlock: result.rows[0].latest_block || 0,
        oldestBlock: result.rows[0].oldest_block || 0
      };
      
    } finally {
      client.release();
    }
  }

  async executeRawQuery(sql: string, params: any[] = []): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Utility method for health checks
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('Storage health check failed:', error);
      return false;
    }
  }
}
