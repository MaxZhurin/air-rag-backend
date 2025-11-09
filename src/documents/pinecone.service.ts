import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';

type Hit = {
  _id: string;
  _score: number;
  fields: {
    category?: string;
    text?: string;
    metadata?: any;
  };
};

interface VectorMetadata {
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  fileName: string;
}

interface VectorData {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

@Injectable()
export class PineconeService implements OnModuleInit {
  private pc: Pinecone;
  private index: any;
  private namespace: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Initialize Pinecone client
    const apiKey = this.configService.get<string>('PINECONE_API_KEY');
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is required in environment variables');
    }
    
    this.pc = new Pinecone({
      apiKey,
    });

    // Get the index configuration from environment variables
    const defaultIndexName = this.configService.get<string>('PINECONE_INDEX_NAME', 'air-multy');
    const defaultIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL');
    
    if (!defaultIndexUrl) {
      throw new Error('PINECONE_INDEX_URL is required in environment variables');
    }

    this.index = this.pc.index(defaultIndexName);
    this.namespace = this.pc
      .index(defaultIndexName, defaultIndexUrl)
      .namespace('default');
  }

  async upsertVector(vector): Promise<string[]> {
    try {
      console.log('vector+++++++++++, vector', vector);
      
      // Extract chunk IDs from vector array
      const chunkIds: string[] = Array.isArray(vector) 
        ? vector.map(v => v.id).filter(Boolean)
        : vector?.id ? [vector.id] : [];
      
      // Get index configurations from environment variables
      const defaultIndexName = this.configService.get<string>('PINECONE_INDEX_NAME', 'air-multy');
      const defaultIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL');
      const airIndexName = this.configService.get<string>('PINECONE_INDEX_NAME_AIR', 'air');
      const airIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL_AIR');
      
      const indexes: Record<string, { name: string; url: string }> = {};
      
      // Add default index
      if (defaultIndexUrl) {
        indexes[defaultIndexName] = {
          name: defaultIndexName,
          url: defaultIndexUrl,
        };
      }
      
      // Add air index if configured
      if (airIndexUrl) {
        indexes[airIndexName] = {
          name: airIndexName,
          url: airIndexUrl,
        };
      }

      if (Object.keys(indexes).length === 0) {
        throw new Error('At least one Pinecone index URL must be configured');
      }

      for (const index in indexes) {
        const namespace = this.pc
          .index(indexes[index].name, indexes[index].url)
          .namespace('default');
        await namespace.upsertRecords(vector);
      }

      // Return chunk IDs for saving to database
      return chunkIds;
    } catch (error) {
      console.error('Error upserting vector:', error);
      throw error;
    }
  }

  async deleteVector(id: string): Promise<void> {
    try {
      // Get index configurations from environment variables
      const defaultIndexName = this.configService.get<string>('PINECONE_INDEX_NAME', 'air-multy');
      const defaultIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL');
      const airIndexName = this.configService.get<string>('PINECONE_INDEX_NAME_AIR', 'air');
      const airIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL_AIR');
      
      const indexes: Record<string, { name: string; url: string }> = {};
      
      // Add default index
      if (defaultIndexUrl) {
        indexes[defaultIndexName] = {
          name: defaultIndexName,
          url: defaultIndexUrl,
        };
      }
      
      // Add air index if configured
      if (airIndexUrl) {
        indexes[airIndexName] = {
          name: airIndexName,
          url: airIndexUrl,
        };
      }

      // Delete from all configured indexes
      for (const index in indexes) {
        const namespace = this.pc
          .index(indexes[index].name, indexes[index].url)
          .namespace('default');
        await namespace.deleteOne(id);
      }
    } catch (error) {
      console.error('Error deleting vector:', error);
      throw error;
    }
  }

  async queryVectors(text: string, indexName: string): Promise<Array<Hit>> {
    try {
      // Get index configurations from environment variables
      const defaultIndexName = this.configService.get<string>('PINECONE_INDEX_NAME', 'air-multy');
      const defaultIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL');
      const airIndexName = this.configService.get<string>('PINECONE_INDEX_NAME_AIR', 'air');
      const airIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL_AIR');
      
      const indexes: Record<string, { name: string; url: string }> = {};
      
      // Add default index
      if (defaultIndexUrl) {
        indexes[defaultIndexName] = {
          name: defaultIndexName,
          url: defaultIndexUrl,
        };
      }
      
      // Add air index if configured
      if (airIndexUrl) {
        indexes[airIndexName] = {
          name: airIndexName,
          url: airIndexUrl,
        };
      }

      // Validate indexName and provide fallback
      console.log(`PineconeService.queryVectors - indexName: ${indexName} (type: ${typeof indexName})`);
      
      // Ensure indexName is a valid string
      const validIndexName = typeof indexName === 'string' ? indexName : defaultIndexName;
      const selectedIndex = indexes[validIndexName] || indexes[defaultIndexName];
      
      if (!selectedIndex) {
        throw new Error(`Index configuration not found for: ${validIndexName}`);
      }
      
      console.log(`Using index: ${selectedIndex.name} (requested: ${indexName})`);

      const namespace = this.pc.index(selectedIndex.name, selectedIndex.url).namespace('default');
      const results = await namespace.searchRecords({
        query: { topK: 3, inputs: { text } },
      });

      // Parse metadata from JSON string in category field
      const hitsWithParsedMetadata = results.result.hits.map((hit: any) => {
        try {
          // Try to parse category as JSON metadata
          const categoryValue = hit.fields.category || hit.fields.text || '';
          const parsedMetadata = JSON.parse(categoryValue);
          return {
            ...hit,
            fields: {
              ...hit.fields,
              metadata: parsedMetadata, // Add parsed metadata
              category: categoryValue, // Keep original for compatibility
              text: hit.fields.text || categoryValue, // Ensure text field exists
            },
          };
        } catch (e) {
          // If parsing fails, treat category as simple string (backward compatibility)
          const categoryValue = hit.fields.category || hit.fields.text || '';
          return {
            ...hit,
            fields: {
              ...hit.fields,
              metadata: {
                documentId: categoryValue,
              },
              category: categoryValue,
              text: hit.fields.text || categoryValue, // Ensure text field exists
            },
          };
        }
      });

      return hitsWithParsedMetadata;
    } catch (error) {
      console.error('Error querying vectors:', error);
      throw error;
    }
  }

  async upsertMultipleVectors(vectors: VectorData[]): Promise<void> {
    try {
      const records = vectors.map((vector) => ({
        id: vector.id,
        values: vector.values,
        metadata: {
          documentId: vector.metadata.documentId,
          userId: vector.metadata.userId,
          chunkIndex: vector.metadata.chunkIndex,
          content: vector.metadata.content,
          fileName: vector.metadata.fileName,
        },
      }));

      await this.index.upsert(records);
    } catch (error) {
      console.error('Error upserting multiple vectors:', error);
      throw error;
    }
  }

  async generateEmbedding(): Promise<number[]> {
    // This method delegates to the EmbeddingService
    // The actual embedding generation is handled by EmbeddingService
    throw new Error(
      'Use EmbeddingService.generateEmbedding() instead of this method.',
    );
  }

  // Additional methods based on the official API
  async describeIndexStats(): Promise<any> {
    try {
      return await this.index.describeIndexStats();
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw error;
    }
  }

  async fetchVectors(ids: string[]): Promise<any> {
    try {
      return await this.index.fetch(ids);
    } catch (error) {
      console.error('Error fetching vectors:', error);
      throw error;
    }
  }

  async deleteVectors(ids: string[]): Promise<void> {
    try {
      if (!ids || ids.length === 0) {
        return;
      }

      // Get index configurations from environment variables
      const defaultIndexName = this.configService.get<string>('PINECONE_INDEX_NAME', 'air-multy');
      const defaultIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL');
      const airIndexName = this.configService.get<string>('PINECONE_INDEX_NAME_AIR', 'air');
      const airIndexUrl = this.configService.get<string>('PINECONE_INDEX_URL_AIR');
      
      const indexes: Record<string, { name: string; url: string }> = {};
      
      // Add default index
      if (defaultIndexUrl) {
        indexes[defaultIndexName] = {
          name: defaultIndexName,
          url: defaultIndexUrl,
        };
      }
      
      // Add air index if configured
      if (airIndexUrl) {
        indexes[airIndexName] = {
          name: airIndexName,
          url: airIndexUrl,
        };
      }

      // Delete from all configured indexes
      for (const index in indexes) {
        const namespace = this.pc
          .index(indexes[index].name, indexes[index].url)
          .namespace('default');
        await namespace.deleteMany(ids);
      }
    } catch (error) {
      console.error('Error deleting vectors:', error);
      throw error;
    }
  }

  async updateVector(
    id: string,
    values: number[],
    metadata: VectorMetadata,
  ): Promise<void> {
    try {
      await this.index.update({
        id,
        values,
        metadata,
      });
    } catch (error) {
      console.error('Error updating vector:', error);
      throw error;
    }
  }

  async listIndexes(): Promise<any> {
    try {
      return await this.pc.listIndexes();
    } catch (error) {
      console.error('Error listing indexes:', error);
      throw error;
    }
  }
}
