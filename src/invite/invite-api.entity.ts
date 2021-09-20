import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsPhoneNumber,
} from 'class-validator';

export class InviteUserToINSAPI {
  @IsNotEmpty()
  ins: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  userIDs: string[];
}

export class InviteExternalUserToINSAPI {
  @IsNotEmpty()
  ins: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsPhoneNumber(undefined, {each: true})
  phoneNumbers: string[];
}
