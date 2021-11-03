import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SearchMessgesAPI {
  @IsString()
  @IsNotEmpty()
  streamChatToken: string;

  @IsString()
  @IsOptional()
  channelId: string;

  @IsArray()
  @IsOptional()
  mediaTypes: string[];

  @IsString()
  @IsOptional()
  autocomplete: string;

  @IsNumber()
  @IsNotEmpty()
  limit: number;

  @IsString()
  @IsOptional()
  next: string;
}
