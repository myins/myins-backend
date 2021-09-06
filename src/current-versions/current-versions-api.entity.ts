import { IsBoolean } from "class-validator";

export class ChangeCurrentVersionsAPI {

    @IsBoolean()
    isTermsAndConditionsVersionChanged: boolean;
    
    @IsBoolean()
    isPrivacyPolicyVersionChanged: boolean;
}
