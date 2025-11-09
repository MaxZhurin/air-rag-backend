import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EmbeddingService } from './embedding.service';
import { PineconeService } from './pinecone.service';
import { PineconeAssistantService } from './pinecone-assistant.service';
import { GeminiService } from './gemini.service';
import { ParserService } from './parser.service';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { Document } from '../entities/document.entity';
import { Chunk } from '../entities/chunk.entity';
import { Category } from '../entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Chunk, Category])],
  controllers: [DocumentsController, CategoryController],
  providers: [
    DocumentsService,
    CategoryService,
    EmbeddingService,
    PineconeService,
    PineconeAssistantService,
    GeminiService,
    ParserService,
  ],
  exports: [
    DocumentsService,
    CategoryService,
    PineconeService,
    EmbeddingService,
    PineconeAssistantService,
    GeminiService,
  ],
})
export class DocumentsModule {}


