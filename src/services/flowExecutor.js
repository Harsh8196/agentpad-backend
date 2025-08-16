import { logger } from '../utils/logger.js';
import { ModelProviderName } from 'sei-agent-kit';
import NetworkAwareSeiAgentKit from './networkAwareSeiAgentKit.js';
import LLMNode from './llmNode.js';
import { TelegramNode } from './telegramNode.js';
import { UserApprovalNode } from './userApprovalNode.js';
import { WebhookHandler } from '../webhookHandler.js';
import SmartContractNode from './smartContractNode.js';

export class BackendFlowExecutor {
  constructor(privateKey) {
    this.privateKey = privateKey;
    
    // Initialize sei-agent-kit (default to mainnet)
    this.seiKit = new NetworkAwareSeiAgentKit(privateKey, ModelProviderName.OPENAI, 'mainnet');
    
    this.variables = {};
    this.nodeResults = {};
    this.shouldStop = false;
    
    // Initialize webhook handler for Telegram approvals
    this.webhookHandler = new WebhookHandler();
  }

  async executeFlow(flowData) {
    const { nodes, edges } = flowData;
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      throw new Error('Invalid flow: nodes and edges must be arrays');
    }

    // Build node map for quick lookup
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    
    // Find Start node
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) throw new Error('No Start node found');

    // Start webhook server if not already running
    if (!this.webhookHandler.server) {
      await this.webhookHandler.start(3001);
      logger.info('✅ Webhook server started for Telegram approvals on port 3001');
    }

    // Execute flow starting from start node
    await this.executeNodeRecursive(startNode, nodeMap, edges, new Set());
    
    logger.info('All nodes executed successfully.');
    return this.nodeResults;
  }

  async executeNodeRecursive(node, nodeMap, edges, visited, isIntervalExecution = false) {
    // Check if we should stop execution
    if (this.shouldStop) {
      logger.info(`Stopping execution due to stop condition`);
      return;
    }
    
    // For interval executions, don't mark nodes as visited to allow re-execution
    if (!isIntervalExecution && visited.has(node.id)) return;
    if (!isIntervalExecution) visited.add(node.id);
    
    logger.info(`[START] Node ${node.type} (${node.id})${isIntervalExecution ? ' [INTERVAL]' : ''}`);
    try {
      const result = await this.executeNode(node, nodeMap, edges, visited);
      this.nodeResults[node.id] = result;
      logger.info(`[END] Node ${node.type} (${node.id})${isIntervalExecution ? ' [INTERVAL]' : ''}`);
      
      // Check for stop condition after conditional nodes
      if (node.type === 'conditional' && this.nodeResults[node.id] === true) {
        // Check if this is a stop condition (you can customize this logic)
        const config = node.data?.config;
        if (config && config.value1 === 'stopMonitoring' && config.value2 === 'true') {
          this.shouldStop = true;
          logger.info(`Stop condition met: ${config.value1} = ${config.value2}`);
          return;
        }
      }
      
      // Find next nodes based on edges
      const nextEdges = edges.filter(e => e.source === node.id);
      
      for (const edge of nextEdges) {
        const nextNode = nodeMap[edge.target];
        if (!nextNode) continue;
        
        // For conditional nodes, check the sourceHandle to determine path
        if (node.type === 'conditional' && edge.sourceHandle) {
          const conditionResult = this.nodeResults[node.id];
          const shouldFollow = edge.sourceHandle === 'true' ? conditionResult : !conditionResult;
          
          if (shouldFollow) {
            await this.executeNodeRecursive(nextNode, nodeMap, edges, visited, isIntervalExecution);
          }
        } else {
          // For other nodes, always follow
          await this.executeNodeRecursive(nextNode, nodeMap, edges, visited, isIntervalExecution);
        }
      }
    } catch (err) {
      logger.error(`[ERROR] Node ${node.type} (${node.id}): ${err.message}`);
      throw err;
    }
  }

  async executeNode(node, nodeMap, edges, visited) {
    switch (node.type) {
      case 'start':
        return this.executeStartNode(node);
      case 'variable':
        return this.executeVariableNode(node);
      case 'arithmetic':
        return this.executeArithmeticNode(node);
      case 'conditional':
        return this.executeConditionalNode(node);
      case 'timer':
        return this.executeTimerNode(node, nodeMap, edges, visited);
      case 'blockchain':
        return this.executeBlockchainNode(node);
      case 'llm':
        return this.executeLLMNode(node);
      case 'logger':
        return this.executeLoggerNode(node);
      case 'telegram':
        return this.executeTelegramNode(node);
      case 'userApproval':
        return this.executeUserApprovalNode(node);
      case 'marketData':
        return this.executeMarketDataNode(node);
      case 'smartContractRead':
        return this.executeSmartContractReadNode(node);
      case 'smartContractWrite':
        return this.executeSmartContractWriteNode(node);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  executeLoggerNode(node) {
    logger.info(`Executing Logger node: ${node.id}`);
    const config = node.data.config;
    const level = config.level || 'info';
    const message = config.message || 'Logger message';
    const value = config.value || '';
    

    
    // Resolve variables in message and value
    const resolvedMessage = this.resolveVariablesInString(message);
    
    // Handle value field - if it's a variable reference, get the actual variable
    let resolvedValue;
    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
      // It's a variable reference like {marketdata}
      const variablePath = value.slice(1, -1); // Remove { and }
      resolvedValue = this.resolveVariablePath(variablePath);
    } else {
      // Use normal resolution for other cases
      resolvedValue = this.resolveValue(value);
    }
    
    const logMessage = `${resolvedMessage} - ${JSON.stringify(resolvedValue, null, 2)}`;
    
    switch (level.toLowerCase()) {
      case 'error':
        logger.error(logMessage);
        break;
      case 'warn':
        logger.warn(logMessage);
        break;
      case 'debug':
        logger.debug(logMessage);
        break;
      default:
        logger.info(logMessage);
    }
    
    const result = {
      level,
      message: resolvedMessage,
      value: resolvedValue,
      timestamp: Date.now()
    };
    
    if (config.outputVariable) {
      this.variables[config.outputVariable] = result;
    }
    
    this.nodeResults[node.id] = result;
    return result;
  }

  executeVariableNode(node) {
    const { config } = node.data;
    if (!config || !config.variableName) throw new Error('Variable node missing variableName');
    
    const operation = config.operation || 'set';
    const variableName = config.variableName;
    
    switch (operation) {
      case 'set':
        // Convert string values to numbers when possible
        const setValue = this.resolveValue(config.value);
        this.variables[variableName] = setValue;
        break;
      case 'get':
        // Just retrieve the variable value (no modification)
        if (!(variableName in this.variables)) {
          this.variables[variableName] = undefined;
        }
        break;
      case 'increment':
        if (!(variableName in this.variables)) {
          this.variables[variableName] = 0;
        } else {
          // Ensure the current value is a number
          let currentValue = this.variables[variableName];
          if (typeof currentValue === 'string') {
            currentValue = Number(currentValue);
            if (isNaN(currentValue)) currentValue = 0;
          }
          this.variables[variableName] = currentValue + 1;
        }
        break;
      case 'decrement':
        if (!(variableName in this.variables)) {
          this.variables[variableName] = 0;
        } else {
          // Ensure the current value is a number
          let currentValue = this.variables[variableName];
          if (typeof currentValue === 'string') {
            currentValue = Number(currentValue);
            if (isNaN(currentValue)) currentValue = 0;
          }
          this.variables[variableName] = currentValue - 1;
        }
        break;
      default:
        throw new Error(`Unknown variable operation: ${operation}`);
    }
    
    const variableValue = this.variables[variableName];
    const displayValue = typeof variableValue === 'object' && variableValue !== null 
      ? JSON.stringify(variableValue, null, 2) 
      : variableValue;
    logger.info(`Variable ${variableName} = ${displayValue} (operation: ${operation})`);
    return this.variables[variableName];
  }

  executeArithmeticNode(node) {
    const { config } = node.data;
    const v1 = this.resolveValue(config.value1);
    const v2 = this.resolveValue(config.value2);
    let result;
    switch (config.operation) {
      case 'add': result = v1 + v2; break;
      case 'subtract': result = v1 - v2; break;
      case 'multiply': result = v1 * v2; break;
      case 'divide': result = v2 !== 0 ? v1 / v2 : null; break;
      default: throw new Error('Unknown arithmetic operation');
    }
    if (config.outputVariable) this.variables[config.outputVariable] = result;
    return result;
  }

  executeConditionalNode(node) {
    const { config } = node.data;
    const v1 = this.resolveValue(config.value1);
    const v2 = this.resolveValue(config.value2);
    let result;
    switch (config.operator) {
      case 'equals': result = v1 === v2; break;
      case 'not_equals': result = v1 !== v2; break;
      case 'greater': result = v1 > v2; break;
      case 'less': result = v1 < v2; break;
      default: throw new Error('Unknown conditional operator');
    }
    if (config.outputVariable) this.variables[config.outputVariable] = result;
    return result;
  }

  async executeTimerNode(node, nodeMap, edges, visited) {
    const { config } = node.data;
    const timerType = config.timerType || 'delay';
    const duration = Number(config.duration) || 0;
    const unit = config.unit || 'ms';
    const repeatCount = config.repeatCount || -1;
    
    // Convert duration to milliseconds
    let durationMs = duration;
    if (unit === 's') durationMs = duration * 1000;
    else if (unit === 'm') durationMs = duration * 60 * 1000;
    
    logger.info(`Timer node: type=${timerType}, duration=${duration}${unit}, repeatCount=${repeatCount}, maxCount=${repeatCount > 0 ? repeatCount : 'Infinity'}`);
    
    switch (timerType) {
      case 'delay':
        if (durationMs > 0) {
          await new Promise(res => setTimeout(res, durationMs));
        }
        break;
        
      case 'interval':
        if (durationMs > 0) {
          let count = 0;
          const maxCount = repeatCount > 0 ? repeatCount : Infinity;
          
          while (count < maxCount && !this.shouldStop) {
            count++;
            logger.info(`Interval execution ${count}/${maxCount === Infinity ? '∞' : maxCount} (repeatCount=${repeatCount}, maxCount=${maxCount})`);
            
            // Execute connected logic during each interval
            const nextEdges = edges.filter(e => e.source === node.id);
            for (const edge of nextEdges) {
              const nextNode = nodeMap[edge.target];
              if (nextNode) {
                await this.executeNodeRecursive(nextNode, nodeMap, edges, visited, true);
              }
            }
            
            // Check if we should stop after executing logic
            if (this.shouldStop) {
              logger.info(`Stopping interval execution due to stop condition`);
              break;
            }
            
            if (count < maxCount) {
              await new Promise(res => setTimeout(res, durationMs));
            }
          }
        }
        break;
        
      case 'timeout':
        if (durationMs > 0) {
          await new Promise(res => setTimeout(res, durationMs));
          logger.info(`Timeout completed after ${duration}${unit}`);
        }
        break;
      
      default:
        throw new Error(`Unknown timer type: ${timerType}`);
    }
    
    if (config.outputVariable) {
      this.variables[config.outputVariable] = durationMs;
    }
    
    return durationMs;
  }

  async executeStartNode(node) {
    const { config } = node.data;
    if (config && config.variables) {
      // Initialize variables from start node
      for (const variable of config.variables) {
        let defaultValue;
        if (variable.defaultValue !== undefined) {
          // Coerce provided default based on declared type
          const provided = variable.defaultValue;
          switch (variable.type) {
            case 'number': {
              const num = typeof provided === 'number' ? provided : Number(provided);
              defaultValue = isNaN(num) ? 0 : num;
              break;
            }
            case 'boolean': {
              if (typeof provided === 'boolean') defaultValue = provided;
              else defaultValue = ['true', '1', 'yes', 'on'].includes(String(provided).toLowerCase());
              break;
            }
            case 'array': {
              if (Array.isArray(provided)) defaultValue = provided;
              else {
                try { defaultValue = JSON.parse(provided); } catch { defaultValue = []; }
                if (!Array.isArray(defaultValue)) defaultValue = [];
              }
              break;
            }
            case 'object': {
              if (provided && typeof provided === 'object' && !Array.isArray(provided)) {
                defaultValue = provided;
              } else {
                try { defaultValue = JSON.parse(provided); } catch { defaultValue = {}; }
                if (!defaultValue || Array.isArray(defaultValue) || typeof defaultValue !== 'object') defaultValue = {};
              }
              break;
            }
            case 'string': {
              defaultValue = String(provided);
              break;
            }
            default: {
              defaultValue = provided;
            }
          }
        } else {
          // No provided default: set sane defaults based on type
          switch (variable.type) {
            case 'number': defaultValue = 0; break;
            case 'string': defaultValue = ''; break;
            case 'boolean': defaultValue = false; break;
            case 'array': defaultValue = []; break;
            case 'object': defaultValue = {}; break;
            default: defaultValue = null;
          }
        }
        this.variables[variable.name] = defaultValue;
      }
      logger.info(`Initialized ${config.variables.length} variables from start node`);
    }
    return null;
  }

  async executeBlockchainNode(node) {
    logger.info(`Executing blockchain node: ${node.id}`);
    
    const config = node.data.config;
    const network = config.network || 'mainnet';
    const selectedTool = config.selectedTool;
    const parameters = config.toolParameters || {};
    
    if (!selectedTool) {
      throw new Error('No blockchain operation selected');
    }
    
    // Create network-specific SeiAgentKit instance
    const seiKit = new NetworkAwareSeiAgentKit(this.privateKey, ModelProviderName.OPENAI, network);
    
    try {
      const result = await this.executeSeiAgentKitMethod(seiKit, selectedTool, parameters);
      
      if (config.outputVariable) {
        this.variables[config.outputVariable] = result;
      }
      
      this.nodeResults[node.id] = result;
      
      logger.info(`Blockchain operation ${selectedTool} completed on ${network}:`, result);
      return result;
      
    } catch (error) {
      logger.error(`Error executing blockchain operation ${selectedTool} on ${network}:`, error);
      throw error;
    }
  }

  async executeSeiAgentKitMethod(seiKit, toolName, parameters) {
    const methodMap = {
      // Basic Operations
      'sei_erc20_balance': () => seiKit.getERC20Balance(parameters.contract_address),
      'sei_erc20_transfer': () => seiKit.ERC20Transfer(
        parameters.amount, 
        parameters.recipient, 
        parameters.ticker
      ),
      'sei_native_transfer': () => seiKit.ERC20Transfer(
        parameters.amount,
        parameters.recipient
      ),
      'sei_erc721_balance': () => seiKit.getERC721Balance(parameters.collectionAddress),
      'sei_erc721_transfer': () => seiKit.ERC721Transfer(
        parameters.recipient,
        parameters.tokenId,
        parameters.collectionAddress
      ),
      'sei_erc721_mint': () => seiKit.ERC721Mint(
        parameters.recipient,
        parameters.tokenId,
        parameters.collectionAddress
      ),

      // DeFi Operations
      'sei_swap': () => seiKit.swap(
        parameters.amount,
        parameters.tokenIn,
        parameters.tokenOut
      ),
      'sei_stake': () => seiKit.stake(parameters.amount),
      'sei_unstake': () => seiKit.unstake(parameters.amount),
      
      // Takara Operations
      'sei_mint_takara': () => seiKit.mintTakara(
        parameters.ticker,
        parameters.amount
      ),
      'sei_borrow_takara': () => seiKit.borrowTakara(
        parameters.ticker,
        parameters.borrowAmount
      ),
      'sei_repay_takara': () => seiKit.repayTakara(
        parameters.ticker,
        parameters.repayAmount
      ),
      'sei_redeem_takara': () => seiKit.redeemTakara(
        parameters.ticker,
        parameters.amount
      ),

      // Citrex Trading
      'sei_citrex_place_order': () => seiKit.citrexPlaceOrder(parameters.orderArgs),
      'sei_citrex_get_products': () => seiKit.citrexGetProducts(),
      'sei_citrex_get_order_book': () => seiKit.citrexGetOrderBook(
        parameters.product_id,
        parameters.aggregation
      ),
      'sei_citrex_list_balances': () => seiKit.citrexListBalances(),
      'sei_citrex_deposit': () => seiKit.citrexDeposit(parameters.amount),
      'sei_citrex_withdraw': () => seiKit.citrexWithdraw(parameters.amount),
      'sei_citrex_get_account_health': () => seiKit.citrexGetAccountHealth(),
      'sei_citrex_list_open_orders': () => seiKit.citrexListOpenOrders(),
      'sei_citrex_cancel_order': () => seiKit.citrexCancelOrder(parameters.order_id),

      // Social Operations
      'sei_post_tweet': () => seiKit.postTweet(parameters.tweet),
      'sei_get_account_details': () => seiKit.getAccountDetails(parameters.username),
      'sei_post_tweet_reply': () => seiKit.postTweetReply(
        parameters.tweet,
        parameters.reply_to_tweet_id
      ),

      // Carbon Strategies
      'sei_compose_trade_by_source_tx': () => seiKit.composeTradeBySourceTx(
        parameters.sourceAmount,
        parameters.sourceToken,
        parameters.targetToken,
        parameters.tradeActions
      ),
      'sei_compose_trade_by_target_tx': () => seiKit.composeTradeByTargetTx(
        parameters.targetAmount,
        parameters.sourceToken,
        parameters.targetToken,
        parameters.tradeActions
      ),
      'sei_create_buy_sell_strategy': () => seiKit.createBuySellStrategy(
        parameters.baseToken,
        parameters.quoteToken,
        parameters.buyMin,
        parameters.buyMax,
        parameters.sellMin,
        parameters.sellMax,
        parameters.buyBudget,
        parameters.sellBudget
      ),
      'sei_create_overlapping_strategy': () => seiKit.createOverlappingStrategy(
        parameters.baseToken,
        parameters.quoteToken,
        parameters.min,
        parameters.max,
        parameters.marginalPriceMin,
        parameters.marginalPriceMax,
        parameters.budget
      ),
      'sei_delete_strategy': () => seiKit.deleteStrategy(parameters.strategyId),
      'sei_get_user_strategies': () => seiKit.getUserStrategies(),
      'sei_update_strategy': () => seiKit.updateStrategy(
        parameters.strategyId,
        parameters.encoded_data
      ),


    };
    
    const method = methodMap[toolName];
    if (!method) {
      throw new Error(`Tool ${toolName} not supported`);
    }
    
    return await method();
  }

  async executeLLMNode(node) {
    logger.info(`Executing LLM node: ${node.id}`);
    
    // Get network from LLM node config, default to mainnet
    const network = node.data.config.network || 'mainnet';
    
    const llmNode = new LLMNode(
      node.data.config,
      this.privateKey,
      network
    );
    
    const context = {
      variables: this.variables,
      nodeResults: this.nodeResults,
      currentNode: node.id
    };
    
    const result = await llmNode.execute(
      node.data.config.input || "Analyze current workflow state",
      context
    );
    
    // Store result in output variable if specified
    if (node.data.config.outputVariable) {
      this.variables[node.data.config.outputVariable] = result;
    }
    
    this.nodeResults[node.id] = result;
    return result;
  }

  resolveValue(val) {
    // Direct variable reference
    if (typeof val === 'string' && val in this.variables) {
      return this.variables[val];
    }

    // Support dotted path: variable.property[.nested]
    if (typeof val === 'string' && val.includes('.')) {
      const parts = val.split('.');
      const base = parts.shift();
      if (base && base in this.variables) {
        let current = this.variables[base];
        // If base is JSON string, try to parse
        if (typeof current === 'string') {
          try { current = JSON.parse(current); } catch { /* keep as string */ }
        }
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            // Failed to traverse, return original value
            return val;
          }
          if (typeof current === 'string') {
            // Attempt to parse nested JSON strings
            try { const parsed = JSON.parse(current); if (parsed && typeof parsed === 'object') current = parsed; } catch { /* ignore */ }
          }
        }
        return current;
      }
    }
    if (typeof val === 'number') {
      return val;
    }
    // Handle empty strings
    if (typeof val === 'string' && val.trim() === '') {
      return 0; // Return 0 for empty strings
    }
    // Don't convert hex addresses or strings that start with 0x to numbers
    if (typeof val === 'string' && val.startsWith('0x')) {
      return val; // Keep as string for addresses/hex values
    }
    // Try to convert to number only for actual numeric strings
    if (typeof val === 'string' && /^-?\d*\.?\d+$/.test(val.trim())) {
      const numVal = Number(val);
      return isNaN(numVal) ? val : numVal;
    }
    // Return as-is for other strings
    return val;
  }

  resolveVariablesInString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    
    let resolvedString = str;
    
    // Find all variable placeholders in the string
    const variablePattern = /\{([^}]+)\}/g;
    const matches = resolvedString.match(variablePattern);
    
    if (matches) {
      for (const match of matches) {
        const variablePath = match.slice(1, -1); // Remove { and }
        const value = this.resolveVariablePath(variablePath);
        

        
        if (value !== undefined) {
          resolvedString = resolvedString.replace(match, value);
        } else {
          logger.warn(`Variable not found: ${variablePath}`);
        }
      }
    }
    
    return resolvedString;
  }
  
  resolveVariablePath(path) {
    const parts = path.split('.');
    let current = this.variables;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else if (typeof current === 'string') {
        // If current is a JSON string, try to parse and continue
        try {
          const parsed = JSON.parse(current);
          if (parsed && typeof parsed === 'object' && part in parsed) {
            current = parsed[part];
          } else {
            return undefined;
          }
        } catch {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  async executeTelegramNode(node) {
    logger.info(`Executing Telegram node: ${node.id}`);
    
    const telegramNode = new TelegramNode(
      node.data.config,
      {
        variables: this.variables,
        nodeResults: this.nodeResults,
        currentNode: node.id
      }
    );
    
    const result = await telegramNode.execute();
    
    // Store result in output variable if specified
    if (node.data.config.outputVariable) {
      this.variables[node.data.config.outputVariable] = result;
    }
    
    this.nodeResults[node.id] = result;
    return result;
  }

  async executeUserApprovalNode(node) {
    logger.info(`Executing User Approval node: ${node.id}`);
    
    const userApprovalNode = new UserApprovalNode(
      node.data.config,
      {
        variables: this.variables,
        nodeResults: this.nodeResults,
        currentNode: node.id,
        webhookHandler: this.webhookHandler
      }
    );
    
    const result = await userApprovalNode.execute();
    
    // Store result in output variable if specified
    if (node.data.config.outputVariable) {
      this.variables[node.data.config.outputVariable] = result;
    }
    
    this.nodeResults[node.id] = result;
    return result;
  }

  async executeMarketDataNode(node) {
    logger.info(`Executing market data node: ${node.id}`);
    
    const config = node.data.config;
    const symbol = this.resolveValue(config.symbol);
    
    if (!symbol) {
      throw new Error('Symbol is required for market data node');
    }
    
    const apiKey = process.env.COINGECKO_DEMO_API_KEY;
    const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&symbols=${symbol}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`;
    
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-cg-demo-api-key': apiKey
      }
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Return structured data for easy access
      const tokenData = data[symbol];
      if (!tokenData) {
        throw new Error(`Token symbol '${symbol}' not found`);
      }
      
      const result = {
        price_usd: tokenData.usd,
        market_cap: tokenData.usd_market_cap,
        volume_24h: tokenData.usd_24h_vol,
        change_24h: tokenData.usd_24h_change,
        last_updated: tokenData.last_updated_at,
        symbol: symbol
      };
      
      if (config.outputVariable) {
        this.variables[config.outputVariable] = result;
      }
      
      this.nodeResults[node.id] = result;
      logger.info(`Market data retrieved for ${symbol}: $${result.price_usd}`);
      return result;
      
    } catch (error) {
      logger.error(`Error fetching market data for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  async executeSmartContractReadNode(node) {
    logger.info(`Executing Smart Contract Read node: ${node.id}`);
    
    const config = node.data.config;
    const network = config.network;
    const contractAddress = config.contractAddress;
    const abi = config.abi;
    const methodName = config.methodName;
    const parameters = config.parameters || {};
    
    if (!network || !contractAddress || !abi || !methodName) {
      throw new Error('Smart Contract Read node requires network, contractAddress, abi, and methodName');
    }
    
    try {
      const smartContractNode = new SmartContractNode(config, this.privateKey);
      const result = await smartContractNode.executeRead(
        contractAddress,
        abi,
        methodName,
        parameters,
        network
      );
      
      if (config.outputVariable) {
        this.variables[config.outputVariable] = result;
      }
      
      this.nodeResults[node.id] = result;
      logger.info(`Smart contract read completed for ${methodName}`);
      return result;
      
    } catch (error) {
      logger.error(`Error executing smart contract read: ${error.message}`);
      throw error;
    }
  }

  async executeSmartContractWriteNode(node) {
    logger.info(`Executing Smart Contract Write node: ${node.id}`);
    
    const config = node.data.config;
    const network = config.network;
    const contractAddress = config.contractAddress;
    const abi = config.abi;
    const methodName = config.methodName;
    const parameters = config.parameters || {};
    const options = {
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice,
      value: config.value,
      waitForConfirmation: config.waitForConfirmation !== false
    };
    
    if (!network || !contractAddress || !abi || !methodName) {
      throw new Error('Smart Contract Write node requires network, contractAddress, abi, and methodName');
    }
    
    try {
      const smartContractNode = new SmartContractNode(config, this.privateKey);
      const result = await smartContractNode.executeWrite(
        contractAddress,
        abi,
        methodName,
        parameters,
        network,
        options
      );
      
      if (config.outputVariable) {
        this.variables[config.outputVariable] = result;
      }
      
      this.nodeResults[node.id] = result;
      logger.info(`Smart contract write completed: ${result.transactionHash}`);
      return result;
      
    } catch (error) {
      logger.error(`Error executing smart contract write: ${error.message}`);
      throw error;
    }
  }
} 