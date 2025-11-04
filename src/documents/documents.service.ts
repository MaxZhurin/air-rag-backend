import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../entities/document.entity';
import { Chunk } from '../entities/chunk.entity';
import { ParserService } from './parser.service';
import { EmbeddingService } from './embedding.service';
import { PineconeService } from './pinecone.service';
import { PineconeAssistantService } from './pinecone-assistant.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
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
  ): Promise<Document> {
    const uploadPath = this.configService.get('UPLOAD_PATH', './uploads');

    // Ensure upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const filePath = path.join(
      uploadPath,
      `${Date.now()}-${file.originalname}`,
    );
    fs.writeFileSync(filePath, Buffer.from(file.buffer));

    const document = this.documentRepository.create({
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      path: filePath,
      userId,
      status: 'processing',
    });

    await this.documentRepository.save(document);

    // Process document asynchronously
    this.processDocument(document.id).catch((error) => {
      console.error(`Error processing document ${document.id}:`, error);
      this.updateDocumentStatus(document.id, 'error', error.message);
    });

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
      const content = await this.parserService.parseFile(
        document.path,
        document.type,
      );

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
      
      await this.pineconeService.upsertVector(data);

      // Store chunk metadata in database
      // const chunk = this.chunkRepository.create({
      //   documentId: document.id,
      //   content: chunkContent,
      //   chunkIndex: i,
      //   pineconeId,
      // });
      // await this.chunkRepository.save(chunk);

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
  ): Promise<{ documents: Document[]; total: number }> {
    const [documents, total] = await this.documentRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { documents, total };
  }

  async getDocument(documentId: string, userId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
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

    // Delete chunks from Pinecone
    const chunks = await this.chunkRepository.find({
      where: { documentId },
    });

    for (const chunk of chunks) {
      await this.pineconeService.deleteVector(chunk.pineconeId);
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
    const document = await this.getDocument(documentId, userId);

    if (!document.textFilePath || !fs.existsSync(document.textFilePath)) {
      throw new NotFoundException('Text content not found for this document');
    }

    const content = fs.readFileSync(document.textFilePath, 'utf8');

    return { content };
  }

  async getDocumentDownloadUrl(
    documentId: string,
    userId: string,
  ): Promise<{ url: string }> {
    const document = await this.getDocument(documentId, userId);

    if (!document.path || !fs.existsSync(document.path)) {
      throw new NotFoundException('Document file not found');
    }

    // Generate a download URL (in production, you might want to generate signed URLs)
    // For now, we'll return a relative path that can be served by the API
    const fileName = path.basename(document.path);
    const url = `/api/documents/${documentId}/download-file`;

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
