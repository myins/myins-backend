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

export class LeaveINSAPI {
  @IsBoolean()
  @IsNotEmpty()
  keepData: boolean;
}

export class MuteINSAPI {
  @IsBoolean()
  @IsNotEmpty()
  isMute: boolean;

  @IsNumber()
  @IsOptional()
  minutes: number;
}

export class ChangeNameAPI {
  @IsString()
  name: string;
}

export class DeletePostFromINSAPI {
  @IsBoolean()
  @IsNotEmpty()
  isDeleted: boolean;
}
