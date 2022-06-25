import type { Optional } from './types';
import { ConnectConfig } from 'ssh2';
import { getIpBlocks, getIpsListFromUrl, isIpInBlocks } from './ips';
import { Netmask } from 'netmask';
import * as socks from 'socksv5';
import { Client as SshClient } from 'ssh2';
import util from 'util';
import dns from 'dns';

type BaseOptions = {
  host: string;
  port: number;
  username: string;
  password: string;
  ipsUrl: string;
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

  constructor(options: Optional<BezZapretaOptions, 'host' | 'port' | 'ipsUrl'>) {
    this.options = {
      host: '127.0.0.1',
      port: 1080,
      ipsUrl: 'https://antifilter.download/list/allyouneed.lst',
      ...options,
    } as BezZapretaOptions;
  }

  async prepareIpBlocks() {
    const ipsList = await getIpsListFromUrl(this.options.ipsUrl);
    this.ipBlocks = getIpBlocks(ipsList);
  }

  isIpBanned(ip: string) {
    return isIpInBlocks(ip, this.ipBlocks);
  }

  async start() {
    await this.prepareIpBlocks();

    const server = socks.createServer(async (info, accept, deny): Promise<void> => {
      let dstAddrIp: string;

      try {
        dstAddrIp = (await util.promisify(dns.resolve4)(info.dstAddr))[0];
      } catch (e) {
        console.log(e);
        return deny();
      }

      if (this.isIpBanned(dstAddrIp)) {
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
                  }
                },
              );
            })
            .on('error', (err) => {
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
            socks.connect(
              {
                host: info.dstAddr,
                port: info.dstPort,
                proxyHost: this.options.socks5.host,
                proxyPort: this.options.socks5.port,
                auths: [
                  username && password
                    ? socks.auth.UserPassword(username, password)
                    : socks.auth.None(),
                ],
              },
              function (socket) {
                clientSocket.pipe(socket);
                socket.pipe(clientSocket);
                clientSocket.resume();
              },
            );
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
