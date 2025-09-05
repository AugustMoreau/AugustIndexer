// Base classes for blockchain ingestion

import { EventEmitter } from 'events';
import { BlockchainEvent } from '../types';
import { logger } from '../utils/logger';

export interface ChainConfig {
  rpcUrl: string;
  wsUrl?: string;
  startBlock?: number;
  confirmations?: number;
  batchSize?: number;
}

export abstract class BaseIngestionEngine extends EventEmitter {
  protected config: ChainConfig;
  protected isRunning: boolean = false;
  protected currentBlock: number = 0;

  constructor(config: ChainConfig) {
    super();
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getLatestBlock(): Promise<number>;
  abstract getBlock(blockNumber: number): Promise<any>;
  abstract subscribeToEvents(contracts: string[]): Promise<void>;
  abstract unsubscribeFromEvents(): Promise<void>;

  protected emitEvent(event: BlockchainEvent): void {
    this.emit('event', event);
  }

  protected emitError(error: Error): void {
    logger.error(`Ingestion error: ${error.message}`, error);
    this.emit('error', error);
  }

  protected emitBlock(blockNumber: number): void {
    this.currentBlock = blockNumber;
    this.emit('block', blockNumber);
  }

  public getCurrentBlock(): number {
    return this.currentBlock;
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}

export interface ContractEventFilter {
  address: string;
  topics?: string[];
  fromBlock?: number;
  toBlock?: number;
}

export interface EventProcessor {
  processEvent(event: any): BlockchainEvent | null;
}

export abstract class BaseEventProcessor implements EventProcessor {
  protected contractAddress: string;
  protected eventSignatures: Map<string, string> = new Map();

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  abstract processEvent(event: any): BlockchainEvent | null;

  protected createBlockchainEvent(
    id: string,
    blockNumber: number,
    transactionHash: string,
    contractAddress: string,
    eventName: string,
    data: Record<string, any>,
    timestamp: Date,
    chain: string
  ): BlockchainEvent {
    return {
      id,
      blockNumber,
      transactionHash,
      contractAddress,
      eventName,
      data,
      timestamp,
      chain
    };
  }
}
