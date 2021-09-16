import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class InviteUserToINSAPI {
  @IsNotEmpty()
  ins: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  userIDs: string[];
}

export class InviteExternalUserToINSAPI {
  @IsNotEmpty()
  ins: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  phoneNumbers: string[];
}
