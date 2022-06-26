export const wildcardMatch = (str: string, pattern: string) => {
  const regex = new RegExp(`^${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}`);
  return regex.test(str);
};
