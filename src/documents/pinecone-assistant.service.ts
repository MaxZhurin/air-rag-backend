import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { Message } from '../entities/message.entity';

interface PineconeAssistantResponse {
  finish_reason?: string;
  message?: {
    role: string;
    content: string;
  };
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: Array<{
    position: number;
    references: Array<{
      file: {
        status: string;
        id: string;
        name: string;
        size: number;
        metadata?: any;
        updated_on: string;
        created_on: string;
        percent_done: number;
        signed_url: string;
        error_message: string | null;
      };
      pages: number[];
      highlight: string | null;
    }>;
  }>;
}

@Injectable()
export class PineconeAssistantService {
  private pc: Pinecone;
  private assistantName: string;

  constructor(private configService: ConfigService) {
    // Initialize Pinecone client
    const apiKey = this.configService.get<string>('PINECONE_API_KEY');
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is required in environment variables');
    }
    
    this.pc = new Pinecone({
      apiKey,
    });
    
    // Set assistant name from environment variable
    this.assistantName = this.configService.get<string>('PINECONE_ASSISTANT_NAME', 'rag-air-assistant');
  }

  async chatWithAssistant(
    messages: Message[],
    model: string,
    jsonResponse: boolean = false,
  ): Promise<PineconeAssistantResponse> {
    try {
      const assistant = this.pc.Assistant(this.assistantName);
      
      // Prepare messages for Pinecone Assistant
      // Send last 2 messages for context (as requested)
      const contextMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })).reverse();
      console.log('contextMessages+++++++++++++++', contextMessages);
      const chatOptions: any = {
        messages: contextMessages,
        model: model,
      };

      // Add json_response if requested
      // if (jsonResponse) {
      //   chatOptions.json_response = true;
      // }

      const response = await assistant.chat(chatOptions);
      // return {};
      return response as unknown as PineconeAssistantResponse;
    } catch (error) {
      console.error('Error chatting with Pinecone Assistant:', error);
      throw error;
    }
  }

  async getAssistantInfo(): Promise<any> {
    try {
      // For now, return basic assistant info
      // The actual API might be different
      return {
        name: this.assistantName,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting assistant info:', error);
      throw error;
    }
  }

  async listAssistants(): Promise<any> {
    try {
      // For now, return a list with the current assistant
      // The actual API might be different
      return {
        assistants: [
          {
            name: this.assistantName,
            status: 'active',
            created_at: new Date().toISOString()
          }
        ]
      };
    } catch (error) {
      console.error('Error listing assistants:', error);
      throw error;
    }
  }

  async uploadFile(filePath: string, metadata?: any): Promise<any> {
    try {
      const assistant = this.pc.Assistant(this.assistantName);
      
      const uploadOptions: any = {
        path: filePath,
      };

      if (metadata) {
        uploadOptions.metadata = metadata;
      }

      const response = await assistant.uploadFile(uploadOptions);
      
      return response;
    } catch (error) {
      console.error('Error uploading file to Pinecone Assistant:', error);
      throw error;
    }
  }

  async listFiles(): Promise<any> {
    try {
      const assistant = this.pc.Assistant(this.assistantName);
      const files = await assistant.listFiles();
      
      return files;
    } catch (error) {
      console.error('Error listing files from Pinecone Assistant:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const assistant = this.pc.Assistant(this.assistantName);
      await assistant.deleteFile(fileId);
    } catch (error) {
      console.error('Error deleting file from Pinecone Assistant:', error);
      throw error;
    }
  }

  async getFile(fileId: string): Promise<any> {
    try {
      const assistant = this.pc.Assistant(this.assistantName);
      const file = await assistant.describeFile(fileId);
      
      return file;
    } catch (error) {
      console.error('Error getting file from Pinecone Assistant:', error);
      throw error;
    }
  }
}
