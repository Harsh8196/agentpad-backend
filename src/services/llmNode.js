import { SeiAgentKit } from "../../external/sei-agent-kit/src/agent/index.ts";
import { createSeiTools } from "../../external/sei-agent-kit/src/langchain/index.ts";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ModelProviderName } from "../../external/sei-agent-kit/src/types/index.ts";

class LLMNode {
  constructor(config, privateKey, provider, tools = null) {
    this.config = config;
    this.privateKey = privateKey;
    this.provider = provider;
    
    // Initialize SeiAgentKit for blockchain operations
    this.seiKit = new SeiAgentKit(privateKey, provider);
    
    // Use provided tools or create new ones
    this.tools = tools || createSeiTools(this.seiKit);
    
    // Initialize LLM
    this.model = new ChatOpenAI({
      modelName: config.model || "gpt-4-turbo",
      temperature: config.temperature || 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    
    // Create agent executor
    this.agentExecutor = this.createAgentExecutor();
  }
  
  createAgentExecutor() {
    const systemPrompt = this.buildSystemPrompt();
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", "{input}"],
    ]);
    
    const agent = createOpenAIFunctionsAgent({
      llm: this.model,
      tools: this.tools,
      prompt,
    });
    
    return new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: true,
    });
  }
  
  buildSystemPrompt() {
    const basePrompt = this.config.prompt || "You are an AI assistant that can help with blockchain operations and analysis.";
    
    return `${basePrompt}

You have access to the following SEI blockchain tools:
${this.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

When analyzing data or making decisions:
1. Use the available tools to gather information
2. Provide clear, actionable insights
3. If asked about portfolio or balances, use the appropriate balance tools
4. For trading decisions, consider market data and account health
5. Always explain your reasoning

Current context: You are part of an automated workflow system. Your responses should be structured and actionable.`;
  }
  
  async execute(input = null) {
    try {
      const userInput = input || this.config.input || "Please analyze the current situation and provide insights.";
      
      if (this.config.chatInterface) {
        // Interactive chat mode
        console.log("🤖 LLM Agent: Starting interactive chat mode...");
        console.log("Type 'exit' to end the chat session.\n");
        
        let chatInput = userInput;
        while (chatInput.toLowerCase() !== 'exit') {
          const result = await this.agentExecutor.invoke({ input: chatInput });
          console.log(`🤖 LLM Agent: ${result.output}\n`);
          
          // In a real implementation, you'd get user input here
          // For now, we'll just exit after one response
          break;
        }
        
        return result.output;
      } else {
        // Single execution mode
        console.log(`🤖 LLM Agent: Processing input: ${userInput}`);
        
        const result = await this.agentExecutor.invoke({ input: userInput });
        console.log(`🤖 LLM Agent: ${result.output}`);
        
        return result.output;
      }
    } catch (error) {
      console.error("❌ LLM Node Error:", error.message);
      throw error;
    }
  }
  
  // Helper method to parse LLM output for workflow use
  parseForWorkflow(output) {
    try {
      // Try to extract structured data from LLM output
      const lines = output.split('\n');
      const result = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            result[key] = value;
          }
        }
      }
      
      return result;
    } catch (error) {
      console.warn("Could not parse LLM output as structured data:", error.message);
      return { rawOutput: output };
    }
  }
  
  // Helper method to extract specific data types
  extractStructuredData(output, dataType) {
    try {
      switch (dataType) {
        case 'balance':
          // Extract balance information
          const balanceMatch = output.match(/(\d+(?:\.\d+)?)\s*(SEI|USDC|USDT)/i);
          return balanceMatch ? { amount: balanceMatch[1], currency: balanceMatch[2] } : null;
          
        case 'decision':
          // Extract decision (buy/sell/hold)
          const decisionMatch = output.match(/(buy|sell|hold|wait)/i);
          return decisionMatch ? decisionMatch[1].toLowerCase() : null;
          
        case 'price':
          // Extract price information
          const priceMatch = output.match(/\$(\d+(?:\.\d+)?)/);
          return priceMatch ? parseFloat(priceMatch[1]) : null;
          
        default:
          return this.parseForWorkflow(output);
      }
    } catch (error) {
      console.warn(`Could not extract ${dataType} data:`, error.message);
      return null;
    }
  }
}

export default LLMNode; 