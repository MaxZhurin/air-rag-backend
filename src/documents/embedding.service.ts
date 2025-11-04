import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  constructor(private configService: ConfigService) {}

  async generateEmbedding(text: string) {
    try {
      // Use a more sophisticated hash-based embedding
      // In production, you should integrate with a proper embedding service
      // like OpenAI's text-embedding-ada-002 or similar

    } catch (error) {
      console.error('Error generating embedding:', error);
      // Fallback to simple embedding if advanced method fails
      // return this.createSimpleEmbedding(text);

    }
  }




  private createSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding as fallback
    const hash = this.simpleHash(text);
    const embedding = new Array(1536).fill(0);
    
    for (let i = 0; i < Math.min(hash.length, 1536); i++) {
      embedding[i] = (hash.charCodeAt(i % hash.length) - 128) / 128;
    }
    
    return embedding;
  }

  private advancedHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }
}


