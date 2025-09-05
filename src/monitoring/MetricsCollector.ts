import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface PerformanceMetrics {
  blockProcessingTime: number;
  transactionProcessingTime: number;
  queryExecutionTime: number;
  wasmExecutionTime: number;
  storageWriteTime: number;
  storageReadTime: number;
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  activeConnections: number;
  queueSize: number;
}

export interface IndexerMetrics {
  blocksProcessed: number;
  transactionsProcessed: number;
  eventsProcessed: number;
  queriesExecuted: number;
  indexesUpdated: number;
  errorsCount: number;
  currentBlockHeight: Record<string, number>;
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private performanceMetrics: PerformanceMetrics = {
    blockProcessingTime: 0,
    transactionProcessingTime: 0,
    queryExecutionTime: 0,
    wasmExecutionTime: 0,
    storageWriteTime: 0,
    storageReadTime: 0
  };
  
  private systemMetrics: SystemMetrics = {
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: 0,
    activeConnections: 0,
    queueSize: 0
  };

  private indexerMetrics: IndexerMetrics = {
    blocksProcessed: 0,
    transactionsProcessed: 0,
    eventsProcessed: 0,
    queriesExecuted: 0,
    indexesUpdated: 0,
    errorsCount: 0,
    currentBlockHeight: {}
  };

  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  private metricsInterval?: NodeJS.Timeout;
  private retentionPeriod: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.cleanupOldMetrics();
    }, 30000);
  }

  private collectSystemMetrics(): void {
    this.systemMetrics.memoryUsage = process.memoryUsage();
    this.systemMetrics.cpuUsage = process.cpuUsage();
    this.systemMetrics.uptime = process.uptime();

    // Record system metrics
    this.recordGauge('system.memory.used', this.systemMetrics.memoryUsage.heapUsed);
    this.recordGauge('system.memory.total', this.systemMetrics.memoryUsage.heapTotal);
    this.recordGauge('system.memory.external', this.systemMetrics.memoryUsage.external);
    this.recordGauge('system.uptime', this.systemMetrics.uptime);
    this.recordGauge('system.active_connections', this.systemMetrics.activeConnections);
    this.recordGauge('system.queue_size', this.systemMetrics.queueSize);

    this.emit('systemMetricsUpdated', this.systemMetrics);
  }

  // Timer methods for performance tracking
  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  endTimer(name: string, labels?: Record<string, string>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      logger.warn(`Timer not found: ${name}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);
    
    this.recordHistogram(name, duration, labels);
    return duration;
  }

  // Counter methods
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    this.recordMetric(name, current + value, labels);
  }

  decrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, Math.max(0, current - value));
    this.recordMetric(name, Math.max(0, current - value), labels);
  }

  // Gauge methods
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(name, value);
    this.recordMetric(name, value, labels);
  }

  // Histogram methods
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
    this.recordMetric(name, value, labels);
  }

  // Core metric recording
  private recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      labels
    };

    const metrics = this.metrics.get(name) || [];
    metrics.push(metric);
    this.metrics.set(name, metrics);

    this.emit('metricRecorded', metric);
  }

  // Indexer-specific metrics
  recordBlockProcessed(chainId: string, blockNumber: number, processingTime: number): void {
    this.indexerMetrics.blocksProcessed++;
    this.indexerMetrics.currentBlockHeight[chainId] = blockNumber;
    this.performanceMetrics.blockProcessingTime = processingTime;

    this.incrementCounter('indexer.blocks_processed', 1, { chain: chainId });
    this.recordGauge(`indexer.current_block.${chainId}`, blockNumber);
    this.recordHistogram('indexer.block_processing_time', processingTime, { chain: chainId });
  }

  recordTransactionProcessed(chainId: string, processingTime: number): void {
    this.indexerMetrics.transactionsProcessed++;
    this.performanceMetrics.transactionProcessingTime = processingTime;

    this.incrementCounter('indexer.transactions_processed', 1, { chain: chainId });
    this.recordHistogram('indexer.transaction_processing_time', processingTime, { chain: chainId });
  }

  recordEventProcessed(chainId: string, eventType: string): void {
    this.indexerMetrics.eventsProcessed++;
    this.incrementCounter('indexer.events_processed', 1, { chain: chainId, event_type: eventType });
  }

  recordQueryExecuted(queryName: string, executionTime: number, resultCount: number): void {
    this.indexerMetrics.queriesExecuted++;
    this.performanceMetrics.queryExecutionTime = executionTime;

    this.incrementCounter('indexer.queries_executed', 1, { query: queryName });
    this.recordHistogram('indexer.query_execution_time', executionTime, { query: queryName });
    this.recordHistogram('indexer.query_result_count', resultCount, { query: queryName });
  }

  recordIndexUpdated(indexName: string, recordCount: number): void {
    this.indexerMetrics.indexesUpdated++;
    this.incrementCounter('indexer.indexes_updated', 1, { index: indexName });
    this.recordGauge(`indexer.index_record_count.${indexName}`, recordCount);
  }

  recordError(errorType: string, errorMessage: string): void {
    this.indexerMetrics.errorsCount++;
    this.incrementCounter('indexer.errors', 1, { type: errorType });
    logger.error(`Recorded error metric: ${errorType} - ${errorMessage}`);
  }

  recordWasmExecution(executionTime: number, functionName: string): void {
    this.performanceMetrics.wasmExecutionTime = executionTime;
    this.recordHistogram('wasm.execution_time', executionTime, { function: functionName });
  }

  recordStorageOperation(operation: 'read' | 'write', duration: number, tableName?: string): void {
    if (operation === 'read') {
      this.performanceMetrics.storageReadTime = duration;
    } else {
      this.performanceMetrics.storageWriteTime = duration;
    }

    if (tableName) {
      this.recordHistogram(`storage.${operation}_time`, duration, { table: tableName });
    } else {
      this.recordHistogram(`storage.${operation}_time`, duration);
    }
  }

  // Connection tracking
  incrementActiveConnections(): void {
    this.systemMetrics.activeConnections++;
    this.recordGauge('system.active_connections', this.systemMetrics.activeConnections);
  }

  decrementActiveConnections(): void {
    this.systemMetrics.activeConnections = Math.max(0, this.systemMetrics.activeConnections - 1);
    this.recordGauge('system.active_connections', this.systemMetrics.activeConnections);
  }

  updateQueueSize(size: number): void {
    this.systemMetrics.queueSize = size;
    this.recordGauge('system.queue_size', size);
  }

  // Metric retrieval
  getMetrics(name?: string, since?: number): Metric[] {
    if (name) {
      const metrics = this.metrics.get(name) || [];
      return since ? metrics.filter(m => m.timestamp >= since) : metrics;
    }

    const allMetrics: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return since ? allMetrics.filter(m => m.timestamp >= since) : allMetrics;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  getIndexerMetrics(): IndexerMetrics {
    return { ...this.indexerMetrics };
  }

  getHistogramStats(name: string): { count: number; min: number; max: number; avg: number; p95: number; p99: number } | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sorted.reduce((sum, val) => sum + val, 0) / count;
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return { count, min, max, avg, p95, p99 };
  }

  // Export metrics in Prometheus format
  exportPrometheusMetrics(): string {
    let output = '';

    // Counters
    for (const [name, value] of this.counters) {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n`;
    }

    // Gauges
    for (const [name, value] of this.gauges) {
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n`;
    }

    // Histograms
    for (const [name, values] of this.histograms) {
      const stats = this.getHistogramStats(name);
      if (stats) {
        output += `# TYPE ${name} histogram\n`;
        output += `${name}_count ${stats.count}\n`;
        output += `${name}_sum ${values.reduce((sum, val) => sum + val, 0)}\n`;
        output += `${name}_bucket{le="0.1"} ${values.filter(v => v <= 100).length}\n`;
        output += `${name}_bucket{le="0.5"} ${values.filter(v => v <= 500).length}\n`;
        output += `${name}_bucket{le="1.0"} ${values.filter(v => v <= 1000).length}\n`;
        output += `${name}_bucket{le="5.0"} ${values.filter(v => v <= 5000).length}\n`;
        output += `${name}_bucket{le="+Inf"} ${values.length}\n`;
      }
    }

    return output;
  }

  // Cleanup old metrics
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.retentionPeriod;
    
    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp >= cutoff);
      this.metrics.set(name, filtered);
    }

    // Clean up histograms (keep only recent values)
    for (const [name, values] of this.histograms) {
      if (values.length > 10000) {
        this.histograms.set(name, values.slice(-5000));
      }
    }
  }

  // Save metrics to file
  async saveMetricsToFile(filePath: string): Promise<void> {
    const data = {
      timestamp: Date.now(),
      performance: this.performanceMetrics,
      system: this.systemMetrics,
      indexer: this.indexerMetrics,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => [
          name,
          this.getHistogramStats(name)
        ])
      )
    };

    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Load metrics from file
  async loadMetricsFromFile(filePath: string): Promise<void> {
    try {
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      
      if (data.performance) this.performanceMetrics = data.performance;
      if (data.system) this.systemMetrics = data.system;
      if (data.indexer) this.indexerMetrics = data.indexer;
      if (data.counters) this.counters = new Map(Object.entries(data.counters));
      if (data.gauges) this.gauges = new Map(Object.entries(data.gauges));
      
      logger.info('Metrics loaded from file:', filePath);
    } catch (error) {
      logger.error('Failed to load metrics from file:', error);
    }
  }

  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.removeAllListeners();
  }
}
