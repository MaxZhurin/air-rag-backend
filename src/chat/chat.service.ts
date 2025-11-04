import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { AiService } from './ai.service';
import { EmbeddingService } from '../documents/embedding.service';
import { PineconeService } from '../documents/pinecone.service';
import { PineconeAssistantService } from '../documents/pinecone-assistant.service';
import { GeminiService } from '../documents/gemini.service';
import { CreateMessageDto } from '../dto/create-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private aiService: AiService,
    private embeddingService: EmbeddingService,
    private pineconeService: PineconeService,
    private pineconeAssistantService: PineconeAssistantService,
    private geminiService: GeminiService,
  ) {}

  async createChat(userId: string, title?: string): Promise<Chat> {
    const chat = this.chatRepository.create({
      userId,
      title: title || 'New Chat', // Will be replaced by AI-generated title on first message
    });
    return this.chatRepository.save(chat);
  }

  async getChats(userId: string): Promise<Chat[]> {
    return this.chatRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async getChat(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  async updateChatTitle(
    chatId: string,
    userId: string,
    title: string,
  ): Promise<Chat> {
    const chat = await this.getChat(chatId, userId);
    chat.title = title;
    return this.chatRepository.save(chat);
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    const chat = await this.getChat(chatId, userId);
    await this.chatRepository.remove(chat);
  }

  async sendMessage(
    chatId: string,
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<{ userMessage: Message; aiMessage: any }> {
    const { content, chatMode, formatResponse, modelId, indexName } = createMessageDto;
    
    // Verify chat belongs to user
    const chat = await this.getChat(chatId, userId);

    // Save user message first
    const userMessage = this.messageRepository.create({
      chatId,
      content,
      role: 'user',
      chatMode,
    });
    await this.messageRepository.save(userMessage);

    // Check if this was the first message in the chat (after saving)
    const totalMessages = await this.messageRepository.count({
      where: { chatId },
    });

    // Generate chat title if this was the first message and title is default
    if (totalMessages === 1 && (chat.title === 'New Chat' || !chat.title)) {
      try {
        const generatedTitle = await this.geminiService.generateChatTitle(content);
        // Update only the title without loading relations to avoid cascade updates
        await this.chatRepository.update(
          { id: chatId },
          { title: generatedTitle }
        );
        console.log(`Generated chat title: "${generatedTitle}"`);
      } catch (error) {
        console.error('Error generating chat title:', error);
        // Continue without updating title
      }
    }

    let aiMessage: any;

    if (chatMode === 'search') {
      // RAG Search mode - use specified index
      const indexToUse = indexName || 'air-multy'; // Default to current index if not specified
      
      // Perform RAG search using the specified index
      const relevantChunks = await this.pineconeService.queryVectors(content, indexToUse);
      
      let formattedResponse: string | null = null;
      let defaultMessage: string | null = null;
      
      // If formatResponse is true, use Gemini to format the results
      if (formatResponse) {
        try {
          formattedResponse = await this.geminiService.formatSearchResults(
            content,
            relevantChunks
          );
        } catch (error) {
          console.error('Error formatting search results with Gemini:', error);
          // Continue without formatting if Gemini fails
        }
      } else {
        // Default messages when formatResponse is false
        if (relevantChunks.length === 0) {
          defaultMessage = 'Результаты не найдены на основании представленных в базе документов.';
        } else {
          defaultMessage = 'Вот найденные результаты:';
        }
      }
      
      // Save AI message for search mode
      const messageContent = formattedResponse || defaultMessage || JSON.stringify(relevantChunks);
      const aiMessageEntity = this.messageRepository.create({
        chatId,
        content: messageContent,
        role: 'assistant',
        chatMode,
        metadata: {
          indexUsed: typeof indexToUse === 'string' ? indexToUse : 'air-multy',
          formatResponse: formatResponse || false,
          resultsCount: relevantChunks.length,
          formatted: !!formattedResponse,
          hasDefaultMessage: !!defaultMessage,
          results: relevantChunks // Store results in metadata for default messages
        }
      });
      await this.messageRepository.save(aiMessageEntity);

      aiMessage = {
        id: aiMessageEntity.id,
        chatId: aiMessageEntity.chatId,
        content: aiMessageEntity.content,
        role: aiMessageEntity.role,
        createdAt: aiMessageEntity.createdAt,
        documentReferences: aiMessageEntity.documentReferences,
        mode: 'search',
        results: relevantChunks,
        formattedResponse: formattedResponse,
        defaultMessage: defaultMessage,
        indexUsed: typeof indexToUse === 'string' ? indexToUse : 'air-multy',
        formatResponse: formatResponse || false
      };
    } else if (chatMode === 'assistant') {
      // Assistant mode - use Pinecone Assistant with specified model
      console.log(`Assistant mode - modelId:`, modelId, `(type: ${typeof modelId})`);
      const modelToUse = modelId || 'gpt-4o'; // Default model if not specified
      
      // Get chat history for context (last 2 messages as requested)
      const messages = await this.messageRepository.find({
        where: { chatId },
        order: { createdAt: 'DESC' },
        take: 3, // Last 4 messages
      });

      // Use Pinecone Assistant for response generation
      const pineconeResponse = await this.pineconeAssistantService.chatWithAssistant(
        messages,
        modelToUse,
        formatResponse || false
      );

      // Extract the response content
      const responseContent = pineconeResponse.message?.content || 'No response received';

      // Save AI message
      const aiMessageEntity = this.messageRepository.create({
        chatId,
        content: responseContent,
        role: 'assistant',
        chatMode,
        metadata: {
          modelUsed: modelToUse,
          formatResponse: formatResponse || false,
          pineconeResponse: {
            id: pineconeResponse.id,
            finishReason: pineconeResponse.finish_reason,
            usage: pineconeResponse.usage,
            citations: pineconeResponse.citations
          }
        }
      });
      await this.messageRepository.save(aiMessageEntity);

      aiMessage = {
        id: aiMessageEntity.id,
        chatId: aiMessageEntity.chatId,
        content: aiMessageEntity.content,
        role: aiMessageEntity.role,
        createdAt: aiMessageEntity.createdAt,
        documentReferences: aiMessageEntity.documentReferences,
        mode: 'assistant',
        response: responseContent,
        modelUsed: modelToUse,
        formatResponse: formatResponse || false,
        pineconeResponse: {
          id: pineconeResponse.id,
          finishReason: pineconeResponse.finish_reason,
          usage: pineconeResponse.usage,
          citations: pineconeResponse.citations
        },
        pineconeResponseFull: pineconeResponse,
      };
    }

    // Create clean return objects to avoid any reference issues
    const cleanUserMessage: any = {
      id: userMessage.id,
      chatId: userMessage.chatId,
      content: userMessage.content,
      role: userMessage.role,
      createdAt: userMessage.createdAt,
      documentReferences: userMessage.documentReferences,
    };

    return { userMessage: cleanUserMessage, aiMessage };
  }

  async getMessages(chatId: string, userId: string): Promise<any[]> {
    // Verify chat belongs to user
    await this.getChat(chatId, userId);

    const messages = await this.messageRepository.find({
      where: { chatId },
      order: { createdAt: 'ASC' },
    });

    // Format messages based on their mode
    return messages.map(message => this.formatMessage(message));
  }

  private formatMessage(message: Message): any {
    const baseMessage = {
      id: message.id,
      chatId: message.chatId,
      content: message.content,
      role: message.role,
      createdAt: message.createdAt,
      documentReferences: message.documentReferences,
    };

    // If it's a user message, return as is
    if (message.role === 'user') {
      return baseMessage;
    }

    // Format assistant messages based on mode
    if (message.chatMode === 'assistant' && message.metadata) {
      return {
        ...baseMessage,
        mode: 'assistant',
        response: message.content,
        modelUsed: message.metadata.modelUsed,
        formatResponse: message.metadata.formatResponse,
        pineconeResponse: message.metadata.pineconeResponse,
      };
    } else if (message.chatMode === 'search' && message.metadata) {
      // Check if it's a formatted response or default message
      if (message.metadata.formatted) {
        // Formatted response from Gemini
        let results = [];
        try {
          // Get results from metadata
          results = message.metadata.results || [];
        } catch (e) {
          results = [];
        }

        return {
          ...baseMessage,
          mode: 'search',
          formattedResponse: message.content,
          results: results, // Include original search results
          indexUsed: typeof message.metadata.indexUsed === 'string' ? message.metadata.indexUsed : 'air-multy',
          formatResponse: true,
        };
      } else if (message.metadata.hasDefaultMessage) {
        // Default message (no formatting)
        let results = [];
        try {
          // Try to parse results from metadata or reconstruct
          results = message.metadata.results || [];
        } catch (e) {
          results = [];
        }

        return {
          ...baseMessage,
          mode: 'search',
          defaultMessage: message.content,
          results: results,
          indexUsed: typeof message.metadata.indexUsed === 'string' ? message.metadata.indexUsed : 'air-multy',
          formatResponse: false,
        };
      } else {
        // Legacy: raw JSON results
        let results = [];
        try {
          results = JSON.parse(message.content);
        } catch (e) {
          results = [];
        }

        return {
          ...baseMessage,
          mode: 'search',
          results: results,
          indexUsed: typeof message.metadata.indexUsed === 'string' ? message.metadata.indexUsed : 'air-multy',
          formatResponse: false,
        };
      }
    }

    // Default return for messages without mode
    return baseMessage;
  }
}
