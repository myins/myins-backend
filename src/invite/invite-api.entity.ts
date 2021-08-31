import { IsNotEmpty, IsPhoneNumber } from "class-validator";

export class InviteUserToINSAPI {
    @IsNotEmpty()
    ins: string;

    @IsNotEmpty()
    userID: string;
}

export class InviteExternalUserToINSAPI {
    @IsNotEmpty()
    ins: string;

    @IsPhoneNumber()
    phoneNumber: string;
}

