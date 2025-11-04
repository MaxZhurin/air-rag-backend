-- Add chatMode and metadata fields to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS "chatMode" VARCHAR,
ADD COLUMN IF NOT EXISTS "metadata" TEXT;

-- Add index for faster lookups by chatMode
CREATE INDEX IF NOT EXISTS idx_messages_chat_mode ON messages("chatMode");

-- Update chatMode enum constraint
-- Note: In PostgreSQL, you would need to use ALTER TYPE to add enum values
-- For SQLite, this is handled by the TypeORM entity definition

