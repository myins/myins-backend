import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePostAPI {
  @IsString()
  @IsOptional()
  content: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;

  @ArrayNotEmpty()
  ins: string[];
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

export class DeletePostsAPI {
  @ArrayNotEmpty()
  postIDs: string[];
}
