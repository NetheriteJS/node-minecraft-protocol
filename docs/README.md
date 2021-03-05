# node-minecraft-protocol

[![Issues](https://img.shields.io/github/issues/netheritejs/node-minecraft-protocol?style=flat-square)](https://github.com/netheritejs/node-minecraft-protocol/issues)
![Last commit](https://img.shields.io/github/last-commit/netheritejs/node-minecraft-protocol?style=flat-square)
![Node version](https://img.shields.io/node/v/netheritejs/node-minecraft-protocol?style=flat-square)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat-square)](https://standardjs.com)
![License](https://img.shields.io/github/license/netheritejs/node-minecraft-protocol?style=flat-square)
![NPM](https://img.shields.io/npm/v/netheritejs/node-minecraft-protocol?style=flat-square)

Minecraft Protocol

Parse and serialize minecraft packets, plus authentication and encryption.

## Features

* Supports Minecraft PC versions from 1.7.10 up to 1.16.4
* Parses all packets and emits events with packet fields as JavaScript objects.
* Send a packet by supplying fields as a JavaScript object.
* Client
  - Authenticating and logging in
  - Encryption
  - Compression
  - Both online and offline mode
  - Respond to keep-alive packets.
  - Ping a server for status
* Server
  - Online/Offline mode
  - Encryption
  - Compression
  - Handshake
  - Keep-alive checking
  - Ping status
* Robust test coverage.
* Optimized for rapidly staying up to date with Minecraft protocol updates.
 
Want to contribute on something important for NetheriteJS or PrismarineJS?
Go to https://github.com/prismarinejs/mineflayer/wiki/Big-Prismarine-projects

## Third Party Plugins

node-minecraft-protocol is pluggable.

* [minecraft-protocol-forge](https://github.com/Netheritejs/node-minecraft-protocol-forge) add forge support to minecraft-protocol

## Projects Using node-minecraft-protocol

* [mineflayer](https://github.com/Netheritejs/mineflayer/) - create minecraft bots with a stable, high level API.
* [mcserve](https://github.com/andrewrk/mcserve) - runs and monitors your minecraft server, provides real-time web interface, allow your users to create bots.
* [flying-squid](https://github.com/Netheritejs/flying-squid) create minecraft servers with a high level API, also a minecraft server by itself.
* [pakkit](https://github.com/Heath123/pakkit) To monitor your packets
* [minecraft-packet-debugger](https://github.com/wvffle/minecraft-packet-debugger) to easily debug your minecraft packets

## Usage

### Echo client example

```js
var mc = require('@netheritejs/minecraft-protocol');
var client = mc.createClient({
  host: "localhost",   // optional
  port: 25565,         // optional
  username: "email@example.com",
  password: "12345678",
  auth: 'mojang' // optional; by default uses mojang, if using a microsoft account, set to 'microsoft'
});
client.on('chat', function(packet) {
  // Listen for chat messages and echo them back.
  var jsonMsg = JSON.parse(packet.message);
  if(jsonMsg.translate == 'chat.type.announcement' || jsonMsg.translate == 'chat.type.text') {
    var username = jsonMsg.with[0].text;
    var msg = jsonMsg.with[1];
    if(username === client.username) return;
    client.write('chat', {message: msg.text});
  }
});
```

If the server is in offline mode, you may leave out the `password` option.

### Hello World server example

```js
var mc = require('@netheritejs/minecraft-protocol');
var server = mc.createServer({
  'online-mode': true,   // optional
  encryption: true,      // optional
  host: '0.0.0.0',       // optional
  port: 25565,           // optional
  version: '1.16.3'
});
const mcData = require('minecraft-data')(server.version)

server.on('login', function(client) {
  
  let loginPacket = mcData.loginPacket

  client.write('login', {
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 255,
    worldNames: loginPacket.worldNames,
    dimensionCodec: loginPacket.dimensionCodec,
    dimension: loginPacket.dimension,
    worldName: 'minecraft:overworld',
    hashedSeed: [0, 0],
    maxPlayers: server.maxPlayers,
    viewDistance: 10,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false
  });
  client.write('position', {
    x: 0,
    y: 1.62,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });
  var msg = {
    translate: 'chat.type.announcement',
    "with": [
      'Server',
      'Hello, world!'
    ]
  };
  client.write("chat", { message: JSON.stringify(msg), position: 0, sender: '0' });
});
```

## Installation

`npm install @netheritejs/minecraft-protocol`

## Documentation

See [API documentation](API.md)
See [FAQ](FAQ.md)

## Testing

* Ensure your system has the `java` executable in `PATH`.
* `MC_SERVER_JAR_DIR=some/path/to/store/minecraft/server/ MC_USERNAME=email@example.com MC_PASSWORD=password npm test`

## Debugging

You can enable some protocol debugging output using `DEBUG` environment variable:

```bash
DEBUG="minecraft-protocol" node [...]
```

On windows :
```
set DEBUG=minecraft-protocol
node your_script.js
```

## Contribute

Pull requests are welcome.

Unlike PrismarineJS, you can make backward-incompatible changes.

## History

See [history](HISTORY.md)

## Related

* [node-rcon](https://github.com/pushrax/node-rcon) can be used to access the rcon server in the minecraft server
* [map-colors][aresmapcolor] can be used to convert any image into a buffer of minecraft compatible colors

[aresmapcolor]: https://github.com/AresRPG/aresrpg-map-colors
