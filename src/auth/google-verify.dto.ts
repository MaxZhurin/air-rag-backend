import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleVerifyDto {
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
