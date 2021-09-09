import { DocumentType } from ".prisma/client";
import { IsEnum } from "class-validator";

export class ChangeCurrentVersionsAPI {

    @IsEnum(DocumentType)
    documentType: DocumentType;
}
