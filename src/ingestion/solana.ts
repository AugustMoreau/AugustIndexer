// Solana blockchain ingestion engine

import { Connection, PublicKey, AccountInfo, ParsedAccountData } from '@solana/web3.js';
import { BaseIngestionEngine, BaseEventProcessor, ChainConfig } from './base';
import { BlockchainEvent } from '../types';
import { logger } from '../utils/logger';

export interface SolanaConfig extends ChainConfig {
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export class SolanaIngestionEngine extends BaseIngestionEngine {
  private connection: Connection;
  private subscriptions: Map<string, number> = new Map();
  private processors: Map<string, BaseEventProcessor> = new Map();
  private monitoredAccounts: Set<string> = new Set();

  constructor(config: SolanaConfig) {
    super(config);
    this.connection = new Connection(config.rpcUrl, config.commitment || 'confirmed');
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const version = await this.connection.getVersion();
      logger.info(`Connected to Solana cluster: ${version['solana-core']}`);
      
      // Get current slot
      this.currentBlock = await this.connection.getSlot();
      logger.info(`Current Solana slot: ${this.currentBlock}`);
    } catch (error) {
      throw new Error(`Failed to initialize Solana ingestion: ${error}`);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Solana ingestion engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Solana ingestion engine...');

    // Start slot monitoring
    this.startSlotMonitoring();

    // Subscribe to account changes if any accounts are monitored
    if (this.monitoredAccounts.size > 0) {
      await this.subscribeToAccountChanges();
    }

    logger.info('Solana ingestion engine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping Solana ingestion engine...');

    // Unsubscribe from all subscriptions
    await this.unsubscribeFromEvents();

    logger.info('Solana ingestion engine stopped');
  }

  async getLatestBlock(): Promise<number> {
    return await this.connection.getSlot();
  }

  async getBlock(slot: number): Promise<any> {
    return await this.connection.getBlock(slot, {
      maxSupportedTransactionVersion: 0
    });
  }

  async subscribeToEvents(accounts: string[]): Promise<void> {
    for (const account of accounts) {
      this.monitoredAccounts.add(account);
    }

    if (this.isRunning) {
      await this.subscribeToAccountChanges();
    }
  }

  async unsubscribeFromEvents(): Promise<void> {
    for (const [account, subscriptionId] of this.subscriptions) {
      try {
        await this.connection.removeAccountChangeListener(subscriptionId);
        logger.info(`Unsubscribed from account: ${account}`);
      } catch (error) {
        logger.warn(`Failed to unsubscribe from account ${account}: ${error}`);
      }
    }
    this.subscriptions.clear();
  }

  addEventProcessor(accountAddress: string, processor: BaseEventProcessor): void {
    this.processors.set(accountAddress, processor);
  }

  private startSlotMonitoring(): void {
    this.connection.onSlotChange((slotInfo) => {
      if (this.isRunning) {
        this.emitBlock(slotInfo.slot);
        this.processNewSlot(slotInfo.slot);
      }
    });
  }

  private async subscribeToAccountChanges(): Promise<void> {
    for (const accountAddress of this.monitoredAccounts) {
      try {
        const publicKey = new PublicKey(accountAddress);
        
        const subscriptionId = this.connection.onAccountChange(
          publicKey,
          (accountInfo, context) => {
            if (this.isRunning) {
              this.processAccountChange(accountAddress, accountInfo, context.slot);
            }
          },
          'confirmed'
        );

        this.subscriptions.set(accountAddress, subscriptionId);
        logger.info(`Subscribed to account changes: ${accountAddress}`);
      } catch (error) {
        this.emitError(new Error(`Failed to subscribe to account ${accountAddress}: ${error}`));
      }
    }
  }

  private async processNewSlot(slot: number): Promise<void> {
    try {
      // Get block data for the slot
      const block = await this.getBlock(slot);
      
      if (block && block.transactions) {
        for (const transaction of block.transactions) {
          // Process transactions that interact with monitored accounts
          if (transaction.transaction && transaction.transaction.message) {
            const accountKeys = transaction.transaction.message.accountKeys;
            
            for (const accountKey of accountKeys) {
              const accountAddress = accountKey.toString();
              if (this.monitoredAccounts.has(accountAddress)) {
                this.processTransaction(transaction, slot, accountAddress);
              }
            }
          }
        }
      }
    } catch (error) {
      // Block might not be available yet, this is normal
      if (!(error instanceof Error) || !error.message.includes('not available')) {
        this.emitError(new Error(`Slot processing error: ${error}`));
      }
    }
  }

  private processAccountChange(
    accountAddress: string,
    accountInfo: AccountInfo<Buffer>,
    slot: number
  ): void {
    try {
      const processor = this.processors.get(accountAddress);
      
      if (processor) {
        const blockchainEvent = processor.processEvent({
          accountAddress,
          accountInfo,
          slot
        });
        
        if (blockchainEvent) {
          this.emitEvent(blockchainEvent);
        }
      } else {
        // Create a generic account change event
        const genericEvent = this.createGenericAccountChangeEvent(
          accountAddress,
          accountInfo,
          slot
        );
        this.emitEvent(genericEvent);
      }
    } catch (error) {
      this.emitError(new Error(`Account change processing error: ${error}`));
    }
  }

  private processTransaction(transaction: any, slot: number, accountAddress: string): void {
    try {
      const processor = this.processors.get(accountAddress);
      
      if (processor) {
        const blockchainEvent = processor.processEvent({
          transaction,
          slot,
          accountAddress
        });
        
        if (blockchainEvent) {
          this.emitEvent(blockchainEvent);
        }
      }
    } catch (error) {
      this.emitError(new Error(`Transaction processing error: ${error}`));
    }
  }

  private createGenericAccountChangeEvent(
    accountAddress: string,
    accountInfo: AccountInfo<Buffer>,
    slot: number
  ): BlockchainEvent {
    return {
      id: `${accountAddress}-${slot}-${Date.now()}`,
      blockNumber: slot,
      transactionHash: '', // Solana doesn't have transaction hash for account changes
      contractAddress: accountAddress,
      eventName: 'AccountChange',
      data: {
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toString(),
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch,
        dataLength: accountInfo.data.length
      },
      timestamp: new Date(),
      chain: 'solana'
    };
  }
}

// Solana-specific event processor
export class SolanaEventProcessor extends BaseEventProcessor {
  private programId: string;

  constructor(accountAddress: string, programId: string) {
    super(accountAddress);
    this.programId = programId;
  }

  processEvent(eventData: any): BlockchainEvent | null {
    try {
      if (eventData.accountInfo) {
        // Account change event
        return this.processAccountChange(eventData);
      } else if (eventData.transaction) {
        // Transaction event
        return this.processTransaction(eventData);
      }
      
      return null;
    } catch (error) {
      logger.warn(`Failed to process Solana event: ${error}`);
      return null;
    }
  }

  private processAccountChange(eventData: any): BlockchainEvent {
    const { accountAddress, accountInfo, slot } = eventData;
    
    return this.createBlockchainEvent(
      `${accountAddress}-${slot}-account-change`,
      slot,
      '', // No transaction hash for account changes
      accountAddress,
      'AccountChange',
      {
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toString(),
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch,
        data: accountInfo.data.toString('base64')
      },
      new Date(),
      'solana'
    );
  }

  private processTransaction(eventData: any): BlockchainEvent | null {
    const { transaction, slot, accountAddress } = eventData;
    
    if (!transaction.transaction || !transaction.transaction.signatures) {
      return null;
    }

    const signature = transaction.transaction.signatures[0];
    
    return this.createBlockchainEvent(
      `${signature}-${accountAddress}`,
      slot,
      signature,
      accountAddress,
      'Transaction',
      {
        signatures: transaction.transaction.signatures,
        message: transaction.transaction.message,
        meta: transaction.meta
      },
      new Date(),
      'solana'
    );
  }
}
