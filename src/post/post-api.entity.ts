import { PostCreatedFrom } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

class CreatePostMainAPI {
  @IsString()
  @IsOptional()
  content: string;

  @ArrayNotEmpty()
  ins: string[];
}

export class CreatePostAPI extends CreatePostMainAPI {
  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;

  @IsEnum(PostCreatedFrom)
  @IsNotEmpty()
  @IsOptional()
  from: PostCreatedFrom;
}

export class CreatePostFromLinksAPI extends CreatePostMainAPI {
  @ArrayNotEmpty()
  media: string[];
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
