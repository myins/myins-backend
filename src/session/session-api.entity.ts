import { IsOptional, IsString } from 'class-validator';

export class CreateSessionAPI {
  @IsString()
  @IsOptional()
  userID: string;
}
