import { IsNumber, Min } from 'class-validator';

export class CreateCommentAPI {
  content: string;

  @Min(1)
  postID: string;
}

export class PatchCommentAPI {
  content: string;
}

export class SharePostAPI {
  postID: string;

  @IsNumber({}, { each: true })
  targetIDs: string[];
}
