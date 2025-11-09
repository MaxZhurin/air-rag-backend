-- Add fileHash field to documents table for duplicate detection
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS "fileHash" VARCHAR(64);

-- Create unique index for fileHash to prevent duplicates (NULL values are allowed)
-- Note: In MySQL/MariaDB, unique index allows multiple NULL values
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash ON documents("fileHash");

