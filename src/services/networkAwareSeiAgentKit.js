import { SeiAgentKit, ModelProviderName } from 'sei-agent-kit';
import { createPublicClient, http, createWalletClient } from "viem";
import { privateKeyToAccount } from 'viem/accounts';

// Define custom chain configurations for different SEI networks
const seiNetworks = {
  mainnet: {
    id: 1329,
    name: "Sei Network",
    nativeCurrency: {
      name: "Sei",
      symbol: "SEI", 
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: ["https://evm-rpc.sei-apis.com/"]
      }
    },
    blockExplorers: {
      default: {
        name: "Seitrace",
        url: "https://seitrace.com"
      }
    }
  },
  testnet: {
    id: 1328,
    name: "Sei Testnet",
    nativeCurrency: {
      name: "Sei",
      symbol: "SEI",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: ["https://testnet-sei-evm-rpc.seistream.app"]
      }
    },
    blockExplorers: {
      default: {
        name: "Seitrace Testnet",
        url: "https://testnet.seistream.app"  
      }
    }
  }
};

export class NetworkAwareSeiAgentKit extends SeiAgentKit {
  constructor(privateKey, provider = ModelProviderName.OPENAI, network = 'mainnet') {
    // First call the parent constructor
    super(privateKey, provider);
    
    this.network = network;
    
    // Override the clients with network-specific configuration
    this.setupCustomNetwork(privateKey, network);
  }
  
  setupCustomNetwork(privateKey, network) {
    const chainConfig = seiNetworks[network];
    
    if (!chainConfig) {
      throw new Error(`Unsupported network: ${network}. Supported networks: mainnet, testnet`);
    }
    
    const account = privateKeyToAccount(privateKey);
    
    // Override the publicClient with network-specific RPC
    this.publicClient = createPublicClient({
      chain: chainConfig,
      transport: http(chainConfig.rpcUrls.default.http[0])
    });
    
    // Override the walletClient with network-specific RPC  
    this.walletClient = createWalletClient({
      account,
      chain: chainConfig,
      transport: http(chainConfig.rpcUrls.default.http[0])
    });
    
    console.log(`✅ SeiAgentKit configured for ${network} network (${chainConfig.rpcUrls.default.http[0]})`);
  }
  
  getNetworkInfo() {
    return {
      network: this.network,
      chainId: seiNetworks[this.network]?.id,
      rpcUrl: seiNetworks[this.network]?.rpcUrls.default.http[0]
    };
  }
  
  // Tool compatibility check
  isToolSupported(toolName) {
    // Most tools should work across networks, but some might be mainnet-specific
    const mainnetOnlyTools = [
      'citrex', 'takara', 'symphony', 'carbon', 'twitter'
    ];
    
    const isMainnetOnly = mainnetOnlyTools.some(prefix => toolName.toLowerCase().includes(prefix));
    
    if (isMainnetOnly && this.network !== 'mainnet') {
      console.warn(`⚠️  Tool ${toolName} may not be available on ${this.network}`);
      return false;
    }
    
    return true;
  }
}

export default NetworkAwareSeiAgentKit;