import { User } from '.prisma/client';

export const userMock: User = {
  id: 'userMockID',
  phoneNumber: '+40743876226',
  phoneNumberVerified: true,
  password: 'pele',
  firstName: 'Cristi',
  lastName: 'Pele',
  profilePicture: null,
  refreshToken: null,
  pushToken: null,
  sandboxToken: null,
  lastAcceptedTermsAndConditionsVersion: null,
  lastAcceptedPrivacyPolicyVersion: null,
  lastReadNotificationID: null,
  disabledNotifications: [],
  disabledBiometryINSIds: [],
  disabledAllBiometry: false,
};

export const userMockPhoneNumberUnverified: User = {
  ...userMock,
  id: 'userID',
  phoneNumber: '+40743876111',
  phoneNumberVerified: false,
  firstName: 'User',
  lastName: 'Verify',
};

export const userMockPhoneNumberVerified: User = {
  ...userMockPhoneNumberUnverified,
  phoneNumberVerified: true,
};
