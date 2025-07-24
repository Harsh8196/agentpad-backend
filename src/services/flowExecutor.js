import { SeiAgentKit } from '../../external/sei-agent-kit/src/agent/index.js';
import { ModelProviderName } from '../../external/sei-agent-kit/src/types/index.js';
import { logger } from '../utils/logger.js';

class BackendFlowExecutor {
  constructor() {
    this.executionContext = {
      variables: new Map(),
      nodeResults: new Map(),
      executionStatus: new Map(),
      blockchainState: null,
      flowMetadata: {
        startTime: new Date(),
        currentNode: null,
        executionPath: []
      }
    };
  }

  async initializeBlockchain(privateKey, provider = ModelProviderName.OPENAI) {
    try {
      const seiAgent = new SeiAgentKit(privateKey, provider);
      
      this.executionContext.blockchainState = {
        seiAgentKit: seiAgent,
        walletAddress: seiAgent.wallet_address,
        network: 'mainnet'
      };
      
      logger.info('SeiAgentKit initialized successfully');
      return { success: true, walletAddress: seiAgent.wallet_address };
    } catch (error) {
      logger.error('Failed to initialize SeiAgentKit:', error);
      throw error;
    }
  }

  async executeNode(node, frontendVariables = {}) {
    // Merge frontend variables with backend context
    this.executionContext.variables = new Map(Object.entries(frontendVariables));
    
    const startTime = Date.now();
    
    try {
      this.executionContext.executionStatus.set(node.id, 'running');
      this.executionContext.flowMetadata.currentNode = node.id;
      this.executionContext.flowMetadata.executionPath.push(node.id);
      
      let result;
      
      switch (node.type) {
        case 'blockchain':
          result = await this.executeBlockchainNode(node);
          break;
        case 'ai-agent':
          result = await this.executeAIAgentNode(node);
          break;
        case 'api-call':
          result = await this.executeAPICallNode(node);
          break;
        case 'database':
          result = await this.executeDatabaseNode(node);
          break;
        default:
          throw new Error(`Backend executor does not handle node type: ${node.type}`);
      }
      
      const executionTime = Date.now() - startTime;
      this.executionContext.nodeResults.set(node.id, result);
      this.executionContext.executionStatus.set(node.id, 'completed');
      
      return {
        success: true,
        data: result,
        nodeId: node.id,
        executionTime,
        variables: Object.fromEntries(this.executionContext.variables)
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.executionContext.executionStatus.set(node.id, 'error');
      
      logger.error(`Node ${node.id} execution failed:`, error);
      
      return {
        success: false,
        error: error.message,
        nodeId: node.id,
        executionTime,
        variables: Object.fromEntries(this.executionContext.variables)
      };
    }
  }

  async executeBlockchainNode(node) {
    if (!this.executionContext.blockchainState?.seiAgentKit) {
      throw new Error('SeiAgentKit not initialized. Please provide a private key.');
    }
    
    const seiAgent = this.executionContext.blockchainState.seiAgentKit;
    const config = node.data.config || {};
    
    logger.info(`Executing blockchain operation: ${config.operation}`);
    
    switch (config.operation) {
      case 'balance':
        return await seiAgent.getERC20Balance(config.tokenAddress);
      
      case 'transfer':
        if (!config.amount || !config.recipientAddress) {
          throw new Error('Transfer requires amount and recipient address');
        }
        return await seiAgent.ERC20Transfer(
          config.amount, 
          config.recipientAddress, 
          config.tokenAddress
        );
      
      case 'swap':
        if (!config.amount || !config.fromToken || !config.toToken) {
          throw new Error('Swap requires amount, fromToken, and toToken');
        }
        return await seiAgent.swap(
          config.amount,
          config.fromToken,
          config.toToken
        );
      
      case 'stake':
        if (!config.amount) {
          throw new Error('Stake requires amount');
        }
        return await seiAgent.stake(config.amount);
      
      case 'borrow':
        if (!config.amount || !config.tokenTicker) {
          throw new Error('Borrow requires amount and token ticker');
        }
        return await seiAgent.borrowTakara(config.tokenTicker, config.amount);
      
      case 'lend':
        if (!config.amount || !config.tokenTicker) {
          throw new Error('Lend requires amount and token ticker');
        }
        return await seiAgent.mintTakara(config.tokenTicker, config.amount);
      
      default:
        throw new Error(`Unknown blockchain operation: ${config.operation}`);
    }
  }

  async executeAIAgentNode(node) {
    const { prompt, model, temperature } = node.data.config || {};
    
    logger.info('AI Agent execution:', { prompt, model, temperature });
    
    // TODO: Implement LangChain integration
    // For now, return a placeholder response
    return {
      message: 'AI Agent execution not yet implemented',
      prompt,
      model: model || 'gpt-4',
      temperature: temperature || 0.7
    };
  }

  async executeAPICallNode(node) {
    const { method, url, headers, body } = node.data.config || {};
    
    logger.info('API Call execution:', { method, url });
    
    try {
      const response = await fetch(url, {
        method: method || 'GET',
        headers: headers || {},
        body: body ? JSON.stringify(body) : undefined
      });
      
      const data = await response.json();
      
      return {
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  async executeDatabaseNode(node) {
    const { operation, query, params } = node.data.config || {};
    
    logger.info('Database execution:', { operation, query });
    
    // TODO: Implement database client
    // For now, return a placeholder response
    return {
      message: 'Database execution not yet implemented',
      operation,
      query,
      params
    };
  }

  // Helper methods
  resolveValue(value) {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const varName = value.slice(2, -1);
      return this.executionContext.variables.get(varName);
    }
    return value;
  }

  getExecutionContext() {
    return {
      variables: Object.fromEntries(this.executionContext.variables),
      nodeResults: Object.fromEntries(this.executionContext.nodeResults),
      executionStatus: Object.fromEntries(this.executionContext.executionStatus),
      flowMetadata: this.executionContext.flowMetadata
    };
  }

  clearContext() {
    this.executionContext.variables.clear();
    this.executionContext.nodeResults.clear();
    this.executionContext.executionStatus.clear();
    this.executionContext.flowMetadata = {
      startTime: new Date(),
      currentNode: null,
      executionPath: []
    };
  }
}

export default BackendFlowExecutor; 