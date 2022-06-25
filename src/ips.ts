import * as http from 'http';
import * as https from 'https';
import { Netmask } from 'netmask';

export const getUrlContent = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

export const getIpsListFromUrl = async (url: string): Promise<string[]> => {
  return (await getUrlContent(url)).split(/\r?\n/).filter((i) => !!i);
};

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
