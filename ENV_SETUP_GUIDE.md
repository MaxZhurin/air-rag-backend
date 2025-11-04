# Environment Variables Setup Guide

This guide contains all the environment variables that need to be configured in your `.env` file.

## Quick Start

1. Copy the template below into a `.env` file in the root of your project
2. Replace all placeholder values with your actual credentials
3. **Never commit the `.env` file to version control**

## .env File Template

Create a file named `.env` in the root directory with the following content:

```env
# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your-password-here
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
PINECONE_INDEX_NAME=air-multy
PINECONE_INDEX_URL=https://your-pinecone-index-url-here.pinecone.io
PINECONE_INDEX_NAME_AIR=air
PINECONE_INDEX_URL_AIR=https://your-pinecone-air-index-url-here.pinecone.io
PINECONE_ASSISTANT_NAME=rag-air-assistant

# Gemini Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# Application Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

## Required Variables (Must be set)

The following variables are **required** and the application will fail to start if they are missing:

- `PINECONE_API_KEY` - Your Pinecone API key
- `PINECONE_INDEX_URL` - URL for your default Pinecone index
- `GEMINI_API_KEY` - Your Google Gemini API key
- `DB_PASSWORD` - Database password (required for database connection)
- `JWT_SECRET` - Secret key for JWT token signing

## Optional Variables (Have defaults)

These variables have defaults but can be overridden:

- `DB_TYPE` - Database type (default: `mysql`)
- `DB_HOST` - Database host (default: `localhost`)
- `DB_PORT` - Database port (default: `3306`)
- `DB_USERNAME` - Database username (default: `root`)
- `DB_DATABASE` - Database name (default: `rac_ai_chat`)
- `JWT_EXPIRATION` - JWT token expiration (default: `7d`)
- `PINECONE_INDEX_NAME` - Default Pinecone index name (default: `air-multy`)
- `PINECONE_ASSISTANT_NAME` - Pinecone assistant name (default: `rag-air-assistant`)
- `PORT` - Application port (default: `3001`)
- `FRONTEND_URL` - Frontend URL for CORS (default: `http://localhost:3000`)
- `PINECONE_INDEX_NAME_AIR` - Alternative Pinecone index name (default: `air`)
- `PINECONE_INDEX_URL_AIR` - Alternative Pinecone index URL (optional)

## Security Notes

1. **Rotate all exposed API keys immediately** - If you had hardcoded keys in your codebase, they should be considered compromised
2. **Never commit `.env` files** - The `.env` file is already in `.gitignore`
3. **Use different keys for development and production**
4. **Keep your `.env` file secure** - Don't share it or expose it publicly

## Changes Made

The following code files have been updated to use environment variables:

1. ✅ `src/documents/pinecone.service.ts` - Now uses `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_INDEX_URL`, `PINECONE_INDEX_NAME_AIR`, `PINECONE_INDEX_URL_AIR`
2. ✅ `src/documents/pinecone-assistant.service.ts` - Now uses `PINECONE_API_KEY`, `PINECONE_ASSISTANT_NAME`
3. ✅ `src/documents/gemini.service.ts` - Now uses `GEMINI_API_KEY` (was hardcoded before)

All hardcoded API keys and sensitive configuration values have been removed from the codebase.

