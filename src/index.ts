import type { Optional } from './types';
import { Client as SshClient, ConnectConfig } from 'ssh2';
import { getIpBlocks, isIpInBlocks } from './ips';
import { Netmask } from 'netmask';
import * as socks from 'socksv5';
import util from 'util';
import dns from 'dns';
import { Socket } from 'net';
import { performance } from 'perf_hooks';
import { checkStringInWildcardList } from './utils/checkStringInWildcardList';
import { getListFromUrl } from './utils/getListFromUrl';

type BaseOptions = {
  host: string;
  port: number;
  username: string;
  password: string;
  ipsUrls?: string;
  domainsUrls?: string;
  domains?: string[];
  ips?: string[];
  withSubdomains?: boolean;
};

export type BezZapretaOptions =
  | (BaseOptions & {
      method: 'socks5';
      socks5: {
        host: string;
        port: number;
        username?: string;
        password?: string;
      };
    })
  | (BaseOptions & { method: 'ssh'; ssh: ConnectConfig });

class BezZapreta {
  private options!: BezZapretaOptions;
  private ipBlocks!: Netmask[];
  private domains!: string[];

  constructor(options: Optional<BezZapretaOptions, 'host' | 'port'>) {
    this.options = {
      host: '127.0.0.1',
      port: 1080,
      withSubdomains: true,
      ...options,
    } as BezZapretaOptions;
  }

  async prepareIpBlocks() {
    const ipsList: string[] = [];

    if (this.options.ipsUrls) {
      for (const ipsUrl of this.options.ipsUrls) {
        ipsList.push(...(await getListFromUrl(ipsUrl)));
      }
    }

    if (this.options.ips) {
      ipsList.push(...this.options.ips);
    }

    this.ipBlocks = getIpBlocks(ipsList);
  }

  async prepareDomains() {
    const domains = [];

    if (this.options.domainsUrls) {
      for (const domainsUrl of this.options.domainsUrls) {
        domains.push(...(await getListFromUrl(domainsUrl)));
      }
    }

    if (this.options.domains) {
      domains.push(...this.options.domains);
    }

    this.domains = domains.reduce((acc, domain) => {
      acc.push(domain);
      if (this.options.withSubdomains) {
        acc.push(`*.${domain}`);
      }
      return acc;
    }, [] as string[]);
  }

  async start() {
    await this.prepareIpBlocks();
    await this.prepareDomains();

    const server = socks.createServer(async (info, accept, deny): Promise<void> => {
      let dstAddrIp = '';

      const isAddrInApplyForDomainsList = checkStringInWildcardList(info.dstAddr, this.domains);

      try {
        if (!info.dstAddr.endsWith('.onion') && !isAddrInApplyForDomainsList) {
          dstAddrIp = (await util.promisify(dns.resolve4)(info.dstAddr))[0];
        }
      } catch (e) {
        console.log('NS resolve err:', e);
      }

      const isAddrInIpBlocks = dstAddrIp && isIpInBlocks(dstAddrIp, this.ipBlocks);

      if (!dstAddrIp || isAddrInApplyForDomainsList || isAddrInIpBlocks) {
        const reason = (() => {
          if (isAddrInApplyForDomainsList) {
            return 'domain';
          }
          if (isAddrInIpBlocks) {
            return 'ip';
          }
          return 'ns';
        })();
        console.info(`+ [${reason}]`, info.dstAddr);
        if (this.options.method === 'ssh') {
          const conn = new SshClient();
          conn
            .on('ready', () => {
              conn.forwardOut(
                info.srcAddr,
                info.srcPort,
                info.dstAddr,
                info.dstPort,
                (err, stream) => {
                  if (err) {
                    conn.end();
                    return deny();
                  }

                  const clientSocket = accept(true);
                  if (clientSocket) {
                    stream
                      .pipe(clientSocket)
                      .pipe(stream)
                      .on('close', () => {
                        conn.end();
                      });
                  } else {
                    conn.end();
                    return deny();
                  }
                },
              );
            })
            .on('error', (err) => {
              console.log('Parent SSH err: ', err);
              deny();
            })
            .connect(this.options.ssh);
        } else if (this.options.method === 'socks5') {
          const clientSocket = accept(true);
          if (clientSocket) {
            process.nextTick(function () {
              clientSocket.pause();
            });

            const { username, password } = this.options.socks5;
            socks
              .connect({
                host: info.dstAddr,
                port: info.dstPort,
                proxyHost: this.options.socks5.host,
                proxyPort: this.options.socks5.port,
                localDNS: !!dstAddrIp, // резолвим на родительской стороне если самим не удалось
                auths: [
                  username && password
                    ? socks.auth.UserPassword(username, password)
                    : socks.auth.None(),
                ],
              })
              .on('connect', (parentSocket: Socket) => {
                clientSocket.pipe(parentSocket).on('error', function (e) {
                  console.log('+94', e);
                  process.exit(1);
                });
                parentSocket.pipe(clientSocket).on('error', function (e) {
                  console.log('+95', e);
                  process.exit(1);
                });
                clientSocket.resume();
              })
              .on('error', function (err) {
                console.log('Parent socks5 err: ', err);
                deny();
              });
          }
        } else {
          deny();
        }
      } else {
        accept();
      }
    });

    server.listen(this.options.port, this.options.host, () => {
      console.info('Server started at: ', `${this.options.host}:${this.options.port}`);
    });

    server.on('error', (err) => {
      console.log('Server error: ', err);
    });

    if (this.options.username && this.options.password) {
      server.useAuth(
        socks.auth.UserPassword((user, password, cb) => {
          cb(user === this.options.username && password === this.options.password);
        }),
      );
    } else {
      server.useAuth(socks.auth.None());
    }
  }
}

export default BezZapreta;
