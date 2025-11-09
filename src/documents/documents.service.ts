import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Document } from '../entities/document.entity';
import { Chunk } from '../entities/chunk.entity';
import { Category } from '../entities/category.entity';
import { ParserService } from './parser.service';
import { EmbeddingService } from './embedding.service';
import { PineconeService } from './pinecone.service';
import { PineconeAssistantService } from './pinecone-assistant.service';
import { GeminiService } from './gemini.service';
import { decodeFilename } from '../utils/filename-decoder.util';
import { cleanTextLineBreaks } from '../utils/text-cleaner.util';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private parserService: ParserService,
    private embeddingService: EmbeddingService,
    private pineconeService: PineconeService,
    private pineconeAssistantService: PineconeAssistantService,
    private geminiService: GeminiService,
    private configService: ConfigService,
  ) {}

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
  ): Promise<any> {
    const uploadPath = this.configService.get('UPLOAD_PATH', './uploads');

    // Ensure upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Decode filename to fix encoding issues with Cyrillic characters
    const decodedFilename = decodeFilename(file.originalname);

    // Calculate SHA256 hash of file content for duplicate detection
    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Check if document with same hash already exists
    const existingDocument = await this.documentRepository.findOne({
      where: { fileHash },
      relations: ['user'],
    });

    if (existingDocument) {
      // Return existing document with user information
      const { user, ...documentWithoutUser } = existingDocument;
      throw new ConflictException({
        message: 'Document with the same content already exists',
        existingDocument: {
          ...documentWithoutUser,
          uploadedBy: {
            email: user?.email || null,
            name: user?.name || null,
          },
        },
      });
    }

    const filePath = path.join(
      uploadPath,
      `${Date.now()}-${decodedFilename}`,
    );
    fs.writeFileSync(filePath, Buffer.from(file.buffer));

    const document = this.documentRepository.create({
      name: decodedFilename,
      type: file.mimetype,
      size: file.size,
      path: filePath,
      userId,
      fileHash,
      status: 'processing',
    });

    await this.documentRepository.save(document);

    // Process document asynchronously
    this.processDocument(document.id).catch((error) => {
      console.error(`Error processing document ${document.id}:`, error);
      this.updateDocumentStatus(document.id, 'error', error.message);
    });

    // Reload document with user relation to include user information
    const documentWithUser = await this.documentRepository.findOne({
      where: { id: document.id },
      relations: ['user'],
    });

    // Map document to include user email and name
    if (documentWithUser) {
      const { user, ...documentWithoutUser } = documentWithUser;
      return {
        ...documentWithoutUser,
        uploadedBy: {
          email: user?.email || null,
          name: user?.name || null,
        },
      };
    }

    // Fallback: return document without user info if not found (should not happen)
    return document;
  }

  async processDocument(documentId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    try {
      // 1. Parse document content
      console.log(`Parsing document ${documentId} (${document.type}): ${document.name}`);
      let content = await this.parserService.parseFile(
        document.path,
        document.type,
      );
      console.log(`Document parsed successfully. Content length: ${content.length} characters`);

      // 1.5. Clean excessive line breaks (more than 2 consecutive newlines)
      content = cleanTextLineBreaks(content);
      console.log(`Content cleaned. Final length: ${content.length} characters`);

      // 2. Save text version as .txt file
      const uploadPath = this.configService.get('UPLOAD_PATH', './uploads');
      const textFileName = `${documentId}-text.txt`;
      const textFilePath = path.join(uploadPath, textFileName);
      fs.writeFileSync(textFilePath, content, 'utf8');

      // 3. Upload to Pinecone Assistant
      let assistantFileId: string | null = null;
      try {
        const uploadResponse = await this.pineconeAssistantService.uploadFile(
          textFilePath,
          {
            documentId: document.id,
            originalName: document.name,
            userId: document.userId,
          }
        );
        assistantFileId = uploadResponse.id;
        console.log('File uploaded to Pinecone Assistant:', uploadResponse);
      } catch (error) {
        console.error('Error uploading to Pinecone Assistant:', error);
        // Continue processing even if assistant upload fails
      }

      // 4. Update document with text file path and assistant file ID
      await this.documentRepository.update(documentId, {
        textFilePath,
        assistantFileId,
      });

      // 5. Split into chunks with AI-powered semantic chunking
      const chunks = await this.splitIntoChunks(content, 1000);
      const data = [];
      
      // 6. Generate embeddings and store in Pinecone with proper metadata
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];
        
        // Store in Pinecone with JSON metadata
        const pineconeId = `${documentId}_chunk_${i}`;
        
        // Create structured metadata as JSON
        const metadata = {
          documentId: document.id,
          userId: document.userId,
          fileName: document.name,
          fileType: document.type,
          chunkIndex: i,
          totalChunks: chunks.length,
          createdAt: new Date().toISOString(),
        };

        data.push({
          id: pineconeId,
          text: chunkContent,
          category: JSON.stringify(metadata), // Store metadata as JSON string
        });
      }
      
      // Upsert vectors to Pinecone and get chunk IDs
      const chunkIds = await this.pineconeService.upsertVector(data);

      // Store chunk metadata in database with their Pinecone IDs
      const chunkEntities = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];
        const pineconeId = chunkIds[i] || `${documentId}_chunk_${i}`;
        
        const chunk = this.chunkRepository.create({
          documentId: document.id,
          content: chunkContent,
          chunkIndex: i,
          pineconeId,
        });
        chunkEntities.push(chunk);
      }
      
      // Save all chunks to database
      await this.chunkRepository.save(chunkEntities);

      // 7. Update document status
      await this.updateDocumentStatus(documentId, 'ready');
    } catch (error) {
      throw error;
    }
  }

  private async splitIntoChunks(
    text: string,
    chunkSize: number,
  ): Promise<string[]> {
    // Try to use Gemini AI for intelligent semantic chunking
    try {
      console.log('Attempting Gemini AI semantic chunking...');
      const chunks = await this.geminiService.semanticChunking(text, chunkSize);
      console.log(`Gemini successfully created ${chunks} ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      console.warn('Gemini chunking failed, falling back to manual chunking:', error.message);
      // Fallback to manual semantic chunking with overlap
      return this.semanticChunking(text, chunkSize, 0.1); // 10% overlap by default
    }
  }

  private semanticChunking(
    text: string,
    chunkSize: number,
    overlapRatio: number = 0.1,
  ): string[] {
    const chunks: string[] = [];
    
    // Split by paragraphs first (double newlines or single newlines)
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    let currentChunk = '';
    let previousContext = '';
    const overlapSize = Math.floor(chunkSize * overlapRatio);

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // If adding this paragraph exceeds chunk size and we have content
      if ((currentChunk + paragraph).length > chunkSize && currentChunk.length > 0) {
        // Add the chunk with previous context
        const chunkWithContext = previousContext + currentChunk;
        chunks.push(chunkWithContext.trim());
        
        // Save last part as context for next chunk (overlap)
        previousContext = this.getLastWords(currentChunk, overlapSize);
        
        // Start new chunk with this paragraph
        currentChunk = paragraph + '\n\n';
      } else {
        // Add paragraph to current chunk
        currentChunk += paragraph + '\n\n';
      }
      
      // If this is the last paragraph, add remaining chunk
      if (i === paragraphs.length - 1 && currentChunk.trim().length > 0) {
        const chunkWithContext = previousContext + currentChunk;
        chunks.push(chunkWithContext.trim());
      }
    }

    // If no paragraphs were found, fall back to sentence-based chunking
    if (chunks.length === 0 && text.length > 0) {
      return this.sentenceBasedChunking(text, chunkSize, overlapSize);
    }

    return chunks;
  }

  private sentenceBasedChunking(
    text: string,
    chunkSize: number,
    overlapSize: number,
  ): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let currentChunk = '';
    let previousContext = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if ((currentChunk + trimmedSentence).length > chunkSize && currentChunk) {
        const chunkWithContext = previousContext + currentChunk;
        chunks.push(chunkWithContext.trim());
        
        previousContext = this.getLastWords(currentChunk, overlapSize);
        currentChunk = trimmedSentence + ' ';
      } else {
        currentChunk += trimmedSentence + ' ';
      }
    }

    if (currentChunk.trim()) {
      const chunkWithContext = previousContext + currentChunk;
      chunks.push(chunkWithContext.trim());
    }

    return chunks;
  }

  private getLastWords(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to cut at sentence boundary
    const lastPart = text.slice(-maxLength);
    const sentenceMatch = lastPart.match(/[.!?]\s+(.+)$/);
    
    if (sentenceMatch) {
      return sentenceMatch[1] + ' ';
    }

    // Try to cut at word boundary
    const words = text.split(/\s+/);
    let result = '';
    
    for (let i = words.length - 1; i >= 0; i--) {
      const newResult = words[i] + ' ' + result;
      if (newResult.length > maxLength) {
        break;
      }
      result = newResult;
    }

    return result.trim() + ' ';
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'uploading' | 'processing' | 'ready' | 'error',
    errorMessage?: string,
  ): Promise<void> {
    await this.documentRepository.update(documentId, {
      status,
      errorMessage,
    });
  }

  async getDocuments(
    userId: string,
    page: number = 1,
    limit: number = 10,
    categoryId?: string | null,
  ): Promise<{ documents: any[]; total: number }> {
    const whereCondition: any = {};

    // Filter by category if provided
    // If categoryId is null or empty string, show documents without category
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === '') {
        whereCondition.categoryId = null;
      } else {
        whereCondition.categoryId = categoryId;
      }
    }

    const [documents, total] = await this.documentRepository.findAndCount({
      where: whereCondition,
      relations: ['category', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Map documents to include user email and name
    const documentsWithUser = documents.map((doc) => {
      const { user, ...documentWithoutUser } = doc;
      return {
        ...documentWithoutUser,
        uploadedBy: {
          email: user?.email || null,
          name: user?.name || null,
        },
      };
    });

    return { documents: documentsWithUser, total };
  }

  async getDocument(documentId: string, userId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId },
      relations: ['category'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async updateDocumentCategory(
    documentId: string,
    userId: string,
    categoryId: string | null,
  ): Promise<Document> {
    const document = await this.getDocument(documentId, userId);

    console.log('Service updateDocumentCategory:', {
      documentId,
      categoryId,
      type: typeof categoryId,
      currentCategoryId: document.categoryId,
    });

    // If categoryId is provided, verify it exists (unless it's null for "no category")
    if (categoryId !== null && categoryId !== undefined) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Explicitly set categoryId to null if it's null or undefined
    const finalCategoryId = categoryId === undefined ? null : categoryId;
    
    console.log('Before update:', {
      documentId,
      currentCategoryId: document.categoryId,
      finalCategoryId,
      type: typeof finalCategoryId,
    });

    // Use QueryBuilder to explicitly set NULL value
    if (finalCategoryId === null) {
      await this.documentRepository
        .createQueryBuilder()
        .update(Document)
        .set({ categoryId: null })
        .where('id = :id', { id: documentId })
        .execute();
    } else {
      await this.documentRepository.update(documentId, {
        categoryId: finalCategoryId,
      });
    }

    console.log('After update, reloading document...');

    // Reload with relations
    const updatedDocument = await this.getDocument(documentId, userId);
    
    console.log('Updated document categoryId:', updatedDocument.categoryId);

    return updatedDocument;
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.getDocument(documentId, userId);

    // Delete from Pinecone Assistant if file was uploaded
    if (document.assistantFileId) {
      try {
        await this.pineconeAssistantService.deleteFile(document.assistantFileId);
        console.log(`Deleted file ${document.assistantFileId} from Pinecone Assistant`);
      } catch (error) {
        console.error('Error deleting file from Pinecone Assistant:', error);
        // Continue with deletion even if assistant deletion fails
      }
    }

    // Delete chunks from Pinecone using deleteMany for efficiency
    const chunks = await this.chunkRepository.find({
      where: { documentId },
    });

    if (chunks.length > 0) {
      const chunkIds = chunks.map(chunk => chunk.pineconeId).filter(Boolean);
      if (chunkIds.length > 0) {
        await this.pineconeService.deleteVectors(chunkIds);
      }
    }

    // Delete original file from filesystem
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Delete text file from filesystem
    if (document.textFilePath && fs.existsSync(document.textFilePath)) {
      fs.unlinkSync(document.textFilePath);
    }

    // Delete from database (cascades to chunks)
    await this.documentRepository.delete(documentId);
  }

  async reprocessDocument(
    documentId: string,
    userId: string,
  ): Promise<Document> {
    const document = await this.getDocument(documentId, userId);

    // Delete existing chunks
    const chunks = await this.chunkRepository.find({
      where: { documentId },
    });

    // for (const chunk of chunks) {
    //   await this.pineconeService.deleteVector(chunk.pineconeId);
    //   await this.chunkRepository.delete(chunk.id);
    // }

    // Update status and reprocess
    document.status = 'processing';
    await this.documentRepository.save(document);

    this.processDocument(documentId).catch((error) => {
      console.error(`Error reprocessing document ${documentId}:`, error);
      this.updateDocumentStatus(documentId, 'error', error.message);
    });

    return document;
  }

  async getDocumentContent(
    documentId: string,
    userId: string,
  ): Promise<{ content: string }> {
    // Get document without userId check to allow access for all users
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['category'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.textFilePath || !fs.existsSync(document.textFilePath)) {
      throw new NotFoundException('Text content not found for this document');
    }

    const content = fs.readFileSync(document.textFilePath, 'utf8');

    return { content };
  }

  async getDocumentDownloadUrl(
    documentId: string,
    userId: string,
    token?: string | null,
  ): Promise<{ url: string }> {
    const document = await this.getDocument(documentId, userId);

    if (!document.path || !fs.existsSync(document.path)) {
      throw new NotFoundException('Document file not found');
    }

    // Generate a download URL with token in query parameter for direct download links
    let url = `/api/documents/${documentId}/download-file`;
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }

    return { url };
  }

  async streamDocumentFile(
    documentId: string,
    userId: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const document = await this.getDocument(documentId, userId);

    if (!document.path || !fs.existsSync(document.path)) {
      throw new NotFoundException('Document file not found');
    }

    return {
      filePath: document.path,
      fileName: document.name,
      mimeType: document.type,
    };
  }
}
