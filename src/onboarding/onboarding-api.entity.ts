import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateGuestPostAPI {
  @IsString()
  @IsOptional()
  content: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;
}

export class ClaimINSAPI {
  @IsString()
  @IsNotEmpty()
  claimToken: string;
}
