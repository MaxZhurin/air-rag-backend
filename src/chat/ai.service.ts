import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message } from '../entities/message.entity';
import { PineconeService } from '../documents/pinecone.service';

@Injectable()
export class AiService {
  constructor(
    private configService: ConfigService,
    private pineconeService: PineconeService,
  ) {}

  async generateResponse(
    chatHistory: Message[],
    userMessage: string,
    modelId?: string,
    formatResponse?: boolean,
    context?: string,
    relevantChunks?: any[],
  ): Promise<{ response: string; documentReferences?: any[] }> {
    // For now, we'll provide a simple response based on context
    // In a production environment, you might want to integrate with another AI service
    // or implement a custom response generation logic
    
    let response = '';
    
    // Use the specified model for response generation
    const model = modelId || 'gpt-4o';
    
    if (context && context.trim().length > 0) {
      response = `Based on your documents, here's what I found:\n\n${context}\n\n`;
    } else {
      response = 'I found some relevant information in your documents:\n\n';
    }
    
    // Add information from relevant chunks
    if (relevantChunks && relevantChunks.length > 0) {
      response += 'Relevant information:\n';
      relevantChunks.forEach((chunk, index) => {
        response += `${index + 1}. ${chunk.metadata?.content || chunk.chunk_text || 'No content available'}\n`;
      });
    } else {
      response += 'No specific relevant information found in your documents.';
    }

    // Format response if requested
    if (formatResponse) {
      response = `[Model: ${model}] ${response}`;
    }

    // Build document references if relevant chunks are provided
    const documentReferences = relevantChunks ? relevantChunks.map((chunk) => ({
      id: chunk.metadata?.documentId || chunk._id,
      name: chunk.metadata?.fileName || 'Unknown document',
      similarity: chunk.score || 0,
    })) : undefined;

    return { response, documentReferences };
  }

  async generateChatTitle(firstMessage: string): Promise<string> {
    // Simple title generation based on first message
    // Extract first few words or create a generic title
    const words = firstMessage.trim().split(' ').slice(0, 5);
    const title = words.join(' ');
    
    // If the message is too short, add a generic prefix
    if (title.length < 3) {
      return `Chat: ${title}`;
    }
    
    return title;
  }
}


