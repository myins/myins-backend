import { IsNotEmpty, IsString } from "class-validator";

export class CreateINSAPI {

    @IsString()
    @IsNotEmpty()
    name: string;
}

export class UpdateINSAdminAPI {

    @IsString()
    @IsNotEmpty()
    insID: string;

    @IsString()
    @IsNotEmpty()
    newAdminID: string;
}
  