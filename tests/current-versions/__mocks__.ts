import { CurrentVersions, DocumentType } from '.prisma/client';

export const currentVersionsMock: CurrentVersions[] = [
  {
    type: DocumentType.TERMS_AND_CONDITIONS,
    updatedAt: new Date('2021-10-15 15:07:11.819'),
    link: 'link.termAndConditions',
  },
  {
    type: DocumentType.PRIVACY_POLICY,
    updatedAt: new Date('2021-10-20 15:07:11.819'),
    link: 'link.privacyPolicy',
  },
];

export const currentVersionTCMock: CurrentVersions = {
  type: DocumentType.TERMS_AND_CONDITIONS,
  updatedAt: new Date(),
  link: 'link.termAndConditions',
};

export const currentVersionPPMock: CurrentVersions = {
  type: DocumentType.PRIVACY_POLICY,
  updatedAt: new Date(),
  link: 'link.privacyPolicy',
};
