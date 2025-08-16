import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem';
import { mainnet, polygon, bsc, arbitrum, optimism, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger.js';

// Define SEI chains
const seiMainnet = defineChain({
  id: 1329,
  name: 'SEI Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'SEI',
    symbol: 'SEI',
  },
  rpcUrls: {
    default: {
      http: ['https://evm-rpc.sei-apis.com/'],
    },
    public: {
      http: ['https://evm-rpc.sei-apis.com/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Seitrace',
      url: 'https://seitrace.com',
    },
  },
});

const seiTestnet = defineChain({
  id: 1328,
  name: 'SEI Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'SEI',
    symbol: 'SEI',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-sei-evm-rpc.seistream.app'],
    },
    public: {
      http: ['https://testnet-sei-evm-rpc.seistream.app'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Seitrace Testnet',
      url: 'https://testnet.seistream.app',
    },
  },
});

class SmartContractNode {
  constructor(config, privateKey) {
    this.config = config;
    this.privateKey = privateKey;
    this.account = privateKeyToAccount(privateKey);
    this.chains = this.getSupportedChains();
  }

  getSupportedChains() {
    return {
      ethereum: mainnet,
      polygon: polygon,
      bsc: bsc,
      arbitrum: arbitrum,
      optimism: optimism,
      base: base,
      sei: seiMainnet,
      sei_testnet: seiTestnet
    };
  }

  getPublicClient(network) {
    const chain = this.chains[network];
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    return createPublicClient({
      chain,
      transport: http()
    });
  }

  getWalletClient(network) {
    const chain = this.chains[network];
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    return createWalletClient({
      account: this.account,
      chain,
      transport: http()
    });
  }

  parseABI(abiString) {
    try {
      const abi = JSON.parse(abiString);
      return {
        readMethods: abi.filter(item => 
          item.type === 'function' && 
          (item.stateMutability === 'view' || item.stateMutability === 'pure')
        ),
        writeMethods: abi.filter(item => 
          item.type === 'function' && 
          (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable')
        ),
        events: abi.filter(item => item.type === 'event')
      };
    } catch (error) {
      throw new Error(`Invalid ABI format: ${error.message}`);
    }
  }

  async executeRead(contractAddress, abi, methodName, parameters, network) {
    try {
      logger.info(`Executing smart contract read: ${methodName} on ${network}`);
      
      const publicClient = this.getPublicClient(network);
      
      // Parse ABI - use JSON.parse instead of parseAbi for JSON strings
      let parsedAbi;
      try {
        parsedAbi = JSON.parse(abi);
      } catch (parseError) {
        // If JSON.parse fails, try parseAbi for human-readable format
        parsedAbi = parseAbi(abi);
      }
      
      // Prepare parameters array
      const paramArray = this.prepareParameters(parameters);
      
      // Call the contract method
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: parsedAbi,
        functionName: methodName,
        args: paramArray
      });
      
      // Format the result
      const formattedResult = this.formatResult(result);
      
      logger.info(`Smart contract read completed:`, formattedResult);
      return formattedResult;
      
    } catch (error) {
      logger.error(`Error in smart contract read:`, error);
      throw error;
    }
  }

  async executeWrite(contractAddress, abi, methodName, parameters, network, options = {}) {
    try {
      logger.info(`Executing smart contract write: ${methodName} on ${network}`);
      
      const publicClient = this.getPublicClient(network);
      const walletClient = this.getWalletClient(network);
      
      // Parse ABI - use JSON.parse instead of parseAbi for JSON strings
      let parsedAbi;
      try {
        parsedAbi = JSON.parse(abi);
      } catch (parseError) {
        // If JSON.parse fails, try parseAbi for human-readable format
        parsedAbi = parseAbi(abi);
      }
      
      // Prepare parameters array
      const paramArray = this.prepareParameters(parameters);
      
      // Prepare transaction arguments
      const writeArgs = {
        address: contractAddress,
        abi: parsedAbi,
        functionName: methodName,
        args: paramArray
      };
      
      // Add value if specified
      if (options.value && options.value !== '0') {
        writeArgs.value = BigInt(options.value);
      }
      
      // Add gas settings if specified
      if (options.gasLimit) {
        writeArgs.gas = BigInt(options.gasLimit);
      }
      if (options.gasPrice) {
        writeArgs.gasPrice = BigInt(options.gasPrice);
      }
      
      // Execute the transaction
      const hash = await walletClient.writeContract(writeArgs);
      
      logger.info(`Transaction sent: ${hash}`);
      
      // Wait for confirmation if specified
      const waitForConfirmation = options.waitForConfirmation !== false;
      if (waitForConfirmation) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        logger.info(`Transaction confirmed in block: ${receipt.blockNumber}`);
        
        return {
          transactionHash: hash,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
          receipt: receipt
        };
      } else {
        return {
          transactionHash: hash,
          status: 'pending'
        };
      }
      
    } catch (error) {
      logger.error(`Error in smart contract write:`, error);
      throw error;
    }
  }

  prepareParameters(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      return [];
    }
    
    // Convert parameters object to array based on order
    return Object.values(parameters);
  }

  formatResult(result) {
    // Handle null/undefined
    if (result === null || result === undefined) {
      return null;
    }
    
    // Handle BigInt (common in blockchain)
    if (typeof result === 'bigint') {
      return result.toString();
    }
    
    // Handle arrays (multiple return values)
    if (Array.isArray(result)) {
      return result.map(item => this.formatResult(item));
    }
    
    // Handle objects (struct returns, complex data)
    if (typeof result === 'object') {
      const formatted = {};
      let hasNamedFields = false;
      
      for (const [key, value] of Object.entries(result)) {
        // Skip numeric keys (array-like objects)
        if (isNaN(key)) {
          formatted[key] = this.formatResult(value);
          hasNamedFields = true;
        }
      }
      
      // If we have named fields, return the object
      if (hasNamedFields) {
        return formatted;
      }
      
      // If no named fields, convert to array or string
      const values = Object.values(result).map(v => this.formatResult(v));
      return values.length === 1 ? values[0] : values;
    }
    
    // Handle basic types
    if (typeof result === 'string') {
      // Handle empty strings or special cases
      return result === '' ? null : result;
    }
    
    if (typeof result === 'number') {
      // Handle special numbers
      if (isNaN(result)) return null;
      if (!isFinite(result)) return null;
      return result;
    }
    
    if (typeof result === 'boolean') {
      return result;
    }
    
    // Fallback: convert to string
    return String(result);
  }

  static getNetworkConfig() {
    return {
      ethereum: {
        name: 'Ethereum Mainnet',
        chainId: 1,
        nativeCurrency: 'ETH',
        blockExplorer: 'https://etherscan.io'
      },
      polygon: {
        name: 'Polygon',
        chainId: 137,
        nativeCurrency: 'MATIC',
        blockExplorer: 'https://polygonscan.com'
      },
      bsc: {
        name: 'Binance Smart Chain',
        chainId: 56,
        nativeCurrency: 'BNB',
        blockExplorer: 'https://bscscan.com'
      },
      arbitrum: {
        name: 'Arbitrum One',
        chainId: 42161,
        nativeCurrency: 'ETH',
        blockExplorer: 'https://arbiscan.io'
      },
      optimism: {
        name: 'Optimism',
        chainId: 10,
        nativeCurrency: 'ETH',
        blockExplorer: 'https://optimistic.etherscan.io'
      },
      base: {
        name: 'Base',
        chainId: 8453,
        nativeCurrency: 'ETH',
        blockExplorer: 'https://basescan.org'
      },
      sei: {
        name: 'SEI Mainnet',
        chainId: 1329,
        nativeCurrency: 'SEI',
        blockExplorer: 'https://seitrace.com'
      },
      sei_testnet: {
        name: 'SEI Testnet',
        chainId: 1328,
        nativeCurrency: 'SEI',
        blockExplorer: 'https://testnet.seistream.app'
      }
    };
  }
}

export default SmartContractNode;