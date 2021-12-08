import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AttachMediaAPI {
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
  postID: string;

  @IsString()
  @IsNotEmpty()
  claimToken: string;

  @IsString()
  @IsOptional()
  setCover: string;
}
