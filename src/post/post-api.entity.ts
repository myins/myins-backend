import { ArrayNotEmpty } from "class-validator";

export class CreatePostAPI {
  
  content: string;

  @ArrayNotEmpty()
  ins: string[];
}
