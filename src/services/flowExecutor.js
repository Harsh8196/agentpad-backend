import { logger } from '../utils/logger.js';

export class BackendFlowExecutor {
  constructor() {
    this.variables = {};
    this.nodeResults = {};
    this.shouldStop = false;
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
        return null;
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
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
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
      case 'increment':
        if (!(variableName in this.variables)) {
          this.variables[variableName] = 0;
        } else {
          // Ensure the current value is a number
          const currentValue = this.resolveValue(this.variables[variableName]);
          this.variables[variableName] = currentValue + 1;
        }
        break;
      case 'decrement':
        if (!(variableName in this.variables)) {
          this.variables[variableName] = 0;
        } else {
          // Ensure the current value is a number
          const currentValue = this.resolveValue(this.variables[variableName]);
          this.variables[variableName] = currentValue - 1;
        }
        break;
      default:
        throw new Error(`Unknown variable operation: ${operation}`);
    }
    
    logger.info(`Variable ${variableName} = ${this.variables[variableName]} (operation: ${operation})`);
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

  async executeBlockchainNode(node) {
    // Stub for now
    logger.info('Blockchain node execution is not implemented yet.');
    return null;
  }

  resolveValue(val) {
    if (typeof val === 'string' && val in this.variables) {
      return this.variables[val];
    }
    if (typeof val === 'number') {
      return val;
    }
    // Try to convert to number, but handle the case where Number("0") returns 0
    const numVal = Number(val);
    return isNaN(numVal) ? val : numVal;
  }
} 