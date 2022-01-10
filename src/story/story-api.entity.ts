import { ArrayNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class CreateStoryAPI {
  @ArrayNotEmpty()
  ins: string[];

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;
}
