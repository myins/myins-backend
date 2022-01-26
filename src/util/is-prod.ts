export const isProd = () => {
  if (process.env.DOCUMENTS_BUCKET?.includes('prod')) {
    return true;
  }
  return false;
};
