import { IsNotEmpty, IsString } from "class-validator";

export class CreateINSAPI {

    @IsString()
    @IsNotEmpty()
    name: string;
  }
  