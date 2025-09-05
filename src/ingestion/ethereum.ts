// Ethereum blockchain ingestion engine

import { ethers } from 'ethers';
import { BaseIngestionEngine, BaseEventProcessor, ChainConfig, ContractEventFilter } from './base';
import { BlockchainEvent } from '../types';
import { logger } from '../utils/logger';

export interface EthereumConfig extends ChainConfig {
  wsUrl: string;
}

export class EthereumIngestionEngine extends BaseIngestionEngine {
  private provider: ethers.providers.JsonRpcProvider;
  private wsProvider?: ethers.providers.WebSocketProvider;
  private contracts: Map<string, ethers.Contract> = new Map();
  private eventFilters: ContractEventFilter[] = [];
  private processors: Map<string, BaseEventProcessor> = new Map();

  constructor(config: EthereumConfig) {
    super(config);
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    if (config.wsUrl) {
      this.wsProvider = new ethers.providers.WebSocketProvider(config.wsUrl);
    }
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const network = await this.provider.getNetwork();
      logger.info(`Connected to Ethereum network: ${network.name} (${network.chainId})`);
      
      // Get current block
      this.currentBlock = await this.provider.getBlockNumber();
      logger.info(`Current Ethereum block: ${this.currentBlock}`);
    } catch (error) {
      throw new Error(`Failed to initialize Ethereum ingestion: ${error}`);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Ethereum ingestion engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Ethereum ingestion engine...');

    // Start block monitoring
    this.startBlockMonitoring();

    // Subscribe to contract events if any filters are set
    if (this.eventFilters.length > 0) {
      await this.subscribeToContractEvents();
    }

    logger.info('Ethereum ingestion engine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping Ethereum ingestion engine...');

    // Unsubscribe from events
    await this.unsubscribeFromEvents();

    // Close WebSocket connection
    if (this.wsProvider) {
      await this.wsProvider.destroy();
    }

    logger.info('Ethereum ingestion engine stopped');
  }

  async getLatestBlock(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async getBlock(blockNumber: number): Promise<any> {
    return await this.provider.getBlockWithTransactions(blockNumber);
  }

  async subscribeToEvents(contracts: string[]): Promise<void> {
    for (const contractAddress of contracts) {
      this.eventFilters.push({
        address: contractAddress,
        fromBlock: this.config.startBlock || this.currentBlock
      });
    }

    if (this.isRunning) {
      await this.subscribeToContractEvents();
    }
  }

  async unsubscribeFromEvents(): Promise<void> {
    // Remove all listeners
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
    }
    this.provider.removeAllListeners();
  }

  addEventProcessor(contractAddress: string, processor: BaseEventProcessor): void {
    this.processors.set(contractAddress.toLowerCase(), processor);
  }

  private startBlockMonitoring(): void {
    const provider = this.wsProvider || this.provider;
    
    provider.on('block', (blockNumber: number) => {
      if (this.isRunning) {
        this.emitBlock(blockNumber);
        this.processNewBlock(blockNumber);
      }
    });
  }

  private async subscribeToContractEvents(): Promise<void> {
    if (!this.wsProvider) {
      logger.warn('WebSocket provider not available, using polling for events');
      this.startEventPolling();
      return;
    }

    for (const filter of this.eventFilters) {
      const eventFilter = {
        address: filter.address,
        topics: filter.topics
      };

      this.wsProvider.on(eventFilter, (log) => {
        if (this.isRunning) {
          this.processLog(log);
        }
      });

      logger.info(`Subscribed to events for contract: ${filter.address}`);
    }
  }

  private startEventPolling(): void {
    const pollInterval = 5000; // 5 seconds
    
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const latestBlock = await this.getLatestBlock();
        const fromBlock = Math.max(this.currentBlock - 10, 0); // Look back 10 blocks

        for (const filter of this.eventFilters) {
          const logs = await this.provider.getLogs({
            address: filter.address,
            topics: filter.topics,
            fromBlock,
            toBlock: latestBlock
          });

          for (const log of logs) {
            this.processLog(log);
          }
        }
      } catch (error) {
        this.emitError(new Error(`Event polling error: ${error}`));
      }
    }, pollInterval);
  }

  private async processNewBlock(blockNumber: number): Promise<void> {
    try {
      const block = await this.getBlock(blockNumber);
      
      // Process transactions in the block
      for (const tx of block.transactions) {
        if (typeof tx === 'string') continue; // Skip if only hash is provided
        
        // Check if transaction is to one of our monitored contracts
        if (tx.to && this.isMonitoredContract(tx.to)) {
          const receipt = await this.provider.getTransactionReceipt(tx.hash);
          if (receipt && receipt.logs) {
            for (const log of receipt.logs) {
              this.processLog(log);
            }
          }
        }
      }
    } catch (error) {
      this.emitError(new Error(`Block processing error: ${error}`));
    }
  }

  private processLog(log: ethers.providers.Log): void {
    try {
      const contractAddress = log.address.toLowerCase();
      const processor = this.processors.get(contractAddress);
      
      if (processor) {
        const blockchainEvent = processor.processEvent(log);
        if (blockchainEvent) {
          this.emitEvent(blockchainEvent);
        }
      } else {
        // Create a generic event if no specific processor is found
        const genericEvent = this.createGenericEvent(log);
        this.emitEvent(genericEvent);
      }
    } catch (error) {
      this.emitError(new Error(`Log processing error: ${error}`));
    }
  }

  private createGenericEvent(log: ethers.providers.Log): BlockchainEvent {
    return {
      id: `${log.transactionHash}-${log.logIndex}`,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      contractAddress: log.address,
      eventName: 'UnknownEvent',
      data: {
        topics: log.topics,
        data: log.data,
        logIndex: log.logIndex
      },
      timestamp: new Date(),
      chain: 'ethereum'
    };
  }

  private isMonitoredContract(address: string): boolean {
    return this.eventFilters.some(filter => 
      filter.address.toLowerCase() === address.toLowerCase()
    );
  }
}

// Ethereum-specific event processor
export class EthereumEventProcessor extends BaseEventProcessor {
  private abi: ethers.utils.Interface;

  constructor(contractAddress: string, abi: any[]) {
    super(contractAddress);
    this.abi = new ethers.utils.Interface(abi);
  }

  processEvent(log: ethers.providers.Log): BlockchainEvent | null {
    try {
      const parsedLog = this.abi.parseLog(log);
      
      // Convert BigNumber values to strings for JSON serialization
      const data: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsedLog.args)) {
        if (ethers.BigNumber.isBigNumber(value)) {
          data[key] = value.toString();
        } else {
          data[key] = value;
        }
      }

      return this.createBlockchainEvent(
        `${log.transactionHash}-${log.logIndex}`,
        log.blockNumber,
        log.transactionHash,
        log.address,
        parsedLog.name,
        data,
        new Date(),
        'ethereum'
      );
    } catch (error) {
      logger.warn(`Failed to parse Ethereum log: ${error}`);
      return null;
    }
  }
}
