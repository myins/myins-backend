import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SearchMessgesAPI {
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

  @IsBoolean()
  @IsOptional()
  onlyMine: boolean;
}

export class SendMessageToStoryAPI {
  @IsString()
  @IsNotEmpty()
  mediaID: string;

  @IsString()
  @IsNotEmpty()
  insID: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ClearedHistoryAPI {
  @IsString()
  @IsNotEmpty()
  channelID: string;
}
