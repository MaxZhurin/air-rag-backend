import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { PineconeService } from './pinecone.service';
import { PineconeAssistantService } from './pinecone-assistant.service';
import { UpdateDocumentCategoryDto } from './dto/update-document-category.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private pineconeService: PineconeService,
    private pineconeAssistantService: PineconeAssistantService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/x-markdown',
    ];

    // Check MIME type or file extension for markdown files
    const isMarkdown =
      allowedTypes.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.md');

    if (!isMarkdown && !allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, DOCX, TXT, and MD files are allowed.',
      );
    }

    return this.documentsService.uploadDocument(file, req.user.id);
  }

  @Get()
  async getDocuments(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('categoryId') categoryId?: string,
  ) {
    // Convert categoryId: 'null' string to null, undefined stays undefined
    const parsedCategoryId =
      categoryId === 'null' || categoryId === ''
        ? null
        : categoryId !== undefined
          ? categoryId
          : undefined;

    return this.documentsService.getDocuments(
      req.user.id,
      page,
      limit,
      parsedCategoryId,
    );
  }

  @Put(':id/category')
  async updateDocumentCategory(
    @Param('id') id: string,
    @Req() req,
    @Body() body: UpdateDocumentCategoryDto,
  ) {
    // Transform handles conversion, but we ensure null is properly passed
    // Handle both null and undefined explicitly
    const categoryId = body.categoryId === undefined ? null : body.categoryId;

    console.log('Updating document category:', {
      documentId: id,
      receivedCategoryId: body.categoryId,
      finalCategoryId: categoryId,
      type: typeof categoryId,
    });

    return this.documentsService.updateDocumentCategory(
      id,
      req.user.id,
      categoryId,
    );
  }

  @Get('indexes')
  async getIndexes() {
    return this.pineconeService.listIndexes();
  }

  @Get('models')
  async getModels() {
    return [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'OpenAI',
          description: 'Latest GPT-4 model with improved capabilities'
        },
        {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
          provider: 'OpenAI',
          description: 'Advanced GPT-4 model'
        },
        {
          id: 'o4-mini',
          name: 'O4 Mini',
          provider: 'OpenAI',
          description: 'Compact version of O4 model'
        },
        {
          id: 'claude-3-5-sonnet',
          name: 'Claude 3.5 Sonnet',
          provider: 'Anthropic',
          description: 'Advanced Claude model with enhanced reasoning'
        },
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet',
          provider: 'Anthropic',
          description: 'Latest Claude model with improved performance'
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          provider: 'Google',
          description: "Google's advanced multimodal AI model"
        }
      ];

  }

  @Get('assistants')
  async getAssistants() {
    return this.pineconeAssistantService.listAssistants();
  }

  @Get('assistant/info')
  async getAssistantInfo() {
    return this.pineconeAssistantService.getAssistantInfo();
  }

  @Get('assistant/files')
  async getAssistantFiles() {
    return this.pineconeAssistantService.listFiles();
  }

  @Get('assistant/files/:fileId')
  async getAssistantFile(@Param('fileId') fileId: string) {
    return this.pineconeAssistantService.getFile(fileId);
  }

  // Specific routes must come before the general :id route
  @Get(':id/download-file')
  async downloadDocumentFile(
    @Param('id') id: string,
    @Req() req,
    @Res() res: Response,
  ) {
    try {
      const fileInfo = await this.documentsService.streamDocumentFile(
        id,
        req.user.id,
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`,
      );
      res.setHeader(
        'Content-Type',
        fileInfo.mimeType || 'application/octet-stream',
      );

      const fileStream = fs.createReadStream(fileInfo.filePath);
      
      fileStream.on('error', (error) => {
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error reading file',
            error: error.message,
          });
        }
      });

      fileStream.pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(error.status || 500).json({
          success: false,
          message: error.message || 'Error downloading file',
        });
      }
    }
  }

  @Get(':id/download')
  async getDocumentDownload(@Param('id') id: string, @Req() req) {
    // Extract token from Authorization header or query parameter
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (req.query.token as string) || null;

    return this.documentsService.getDocumentDownloadUrl(id, req.user.id, token);
  }

  @Get(':id/status')
  async getDocumentStatus(@Param('id') id: string, @Req() req) {
    const document = await this.documentsService.getDocument(id, req.user.id);
    return { id: document.id, status: document.status };
  }

  @Get(':id/content')
  async getDocumentContent(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocumentContent(id, req.user.id);
  }

  @Post(':id/reprocess')
  async reprocessDocument(@Param('id') id: string, @Req() req) {
    return this.documentsService.reprocessDocument(id, req.user.id);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocument(id, req.user.id);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @Req() req) {
    await this.documentsService.deleteDocument(id, req.user.id);
    return { message: 'Document deleted successfully' };
  }
}


