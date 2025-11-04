import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateChatDto } from '../dto/create-chat.dto';
import { UpdateChatDto } from '../dto/update-chat.dto';
import { CreateMessageDto } from '../dto/create-message.dto';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  async createChat(@Req() req, @Body() createChatDto: CreateChatDto) {
    return this.chatService.createChat(req.user.id, createChatDto.title);
  }

  @Get()
  async getChats(@Req() req) {
    return this.chatService.getChats(req.user.id);
  }

  @Get(':id')
  async getChat(@Param('id') id: string, @Req() req) {
    return this.chatService.getChat(id, req.user.id);
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string, @Req() req) {
    return this.chatService.getMessages(id, req.user.id);
  }

  @Put(':id')
  async updateChatTitle(
    @Param('id') id: string,
    @Req() req,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    return this.chatService.updateChatTitle(id, req.user.id, updateChatDto.title);
  }

  @Delete(':id')
  async deleteChat(@Param('id') id: string, @Req() req) {
    await this.chatService.deleteChat(id, req.user.id);
    return { message: 'Chat deleted successfully' };
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Req() req,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(id, req.user.id, createMessageDto);
  }
}

