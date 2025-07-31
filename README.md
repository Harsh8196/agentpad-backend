# AgentPad Backend

A Node.js-based flow execution engine for AI agent workflows on the SEI blockchain.

## 🚀 Features

- **Network-Aware Blockchain Operations**: Support for mainnet, testnet, and devnet
- **LLM Integration**: AI-powered decision making with LangChain
- **Variable Management**: Dynamic variable handling across nodes
- **Timer Operations**: Delay, interval, and timeout functionality
- **Conditional Logic**: Branching based on conditions
- **Arithmetic Operations**: Mathematical calculations
- **Real-time Logging**: Comprehensive execution logging

## 📋 Prerequisites

- Node.js 18+
- SEI private key
- OpenAI API key (for LLM nodes)

## 🛠️ Installation

1. **Install Dependencies**:
```bash
npm install
```

2. **Environment Setup**:
```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
```bash
   SEI_PRIVATE_KEY=your_private_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## 🎯 Usage

### Basic Flow Execution
```bash
node src/index.js flow.json
```

### Network-Specific Execution
```bash
# Mainnet (default)
node src/index.js flow.json mainnet

# Testnet
node src/index.js flow.json testnet

# Devnet
node src/index.js flow.json devnet
```

## 🔗 Supported Blockchain Operations

### Basic Operations (All Networks)
- `sei_erc20_balance` - Get token balance
- `sei_erc20_transfer` - Transfer ERC-20 tokens
- `sei_native_transfer` - Transfer native SEI
- `sei_erc721_balance` - Get NFT balance
- `sei_erc721_transfer` - Transfer NFTs
- `sei_erc721_mint` - Mint NFTs

### DeFi Operations (Mainnet Only)
- `sei_swap` - Token swapping via Symphony
- `sei_stake` - Stake SEI tokens
- `sei_unstake` - Unstake SEI tokens
- `sei_mint_takara` - Mint tTokens
- `sei_borrow_takara` - Borrow from Takara
- `sei_repay_takara` - Repay to Takara
- `sei_redeem_takara` - Redeem from Takara

### Trading Operations (Mainnet Only)
- `sei_citrex_place_order` - Place trading orders
- `sei_citrex_get_balance` - Get trading balance
- `sei_citrex_get_products` - Get available products
- `sei_citrex_get_order_book` - Get order book data

### Social Operations (Mainnet Only)
- `sei_post_tweet` - Post tweets
- `sei_get_account_details` - Get account details

## 📊 Node Types

### Start Node
- **Purpose**: Flow entry point and variable initialization
- **Configuration**: 
  ```json
  {
    "variables": [
      {
        "name": "myVariable",
        "type": "string",
        "defaultValue": "initial value",
        "description": "Variable description"
      }
    ]
  }
  ```

### Blockchain Node
- **Purpose**: Execute SEI blockchain operations
- **Configuration**:
  ```json
  {
    "network": "mainnet|testnet|devnet",
    "selectedTool": "sei_erc20_balance",
    "toolParameters": {
      "ticker": "SEI"
    },
    "outputVariable": "result"
  }
  ```

### LLM Node
- **Purpose**: AI-powered analysis and decision making
- **Configuration**:
  ```json
  {
    "prompt": "Analyze the current state and suggest actions",
    "input": "Current workflow state",
    "outputVariable": "aiAnalysis",
    "chatInterface": false,
    "model": "gpt-4-turbo"
  }
  ```

### Timer Node
- **Purpose**: Add delays or intervals
- **Configuration**:
  ```json
  {
    "timerType": "delay|interval|timeout",
    "duration": 60,
    "unit": "s|m|ms",
    "repeatCount": 3,
    "outputVariable": "timerResult"
  }
  ```

### Conditional Node
- **Purpose**: Make decisions based on conditions
- **Configuration**:
  ```json
  {
    "value1": "variable1",
    "operator": "equals|not_equals|greater|less",
    "value2": "variable2",
    "outputVariable": "conditionResult"
  }
  ```

### Arithmetic Node
- **Purpose**: Perform mathematical operations
- **Configuration**:
  ```json
  {
    "value1": "variable1",
    "operator": "add|subtract|multiply|divide",
    "value2": "variable2",
    "outputVariable": "calculationResult"
  }
  ```

### Variable Node
- **Purpose**: Set, get, or modify variables
- **Configuration**:
  ```json
  {
    "variableName": "myVariable",
    "operation": "set|increment|decrement",
    "value": "newValue",
    "outputVariable": "operationResult"
  }
  ```

## 🔧 Architecture

### EnhancedSeiAgentKit
A wrapper around the original `sei-agent-kit` that adds network selection capabilities:

- **Network Support**: Mainnet, testnet, devnet
- **Tool Validation**: Ensures operations are supported on selected network
- **Dynamic RPC**: Automatically configures RPC endpoints
- **Warning System**: Alerts for non-mainnet DeFi operations

### Flow Executor
The core execution engine that:

- **Recursive Execution**: Traverses flow nodes recursively
- **Variable Resolution**: Handles variable references and constants
- **Network Management**: Creates network-specific SeiAgentKit instances
- **Error Handling**: Comprehensive error logging and recovery

## 📝 Example Flows

### Basic Token Operations (Testnet)
```json
{
  "name": "Basic Token Operations",
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "data": {
        "config": {
          "variables": [
            { "name": "balance", "type": "string", "defaultValue": "" }
          ]
        }
      }
    },
    {
      "id": "blockchain-1",
      "type": "blockchain",
      "data": {
        "config": {
          "network": "testnet",
          "selectedTool": "sei_erc20_balance",
          "toolParameters": { "ticker": "SEI" },
          "outputVariable": "balance"
        }
      }
    }
  ],
  "edges": [
    { "source": "start-1", "target": "blockchain-1" }
  ]
}
```

### DeFi Operations (Mainnet)
```json
{
  "name": "DeFi Operations",
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "data": { "config": { "variables": [] } }
    },
    {
      "id": "blockchain-1",
      "type": "blockchain",
      "data": {
        "config": {
          "network": "mainnet",
          "selectedTool": "sei_swap",
          "toolParameters": {
            "amount": "10",
            "tokenIn": "0x...",
            "tokenOut": "0x..."
          }
        }
      }
    },
    {
      "id": "llm-1",
      "type": "llm",
      "data": {
        "config": {
          "prompt": "Analyze the swap result and suggest next actions",
          "outputVariable": "analysis"
        }
      }
    }
  ],
  "edges": [
    { "source": "start-1", "target": "blockchain-1" },
    { "source": "blockchain-1", "target": "llm-1" }
  ]
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Memory Issues**: If you encounter memory problems during build:
   ```bash
   node --max-old-space-size=8192 ./node_modules/.bin/tsc
   ```

2. **Network Connection**: Ensure your RPC endpoints are accessible

3. **Private Key**: Verify your SEI private key is correct and has sufficient balance

4. **API Keys**: Check that your OpenAI API key is valid

### Logging

The system uses Winston for logging. Set `LOG_LEVEL` in your `.env` file:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information

## 🔄 Development

### Adding New Blockchain Operations

1. **Update Tool Mapping**: Add to `TOOL_NETWORK_SUPPORT` in `enhancedSeiAgentKit.js`
2. **Add Method**: Implement in `executeSeiAgentKitMethod` in `flowExecutor.js`
3. **Test**: Create test flows to verify functionality

### Adding New Node Types

1. **Add Case**: Add to `executeNode` switch statement in `flowExecutor.js`
2. **Implement Method**: Create execution method for the new node type
3. **Update Frontend**: Add corresponding frontend components

## 📄 License

This project is part of AgentPad and follows the same licensing terms. 