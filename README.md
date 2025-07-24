# AgentPad Backend

Standalone execution engine for AgentPad flows.

## 🏗️ Architecture

This is the **standalone backend executor** for AgentPad, designed to run independently from the frontend. It can be deployed as:

- **CLI Tool** - Run flows locally
- **Docker Container** - Deploy anywhere
- **Cloud Service** - Deploy to cloud platforms

## 🚀 Features

- **Flow Execution Engine** - Execute flows built in the frontend
- **Blockchain Integration** - SEI blockchain operations via sei-agent-kit
- **AI Agent Support** - OpenAI, Anthropic, Google AI integration
- **API Operations** - HTTP requests and data processing
- **Database Operations** - SQL and NoSQL database support
- **Environment Management** - Secure private key handling

## 📁 Structure

```
AgentPad-Backend/
├── src/
│   ├── flowExecutor.js      # Main execution engine
│   ├── cli.js               # CLI tool entry point
│   ├── server.js            # HTTP server for API
│   └── utils/               # Execution utilities
│       ├── blockchain.js    # Blockchain operations
│       ├── ai.js            # AI agent operations
│       ├── api.js           # API call operations
│       └── database.js      # Database operations
├── external/
│   └── sei-agent-kit/       # SEI blockchain integration
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker compose setup
└── package.json             # Dependencies
```

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <backend-repo-url>
cd AgentPad-Backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

```bash
# Blockchain Configuration
SEI_PRIVATE_KEY=your-private-key
SEI_RPC_URL=https://sei-rpc-url

# AI Configuration
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_KEY=your-google-key

# Database Configuration
DATABASE_URL=your-database-url

# Server Configuration
PORT=3001
NODE_ENV=development
```

## 🚀 Usage

### CLI Tool

```bash
# Execute a flow from JSON file
node src/cli.js execute flow.json

# Execute with custom environment
node src/cli.js execute flow.json --env production
```

### Docker

```bash
# Build the image
docker build -t agentpad-backend .

# Run the container
docker run -p 3001:3001 agentpad-backend

# With environment variables
docker run -p 3001:3001 \
  -e SEI_PRIVATE_KEY=your-key \
  -e OPENAI_API_KEY=your-key \
  agentpad-backend
```

### HTTP API

```bash
# Start the server
npm start

# Execute flow via API
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d @flow.json
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📦 Deployment

### Docker Deployment

```bash
# Build image
docker build -t agentpad-backend .

# Run with docker-compose
docker-compose up -d
```

### Cloud Deployment

The backend can be deployed to:
- **AWS Lambda** - Serverless execution
- **Google Cloud Run** - Containerized deployment
- **Azure Container Instances** - Cloud containers
- **DigitalOcean App Platform** - Managed containers

## 🔒 Security

- **Private Keys** - Stored in environment variables
- **No Frontend Dependencies** - Completely isolated
- **Secure Execution** - Sandboxed flow execution
- **Environment Isolation** - Separate configs per environment

## 📚 API Reference

### Execute Flow

```http
POST /api/execute
Content-Type: application/json

{
  "flow": {
    "nodes": [...],
    "edges": [...]
  },
  "environment": {
    "variables": {...}
  }
}
```

### Health Check

```http
GET /api/health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details. 