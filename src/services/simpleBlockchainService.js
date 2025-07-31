import { createPublicClient, createWalletClient, http } from "viem";
import { sei } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// SEI Token Addresses (Mainnet)
const SEI_TOKENS = {
  SEI: null, // Native SEI
  USDC: "0x8D97Cea50351Fb4329d591682b148D43a0C3611b",
  USDT: "0x4C2F7092C2aE51D286b1cdc95eFd1B7d3dBA3b8b",
  WSEI: "0x0000000000000000000000000000000000000000" // Wrapped SEI
};

class SimpleBlockchainService {
  constructor(privateKey, provider, network = 'mainnet') {
    this.privateKey = privateKey;
    this.provider = provider;
    this.network = network;
    
    // Setup network configuration
    this.setupNetwork(network);
    
    // Setup wallet
    this.account = privateKeyToAccount(privateKey);
    this.walletAddress = this.account.address;
    
    // Setup clients
    this.publicClient = createPublicClient({
      chain: sei,
      transport: http(this.rpcUrl)
    });
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain: sei,
      transport: http(this.rpcUrl)
    });
  }
  
  setupNetwork(network) {
    switch (network) {
      case 'mainnet':
        this.rpcUrl = 'https://evm-rpc.sei-apis.com';
        this.chainId = 713715;
        break;
      case 'testnet':
        this.rpcUrl = 'https://evm-rpc-testnet.sei-apis.com';
        this.chainId = 713715;
        break;
      case 'devnet':
        this.rpcUrl = 'https://evm-rpc-devnet.sei-apis.com';
        this.chainId = 713715;
        break;
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }
  
  // Get ERC-20 token balance
  async getERC20Balance(ticker) {
    try {
      const tokenAddress = SEI_TOKENS[ticker];
      
      if (!tokenAddress) {
        // Native SEI balance
        const balance = await this.publicClient.getBalance({
          address: this.walletAddress
        });
        
        return {
          ticker: 'SEI',
          balance: balance.toString(),
          formatted: `${Number(balance) / 1e18} SEI`
        };
      }
      
      // ERC-20 token balance
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view'
        }],
        functionName: 'balanceOf',
        args: [this.walletAddress]
      });
      
      return {
        ticker,
        balance: balance.toString(),
        formatted: `${Number(balance) / 1e18} ${ticker}`
      };
    } catch (error) {
      throw new Error(`Failed to get ${ticker} balance: ${error.message}`);
    }
  }
  
  // Transfer ERC-20 tokens
  async ERC20Transfer(amount, recipient, ticker) {
    try {
      const tokenAddress = SEI_TOKENS[ticker];
      
      if (!tokenAddress) {
        // Native SEI transfer
        const hash = await this.walletClient.sendTransaction({
          to: recipient,
          value: BigInt(amount * 1e18)
        });
        
        return {
          hash,
          ticker: 'SEI',
          amount,
          recipient,
          status: 'pending'
        };
      }
      
      // ERC-20 token transfer
      const hash = await this.walletClient.writeContract({
        address: tokenAddress,
        abi: [{
          name: 'transfer',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable'
        }],
        functionName: 'transfer',
        args: [recipient, BigInt(amount * 1e18)]
      });
      
      return {
        hash,
        ticker,
        amount,
        recipient,
        status: 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to transfer ${ticker}: ${error.message}`);
    }
  }
  
  // Get network info
  getNetworkInfo() {
    return {
      network: this.network,
      chainId: this.chainId,
      rpcUrl: this.rpcUrl,
      walletAddress: this.walletAddress
    };
  }
  
  // Check if tool is supported on current network
  isToolSupported(toolName) {
    const supportedTools = {
      'sei_erc20_balance': ['mainnet', 'testnet', 'devnet'],
      'sei_erc20_transfer': ['mainnet', 'testnet', 'devnet'],
      'sei_native_transfer': ['mainnet', 'testnet', 'devnet']
    };
    
    return supportedTools[toolName]?.includes(this.network) || false;
  }
  
  // Get supported tools for current network
  getSupportedTools() {
    const allTools = [
      'sei_erc20_balance',
      'sei_erc20_transfer', 
      'sei_native_transfer'
    ];
    
    return allTools.filter(tool => this.isToolSupported(tool));
  }
}

export { SimpleBlockchainService }; 