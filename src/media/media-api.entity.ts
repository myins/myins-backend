import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AttachMediaAPI {
  @IsString()
  @IsOptional()
  entityID: string;

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
