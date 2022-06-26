import { wildcardMatch } from './wildcardMatch';

export const checkStringInWildcardList = (str: string, list?: string[]): boolean => {
  if (!list || !list.length) {
    return false;
  }
  for (const item of list) {
    if (wildcardMatch(str, item)) {
      return true;
    }
  }
  return false;
};
