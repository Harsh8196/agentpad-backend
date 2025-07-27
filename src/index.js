#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';
import { BackendFlowExecutor } from './services/flowExecutor.js';

// Simple CLI usage
function printUsage() {
  console.log('Usage: node src/index.js <flow.json>');
  process.exit(1);
}

const [,, flowFile] = process.argv;
if (!flowFile) {
  printUsage();
}

const flowPath = path.resolve(process.cwd(), flowFile);
if (!fs.existsSync(flowPath)) {
  logger.error(`Flow file not found: ${flowPath}`);
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
  logger.info('Starting flow execution...');
  const executor = new BackendFlowExecutor();
  try {
    await executor.executeFlow(flowData);
    logger.info('Flow execution completed.');
  } catch (err) {
    logger.error('Flow execution failed:', err);
    process.exit(1);
  }
}

main();