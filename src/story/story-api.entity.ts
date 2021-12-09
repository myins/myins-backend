import { ArrayNotEmpty, IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class CreateStoryAPI {
  @ArrayNotEmpty()
  ins: string[];

  @IsBoolean()
  isHighlight: boolean;

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;
}
