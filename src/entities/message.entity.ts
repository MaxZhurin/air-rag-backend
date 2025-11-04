import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Chat } from './chat.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: ['user', 'assistant'],
  })
  role: 'user' | 'assistant';

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat: Chat;

  @Column()
  chatId: string;

  @Column({
    type: 'enum',
    enum: ['assistant', 'search'],
    nullable: true,
  })
  chatMode: 'assistant' | 'search';

  // Store references to documents found (JSON array of document IDs)
  @Column('simple-json', { nullable: true })
  documentReferences: { id: string; name: string; similarity: number }[];

  // Store additional metadata (citations, usage, etc.)
  @Column('simple-json', { nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;
}


