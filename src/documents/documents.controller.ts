import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { PineconeService } from './pinecone.service';
import { PineconeAssistantService } from './pinecone-assistant.service';

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
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, DOCX, and TXT files are allowed.',
      );
    }

    return this.documentsService.uploadDocument(file, req.user.id);
  }

  @Get()
  async getDocuments(
    @Req() req,
  @Query('page') page = 1,
  @Query('limit') limit = 10,
  ) {
    return this.documentsService.getDocuments(req.user.id, page, limit);
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

  @Get(':id')
  async getDocument(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocument(id, req.user.id);
  }

  @Get(':id/status')
  async getDocumentStatus(@Param('id') id: string, @Req() req) {
    const document = await this.documentsService.getDocument(id, req.user.id);
    return { id: document.id, status: document.status };
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @Req() req) {
    await this.documentsService.deleteDocument(id, req.user.id);
    return { message: 'Document deleted successfully' };
  }

  @Post(':id/reprocess')
  async reprocessDocument(@Param('id') id: string, @Req() req) {
    return this.documentsService.reprocessDocument(id, req.user.id);
  }

  @Get(':id/content')
  async getDocumentContent(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocumentContent(id, req.user.id);
  }

  @Get(':id/download')
  async getDocumentDownload(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocumentDownloadUrl(id, req.user.id);
  }
}


