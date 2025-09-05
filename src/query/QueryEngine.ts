// Query engine for executing Augustium queries against indexed data

import { QueryDefinition, WhereClause, OrderByClause } from '../types';
import { StorageManager } from '../storage/StorageManager';
import { logger } from '../utils/logger';

export class QueryEngine {
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  async executeQuery(query: QueryDefinition, parameters: Record<string, any> = {}): Promise<any[]> {
    try {
      logger.debug(`Executing query: ${query.name}`);

      // Validate parameters
      this.validateParameters(query, parameters);

      // Build SQL query from Augustium query definition
      const { sql, params } = this.buildSQLQuery(query, parameters);

      // Execute query
      const results = await this.storageManager.executeRawQuery(sql, params);

      logger.debug(`Query ${query.name} returned ${results.length} results`);
      return results;

    } catch (error) {
      logger.error(`Query execution failed for ${query.name}:`, error);
      throw error;
    }
  }

  private validateParameters(query: QueryDefinition, parameters: Record<string, any>): void {
    if (!query.parameters) return;

    for (const param of query.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }

      if (param.name in parameters) {
        // Type validation could be added here
        const value = parameters[param.name];
        if (!this.isValidParameterType(value, param.type)) {
          throw new Error(`Parameter '${param.name}' has invalid type. Expected ${param.type}`);
        }
      }
    }
  }

  private isValidParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'U32':
      case 'U64':
      case 'U128':
      case 'U256':
        return typeof value === 'number' || typeof value === 'string';
      case 'String':
        return typeof value === 'string';
      case 'Bool':
        return typeof value === 'boolean';
      case 'Address':
        return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
      default:
        return true; // Allow unknown types for now
    }
  }

  private buildSQLQuery(query: QueryDefinition, parameters: Record<string, any>): { sql: string; params: any[] } {
    const tableName = `august_index_${query.from.toLowerCase()}`;
    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    // Build WHERE clause
    if (query.where && query.where.length > 0) {
      const whereConditions = query.where.map(clause => {
        return this.buildWhereCondition(clause, parameters, params);
      });
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Build ORDER BY clause
    if (query.orderBy && query.orderBy.length > 0) {
      const orderConditions = query.orderBy.map(clause => {
        return `${clause.field.toLowerCase()} ${clause.direction.toUpperCase()}`;
      });
      sql += ` ORDER BY ${orderConditions.join(', ')}`;
    }

    // Add LIMIT
    if (query.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(query.limit);
    }

    return { sql, params };
  }

  private buildWhereCondition(clause: WhereClause, parameters: Record<string, any>, params: any[]): string {
    const fieldName = clause.field.toLowerCase();
    let value = clause.value;

    // Replace parameter references
    if (typeof value === 'string' && value.startsWith('$')) {
      const paramName = value.substring(1);
      if (paramName in parameters) {
        value = parameters[paramName];
      } else {
        throw new Error(`Parameter '${paramName}' not provided`);
      }
    }

    params.push(value);
    const paramIndex = params.length;

    switch (clause.operator) {
      case 'eq':
        return `${fieldName} = $${paramIndex}`;
      case 'ne':
        return `${fieldName} != $${paramIndex}`;
      case 'gt':
        return `${fieldName} > $${paramIndex}`;
      case 'gte':
        return `${fieldName} >= $${paramIndex}`;
      case 'lt':
        return `${fieldName} < $${paramIndex}`;
      case 'lte':
        return `${fieldName} <= $${paramIndex}`;
      case 'like':
        return `${fieldName} LIKE $${paramIndex}`;
      case 'in':
        if (Array.isArray(value)) {
          const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
          // Adjust params array to include all values
          params.splice(paramIndex - 1, 1, ...value);
          return `${fieldName} IN (${placeholders})`;
        } else {
          return `${fieldName} = $${paramIndex}`;
        }
      default:
        throw new Error(`Unsupported operator: ${clause.operator}`);
    }
  }

  async executeAggregateQuery(indexName: string, aggregation: {
    field: string;
    operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    groupBy?: string;
    where?: WhereClause[];
  }): Promise<any[]> {
    const tableName = `august_index_${indexName.toLowerCase()}`;
    let sql = `SELECT `;

    // Build aggregation
    if (aggregation.groupBy) {
      sql += `${aggregation.groupBy.toLowerCase()}, `;
    }

    switch (aggregation.operation) {
      case 'count':
        sql += `COUNT(${aggregation.field.toLowerCase()}) as result`;
        break;
      case 'sum':
        sql += `SUM(${aggregation.field.toLowerCase()}) as result`;
        break;
      case 'avg':
        sql += `AVG(${aggregation.field.toLowerCase()}) as result`;
        break;
      case 'min':
        sql += `MIN(${aggregation.field.toLowerCase()}) as result`;
        break;
      case 'max':
        sql += `MAX(${aggregation.field.toLowerCase()}) as result`;
        break;
    }

    sql += ` FROM ${tableName}`;

    const params: any[] = [];

    // Add WHERE clause if provided
    if (aggregation.where && aggregation.where.length > 0) {
      const whereConditions = aggregation.where.map(clause => {
        return this.buildWhereCondition(clause, {}, params);
      });
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add GROUP BY if specified
    if (aggregation.groupBy) {
      sql += ` GROUP BY ${aggregation.groupBy.toLowerCase()}`;
    }

    return await this.storageManager.executeRawQuery(sql, params);
  }

  async executeTimeSeriesQuery(indexName: string, options: {
    timeField: string;
    valueField: string;
    interval: 'hour' | 'day' | 'week' | 'month';
    aggregation: 'count' | 'sum' | 'avg';
    startTime?: Date;
    endTime?: Date;
  }): Promise<any[]> {
    const tableName = `august_index_${indexName.toLowerCase()}`;
    const params: any[] = [];

    let sql = `SELECT `;

    // Time bucket based on interval
    switch (options.interval) {
      case 'hour':
        sql += `DATE_TRUNC('hour', ${options.timeField}) as time_bucket, `;
        break;
      case 'day':
        sql += `DATE_TRUNC('day', ${options.timeField}) as time_bucket, `;
        break;
      case 'week':
        sql += `DATE_TRUNC('week', ${options.timeField}) as time_bucket, `;
        break;
      case 'month':
        sql += `DATE_TRUNC('month', ${options.timeField}) as time_bucket, `;
        break;
    }

    // Aggregation
    switch (options.aggregation) {
      case 'count':
        sql += `COUNT(*) as value`;
        break;
      case 'sum':
        sql += `SUM(${options.valueField}) as value`;
        break;
      case 'avg':
        sql += `AVG(${options.valueField}) as value`;
        break;
    }

    sql += ` FROM ${tableName}`;

    // Time range filter
    const whereConditions: string[] = [];
    if (options.startTime) {
      params.push(options.startTime);
      whereConditions.push(`${options.timeField} >= $${params.length}`);
    }
    if (options.endTime) {
      params.push(options.endTime);
      whereConditions.push(`${options.timeField} <= $${params.length}`);
    }

    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    sql += ` GROUP BY time_bucket ORDER BY time_bucket`;

    return await this.storageManager.executeRawQuery(sql, params);
  }

  async getQueryPlan(query: QueryDefinition, parameters: Record<string, any> = {}): Promise<any[]> {
    const { sql, params } = this.buildSQLQuery(query, parameters);
    const explainSql = `EXPLAIN ANALYZE ${sql}`;
    
    return await this.storageManager.executeRawQuery(explainSql, params);
  }

  // Helper method for building complex queries programmatically
  buildDynamicQuery(indexName: string, options: {
    select?: string[];
    where?: Record<string, any>;
    orderBy?: { field: string; direction: 'asc' | 'desc' }[];
    limit?: number;
    offset?: number;
  }): { sql: string; params: any[] } {
    const tableName = `august_index_${indexName.toLowerCase()}`;
    const params: any[] = [];

    // SELECT clause
    let sql = 'SELECT ';
    if (options.select && options.select.length > 0) {
      sql += options.select.map(field => field.toLowerCase()).join(', ');
    } else {
      sql += '*';
    }
    sql += ` FROM ${tableName}`;

    // WHERE clause
    if (options.where && Object.keys(options.where).length > 0) {
      const whereConditions = Object.entries(options.where).map(([field, value]) => {
        params.push(value);
        return `${field.toLowerCase()} = $${params.length}`;
      });
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // ORDER BY clause
    if (options.orderBy && options.orderBy.length > 0) {
      const orderConditions = options.orderBy.map(clause => {
        return `${clause.field.toLowerCase()} ${clause.direction.toUpperCase()}`;
      });
      sql += ` ORDER BY ${orderConditions.join(', ')}`;
    }

    // LIMIT clause
    if (options.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    // OFFSET clause
    if (options.offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    return { sql, params };
  }
}
