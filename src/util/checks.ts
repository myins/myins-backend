export const isProd = () => {
  if (process.env.DOCUMENTS_BUCKET?.includes('prod')) {
    return true;
  }
  return false;
};

export const isAdmin = (number: string) => {
  const adminNumbers: string[] = [
    '+447522723741',
    '+447557121310',
    '+40724098717',
    '+447725940430',
  ];
  return adminNumbers.includes(number);
};
