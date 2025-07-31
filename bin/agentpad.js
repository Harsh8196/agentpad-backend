#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';
import { BackendFlowExecutor } from '../src/services/flowExecutor.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('agentpad')
  .description('AgentPad CLI - AI Agent Workflow Builder')
  .version('1.0.0');

// Start command - execute a flow
program
  .command('start')
  .description('Start executing a flow')
  .argument('<flow>', 'Flow file path or flow name')
  .option('-n, --network <network>', 'Network to use (mainnet, testnet, devnet)', 'mainnet')
  .option('-w, --watch', 'Watch for changes and restart automatically')
  .option('-d, --daemon', 'Run as daemon process')
  .action(async (flow, options) => {
    try {
      await startFlow(flow, options);
    } catch (error) {
      logger.error('Failed to start flow:', error);
      process.exit(1);
    }
  });

// Stop command - stop running flows
program
  .command('stop')
  .description('Stop running flows')
  .option('-a, --all', 'Stop all running flows')
  .option('-f, --flow <name>', 'Stop specific flow by name')
  .action(async (options) => {
    try {
      await stopFlows(options);
    } catch (error) {
      logger.error('Failed to stop flows:', error);
      process.exit(1);
    }
  });

// List command - show available flows
program
  .command('list')
  .description('List available flows')
  .option('-r, --running', 'Show only running flows')
  .action(async (options) => {
    try {
      await listFlows(options);
    } catch (error) {
      logger.error('Failed to list flows:', error);
      process.exit(1);
    }
  });

// Status command - show flow status
program
  .command('status')
  .description('Show flow status')
  .argument('[flow]', 'Flow name (optional)')
  .action(async (flow) => {
    try {
      await showStatus(flow);
    } catch (error) {
      logger.error('Failed to show status:', error);
      process.exit(1);
    }
  });

// Validate command - validate flow without executing
program
  .command('validate')
  .description('Validate a flow without executing')
  .argument('<flow>', 'Flow file path or flow name')
  .action(async (flow) => {
    try {
      await validateFlow(flow);
    } catch (error) {
      logger.error('Failed to validate flow:', error);
      process.exit(1);
    }
  });

// Global state for running flows
const runningFlows = new Map();

async function startFlow(flow, options) {
  // Check required environment variables
  const privateKey = process.env.SEI_PRIVATE_KEY;
  if (!privateKey) {
    logger.error('SEI_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  // Validate network
  const validNetworks = ['mainnet', 'testnet', 'devnet'];
  if (!validNetworks.includes(options.network)) {
    logger.error(`Invalid network: ${options.network}. Must be one of: ${validNetworks.join(', ')}`);
    process.exit(1);
  }

  // Resolve flow file path
  let flowPath;
  if (fs.existsSync(flow)) {
    // Direct file path
    flowPath = path.resolve(process.cwd(), flow);
  } else {
    // Try to find in flows directory
    const flowsDir = path.join(process.cwd(), 'flows');
    if (!fs.existsSync(flowsDir)) {
      fs.mkdirSync(flowsDir, { recursive: true });
    }
    flowPath = path.join(flowsDir, `${flow}.json`);
    if (!fs.existsSync(flowPath)) {
      logger.error(`Flow not found: ${flow}`);
      logger.info('Available flows:');
      await listFlows({});
      process.exit(1);
    }
  }

  // Parse flow data
  let flowData;
  try {
    flowData = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));
  } catch (err) {
    logger.error('Failed to parse flow JSON:', err);
    process.exit(1);
  }

  const flowName = flowData.name || path.basename(flowPath, '.json');
  
  // Check if flow is already running
  if (runningFlows.has(flowName)) {
    logger.warn(`Flow '${flowName}' is already running`);
    return;
  }

  logger.info(`Starting flow '${flowName}' on ${options.network.toUpperCase()}...`);
  
  // Create provider
  const provider = 'openai';
  
  // Create executor
  const executor = new BackendFlowExecutor(privateKey, provider);
  
  // Store flow info
  const flowInfo = {
    name: flowName,
    path: flowPath,
    network: options.network,
    executor,
    startTime: new Date(),
    status: 'running'
  };
  
  runningFlows.set(flowName, flowInfo);
  
  try {
    await executor.executeFlow(flowData);
    logger.info(`Flow '${flowName}' completed successfully.`);
    flowInfo.status = 'completed';
  } catch (err) {
    logger.error(`Flow '${flowName}' failed:`, err);
    flowInfo.status = 'failed';
    flowInfo.error = err.message;
  } finally {
    if (!options.daemon) {
      runningFlows.delete(flowName);
    }
  }
}

async function stopFlows(options) {
  if (options.all) {
    if (runningFlows.size === 0) {
      logger.info('No flows are currently running.');
      return;
    }
    
    logger.info(`Stopping ${runningFlows.size} running flows...`);
    for (const [name, flowInfo] of runningFlows) {
      logger.info(`Stopping flow '${name}'...`);
      // For now, we'll just remove from the map since we don't have a way to stop execution
      // In a real implementation, you'd want to implement proper flow cancellation
      runningFlows.delete(name);
    }
    logger.info('All flows stopped.');
  } else if (options.flow) {
    const flowName = options.flow;
    if (!runningFlows.has(flowName)) {
      logger.error(`Flow '${flowName}' is not running.`);
      return;
    }
    
    logger.info(`Stopping flow '${flowName}'...`);
    runningFlows.delete(flowName);
    logger.info(`Flow '${flowName}' stopped.`);
  } else {
    logger.error('Please specify --all or --flow <name>');
    process.exit(1);
  }
}

async function listFlows(options) {
  const flowsDir = path.join(process.cwd(), 'flows');
  
  if (options.running) {
    if (runningFlows.size === 0) {
      logger.info('No flows are currently running.');
      return;
    }
    
    logger.info('Running flows:');
    for (const [name, flowInfo] of runningFlows) {
      const duration = Math.floor((new Date() - flowInfo.startTime) / 1000);
      logger.info(`  ${name} (${flowInfo.network}) - ${flowInfo.status} (${duration}s)`);
    }
  } else {
    if (!fs.existsSync(flowsDir)) {
      logger.info('No flows directory found.');
      return;
    }
    
    const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      logger.info('No flows found.');
      return;
    }
    
    logger.info('Available flows:');
    for (const file of files) {
      const flowName = path.basename(file, '.json');
      const isRunning = runningFlows.has(flowName);
      const status = isRunning ? 'RUNNING' : 'STOPPED';
      logger.info(`  ${flowName} [${status}]`);
    }
  }
}

async function showStatus(flowName) {
  if (flowName) {
    // Show status of specific flow
    if (runningFlows.has(flowName)) {
      const flowInfo = runningFlows.get(flowName);
      const duration = Math.floor((new Date() - flowInfo.startTime) / 1000);
      logger.info(`Flow '${flowName}':`);
      logger.info(`  Status: ${flowInfo.status}`);
      logger.info(`  Network: ${flowInfo.network}`);
      logger.info(`  Duration: ${duration}s`);
      if (flowInfo.error) {
        logger.info(`  Error: ${flowInfo.error}`);
      }
    } else {
      logger.info(`Flow '${flowName}' is not running.`);
    }
  } else {
    // Show status of all flows
    if (runningFlows.size === 0) {
      logger.info('No flows are currently running.');
      return;
    }
    
    logger.info('Flow Status:');
    for (const [name, flowInfo] of runningFlows) {
      const duration = Math.floor((new Date() - flowInfo.startTime) / 1000);
      logger.info(`  ${name}: ${flowInfo.status} (${duration}s)`);
    }
  }
}

async function validateFlow(flow) {
  // Resolve flow file path
  let flowPath;
  if (fs.existsSync(flow)) {
    flowPath = path.resolve(process.cwd(), flow);
  } else {
    const flowsDir = path.join(process.cwd(), 'flows');
    flowPath = path.join(flowsDir, `${flow}.json`);
    if (!fs.existsSync(flowPath)) {
      logger.error(`Flow not found: ${flow}`);
      process.exit(1);
    }
  }

  // Parse and validate flow data
  try {
    const flowData = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));
    
    // Basic validation
    if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
      throw new Error('Flow must have a nodes array');
    }
    
    if (!flowData.edges || !Array.isArray(flowData.edges)) {
      throw new Error('Flow must have an edges array');
    }
    
    // Check for start node
    const startNode = flowData.nodes.find(n => n.data.type === 'start');
    if (!startNode) {
      throw new Error('Flow must have a start node');
    }
    
    // Check for required fields in each node
    for (const node of flowData.nodes) {
      if (!node.id || !node.data || !node.data.type) {
        throw new Error(`Node missing required fields: ${JSON.stringify(node)}`);
      }
    }
    
    logger.info(`Flow '${flowData.name || path.basename(flowPath, '.json')}' is valid.`);
    logger.info(`  Nodes: ${flowData.nodes.length}`);
    logger.info(`  Edges: ${flowData.edges.length}`);
    
  } catch (err) {
    logger.error('Flow validation failed:', err);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  if (runningFlows.size > 0) {
    logger.info(`Stopping ${runningFlows.size} running flows...`);
    runningFlows.clear();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  if (runningFlows.size > 0) {
    logger.info(`Stopping ${runningFlows.size} running flows...`);
    runningFlows.clear();
  }
  process.exit(0);
});

program.parse(); 