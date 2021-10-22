import {
  IsBoolean,
  IsNotEmpty,
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
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsPhoneNumber()
  @IsNotEmpty()
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
