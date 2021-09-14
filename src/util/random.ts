import * as crypto from 'crypto';

export const randomCode = (length = 2) => {
  return crypto
    .randomBytes(length / 2)
    .toString('hex')
    .toUpperCase();
};
