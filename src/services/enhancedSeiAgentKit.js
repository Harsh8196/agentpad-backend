import { SeiAgentKit } from "../../external/sei-agent-kit/src/agent/index.ts";
import { ModelProviderName } from "../../external/sei-agent-kit/src/types/index.ts";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from 'viem/accounts';

// Network configurations for SEI
const SEI_NETWORKS = {
  mainnet: {
    name: 'Mainnet',
    chainId: 713715,
    rpcUrl: 'https://evm-rpc.sei-apis.com',
    explorer: 'https://sei.io/explorer'
  },
  testnet: {
    name: 'Testnet',
    chainId: 713715,
    rpcUrl: 'https://evm-rpc-testnet.sei-apis.com',
    explorer: 'https://testnet.sei.io/explorer'
  },
  devnet: {
    name: 'Devnet',
    chainId: 713715,
    rpcUrl: 'https://evm-rpc-devnet.sei-apis.com',
    explorer: 'https://devnet.sei.io/explorer'
  }
};

// Tool network support mapping
const TOOL_NETWORK_SUPPORT = {
  // Basic Operations (All Networks)
  'sei_erc20_balance': ['mainnet', 'testnet', 'devnet'],
  'sei_erc20_transfer': ['mainnet', 'testnet', 'devnet'],
  'sei_native_transfer': ['mainnet', 'testnet', 'devnet'],
  'sei_erc721_balance': ['mainnet', 'testnet', 'devnet'],
  'sei_erc721_transfer': ['mainnet', 'testnet', 'devnet'],
  'sei_erc721_mint': ['mainnet', 'testnet', 'devnet'],
  
  // DeFi Operations (Mainnet Only)
  'sei_swap': ['mainnet'],
  'sei_stake': ['mainnet'],
  'sei_unstake': ['mainnet'],
  'sei_mint_takara': ['mainnet'],
  'sei_borrow_takara': ['mainnet'],
  'sei_repay_takara': ['mainnet'],
  'sei_redeem_takara': ['mainnet'],
  'sei_get_redeemable_amount': ['mainnet'],
  'sei_get_borrow_balance': ['mainnet'],
  
  // Trading Operations (Mainnet Only)
  'sei_citrex_deposit': ['mainnet'],
  'sei_citrex_withdraw': ['mainnet'],
  'sei_citrex_get_products': ['mainnet'],
  'sei_citrex_get_order_book': ['mainnet'],
  'sei_citrex_get_account_health': ['mainnet'],
  'sei_citrex_get_tickers': ['mainnet'],
  'sei_citrex_calculate_margin_requirement': ['mainnet'],
  'sei_citrex_get_klines': ['mainnet'],
  'sei_citrex_get_product': ['mainnet'],
  'sei_citrex_get_server_time': ['mainnet'],
  'sei_citrex_get_trade_history': ['mainnet'],
  'sei_citrex_cancel_and_replace_order': ['mainnet'],
  'sei_citrex_cancel_open_orders_for_product': ['mainnet'],
  'sei_citrex_cancel_order': ['mainnet'],
  'sei_citrex_cancel_orders': ['mainnet'],
  'sei_citrex_list_balances': ['mainnet'],
  'sei_citrex_list_open_orders': ['mainnet'],
  'sei_citrex_list_positions': ['mainnet'],
  'sei_citrex_place_order': ['mainnet'],
  'sei_citrex_place_orders': ['mainnet'],
  
  // Social Operations (Mainnet Only)
  'sei_post_tweet': ['mainnet'],
  'sei_get_account_details': ['mainnet'],
  'sei_get_account_mentions': ['mainnet'],
  'sei_post_tweet_reply': ['mainnet'],
  
  // Carbon Strategies (Mainnet Only)
  'sei_compose_trade_by_source_tx': ['mainnet'],
  'sei_compose_trade_by_target_tx': ['mainnet'],
  'sei_create_buy_sell_strategy': ['mainnet'],
  'sei_create_overlapping_strategy': ['mainnet'],
  'sei_delete_strategy': ['mainnet'],
  'sei_get_user_strategies': ['mainnet'],
  'sei_update_strategy': ['mainnet']
};

class EnhancedSeiAgentKit extends SeiAgentKit {
  constructor(privateKey, provider, network = 'mainnet') {
    // Convert provider string to ModelProviderName enum if needed
    const modelProvider = typeof provider === 'string' ? ModelProviderName.OPENAI : provider;
    
    // Call parent constructor first
    super(privateKey, modelProvider);
    
    // Store private key for later use
    this.privateKey = privateKey;
    
    this.network = network;
    this.networkConfig = SEI_NETWORKS[network] || SEI_NETWORKS.mainnet;
    
    // Only override clients if not mainnet
    if (network !== 'mainnet') {
      this.setupCustomNetwork();
    }
  }
  
  setupCustomNetwork() {
    const account = privateKeyToAccount(this.privateKey);
    
    // Create custom chain configuration
    const customChain = {
      id: this.networkConfig.chainId,
      name: `SEI ${this.networkConfig.name}`,
      network: this.networkConfig.name.toLowerCase(),
      nativeCurrency: {
        name: 'SEI',
        symbol: 'SEI',
        decimals: 18,
      },
      rpcUrls: {
        default: { http: [this.networkConfig.rpcUrl] },
        public: { http: [this.networkConfig.rpcUrl] },
      },
      blockExplorers: {
        default: {
          name: 'SEI Explorer',
          url: this.networkConfig.explorer,
        },
      },
    };
    
    // Re-create clients with custom network
    this.publicClient = createPublicClient({
      chain: customChain,
      transport: http()
    });
    
    this.walletClient = createWalletClient({
      account,
      chain: customChain,
      transport: http()
    });
    
    this.wallet_address = account.address;
  }
  
  getNetworkInfo() {
    return {
      name: this.networkConfig.name,
      rpcUrl: this.networkConfig.rpcUrl,
      explorer: this.networkConfig.explorer,
      chainId: this.networkConfig.chainId
    };
  }
  
  isToolSupported(toolName) {
    const supportedNetworks = TOOL_NETWORK_SUPPORT[toolName];
    if (!supportedNetworks) {
      return false;
    }
    return supportedNetworks.includes(this.network);
  }
  
  getSupportedTools() {
    return Object.keys(TOOL_NETWORK_SUPPORT).filter(toolName => 
      this.isToolSupported(toolName)
    );
  }
  
  // Override methods to add network warnings for non-mainnet usage
  async getERC20Balance(contract_address) {
    if (this.network !== 'mainnet') {
      console.warn(`⚠️  Using getERC20Balance on ${this.network.toUpperCase()} network`);
    }
    return super.getERC20Balance(contract_address);
  }
  
  async ERC20Transfer(amount, recipient, ticker) {
    if (this.network !== 'mainnet') {
      console.warn(`⚠️  Using ERC20Transfer on ${this.network.toUpperCase()} network`);
    }
    return super.ERC20Transfer(amount, recipient, ticker);
  }
}

export { EnhancedSeiAgentKit, SEI_NETWORKS, TOOL_NETWORK_SUPPORT }; 