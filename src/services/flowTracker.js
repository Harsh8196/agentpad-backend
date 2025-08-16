import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const TRACKING_FILE = path.join(process.cwd(), '.running-flows.json');

export class FlowTracker {
  constructor() {
    this.ensureTrackingFile();
  }

  ensureTrackingFile() {
    if (!fs.existsSync(TRACKING_FILE)) {
      fs.writeFileSync(TRACKING_FILE, JSON.stringify({}, null, 2));
    }
  }

  getRunningFlows() {
    try {
      const data = fs.readFileSync(TRACKING_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error reading running flows file:', error);
      return {};
    }
  }

  addRunningFlow(flowName, flowInfo) {
    try {
      const flows = this.getRunningFlows();
      flows[flowName] = {
        ...flowInfo,
        startTime: new Date().toISOString(),
        status: 'running'
      };
      fs.writeFileSync(TRACKING_FILE, JSON.stringify(flows, null, 2));
      logger.info(`Added flow '${flowName}' to tracking`);
    } catch (error) {
      logger.error('Error adding running flow:', error);
    }
  }

  removeRunningFlow(flowName) {
    try {
      const flows = this.getRunningFlows();
      if (flows[flowName]) {
        delete flows[flowName];
        fs.writeFileSync(TRACKING_FILE, JSON.stringify(flows, null, 2));
        logger.info(`Removed flow '${flowName}' from tracking`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error removing running flow:', error);
      return false;
    }
  }

  updateFlowStatus(flowName, status, error = null) {
    try {
      const flows = this.getRunningFlows();
      if (flows[flowName]) {
        flows[flowName].status = status;
        if (error) {
          flows[flowName].error = error;
        }
        fs.writeFileSync(TRACKING_FILE, JSON.stringify(flows, null, 2));
        logger.info(`Updated flow '${flowName}' status to ${status}`);
      }
    } catch (error) {
      logger.error('Error updating flow status:', error);
    }
  }

  clearAllFlows() {
    try {
      fs.writeFileSync(TRACKING_FILE, JSON.stringify({}, null, 2));
      logger.info('Cleared all running flows from tracking');
    } catch (error) {
      logger.error('Error clearing running flows:', error);
    }
  }

  isFlowRunning(flowName) {
    const flows = this.getRunningFlows();
    return flows[flowName] && flows[flowName].status === 'running';
  }

  getRunningFlowsCount() {
    const flows = this.getRunningFlows();
    return Object.keys(flows).filter(name => flows[name].status === 'running').length;
  }
} 