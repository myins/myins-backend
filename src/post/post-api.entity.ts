import { ArrayNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

export class CreatePostAPI {

  content: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;

  @ArrayNotEmpty()
  ins: string[];
}

export class AttachMediaAPI {

  @IsString()
  postID: string;

  //@IsBoolean()
  setCover: string

  //@IsNumber({ maxDecimalPlaces: 0 })
  width: string;

  //@IsNumber({ maxDecimalPlaces: 0 })
  height: string;

  @IsString()
  claimToken: string;
}

export class AttachCoverAPI {
  @IsString()
  claimToken: string;
  
}