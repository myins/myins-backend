import { ArrayNotEmpty, IsBoolean } from 'class-validator';

export class CreateStoryAPI {
  @ArrayNotEmpty()
  ins: string[];

  @IsBoolean()
  isHighlight: boolean;
}
