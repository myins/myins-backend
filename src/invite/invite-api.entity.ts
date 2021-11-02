import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class InviteUserToINSAPI {
  @IsString()
  @IsNotEmpty()
  ins: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  userIDs: string[];
}

export class InviteExternalUserToINSAPI {
  @IsString()
  @IsNotEmpty()
  ins: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsPhoneNumber(undefined, { each: true })
  phoneNumbers: string[];
}

export class InviteTestMessageAPI {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
