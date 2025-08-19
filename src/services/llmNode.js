import { createSeiTools, ModelProviderName } from "sei-agent-kit";
import NetworkAwareSeiAgentKit from "./networkAwareSeiAgentKit.js";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import readline from 'readline';

class LLMNode {
  constructor(config, privateKey, network = 'mainnet') {
    this.config = config;
    this.privateKey = privateKey;
    this.network = network;
    
    // Initialize context for workflows
    this.context = null;
    
    // Create the agent following sei-agent-kit pattern
    this.initializeAgent();
  }
  
  async initializeAgent() {
    try {
      // 1. Initialize Language Model based on provider
      this.llm = this.createLanguageModel();

      // 2. Create NetworkAwareSeiAgentKit instance with network support
      this.seiKit = new NetworkAwareSeiAgentKit(
        this.privateKey,
        ModelProviderName.OPENAI, // sei-agent-kit still uses OpenAI for tools
        this.network
      );

      // 3. Generate tools from SeiAgentKit using the official function
      this.agentTools = createSeiTools(this.seiKit);

      // 4. Create memory for conversation
      this.memory = new MemorySaver();
      this.agentConfig = { configurable: { thread_id: "AgentPad-LLM-Session" } };

      // 5. Create and configure the agent
      this.agent = createReactAgent({
        llm: this.llm,
        tools: this.agentTools,
        checkpointSaver: this.memory,
        messageModifier: this.buildSystemPrompt(),
      });

      
    } catch (error) {
      console.error("❌ Failed to initialize LLM Agent:", error.message);
      this.agent = null;
    }
  }

  createLanguageModel() {
    const model = this.config.model || "gpt-4o-mini";
    const temperature = this.config.temperature || 0.1;
    const maxTokens = Number(this.config.maxTokens || process.env.LLM_MAX_TOKENS || 512);

    return new ChatOpenAI({
      modelName: model,
      temperature: temperature,
      maxTokens,
    });
  }
  
  buildSystemPrompt() {
    // Check output mode first
    const outputMode = this.config.outputMode || 'assistant';
    
    if (outputMode === 'action') {
      // Prefer user-provided prompt for action mode; fall back to minimal JSON spec
      const userActionPrompt = this.config.systemPrompt || this.config.prompt || this.config.actionPrompt;
      let systemPrompt = userActionPrompt || `You are an automation planning assistant. Return ONLY valid JSON describing the next action to take. Required fields:\n{\n  "action": "string",\n  "parameters": { },\n  "confidence": "low|medium|high",\n  "reason": "string"\n}`;

      const availableActionsRaw = (this.config.availableActions ?? '').trim();
      if (!userActionPrompt && availableActionsRaw.length > 0) {
        systemPrompt += `\n\nAvailable actions: ${availableActionsRaw}`;
      }

      if (this.context && this.context.variables) {
        systemPrompt += `\n\nCurrent workflow variables available to you:\n`;
        for (const [key, value] of Object.entries(this.context.variables)) {
          systemPrompt += `- ${key}: ${value}\n`;
        }
      }

      return systemPrompt;
    }
    
    // Use specialized portfolio analysis prompt if config type is 'portfolio'
    if (this.config.analysisType === 'portfolio') {
      return this.buildPortfolioAnalysisPrompt();
    }
    
    // Use the systemPrompt from config if provided, otherwise use default
    let systemPrompt = this.config.systemPrompt || this.config.prompt || `
      You are a helpful AI assistant specialized in blockchain operations and portfolio management on the SEI blockchain.
      You have access to comprehensive SEI blockchain tools for checking balances, transferring tokens, staking, swapping, and more.
      
      You can perform actions like:
      - Check ERC20 and ERC721 token balances
      - Transfer tokens between addresses
      - Stake and unstake SEI tokens
      - Swap tokens
      - Interact with DeFi protocols like Takara and Citrex
      - Post and manage Twitter content
      - Create and manage Carbon strategies
      - Access DexScreener data
      - And much more blockchain functionality
      
      Always be helpful, accurate, and execute the requested blockchain operations when possible.
      If you need a wallet address or token address, check the available workflow variables first.
    `;

    // Add workflow context if available
    if (this.context && this.context.variables) {
      systemPrompt += `\n\nCurrent workflow variables available to you:\n`;
      for (const [key, value] of Object.entries(this.context.variables)) {
        systemPrompt += `- ${key}: ${value}\n`;
      }
    }

    return systemPrompt;
  }
  
  buildActionPrompt() {
    // Deprecated: retained for backward compatibility but not used when outputMode === 'action'
    const userActionPrompt = this.config.systemPrompt || this.config.prompt || this.config.actionPrompt;
    if (userActionPrompt) return userActionPrompt;
    return `You are an automation planning assistant. Return ONLY valid JSON with fields action, parameters, confidence, reason.`;
  }
  
  buildPortfolioAnalysisPrompt() {
    let prompt = `
You are an expert SEI blockchain portfolio analyst with comprehensive access to real-time blockchain tools.

ANALYSIS CAPABILITIES:
- Real-time balance checking for all SEI ecosystem tokens (SEI, USDC, USDT, WETH, ATOM)
- DeFi position analysis (staking rewards, Takara lending, Citrex trading)
- NFT portfolio evaluation
- Risk assessment and diversification analysis
- Yield optimization recommendations

ANALYSIS WORKFLOW:
1. BALANCE DISCOVERY:
   - Check native SEI balance using sei_erc20_balance with ticker "SEI"
   - Check major stablecoins: USDC, USDT
   - Check ecosystem tokens: WETH, ATOM
   - Use sei_erc721_balance for NFT holdings if relevant
   
2. DEFI POSITION ANALYSIS:
   - Check staking positions and current rewards
   - Analyze Takara lending/borrowing positions using sei_get_borrow_balance
   - Review Citrex trading balances using sei_citrex_list_balances
   
3. PORTFOLIO CALCULATION:
   - Calculate total USD value estimation
   - Determine asset allocation percentages
   - Assess liquidity vs locked funds ratio
   
4. RISK & RECOMMENDATIONS:
   - Evaluate concentration risk (>50% in single asset = high risk)
   - Assess diversification opportunities
   - Suggest yield optimization strategies
   - Provide specific, actionable recommendations

OUTPUT FORMAT:
Structure your analysis as:

📊 PORTFOLIO OVERVIEW
• Total Estimated Value: $X,XXX USD
• Asset Count: X tokens + Y NFTs  
• Active DeFi Positions: X staking, Y lending

💰 ASSET BREAKDOWN
• Native SEI: X tokens ($XXX, XX%)
• Stablecoins: $XXX (XX%)
• Other Tokens: $XXX (XX%)
• DeFi Positions: $XXX (XX%)

⚠️ RISK ANALYSIS
• Risk Level: [Low/Medium/High]
• Primary Risks: [Top 2-3 specific risks]
• Diversification Score: [1-10 scale]

🎯 ACTIONABLE RECOMMENDATIONS
1. [Specific action with exact amounts]
2. [Timeline-based recommendation]  
3. [Risk mitigation strategy]

Always use the blockchain tools to get real-time data. Check workflow variables for target wallet addresses.
    `;

    // Add workflow context
    if (this.context && this.context.variables) {
      prompt += `\n\n📋 AVAILABLE WORKFLOW DATA:\n`;
      for (const [key, value] of Object.entries(this.context.variables)) {
        if (value && value !== '') {
          prompt += `• ${key}: ${value}\n`;
        }
      }
    }

    return prompt;
  }
  
  async execute(input = null, context = null) {
    try {
      // Set context for workflow integration
      this.context = context;
      
      // Wait for agent initialization if needed
      if (!this.agent) {
        await this.initializeAgent();
      }
      
      if (!this.agent) {
        throw new Error("Failed to initialize LLM agent with sei-agent-kit");
      }
      
      const userInput = input || this.config.input || "Please analyze the current situation and provide insights.";
      
      // Check if this is interactive chat mode
      if (this.config.chatInterface) {
        return await this.startInteractiveChat(userInput);
      } else {
        // Automated workflow mode
        return await this.processAutomatedInput(userInput);
      }
    } catch (error) {
      console.error("❌ LLM Node Error:", error.message);
      throw error;
    }
  }
  
  async processAutomatedInput(userInput) {
    // Resolve variables in the input
    const resolvedInput = this.resolveVariablesInInput(userInput);

    
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your_')) {
      const errorMsg = "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.";
      console.error(errorMsg);
      return errorMsg;
    }
    
    try {
  
      
      // Use the agent to process the input - ALWAYS use React agent for sei-agent-kit compatibility
      const responseStream = await this.agent.stream(
        { messages: [new HumanMessage(resolvedInput)] },
        this.agentConfig
      );

      let finalResponse = "";
      
      // Process the streaming response
      for await (const responseChunk of responseStream) {
        if ("agent" in responseChunk) {
          const agentMessage = responseChunk.agent.messages[0].content;
          finalResponse = agentMessage;
        } else if ("tools" in responseChunk) {
          const toolMessage = responseChunk.tools.messages[0].content;
        }
      }
      
      // Handle action output mode
      const outputMode = this.config.outputMode || 'assistant';
      if (outputMode === 'action') {
        return this.processActionOutput(finalResponse);
      }
      
      return finalResponse || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("Error in automated processing:", error.message);
      console.error("Full error:", error);
      return `Error: ${error.message}`;
    }
  }


  
  processActionOutput(response) {
    try {
      // Try to parse JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const actionData = JSON.parse(jsonMatch[0]);
        
        // Validate action structure
        if (actionData.action && actionData.confidence) {
          // Optional whitelist validation: only enforce if non-empty
          const availableActionsRaw = (this.config.availableActions ?? '').trim();
          if (availableActionsRaw.length > 0) {
            const allowed = new Set(
              availableActionsRaw
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            );
            if (allowed.size > 0 && !allowed.has(actionData.action)) {
              return JSON.stringify({
                action: 'error',
                parameters: {},
                confidence: 'low',
                reason: `Action '${actionData.action}' is not allowed. Allowed actions: ${[...allowed].join(', ')}`,
                rawResponse: response,
              });
            }
          }

          return JSON.stringify(actionData);
        }
      }
      
      // If JSON parsing fails, return structured error
      console.warn("⚠️ Could not parse action JSON from response:", response);
      return JSON.stringify({
        action: "error",
        parameters: {},
        confidence: "low",
        reason: "Failed to parse action from LLM response",
        rawResponse: response
      });
    } catch (error) {
      console.error("❌ Error processing action output:", error);
      return JSON.stringify({
        action: "error",
        parameters: {},
        confidence: "low",
        reason: "Error processing action output",
        error: error.message
      });
    }
  }
  
  resolveVariablesInInput(input) {
    if (!this.context || !this.context.variables) {
      return input;
    }
    
    let resolvedInput = input;
    
    // Find all variable placeholders in the input
    const variablePattern = /\{([^}]+)\}/g;
    const matches = resolvedInput.match(variablePattern);
    
    if (matches) {
      for (const match of matches) {
        const variablePath = match.slice(1, -1); // Remove { and }
        const value = this.resolveVariablePath(variablePath);
        
        if (value !== undefined) {
          resolvedInput = resolvedInput.replace(match, value);

        } else {
          console.warn(`⚠️ Variable not found: ${variablePath}`);
        }
      }
    }
    
    return resolvedInput;
  }
  
  resolveVariablePath(path) {
    const parts = path.split('.');
    let current = this.context.variables;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else if (typeof current === 'string') {
        // If current is a JSON string, try to parse and continue
        try {
          const parsed = JSON.parse(current);
          if (parsed && typeof parsed === 'object' && part in parsed) {
            current = parsed[part];
          } else {
            return undefined;
          }
        } catch {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  async startInteractiveChat(initialInput = null) {

    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const askQuestion = () => new Promise((resolve) => {
      rl.question('You: ', resolve);
    });
    
    let lastOutput = null;
    
    try {
      // Show initial message if provided
      if (initialInput) {
  
      }
      
      while (true) {
        const userInput = await askQuestion();
        
        if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
  
          break;
        }
        
        if (userInput.trim()) {
          lastOutput = await this.processChatInput(userInput);
  
        }
      }
    } finally {
      rl.close();
    }
    
    return lastOutput;
  }
  
  async processChatInput(userInput) {
    try {
      // Check if API key is available
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your_')) {
        return "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.";
      }
      
  
      
      // Use the agent to process the chat input
      const responseStream = await this.agent.stream(
        { messages: [new HumanMessage(userInput)] },
        this.agentConfig
      );

      let finalResponse = "";
      
      // Process the streaming response
      for await (const responseChunk of responseStream) {
        if ("agent" in responseChunk) {
          finalResponse = responseChunk.agent.messages[0].content;
        } else if ("tools" in responseChunk) {
  
        }
      }
      
      return finalResponse || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("Error processing chat input:", error.message);
      return `Error: ${error.message}`;
    }
  }
}

export default LLMNode;