import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Chunk } from './chunk.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // pdf, docx, txt

  @Column()
  size: number;

  @Column()
  path: string; // Local file path

  @Column({ nullable: true })
  textFilePath: string; // Path to extracted text file (.txt)

  @Column({ nullable: true })
  assistantFileId: string; // Pinecone Assistant file ID

  @Column({
    type: 'enum',
    enum: ['uploading', 'processing', 'ready', 'error'],
    default: 'uploading',
  })
  status: 'uploading' | 'processing' | 'ready' | 'error';

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Chunk, (chunk) => chunk.document)
  chunks: Chunk[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
