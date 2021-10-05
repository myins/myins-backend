import { DocumentType } from '.prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ChangeCurrentVersionsAPI {
  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType: DocumentType;
}
