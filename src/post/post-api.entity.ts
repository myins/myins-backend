import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePostAPI {
  @IsString()
  content: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;

  @ArrayNotEmpty()
  ins: string[];
}

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
  setCover?: string;
}

export class AttachCoverAPI {
  @IsString()
  @IsNotEmpty()
  claimToken: string;
}

export class SharePostAPI {
  @ArrayNotEmpty()
  ins: string[];
}
