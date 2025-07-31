# AgentPad CLI

A powerful command-line interface for managing and executing AI agent workflows on the SEI blockchain.

## Quick Start

### Using the batch file (Windows)
```bash
# List available flows
.\agentpad.bat list

# Start a flow
.\agentpad.bat start test-flow --network testnet

# Validate a flow
.\agentpad.bat validate test-flow

# Show status
.\agentpad.bat status
```

### Using npx directly
```bash
# List available flows
npx tsx bin/agentpad.js list

# Start a flow
npx tsx bin/agentpad.js start test-flow --network testnet

# Validate a flow
npx tsx bin/agentpad.js validate test-flow

# Show status
npx tsx bin/agentpad.js status
```

## Commands

### `start` - Execute a flow
```bash
agentpad start <flow> [options]
```

**Arguments:**
- `<flow>` - Flow file path or flow name (without .json extension)

**Options:**
- `-n, --network <network>` - Network to use (mainnet, testnet, devnet) [default: mainnet]
- `-w, --watch` - Watch for changes and restart automatically
- `-d, --daemon` - Run as daemon process

**Examples:**
```bash
# Start a flow on mainnet
agentpad start my-flow

# Start a flow on testnet
agentpad start my-flow --network testnet

# Start a flow as daemon
agentpad start my-flow --daemon
```

### `stop` - Stop running flows
```bash
agentpad stop [options]
```

**Options:**
- `-a, --all` - Stop all running flows
- `-f, --flow <name>` - Stop specific flow by name

**Examples:**
```bash
# Stop all flows
agentpad stop --all

# Stop specific flow
agentpad stop --flow my-flow
```

### `list` - List available flows
```bash
agentpad list [options]
```

**Options:**
- `-r, --running` - Show only running flows

**Examples:**
```bash
# List all flows
agentpad list

# List only running flows
agentpad list --running
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
agentpad status

# Show status of specific flow
agentpad status my-flow
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
agentpad validate my-flow
```

## Flow Management

### Flow Storage
Flows are stored in the `flows/` directory as JSON files. The CLI will automatically look for flows in this directory.

### Flow Structure
Each flow should have:
- `name` - Flow name
- `description` - Flow description
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
      "data": {
        "type": "start",
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

## Networks

### Supported Networks
- `mainnet` - SEI mainnet
- `testnet` - SEI testnet  
- `devnet` - SEI devnet

### Network-Specific Features
- **Mainnet**: All operations available
- **Testnet**: Basic operations (ERC-20 transfer, native SEI transfer)
- **Devnet**: Basic operations only

## Error Handling

The CLI provides detailed error messages and logging:
- Invalid flow files
- Missing environment variables
- Network connectivity issues
- Blockchain operation failures

## Examples

### Complete Workflow Example

1. **Create a flow file** (`flows/my-workflow.json`):
```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "id": "start-node",
      "data": {
        "type": "start",
        "config": {
          "variables": [
            {
              "name": "balance",
              "type": "string"
            }
          ]
        }
      }
    },
    {
      "id": "blockchain-node",
      "data": {
        "type": "blockchain",
        "config": {
          "network": "testnet",
          "selectedTool": "sei_erc20_balance",
          "outputVariable": "balance",
          "toolParameters": {
            "ticker": "SEI"
          }
        }
      }
    }
  ],
  "edges": [
    {
      "source": "start-node",
      "target": "blockchain-node"
    }
  ]
}
```

2. **Validate the flow**:
```bash
agentpad validate my-workflow
```

3. **Start the flow**:
```bash
agentpad start my-workflow --network testnet
```

4. **Check status**:
```bash
agentpad status my-workflow
```

## Troubleshooting

### Common Issues

1. **"SEI_PRIVATE_KEY environment variable is required"**
   - Set your private key: `export SEI_PRIVATE_KEY=your_private_key`

2. **"Flow not found"**
   - Ensure the flow file exists in the `flows/` directory
   - Check the flow name (without .json extension)

3. **"Invalid network"**
   - Use one of: mainnet, testnet, devnet

4. **"Flow validation failed"**
   - Check that the flow has required fields (nodes, edges, start node)
   - Ensure all nodes have proper configuration

### Getting Help
```bash
# Show help
agentpad --help

# Show command help
agentpad start --help
agentpad stop --help
agentpad list --help
agentpad status --help
agentpad validate --help
``` 