# AugustIndexer Examples

This directory contains example indexers written in Augustium DSL to demonstrate the capabilities of AugustIndexer.

## Uniswap V3 Pool Indexer

The `uniswap_pools.augustium` file demonstrates how to index Uniswap V3 pools and swaps:

### Features Demonstrated

1. **Multi-struct indexing**: Indexes both Pool creation and Swap events
2. **Cross-contract listening**: Monitors factory contract for pool creation and all pool contracts for swaps
3. **Complex data mapping**: Maps blockchain events to structured data
4. **Parameterized queries**: Queries that accept parameters for filtering

### Usage

1. **Deploy the indexer**:
```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"code": "$(cat examples/uniswap_pools.augustium)"}'
```

2. **Query top pools by liquidity**:
```bash
curl -X POST http://localhost:3000/query/TopPoolsByLiquidity \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

3. **Get recent swaps for a pool**:
```bash
curl -X POST http://localhost:3000/query/RecentSwapsForPool \
  -H "Content-Type: application/json" \
  -d '{"pool_address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", "limit": 20}'
```

4. **Find pools containing USDC**:
```bash
curl -X POST http://localhost:3000/query/PoolsWithToken \
  -H "Content-Type: application/json" \
  -d '{"token_address": "0xA0b86a33E6417c66f73342C4C5B0A8E8b4e1D8a6"}'
```

### Data Structures

#### Pool
- `id`: Pool contract address
- `token0`: First token address
- `token1`: Second token address  
- `fee`: Pool fee tier
- `liquidity`: Current liquidity
- `sqrt_price_x96`: Current price (sqrt format)
- `tick`: Current tick
- `tick_spacing`: Tick spacing for the pool
- `created_at_block`: Block number when pool was created
- `created_at_timestamp`: Timestamp when pool was created

#### Swap
- `id`: Unique swap identifier (tx_hash + log_index)
- `pool`: Pool contract address
- `sender`: Address that initiated the swap
- `recipient`: Address that received the output
- `amount0`: Token0 amount (negative = out, positive = in)
- `amount1`: Token1 amount (negative = out, positive = in)
- `sqrt_price_x96`: Price after swap
- `liquidity`: Liquidity after swap
- `tick`: Tick after swap
- `block_number`: Block number of the swap
- `timestamp`: Timestamp of the swap
- `transaction_hash`: Transaction hash

## Running the Example

1. **Start AugustIndexer**:
```bash
npm run dev
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your RPC URLs and database credentials
```

3. **Deploy the Uniswap indexer**:
```bash
node scripts/deploy-uniswap-example.js
```

4. **Monitor indexing progress**:
```bash
curl http://localhost:3000/health
```

## WebSocket Subscriptions

You can subscribe to real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');

// Subscribe to new pool creations
ws.send(JSON.stringify({
  type: 'subscribe',
  index: 'PoolIndex',
  filter: {}
}));

// Subscribe to swaps for a specific pool
ws.send(JSON.stringify({
  type: 'subscribe', 
  index: 'SwapIndex',
  filter: {
    pool: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
  }
}));
```

## Advanced Queries

The query engine supports complex operations:

### Time Series Analysis
```bash
curl -X POST http://localhost:3000/query/SwapVolumeByTimeRange \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": 1640995200,
    "end_time": 1641081600
  }'
```

### Aggregations
```bash
curl -X POST http://localhost:3000/aggregate/SwapIndex \
  -H "Content-Type: application/json" \
  -d '{
    "field": "amount0",
    "operation": "sum",
    "groupBy": "pool",
    "where": [
      {"field": "timestamp", "operator": "gte", "value": 1640995200}
    ]
  }'
```
