-- Fix errorMessage column to be TEXT instead of VARCHAR
ALTER TABLE documents MODIFY COLUMN errorMessage TEXT;
