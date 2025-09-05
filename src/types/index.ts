// Core configuration types
export interface CacheConfig {
  maxSize?: number;
  defaultTTL?: number;
  persistToDisk?: boolean;
}

export interface AugustIndexerConfig {
  port: number;
  database: DatabaseConfig;
  chains: ChainConfig;
  storage: StorageConfig;
  zkProofs: ZkProofConfig;
  plugins: PluginConfig;
  cache?: CacheConfig;
}

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ChainConfig {
  ethereum: EthereumConfig;
  solana: SolanaConfig;
  augustium: AugustiumConfig;
}

export interface EthereumConfig {
  rpcUrl: string;
  wsUrl: string;
}

export interface SolanaConfig {
  rpcUrl: string;
}

export interface AugustiumConfig {
  rpcUrl: string;
}

export interface StorageConfig {
  enableIpfs: boolean;
  ipfsUrl: string;
  arweaveWalletPath?: string;
}

export interface ZkProofConfig {
  enabled: boolean;
  augustZkEndpoint?: string;
}

export interface PluginConfig {
  directory: string;
  enableMlOptimization: boolean;
}

// Augustium DSL types
export interface AugustiumSchema {
  name: string;
  fields: SchemaField[];
}

export interface SchemaField {
  name: string;
  type: AugustiumType;
  nullable?: boolean;
}

export type AugustiumType = 'Address' | 'U256' | 'U128' | 'U64' | 'U32' | 'String' | 'Bool' | 'Bytes';

export interface IndexDefinition {
  name: string;
  source: ChainSource;
  contract: string;
  events?: string[];
  mapping: MappingFunction;
  schema: AugustiumSchema;
}

export interface ChainSource {
  chain: 'Ethereum' | 'Solana' | 'Augustium';
  network: string;
}

export interface MappingFunction {
  code: string;
  wasmModule?: any; // WebAssembly.Module
}

export interface QueryDefinition {
  name: string;
  parameters: QueryParameter[];
  from: string;
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
}

export interface QueryParameter {
  name: string;
  type: AugustiumType;
  required: boolean;
}

export interface WhereClause {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: any;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

// Blockchain event types
export interface BlockchainEvent {
  id: string;
  blockNumber: number;
  transactionHash: string;
  contractAddress: string;
  eventName: string;
  data: Record<string, any>;
  timestamp: Date;
  chain: string;
}

export interface IndexedData {
  id: string;
  indexName: string;
  data: Record<string, any>;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

// Plugin system types
export interface Plugin {
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  process?(data: any): Promise<any>;
  cleanup?(): Promise<void>;
}

export interface PluginContext {
  logger: any;
  storage: any;
  config: AugustIndexerConfig;
}
