import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Document } from './document.entity';

@Entity('chunks')
export class Chunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  document: Document;

  @Column()
  documentId: string;

  @Column('text')
  content: string;

  @Column()
  chunkIndex: number;

  @Column()
  pineconeId: string; // ID in Pinecone vector database

  @CreateDateColumn()
  createdAt: Date;
}


