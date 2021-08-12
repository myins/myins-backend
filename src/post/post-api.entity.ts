import { ArrayNotEmpty, IsNumber, Max, Min } from "class-validator";

export class CreatePostAPI {
  
  content: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  totalMediaContent: number;

  @ArrayNotEmpty()
  ins: string[];
}
