import { IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateGuestPostAPI {
  content: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  totalMediaContent: number;
}

export class ClaimINSAPI {
  @IsString()
  claimToken: string;
}
