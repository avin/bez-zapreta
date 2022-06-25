#!/usr/bin/env node

import yargs from 'yargs/yargs';
import BezZapreta, { BezZapretaOptions } from './index';
import path from 'path';
import os from 'os';

const validateConfig = (config: Record<string, unknown>) => {
  if (!['socks5', 'ssh'].includes(config.method as string)) {
    throw new Error('Method not supported');
  }

  if (config.method === 'socks5') {
    if (typeof config.socks5 !== 'object') {
      throw new Error('No socks5 options');
    }
  }

  if (config.method === 'ssh') {
    if (typeof config.ssh !== 'object') {
      throw new Error('No ssh options');
    }
  }
};



void (async () => {
  const argv = await yargs(process.argv.slice(2)).options({
    config: { type: 'string', alias: 'c', default: path.resolve(os.homedir(), '.bez-zapreta.js') },
  }).argv;

  const config = require(path.resolve(argv.config)) as BezZapretaOptions;
  validateConfig(config);

  const server = new BezZapreta(config);
  void server.start();
})();
