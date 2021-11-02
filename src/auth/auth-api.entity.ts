import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class RefreshTokenBodyAPI {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @IsString()
  @IsNotEmpty()
  userID: string;
}

export class PhoneBodyAPI {
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  @IsOptional()
  newPhone: string;
}

export class ResetPasswordAPI {
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;
}

export class ChangePasswordAPI {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

export class CodePhoneAPI {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  @IsOptional()
  newPhone: string;
}
