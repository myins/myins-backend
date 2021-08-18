import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class RefreshTokenBodyAPI {
  @IsNotEmpty()
  refreshToken: string;

  @IsNotEmpty()
  userID: string;
}

export class PhoneBodyAPI {
  @IsPhoneNumber()
  phone: string;
}

export class ResetPasswordAPI {

  @IsNotEmpty()
  resetToken: string;
  
  @IsNotEmpty()
  newPassword: string;
  
  @IsNotEmpty()
  phone: string
}

export class CodePhoneAPI {

  @IsNotEmpty()
  code: string;

  @IsNotEmpty()
  phone: string;
}