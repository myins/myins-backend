import { IsNumber } from 'class-validator';

export class CreateCommentAPI {
  content: string;

  postID: string;
}

export class PatchCommentAPI {
  content: string;
}

export class SharePostAPI {

  postID: string;

  @IsNumber({}, {each: true})
  targetIDs: string[];
}
