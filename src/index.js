#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { BackendFlowExecutor } from './services/flowExecutor.js';

// Load environment variables
dotenv.config();

// CLI usage
function printUsage() {
  console.log('Usage: node src/index.js <flow.json> [network]');
  console.log('  flow.json: Path to the flow JSON file');
  console.log('  network:   Network to use (mainnet, testnet, devnet) - defaults to mainnet');
  process.exit(1);
}

const [,, flowFile, network = 'mainnet'] = process.argv;
if (!flowFile) {
  printUsage();
}

// Validate network
const validNetworks = ['mainnet', 'testnet', 'devnet'];
if (!validNetworks.includes(network)) {
  logger.error(`Invalid network: ${network}. Must be one of: ${validNetworks.join(', ')}`);
  process.exit(1);
}

const flowPath = path.resolve(process.cwd(), flowFile);
if (!fs.existsSync(flowPath)) {
  logger.error(`Flow file not found: ${flowPath}`);
  process.exit(1);
}

// Check required environment variables
const privateKey = process.env.SEI_PRIVATE_KEY;
if (!privateKey) {
  logger.error('SEI_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

let flowData;
try {
  flowData = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));
} catch (err) {
  logger.error('Failed to parse flow JSON:', err);
  process.exit(1);
}

async function main() {
  logger.info(`Starting flow execution on ${network.toUpperCase()}...`);
  
  // Create provider (you can customize this based on your needs)
  const provider = 'openai'; // Use OpenAI as default provider
  
  const executor = new BackendFlowExecutor(privateKey, provider);
  try {
    await executor.executeFlow(flowData);
    logger.info('Flow execution completed.');
  } catch (err) {
    logger.error('Flow execution failed:', err);
    process.exit(1);
  }
}

main();