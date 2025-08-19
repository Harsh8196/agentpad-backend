# AgentPad CLI

A powerful command-line interface for managing and executing AI agent workflows on the SEI blockchain.

## Quick Start

### Using npm commands (RECOMMENDED)
```bash
# List available flows
npm run agentpad list

# Start a single flow
npm run agentpad start flow1

# Start multiple flows
npm run agentpad start flow1 flow2

# Stop flows
npm run agentpad stop

# Show status
npm run agentpad status

# Validate a flow
npm run agentpad validate flow1
```

### Using npx directly
```bash
# List available flows
npx --no-install tsx --no-warnings bin/agentpad.js list

# Start a single flow
npx --no-install tsx --no-warnings bin/agentpad.js start flow1

# Start multiple flows
npx --no-install tsx --no-warnings bin/agentpad.js start flow1 flow2

# Stop flows
npx --no-install tsx --no-warnings bin/agentpad.js stop

# Show status
npx --no-install tsx --no-warnings bin/agentpad.js status

# Validate a flow
npx --no-install tsx --no-warnings bin/agentpad.js validate flow1
```

## Commands

### `start` - Execute a flow
```bash
agentpad start <flows...> [options]
```

**Arguments:**
- `<flows...>` - Flow file paths or flow names (can specify multiple)

**Options:**
- `-w, --watch` - Watch for changes and restart automatically
- `-d, --daemon` - Run as daemon process

**Examples:**
```bash
# Start a single flow
npm run agentpad start flow1

# Start multiple flows
npm run agentpad start flow1 flow2 flow3

# Start a flow as daemon
npm run agentpad start flow1 --daemon
```

### `stop` - Stop running flows
```bash
agentpad stop [flow]
```

**Arguments:**
- `[flow]` - Flow name to stop (optional, stops all if not specified)

**Examples:**
```bash
# Stop all flows
npm run agentpad stop

# Stop specific flow
npm run agentpad stop flow1
```

### `list` - List available flows
```bash
agentpad list [type]
```

**Arguments:**
- `[type]` - Type to list: "running" for running flows only

**Examples:**
```bash
# List all flows
npm run agentpad list

# List only running flows
npm run agentpad list running
```

### `status` - Show flow status
```bash
agentpad status [flow]
```

**Arguments:**
- `[flow]` - Flow name (optional)

**Examples:**
```bash
# Show status of all flows
npm run agentpad status

# Show status of specific flow
npm run agentpad status flow1
```

### `validate` - Validate a flow without executing
```bash
agentpad validate <flow>
```

**Arguments:**
- `<flow>` - Flow file path or flow name

**Examples:**
```bash
# Validate a flow
npm run agentpad validate flow1
```

## Multiple Flow Execution

The CLI supports running multiple flows simultaneously:

```bash
# Start multiple flows at once
npm run agentpad start flow1 flow2 flow3

# This will execute all flows in parallel and show results
```

## Flow Management

### Flow Storage
Flows are stored in the `flows/` directory as JSON files. The CLI automatically looks for flows in this directory.

### Flow Structure
Each flow should have:
- `name` - Flow name
- `description` - Flow description (optional)
- `nodes` - Array of flow nodes
- `edges` - Array of connections between nodes

### Example Flow
```json
{
  "name": "My Flow",
  "description": "A simple test flow",
  "nodes": [
    {
      "id": "start-node",
      "type": "start",
      "data": {
        "config": {
          "variables": [
            {
              "name": "my_variable",
              "type": "string"
            }
          ]
        }
      }
    }
  ],
  "edges": []
}
```

## Environment Variables

### Required
- `SEI_PRIVATE_KEY` - Your SEI private key for blockchain operations

### Optional
- `OPENAI_API_KEY` - OpenAI API key for LLM operations
- `TELEGRAM_BOT_TOKEN` - Telegram bot token for approval workflows
- `TELEGRAM_CHAT_ID` - Telegram chat ID for notifications
- `COINGECKO_DEMO_API_KEY` - CoinGecko API key for market data

## Network Selection

Network selection is handled within individual blockchain nodes in your flows, not at the CLI level. Each blockchain node can be configured to use:
- `mainnet` - SEI mainnet
- `testnet` - SEI testnet

This allows different nodes in the same flow to use different networks as needed.

## Performance Optimization

### Fast Startup
The CLI uses `tsx` for fast TypeScript execution without compilation step.

### Multiple Flow Execution
- Flows run in parallel for maximum efficiency
- Each flow has its own isolated execution context
- Progress tracking for each flow independently

## Error Handling

The CLI provides detailed error messages and logging:
- Invalid flow files
- Missing environment variables
- Network connectivity issues
- Blockchain operation failures

## Examples

### Complete Workflow Example

1. **Create flow files** in `flows/` directory:
   - `flows/my-workflow.json`
   - `flows/another-workflow.json`

2. **Validate flows**:
```bash
npm run agentpad validate my-workflow
npm run agentpad validate another-workflow
```

3. **Start multiple flows**:
```bash
npm run agentpad start my-workflow another-workflow
```

4. **Check status**:
```bash
npm run agentpad status
```

## Troubleshooting

### Common Issues

1. **"SEI_PRIVATE_KEY environment variable is required"**
   - Set your private key: `export SEI_PRIVATE_KEY=your_private_key`

2. **"Flow not found"**
   - Ensure the flow file exists in the `flows/` directory
   - Check the flow name (without .json extension)

3. **"Flow validation failed"**
   - Check that the flow has required fields (nodes, edges, start node)
   - Ensure all nodes have proper configuration

4. **Slow startup**
   - Use `npm run agentpad` for fastest execution
   - The command uses `--no-install` and `--no-warnings` for faster startup

### Getting Help
```bash
# Show help
npm run agentpad --help

# Show command help
npm run agentpad start --help
npm run agentpad stop --help
npm run agentpad list --help
npm run agentpad status --help
npm run agentpad validate --help
``` 