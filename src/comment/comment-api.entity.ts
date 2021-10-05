import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentAPI {
  @IsString()
  content: string;

  @IsString()
  @IsNotEmpty()
  postID: string;
}

export class PatchCommentAPI {
  @IsString()
  content: string;
}
