export const isTestNumber = (phone: string) => {
  if (phone.endsWith('1234')) {
    return true;
  }
  return false;
};
