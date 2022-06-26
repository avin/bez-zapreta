import { Netmask } from 'netmask';

export const getIpBlocks = (ipsList: string[]): Netmask[] => {
  return ipsList.reduce((acc, mask) => {
    try {
      acc.push(new Netmask(mask));
    } catch (e) {
      console.log('!!! wrong mask:', mask);
    }
    return acc;
  }, [] as Netmask[]);
};

export const isIpInBlocks = (ip: string, ipBlocks: Netmask[]) => {
  return !!ipBlocks.find((block) => block.contains(ip));
};
