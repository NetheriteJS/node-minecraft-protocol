const ClientSocket = require('./socket')

class Client extends ClientSocket {
  constructor ({ version, customPackets, hideErrors = false } = {}) {
    super(false, version, customPackets, hideErrors)
  }

  write (packet) { return super.writeRaw(packet) }
  writePacket (...args) { return super.write(...args) }
}

module.exports = Client
