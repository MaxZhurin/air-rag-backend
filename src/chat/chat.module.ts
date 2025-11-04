import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, Message]), DocumentsModule],
  controllers: [ChatController],
  providers: [ChatService, AiService],
  exports: [ChatService],
})
export class ChatModule {}


