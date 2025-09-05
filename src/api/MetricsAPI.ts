import * as express from 'express';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { CacheManager } from '../cache/CacheManager';
import { logger } from '../utils/logger';

export class MetricsAPI {
  private router: express.Router;
  private metricsCollector: MetricsCollector;
  private cacheManager: CacheManager;

  constructor(metricsCollector: MetricsCollector, cacheManager: CacheManager) {
    this.router = express.Router();
    this.metricsCollector = metricsCollector;
    this.cacheManager = cacheManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Get all metrics
    this.router.get('/metrics', (req, res) => {
      try {
        const since = req.query.since ? parseInt(req.query.since as string) : undefined;
        const metrics = this.metricsCollector.getMetrics(undefined, since);
        res.json({ success: true, data: metrics });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Get specific metric
    this.router.get('/metrics/:name', (req, res) => {
      try {
        const { name } = req.params;
        const since = req.query.since ? parseInt(req.query.since as string) : undefined;
        const metrics = this.metricsCollector.getMetrics(name, since);
        res.json({ success: true, data: metrics });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Get performance metrics
    this.router.get('/performance', (req, res) => {
      try {
        const performance = this.metricsCollector.getPerformanceMetrics();
        res.json({ success: true, data: performance });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Get system metrics
    this.router.get('/system', (req, res) => {
      try {
        const system = this.metricsCollector.getSystemMetrics();
        res.json({ success: true, data: system });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Get indexer metrics
    this.router.get('/indexer', (req, res) => {
      try {
        const indexer = this.metricsCollector.getIndexerMetrics();
        res.json({ success: true, data: indexer });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Get histogram statistics
    this.router.get('/histogram/:name', (req, res) => {
      try {
        const { name } = req.params;
        const stats = this.metricsCollector.getHistogramStats(name);
        if (stats) {
          res.json({ success: true, data: stats });
        } else {
          res.status(404).json({ success: false, error: 'Histogram not found' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Export Prometheus metrics
    this.router.get('/prometheus', (req, res) => {
      try {
        const prometheusMetrics = this.metricsCollector.exportPrometheusMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(prometheusMetrics);
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Cache metrics
    this.router.get('/cache', (req, res) => {
      try {
        const stats = this.cacheManager.getStats();
        const hitRate = this.cacheManager.getHitRate();
        res.json({ 
          success: true, 
          data: { 
            ...stats, 
            hitRate: hitRate * 100 // Convert to percentage
          } 
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Reset cache stats
    this.router.post('/cache/reset', (req, res) => {
      try {
        this.cacheManager.resetStats();
        res.json({ success: true, message: 'Cache stats reset' });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Clear cache
    this.router.delete('/cache', (req, res) => {
      try {
        this.cacheManager.clear();
        res.json({ success: true, message: 'Cache cleared' });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Health check with detailed metrics
    this.router.get('/health', (req, res) => {
      try {
        const performance = this.metricsCollector.getPerformanceMetrics();
        const system = this.metricsCollector.getSystemMetrics();
        const indexer = this.metricsCollector.getIndexerMetrics();
        const cache = this.cacheManager.getStats();

        const health = {
          status: 'healthy',
          timestamp: Date.now(),
          uptime: system.uptime,
          memory: {
            used: system.memoryUsage.heapUsed,
            total: system.memoryUsage.heapTotal,
            usage: (system.memoryUsage.heapUsed / system.memoryUsage.heapTotal) * 100
          },
          performance: {
            avgBlockProcessingTime: performance.blockProcessingTime,
            avgQueryExecutionTime: performance.queryExecutionTime,
            avgWasmExecutionTime: performance.wasmExecutionTime
          },
          indexer: {
            blocksProcessed: indexer.blocksProcessed,
            transactionsProcessed: indexer.transactionsProcessed,
            queriesExecuted: indexer.queriesExecuted,
            errorsCount: indexer.errorsCount
          },
          cache: {
            hitRate: this.cacheManager.getHitRate() * 100,
            size: cache.size,
            memoryUsage: cache.memoryUsage
          },
          connections: system.activeConnections
        };

        res.json({ success: true, data: health });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  getRouter(): express.Router {
    return this.router;
  }
}
