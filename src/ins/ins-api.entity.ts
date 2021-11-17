import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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
  memberID: string;
}

export class MuteINSAPI {
  @IsBoolean()
  @IsNotEmpty()
  isMute: boolean;

  @IsNumber()
  @IsOptional()
  minutes: number;
}
