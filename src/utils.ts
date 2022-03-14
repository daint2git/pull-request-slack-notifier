export const stringify = (value: Record<string, any>) =>
  JSON.stringify(value, null, 2);

export const isUndefined = (value: any): value is undefined =>
  typeof value === 'undefined';

export const normalizeError = (error: any) => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return stringify(error);
};
