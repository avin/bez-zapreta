declare module 'socksv5' {
  import type net from 'net';
  import { Socket } from 'net';

  class Auth {}

  class SocksServer {
    listen: net.Server['listen'];
    useAuth(auth: Auth): void;
    close: net.Server['close'];
  }

  type Info = {
    srcAddr: string;
    srcPort: number;
    dstAddr: string;
    dstPort: number;
  };

  function acceptHandler(intercept: true): net.Socket | undefined;
  function acceptHandler(intercept?: false): undefined;
  export function createServer(
    cb: (info: Info, accept: typeof acceptHandler, deny: () => void) => Promise<void> | void,
  ): SocksServer;
  export function connect(
    ptions: {
      host: string;
      port: number;
      proxyHost: string;
      proxyPort: number;
      auths: Auth[];
    },
    cb: (s: Socket) => void,
  ): SocksServer;

  export const auth: {
    None: () => Auth;
    UserPassword: (login: string, password: string) => Auth;
  };
}
