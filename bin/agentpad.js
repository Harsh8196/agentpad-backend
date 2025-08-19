#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';
import { BackendFlowExecutor } from '../src/services/flowExecutor.js';
import { FlowTracker } from '../src/services/flowTracker.js';

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
  .argument('<flows...>', 'Flow file paths or flow names (can specify multiple)')
  .option('-w, --watch', 'Watch for changes and restart automatically')
  .option('-d, --daemon', 'Run as daemon process')
  .action(async (flows, options) => {
    try {
      if (flows.length === 1) {
        await startFlow(flows[0], options);
      } else {
        await startMultipleFlows(flows.join(','), options);
      }
    } catch (error) {
      logger.error('Failed to start flow:', error);
      process.exit(1);
    }
  });

// Stop command - stop running flows
program
  .command('stop')
  .description('Stop running flows')
  .argument('[flow]', 'Flow name to stop (optional, stops all if not specified)')
  .action(async (flow) => {
    try {
      await stopFlows(flow);
    } catch (error) {
      logger.error('Failed to stop flows:', error);
      process.exit(1);
    }
  });

// List command - show available flows
program
  .command('list')
  .description('List available flows')
  .argument('[type]', 'Type to list: "running" for running flows only')
  .action(async (type) => {
    try {
      await listFlows(type);
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
const flowTracker = new FlowTracker();

// Cleanup function for graceful shutdown
async function cleanup() {
  logger.info('Shutting down...');
  
  // Stop all running flows
  for (const [flowName, flowInfo] of runningFlows) {
    if (flowInfo.executor && flowInfo.executor.webhookHandler) {
      flowInfo.executor.webhookHandler.stop();
    }
  }
  

  
  // Stop flow tracker
  flowTracker.stopAllFlows();
  
  process.exit(0);
}

// Handle process termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function startMultipleFlows(flowsString, options) {
  const flows = flowsString.split(',').map(f => f.trim()).filter(f => f);
  
  if (flows.length === 0) {
    logger.error('No valid flows specified');
    process.exit(1);
  }

  logger.info(`Starting ${flows.length} flows: ${flows.join(', ')}`);
  
  const promises = flows.map(async (flow) => {
    try {
      await startFlow(flow, options);
    } catch (error) {
      logger.error(`Failed to start flow '${flow}':`, error);
      return { flow, success: false, error: error.message };
    }
  });

  const results = await Promise.allSettled(promises);
  
  let successCount = 0;
  let failureCount = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failureCount++;
      logger.error(`Flow '${flows[index]}' failed:`, result.reason);
    }
  });

  logger.info(`Multiple flow execution completed: ${successCount} successful, ${failureCount} failed`);
}

async function startFlow(flow, options) {
  // Check required environment variables
  const privateKey = process.env.SEI_PRIVATE_KEY;
  if (!privateKey) {
    logger.error('SEI_PRIVATE_KEY environment variable is required');
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
  if (runningFlows.has(flowName) || flowTracker.isFlowRunning(flowName)) {
    logger.warn(`Flow '${flowName}' is already running`);
    return;
  }

  logger.info(`Starting flow '${flowName}'...`);
  
  // Create executor (OpenAI only)
  const executor = new BackendFlowExecutor(privateKey);
  
  // Store flow info
  const flowInfo = {
    name: flowName,
    path: flowPath,
    executor,
    startTime: new Date(),
    status: 'running'
  };
  
  runningFlows.set(flowName, flowInfo);
  flowTracker.addRunningFlow(flowName, flowInfo);
  
  try {
    await executor.executeFlow(flowData);
    logger.info(`Flow '${flowName}' completed successfully.`);
    flowInfo.status = 'completed';
    flowTracker.updateFlowStatus(flowName, 'completed');
  } catch (err) {
    logger.error(`Flow '${flowName}' failed:`, err);
    flowInfo.status = 'failed';
    flowInfo.error = err.message;
    flowTracker.updateFlowStatus(flowName, 'failed', err.message);
  } finally {
    if (!options.daemon) {
      runningFlows.delete(flowName);
      flowTracker.removeRunningFlow(flowName);
      
      // Stop webhook server if no other flows are running
      if (runningFlows.size === 0) {
        if (executor.webhookHandler && executor.webhookHandler.server) {
          executor.webhookHandler.stop();
          logger.info('🛑 Webhook server stopped');
        }

      }
    }
  }
}

async function stopFlows(flowName) {
  if (!flowName) {
    // Stop all flows
    const runningFlowsFromTracker = flowTracker.getRunningFlows();
    const runningFlowNames = Object.keys(runningFlowsFromTracker).filter(name => 
      runningFlowsFromTracker[name].status === 'running'
    );
    
    if (runningFlows.size === 0 && runningFlowNames.length === 0) {
      logger.info('No flows are currently running.');
      return;
    }
    
    const totalRunning = runningFlows.size + runningFlowNames.length;
    logger.info(`Stopping ${totalRunning} running flows...`);
    
    // Stop flows in memory
    for (const [name, flowInfo] of runningFlows) {
      logger.info(`Stopping flow '${name}'...`);
      runningFlows.delete(name);
    }
    
    // Stop flows from tracker
    for (const name of runningFlowNames) {
      logger.info(`Stopping flow '${name}'...`);
      flowTracker.removeRunningFlow(name);
    }
    
    logger.info('All flows stopped.');
  } else {
    // Stop specific flow with flexible matching
    let actualFlowName = null;
    let isRunningInMemory = false;
    let isRunningInTracker = false;
    
    // First try exact match
    if (runningFlows.has(flowName) || flowTracker.isFlowRunning(flowName)) {
      actualFlowName = flowName;
      isRunningInMemory = runningFlows.has(flowName);
      isRunningInTracker = flowTracker.isFlowRunning(flowName);
    } else {
      // Try flexible matching (case-insensitive, handle filename vs display name)
      const runningFlowsFromTracker = flowTracker.getRunningFlows();
      const allRunningNames = [
        ...Array.from(runningFlows.keys()),
        ...Object.keys(runningFlowsFromTracker).filter(name => 
          runningFlowsFromTracker[name].status === 'running'
        )
      ];
      
      // Create mapping of possible matches
      const flowMatches = allRunningNames.filter(name => {
        const lowerName = name.toLowerCase();
        const lowerInput = flowName.toLowerCase();
        
        // Direct match
        if (lowerName === lowerInput) return true;
        
        // Convert spaces to underscores and vice versa
        const nameWithUnderscores = lowerName.replace(/\s+/g, '_');
        const nameWithSpaces = lowerName.replace(/_+/g, ' ');
        const inputWithUnderscores = lowerInput.replace(/\s+/g, '_');
        const inputWithSpaces = lowerInput.replace(/_+/g, ' ');
        
        return nameWithUnderscores === lowerInput || 
               nameWithSpaces === lowerInput ||
               lowerName === inputWithUnderscores ||
               lowerName === inputWithSpaces;
      });
      
      if (flowMatches.length === 1) {
        actualFlowName = flowMatches[0];
        isRunningInMemory = runningFlows.has(actualFlowName);
        isRunningInTracker = flowTracker.isFlowRunning(actualFlowName);
      } else if (flowMatches.length > 1) {
        logger.error(`Multiple flows match '${flowName}': ${flowMatches.join(', ')}`);
        logger.info('Please use the exact flow name from the list.');
        return;
      }
    }
    
    if (!actualFlowName) {
      logger.error(`Flow '${flowName}' is not running.`);
      logger.info('Running flows:');
      await listFlows('running');
      return;
    }
    
    logger.info(`Stopping flow '${actualFlowName}'...`);
    if (isRunningInMemory) {
      runningFlows.delete(actualFlowName);
    }
    if (isRunningInTracker) {
      flowTracker.removeRunningFlow(actualFlowName);
    }
    logger.info(`Flow '${actualFlowName}' stopped.`);
  }
}

async function listFlows(type) {
  const flowsDir = path.join(process.cwd(), 'flows');
  
  if (type === 'running') {
    const runningFlowsFromTracker = flowTracker.getRunningFlows();
    const runningFlowNames = Object.keys(runningFlowsFromTracker).filter(name => 
      runningFlowsFromTracker[name].status === 'running'
    );
    
    if (runningFlows.size === 0 && runningFlowNames.length === 0) {
      logger.info('No flows are currently running.');
      return;
    }
    
    logger.info('Running flows:');
    
    // Show flows in memory
    for (const [name, flowInfo] of runningFlows) {
      const duration = Math.floor((new Date() - flowInfo.startTime) / 1000);
      logger.info(`  ${name} - ${flowInfo.status} (${duration}s)`);
    }
    
    // Show flows from tracker
    for (const name of runningFlowNames) {
      const flowInfo = runningFlowsFromTracker[name];
      const startTime = new Date(flowInfo.startTime);
      const duration = Math.floor((new Date() - startTime) / 1000);
      logger.info(`  ${name} - ${flowInfo.status} (${duration}s)`);
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
      const isRunningInMemory = runningFlows.has(flowName);
      const isRunningInTracker = flowTracker.isFlowRunning(flowName);
      const status = (isRunningInMemory || isRunningInTracker) ? 'RUNNING' : 'STOPPED';
      logger.info(`  ${flowName} [${status}]`);
    }
  }
}

async function showStatus(flowName) {
  if (flowName) {
    // Show status of specific flow
    const isRunningInMemory = runningFlows.has(flowName);
    const isRunningInTracker = flowTracker.isFlowRunning(flowName);
    
    if (isRunningInMemory) {
      const flowInfo = runningFlows.get(flowName);
      const duration = Math.floor((new Date() - flowInfo.startTime) / 1000);
      logger.info(`Flow '${flowName}':`);
      logger.info(`  Status: ${flowInfo.status}`);
      logger.info(`  Duration: ${duration}s`);
      if (flowInfo.error) {
        logger.info(`  Error: ${flowInfo.error}`);
      }
    } else if (isRunningInTracker) {
      const flows = flowTracker.getRunningFlows();
      const flowInfo = flows[flowName];
      const startTime = new Date(flowInfo.startTime);
      const duration = Math.floor((new Date() - startTime) / 1000);
      logger.info(`Flow '${flowName}':`);
      logger.info(`  Status: ${flowInfo.status}`);
      logger.info(`  Duration: ${duration}s`);
      if (flowInfo.error) {
        logger.info(`  Error: ${flowInfo.error}`);
      }
    } else {
      logger.info(`Flow '${flowName}' is not running.`);
    }
  } else {
    // Show status of all flows
    const runningFlowsFromTracker = flowTracker.getRunningFlows();
    const runningFlowNames = Object.keys(runningFlowsFromTracker).filter(name => 
      runningFlowsFromTracker[name].status === 'running'
    );
    
    if (runningFlows.size === 0 && runningFlowNames.length === 0) {
      logger.info('No flows are currently running.');
      return;
    }
    
    logger.info('Flow Status:');
    
    // Show flows in memory
    for (const [name, flowInfo] of runningFlows) {
      const duration = Math.floor((new Date() - flowInfo.startTime) / 1000);
      logger.info(`  ${name}: ${flowInfo.status} (${duration}s)`);
    }
    
    // Show flows from tracker
    for (const name of runningFlowNames) {
      const flowInfo = runningFlowsFromTracker[name];
      const startTime = new Date(flowInfo.startTime);
      const duration = Math.floor((new Date() - startTime) / 1000);
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

program.parse(); 