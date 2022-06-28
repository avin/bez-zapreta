import { Netmask } from 'netmask';

export const getIpBlocks = (ipsList: string[]): Record<string, Netmask[]> => {
  const resultMap: Record<string, Netmask[]> = {};
  ipsList.forEach((mask) => {

    const maskParts = mask.split('.');
    const key = maskParts[0] + '.' + maskParts[1] + '.';

    resultMap[key] = resultMap[key] || [];

    try {
      resultMap[key].push(new Netmask(mask));
    } catch (e) {
      console.log('!!! wrong mask:', mask);
    }
  });
  return resultMap;
};

export const isIpInBlocks = (ip: string, ipBlocks: Record<string, Netmask[]>) => {
  const ipParts = ip.split('.');
  const key = ipParts[0] + '.' + ipParts[1] + '.';
  return !!ipBlocks[key]?.find((block) => block.contains(ip));
};
