import { isProd } from './checks';

export const isTestNumber = (phone: string) => {
  if (!isProd() && phone.endsWith('1234')) {
    return true;
  }
  return false;
};
