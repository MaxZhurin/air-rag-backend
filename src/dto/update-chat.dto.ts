import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateChatDto {
  @IsNotEmpty()
  @IsString()
  title: string;
}


