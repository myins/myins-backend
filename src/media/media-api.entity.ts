import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AttachMediaAPI {
  @ArrayNotEmpty()
  entitiesIDs: string[];

  @IsString()
  @IsOptional()
  isStoryEntity: string;

  @IsString()
  @IsOptional()
  isHighlight: string;

  @IsString()
  @IsNotEmpty()
  width: string;

  @IsString()
  @IsNotEmpty()
  height: string;

  @ArrayMinSize(0)
  @IsOptional()
  stickers: string[];
}

export class AttachMediaWithClaimTokenAPI extends AttachMediaAPI {
  @IsString()
  @IsNotEmpty()
  claimToken: string;

  @IsString()
  @IsOptional()
  setCover: string;
}

export class SetHighlightAPI {
  @IsBoolean()
  @IsNotEmpty()
  isHighlight: boolean;
}

export class DeleteStoryMediasAPI {
  @ArrayNotEmpty()
  storyIDs: string[];
}
