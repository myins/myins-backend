import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AttachMediaAPI {
  @IsString()
  @IsOptional()
  entityID: string;

  @IsString()
  @IsOptional()
  isStoryEntity: string;

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
