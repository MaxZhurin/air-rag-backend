-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add categoryId column to documents table
ALTER TABLE documents 
ADD COLUMN categoryId VARCHAR(36) NULL,
ADD FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_documents_category_id ON documents(categoryId);


