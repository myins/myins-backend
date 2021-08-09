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
