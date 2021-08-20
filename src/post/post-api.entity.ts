import { ArrayNotEmpty, IsBoolean, IsNumber, Max, Min } from "class-validator";

export class CreatePostAPI {

  content: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  totalMediaContent: number;

  @ArrayNotEmpty()
  ins: string[];
}

export class AttachMediaAPI {

  //@IsBoolean()
  setCover: string

  //@IsNumber({ maxDecimalPlaces: 0 })
  width: string;

  //@IsNumber({ maxDecimalPlaces: 0 })
  height: string;
}