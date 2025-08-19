# AgentPad Backend

A Node.js-based flow execution engine for AI agent workflows on the SEI blockchain, designed to work seamlessly with the AgentPad frontend.

## 🚀 Features

- **Network-Aware Blockchain Operations**: Support for SEI mainnet and testnet
- **LLM Integration**: AI-powered decision making with OpenAI models
- **Variable Management**: Dynamic variable handling across nodes
- **Timer Operations**: Delay, interval, and timeout functionality
- **Conditional Logic**: Branching based on conditions
- **Arithmetic Operations**: Mathematical calculations
- **Real-time Logging**: Comprehensive execution logging
- **Webhook Management**: Automatic Telegram webhook handling
- **Smart Contract Integration**: Dynamic ABI parsing and execution
- **Market Data**: Real-time token price fetching

## 📋 Prerequisites

- Node.js 18+
- SEI private key
- OpenAI API key (for LLM nodes)
- Telegram bot token (for approval workflows)

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
# Required
SEI_PRIVATE_KEY=your_private_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
COINGECKO_DEMO_API_KEY=your_coingecko_api_key_here
```

## 🎯 Usage

### Using the CLI (Recommended)
```bash
# Start a flow
npm run agentpad start flow_name

# Start multiple flows
npm run agentpad start flow1 flow2

# Stop flows
npm run agentpad stop

# List available flows
npm run agentpad list

# Check status
npm run agentpad status

# Validate a flow
npm run agentpad validate flow_name
```

### Direct Execution (Legacy)
```bash
# Single flow execution
node src/index.js flow.json

# Network-specific execution
node src/index.js flow.json mainnet
node src/index.js flow.json testnet
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
- `sei_citrex_list_balances` - List all balances
- `sei_citrex_deposit` - Deposit funds
- `sei_citrex_withdraw` - Withdraw funds
- `sei_citrex_get_account_health` - Get account health
- `sei_citrex_list_open_orders` - List open orders
- `sei_citrex_cancel_order` - Cancel orders

### Social Operations (Mainnet Only)
- `sei_post_tweet` - Post tweets
- `sei_get_account_details` - Get account details
- `sei_post_tweet_reply` - Reply to tweets

### Strategy Operations (Mainnet Only)
- `sei_compose_trade_by_source_tx` - Compose trade by source
- `sei_compose_trade_by_target_tx` - Compose trade by target
- `sei_create_buy_sell_strategy` - Create buy/sell strategy
- `sei_create_overlapping_strategy` - Create overlapping strategy
- `sei_delete_strategy` - Delete strategy
- `sei_get_user_strategies` - Get user strategies
- `sei_update_strategy` - Update strategy

## 📊 Node Types

### Start Node
- **Purpose**: Flow entry point and variable initialization
- **Configuration**: Define initial variables with types and default values

### Blockchain Node
- **Purpose**: Execute SEI blockchain operations
- **Configuration**: Network selection, tool choice, and parameters

### LLM Node
- **Purpose**: AI-powered analysis and decision making
- **Configuration**: Prompt, input variables, model selection, and output

### Timer Node
- **Purpose**: Add delays or intervals
- **Types**: Delay, interval, timeout

### Conditional Node
- **Purpose**: Make decisions based on conditions
- **Operators**: equals, not_equals, greater, less

### Arithmetic Node
- **Purpose**: Perform mathematical operations
- **Operators**: add, subtract, multiply, divide

### Variable Node
- **Purpose**: Set, get, or modify variables
- **Operations**: set, get, increment, decrement

### Market Data Node
- **Purpose**: Fetch real-time token prices
- **Sources**: CoinGecko API

### Smart Contract Nodes
- **Read Node**: Execute read operations on smart contracts
- **Write Node**: Execute write operations on smart contracts
- **Features**: Dynamic ABI parsing, method discovery

### Telegram Node
- **Purpose**: Send notifications and interactive messages
- **Features**: Inline keyboards, approval workflows

### User Approval Node
- **Purpose**: Wait for user approval before proceeding
- **Integration**: Works with Telegram for interactive approvals

### Logger Node
- **Purpose**: Log messages during flow execution
- **Levels**: info, warn, error, debug

## 🔧 Architecture

### NetworkAwareSeiAgentKit
A wrapper around `sei-agent-kit` that adds network selection capabilities:

- **Network Support**: Mainnet, testnet
- **Tool Validation**: Ensures operations are supported on selected network
- **Dynamic RPC**: Automatically configures RPC endpoints
- **Warning System**: Alerts for non-mainnet DeFi operations

### Flow Executor
The core execution engine that:

- **Sequential Execution**: Processes nodes in dependency order
- **Variable Resolution**: Handles variable references and constants
- **Network Management**: Creates network-specific SeiAgentKit instances
- **Error Handling**: Comprehensive error logging and recovery
- **Webhook Management**: Automatic Telegram webhook handling

## 📝 Example Flow Structure

```json
{
  "name": "Example Flow",
  "description": "A simple test flow",
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
          "network": "mainnet",
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

## 🐛 Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure all required environment variables are set
2. **Network Connection**: Verify RPC endpoints are accessible
3. **Private Key**: Check that your SEI private key is correct and has sufficient balance
4. **API Keys**: Verify that your OpenAI API key is valid

### Logging

The system uses Winston for logging. Set `LOG_LEVEL` in your `.env` file:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information

## 🔄 Development

### Adding New Blockchain Operations

1. **Update sei-agent-kit**: Ensure the operation is available in the latest version
2. **Add to flowExecutor**: Implement in the blockchain node execution logic
3. **Test**: Create test flows to verify functionality

### Adding New Node Types

1. **Add Case**: Add to `executeNode` switch statement in `flowExecutor.js`
2. **Implement Method**: Create execution method for the new node type
3. **Update Frontend**: Add corresponding frontend components

## 📄 License

MIT License - see LICENSE file for details.