# Bez-Zapreta

Socks5 прокси сервер, который определяем находится ли ресурс под запретом и только в этом случае использует обходные пути.
В случае если ресурс не заблокирован, трафик на него пойдет напрямую. Заходи одновременно на твиттер и госуслугами без ручного 
переключения проксей/vpn. Скрипт по умолчанию использует список заблокированных ресурсов с сайта [antifilter.download](https://antifilter.download/). 
При желании можно использовать любой другой список.

## Установка и запуск

Установи:

```sh
npm i -g bez-zapreta
```

Положи в домашнюю директорию файл `.bez-zapreta.js` с настройками обхода блокировки (примеры настроек см. ниже) и запускай программу:

```sh
bez-zapreta
```

## Примеры настроек

Для работы программы необходимо задать способ обход блокировки. Доступные способы: `socks5`; `ssh`;

### Через Socks5

```javascript
module.exports = {
  port: 1080, // Порт на котором будет висеть основной socks5 сервер, который ты будешь использовать в браузере
  method: 'socks5',
  socks5: {
    host: 'mysocks.com',
    port: 1080,
  },
};
```

### Через SSH 

```javascript
const os = require('os');
const path = require('path');
const fs = require('fs');

module.exports = {
  port: 1080,
  method: 'ssh',
  socks5: {
    host: 'myssh.com',
    port: 22,

    username: 'root',
    password: 'password_here',

    // privateKey: fs.readFileSync(path.resolve(os.homedir(), ".ssh", "id_rsa")),
    // passphrase: "passphrase_of_key_here",

    // ... полный список доступных настроек ssh-соединения смотри тут:
    // https://github.com/mscdex/ssh2#client-methods (настройки `connect`)
  },
};
```

### Использование в паре с Tor

Tor клиент умеет поднимать socks5 сервер. Используй его в настройках.

### Использование в паре с PPTP/L2TP и другими VPN-ами

Ничего не выйдет. Используй другие способы.
