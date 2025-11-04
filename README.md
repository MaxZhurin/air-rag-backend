# RAC-AI-Chat Backend

NestJS backend with TypeORM, Google OAuth, OpenAI integration, and Pinecone vector database for RAG (Retrieval-Augmented Generation) functionality.

## Features

- 🔐 Google OAuth 2.0 Authentication
- 💬 AI Chat with OpenAI GPT-4
- 📄 Document Processing (PDF, DOCX, TXT)
- 🔍 Vector Search with Pinecone
- 🗄️ MySQL Database with TypeORM
- 🚀 RESTful API

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- pnpm (or npm/yarn)
- Google OAuth credentials
- OpenAI API key
- Pinecone account

## Installation

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:

```env
# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your-password
DB_DATABASE=rac_ai_chat

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=7d

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=rac-ai-documents

# Application Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

4. Create MySQL database:

```sql
CREATE DATABASE rac_ai_chat;
```

5. Start the development server:

```bash
pnpm run start:dev
```

The backend will be available at `http://localhost:3001`

## API Endpoints

### Authentication

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/profile` - Get user profile (protected)

### Chats

- `POST /api/chats` - Create new chat
- `GET /api/chats` - Get all chats
- `GET /api/chats/:id` - Get chat by ID
- `GET /api/chats/:id/messages` - Get chat messages
- `POST /api/chats/:id/messages` - Send message
- `PUT /api/chats/:id` - Update chat title
- `DELETE /api/chats/:id` - Delete chat

### Documents

- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get document by ID
- `GET /api/documents/:id/status` - Get document status
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/reprocess` - Reprocess document

## Project Structure

```
src/
├── auth/               # Authentication module
│   ├── strategies/     # Passport strategies (JWT, Google)
│   ├── guards/         # Auth guards
│   ├── auth.service.ts
│   └── auth.controller.ts
├── chat/               # Chat module
│   ├── chat.service.ts
│   ├── ai.service.ts   # OpenAI integration
│   └── chat.controller.ts
├── documents/          # Documents module
│   ├── documents.service.ts
│   ├── parser.service.ts      # File parsing
│   ├── embedding.service.ts   # OpenAI embeddings
│   ├── pinecone.service.ts    # Vector database
│   └── documents.controller.ts
├── entities/           # TypeORM entities
│   ├── user.entity.ts
│   ├── chat.entity.ts
│   ├── message.entity.ts
│   ├── document.entity.ts
│   └── chunk.entity.ts
├── config/             # Configuration
│   └── database.config.ts
├── app.module.ts
└── main.ts
```

## Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Secret to `.env`

## Setting Up Pinecone

1. Sign up at [Pinecone](https://www.pinecone.io/)
2. Create a new index with:
   - Dimensions: 1536 (for text-embedding-3-small)
   - Metric: cosine
3. Copy API key and environment to `.env`

## Building for Production

```bash
pnpm run build
pnpm run start:prod
```

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```
