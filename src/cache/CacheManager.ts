import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  memoryUsage: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  persistToDisk: boolean;
  persistPath?: string;
  compressionEnabled: boolean;
}

export class CacheManager extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0
  };

  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private persistTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      maxSize: config.maxSize || 10000,
      defaultTTL: config.defaultTTL || 3600000, // 1 hour
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      persistToDisk: config.persistToDisk || false,
      persistPath: config.persistPath || './cache.json',
      compressionEnabled: config.compressionEnabled || false
    };

    this.startCleanupTimer();
    if (this.config.persistToDisk) {
      this.startPersistTimer();
      this.loadFromDisk();
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private startPersistTimer(): void {
    if (!this.config.persistToDisk) return;
    
    this.persistTimer = setInterval(() => {
      this.persistToDisk();
    }, this.config.cleanupInterval * 2); // Persist less frequently than cleanup
  }

  // Core cache operations
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.stats.sets++;
    this.stats.size = this.cache.size;
    this.updateMemoryUsage();

    this.emit('set', key, value);
    logger.debug(`Cache set: ${key}`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.emit('miss', key);
      return null;
    }

    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.emit('miss', key);
      this.emit('expired', key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.stats.hits++;
    this.emit('hit', key);
    
    return entry.value as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
      this.updateMemoryUsage();
      this.emit('delete', key);
      logger.debug(`Cache delete: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.stats.memoryUsage = 0;
    this.emit('clear', size);
    logger.info('Cache cleared');
  }

  // Advanced operations
  getOrSet<T>(key: string, factory: () => Promise<T> | T, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return Promise.resolve(factory()).then(value => {
      this.set(key, value, ttl);
      return value;
    });
  }

  mget<T>(keys: string[]): Map<string, T | null> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, this.get<T>(key));
    }
    return result;
  }

  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttl);
    }
  }

  keys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  values<T>(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value as T);
  }

  entries<T>(): Array<{ key: string; value: T }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value as T
    }));
  }

  // Query result caching
  cacheQuery(queryName: string, params: any, result: any, ttl?: number): void {
    const key = this.generateQueryKey(queryName, params);
    this.set(key, result, ttl);
  }

  getCachedQuery<T>(queryName: string, params: any): T | null {
    const key = this.generateQueryKey(queryName, params);
    return this.get<T>(key);
  }

  private generateQueryKey(queryName: string, params: any): string {
    const paramStr = JSON.stringify(params, Object.keys(params).sort());
    return `query:${queryName}:${Buffer.from(paramStr).toString('base64')}`;
  }

  // Block data caching
  cacheBlock(chainId: string, blockNumber: number, blockData: any, ttl?: number): void {
    const key = `block:${chainId}:${blockNumber}`;
    this.set(key, blockData, ttl);
  }

  getCachedBlock(chainId: string, blockNumber: number): any | null {
    const key = `block:${chainId}:${blockNumber}`;
    return this.get(key);
  }

  // Transaction caching
  cacheTransaction(chainId: string, txHash: string, txData: any, ttl?: number): void {
    const key = `tx:${chainId}:${txHash}`;
    this.set(key, txData, ttl);
  }

  getCachedTransaction(chainId: string, txHash: string): any | null {
    const key = `tx:${chainId}:${txHash}`;
    return this.get(key);
  }

  // Index data caching
  cacheIndexData(indexName: string, key: string, data: any, ttl?: number): void {
    const cacheKey = `index:${indexName}:${key}`;
    this.set(cacheKey, data, ttl);
  }

  getCachedIndexData(indexName: string, key: string): any | null {
    const cacheKey = `index:${indexName}:${key}`;
    return this.get(cacheKey);
  }

  // Cache maintenance
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.size = this.cache.size;
      this.updateMemoryUsage();
      this.emit('cleanup', expiredCount);
      logger.debug(`Cache cleanup: removed ${expiredCount} expired entries`);
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      this.updateMemoryUsage();
      this.emit('evict', oldestKey);
      logger.debug(`Cache evict LRU: ${oldestKey}`);
    }
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += this.estimateEntrySize(entry);
    }
    this.stats.memoryUsage = totalSize;
  }

  private estimateEntrySize(entry: CacheEntry): number {
    // Rough estimation of memory usage
    const keySize = entry.key.length * 2; // UTF-16
    const valueSize = JSON.stringify(entry.value).length * 2;
    const metadataSize = 64; // Approximate size of metadata
    return keySize + valueSize + metadataSize;
  }

  // Persistence
  private async persistToDisk(): Promise<void> {
    if (!this.config.persistToDisk || !this.config.persistPath) return;

    try {
      const data = {
        timestamp: Date.now(),
        entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
          key,
          value: entry.value,
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed
        })),
        stats: this.stats
      };

      await fs.promises.writeFile(this.config.persistPath, JSON.stringify(data));
      logger.debug('Cache persisted to disk');
    } catch (error) {
      logger.error('Failed to persist cache to disk:', error);
    }
  }

  private async loadFromDisk(): Promise<void> {
    if (!this.config.persistToDisk || !this.config.persistPath) return;

    try {
      if (!fs.existsSync(this.config.persistPath)) return;

      const data = JSON.parse(await fs.promises.readFile(this.config.persistPath, 'utf8'));
      const now = Date.now();

      for (const entryData of data.entries) {
        // Only load non-expired entries
        if (now - entryData.timestamp < entryData.ttl) {
          const entry: CacheEntry = {
            key: entryData.key,
            value: entryData.value,
            timestamp: entryData.timestamp,
            ttl: entryData.ttl,
            accessCount: entryData.accessCount,
            lastAccessed: entryData.lastAccessed
          };
          this.cache.set(entryData.key, entry);
        }
      }

      if (data.stats) {
        this.stats = { ...this.stats, ...data.stats };
      }

      this.stats.size = this.cache.size;
      this.updateMemoryUsage();
      
      logger.info(`Cache loaded from disk: ${this.cache.size} entries`);
    } catch (error) {
      logger.error('Failed to load cache from disk:', error);
    }
  }

  // Statistics and monitoring
  getStats(): CacheStats {
    return { ...this.stats };
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: this.cache.size,
      memoryUsage: this.stats.memoryUsage
    };
  }

  // Configuration
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart timers if intervals changed
    if (newConfig.cleanupInterval) {
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      this.startCleanupTimer();
    }

    if (newConfig.persistToDisk !== undefined) {
      if (this.persistTimer) clearInterval(this.persistTimer);
      if (this.config.persistToDisk) {
        this.startPersistTimer();
      }
    }
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // Cleanup
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
    }

    if (this.config.persistToDisk) {
      await this.persistToDisk();
    }

    this.clear();
    this.removeAllListeners();
    
    logger.info('Cache manager destroyed');
  }
}
