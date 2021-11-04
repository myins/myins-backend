import { NotificationSource } from '.prisma/client';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class CreateUserAPI {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UpdateUserAPI {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  lastName: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  @IsOptional()
  phoneNumber: string;
}

export class UpdatePushTokenAPI {
  @IsString()
  @IsNotEmpty()
  pushToken: string;

  @IsBoolean()
  isSandbox: boolean;
}

export class ApproveDenyUserAPI {
  @IsString()
  @IsNotEmpty()
  userID: string;

  @IsString()
  @IsNotEmpty()
  insID: string;
}

export class SetLastNotificationAPI {
  @IsString()
  @IsNotEmpty()
  notifID: string;
}

export class EnableDisableNotificationAPI {
  @IsArray()
  @IsNotEmpty()
  @IsOptional()
  sources: NotificationSource[];

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  all: boolean;
}

export class EnableDisableByometryAPI {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  insID: string;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  all: boolean;
}
