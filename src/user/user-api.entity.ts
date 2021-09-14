import {
  IsBoolean,
  IsNotEmpty,
  IsPhoneNumber,
  Max,
  Min,
} from 'class-validator';

export class CreateUserAPI {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsPhoneNumber()
  phoneNumber: string;

  @IsNotEmpty()
  password: string;
}

export class UpdateUserAPI {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsPhoneNumber()
  phone: string;

  @IsNotEmpty()
  username: string;

  //@IsNotEmpty() - allow empty description for now
  description: string;
}

export class DeleteUserAPI {
  userID: string;
}

export class UpdatePushTokenAPI {
  @IsNotEmpty()
  pushToken: string;

  @IsBoolean()
  isSandbox: boolean;
}

export class GetUserPostsAPI {
  @Min(0)
  @Max(1000)
  skip: number;

  @Min(0)
  @Max(20)
  take: number;
}
