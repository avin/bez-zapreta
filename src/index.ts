/* eslint-disable */
// @ts-nocheck

import type { Optional } from './types';
import { ConnectConfig } from 'ssh2';
// import * as net from 'net';
// import { SocketHandler } from './socks5/socket-handler';
import { getIpBlocks, getIpsListFromUrl, isIpInBlocks } from './ips';
import { Netmask } from 'netmask';
// import { SocksClient } from 'socks';
import * as socks from 'socksv5';
import { Client as SshClient } from 'ssh2';
// import { AddressInfo } from 'net';
// import createTunnel from './ssh-tunnel';
import util from 'util';
import dns from 'dns';

export type BezZapretaOptions = {
  port: number;
  ipsUrl: string;
  method: 'socks5' | 'ssh';
  ssh: ConnectConfig;
  socks5: {
    host: string;
    port: number;
  };
};

class BezZapreta {
  private options!: BezZapretaOptions;
  private ipBlocks!: Netmask[];

  constructor(options: Optional<BezZapretaOptions, 'port' | 'ipsUrl'>) {
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

    socks
      .createServer(async (info, accept, deny) => {
        const dstAddrIp = (await util.promisify(dns.resolve4)(info.dstAddr))[0];

        if (this.isIpBanned(dstAddrIp)) {
          if (this.options.method === 'ssh') {
            const conn = new SshClient();
            conn
              .on('ready', () => {
                console.log(info);
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
            process.nextTick(function() {
              clientSocket.pause()
            });

            var client = socks.connect({
              host: info.dstAddr,
              port: info.dstPort,
              proxyHost: this.options.socks5.host,
              proxyPort: this.options.socks5.port,
              auths: [ socks.auth.None() ]
            }, function(socket) {
              console.log('>> Connection successful');
              clientSocket.pipe(socket)
              socket.pipe(clientSocket);
              clientSocket.resume();
            });

          } else {
            deny();
          }
        } else {
          accept();
        }
      })
      .listen(this.options.port, 'localhost', () => {
        console.info('Server started on port: ', this.options.port);
      })
      .useAuth(socks.auth.None());
  }

  // async start() {
  //   await this.prepareIpBlocks();
  //
  //   // this.createSshSocksServer();
  //
  //   const server = net.createServer((socket) => {
  //     void new SocketHandler(socket, {
  //       userPassAuthFn: (username, password) => {
  //         return true;
  //       },
  //       createConnectionSocket: async (dstHost, dstPort) => {
  //         return await (async () => {
  //           if (this.isIpBanned(dstHost)) {
  //
  //             return new Promise((resolve, reject) => {
  //               const conn = new SshClient();
  //               conn
  //                 .on('ready', () => {
  //                   conn.forwardOut(
  //                     info.srcAddr,
  //                     info.srcPort,
  //                     info.dstAddr,
  //                     info.dstPort,
  //                     (err, stream) => {
  //                       console.log('++++', stream);
  //                       // if (err) {
  //                       //   conn.end();
  //                       //   return deny();
  //                       // }
  //                       //
  //                       // const clientSocket = accept(true);
  //                       // if (clientSocket) {
  //                       //   stream
  //                       //     .pipe(clientSocket)
  //                       //     .pipe(stream)
  //                       //     .on('close', () => {
  //                       //       conn.end();
  //                       //     });
  //                       // } else {
  //                       //   conn.end();
  //                       // }
  //                     },
  //                   );
  //                 })
  //                 .on('error', (err) => {
  //                   // deny();
  //                 })
  //                 .connect(this.options.ssh);
  //             })
  //
  //
  //
  //             // const info = await SocksClient.createConnection({
  //             //   proxy: {
  //             //     host: this.options.socks5.host,
  //             //     port: this.options.socks5.port,
  //             //     type: 5,
  //             //   },
  //             //   command: 'connect',
  //             //   destination: {
  //             //     host: dstHost,
  //             //     port: dstPort,
  //             //   },
  //             // });
  //             // return info.socket;
  //           } else {
  //             return await new Promise((resolve) => {
  //               const socket = net.createConnection(dstPort, dstHost);
  //               socket.once('connect', () => {
  //                 resolve(socket);
  //               });
  //             });
  //           }
  //         })();
  //       },
  //     }).handle();
  //   });
  //   server.listen(this.options.port);
  //   console.info('Server started on port: ', this.options.port);
  // }
}

export default BezZapreta;
