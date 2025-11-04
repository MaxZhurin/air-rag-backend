-- Add assistant-related fields to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS "textFilePath" VARCHAR,
ADD COLUMN IF NOT EXISTS "assistantFileId" VARCHAR;

-- Add index for faster lookups by assistantFileId
CREATE INDEX IF NOT EXISTS idx_documents_assistant_file_id ON documents("assistantFileId");

