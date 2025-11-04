import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['assistant', 'search'])
  chatMode: 'assistant' | 'search';

  @IsOptional()
  @IsBoolean()
  formatResponse?: boolean;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  indexName?: string;
}


