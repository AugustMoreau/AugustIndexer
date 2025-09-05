# AugustIndexer

A blockchain indexer that works with the Augustium programming language. Built this to make it easier to index smart contracts and run machine learning models on-chain.

## What is this?

Basically, if you want to:
- Index blockchain data from multiple chains (Ethereum, Solana, etc.)
- Write smart contracts in Augustium (a language I've been working on)
- Run ML models directly in your contracts
- Query blockchain data easily

Then this might be useful for you.

## Features

**Augustium Language Support**
- Full compiler implementation (lexer, parser, AST)
- Compiles to WebAssembly for execution
- Built-in ML primitives (tensors, neural networks)
- Rust-like syntax with memory safety

**Multi-Chain Indexing**
- Works with Ethereum and Solana
- Real-time event streaming
- Structured data storage in PostgreSQL
- GraphQL and REST APIs for queries

**Machine Learning**
- Run neural networks in smart contracts
- On-chain training and inference
- Tensor operations and linear algebra
- Privacy-preserving ML with zero-knowledge proofs

## Getting Started

### What you need
- Node.js 18 or higher
- PostgreSQL 14+
- Rust 1.70+ (for WebAssembly compilation)

### Installation

```bash
git clone https://github.com/AugustMoreau/AugustIndexer
cd AugustIndexer
npm install
```

Copy the example environment file and edit it:
```bash
cp .env.example .env
# Edit .env with your database and RPC URLs
```

Start the indexer:
```bash
npm start
```

## Example: Simple ML Contract

Here's what an Augustium contract looks like:

```rust
// hello_ml.aug
use stdlib::ml::{NeuralNetwork, MLDataset};

contract HelloML {
    let mut model: NeuralNetwork;
    let mut training_data: MLDataset;
    let mut message: String;

    fn constructor(initial_message: String) {
        self.message = initial_message;
        self.model = NeuralNetwork::new(vec![10, 5, 1]);
        self.training_data = MLDataset::new();
    }

    pub fn get_message() -> String {
        self.message.clone()
    }

    pub fn add_training_data(features: Vec<f64>, label: f64) {
        self.training_data.add_sample(features, label);
    }

    pub fn train_model() {
        self.model.train(&self.training_data, 100, 0.01);
    }

    pub fn predict(features: Vec<f64>) -> f64 {
        self.model.predict(&features)
    }
}
```

Deploy it by sending the code to the `/deploy` endpoint:

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"code": "contract HelloML { ... }"}'
```

## Indexing Blockchain Data

You can also use Augustium to define indexers. For example, to index Uniswap pools:

```rust
struct Pool {
    id: Address,
    token0: Address,
    token1: Address,
    liquidity: U256,
}

index PoolIndex {
    source: Ethereum(Mainnet),
    contract: "UniswapV3Pool",
    map: (event) => Pool {
        id: event.poolAddress,
        token0: event.token0,
        token1: event.token1,
        liquidity: event.liquidity
    }
}

query TopPools(limit: 10) {
    from: PoolIndex
    order_by: liquidity desc
}
```

## API Endpoints

- `GET /health` - Check if the indexer is running
- `POST /deploy` - Deploy Augustium code
- `POST /query/:queryName` - Execute a named query
- `POST /graphql` - GraphQL endpoint (coming soon)

## Architecture

The system has a few main parts:

1. **Chain Listeners** - Connect to blockchain RPC endpoints and stream events
2. **Augustium Compiler** - Compiles Augustium code to WebAssembly
3. **WASM Runtime** - Executes compiled contracts safely
4. **Storage Layer** - PostgreSQL for structured data
5. **Query Engine** - GraphQL and REST APIs

## Development

Run tests:
```bash
npm test
```

Build:
```bash
npm run build
```

## Why Augustium?

I wanted a language that:
- Has first-class ML support
- Compiles to WebAssembly for safety
- Works across different blockchains
- Is easy to write indexers in

Solidity is great for Ethereum, but it doesn't have ML primitives and can't run on other chains easily. Augustium tries to solve these problems.

## Status

This is still experimental. The language spec is evolving and there might be breaking changes. But the basic functionality works.


## License

MIT - see LICENSE file
