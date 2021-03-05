const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const { Transform } = require('stream')

const LEGACY_PING_PACKET_ID = 0xfe

class Splitter extends Transform {
  constructor () {
    super()
    this.buffer = Buffer.allocUnsafe(0)
    this.lastSize = 0
    this.recognizeLegacyPing = false
  }

  _transform (chunk, _, cb) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    if (this.recognizeLegacyPing && this.buffer[0] === LEGACY_PING_PACKET_ID) {
      // legacy_server_list_ping packet follows a different protocol format
      // prefix the encoded varint packet id for the deserializer
      const header = Buffer.alloc(sizeOfVarInt(LEGACY_PING_PACKET_ID))
      writeVarInt(LEGACY_PING_PACKET_ID, header, 0)
      let payload = this.buffer.slice(1) // remove 0xfe packet id
      if (payload.length === 0) payload = Buffer.from('\0') // TODO: update minecraft-data to recognize a lone 0xfe, https://github.com/PrismarineJS/minecraft-data/issues/95
      this.push(Buffer.concat([header, payload]))
      return cb()
    }
    if (this.buffer.length < this.lastSize) return cb()
    let offset = 0
    while (this.buffer.length) {
      try {
        const { value, size } = readVarInt(this.buffer, offset)
        const endValue = value + size
        if ((this.buffer.length - offset) < endValue) {
          this.lastSize = endValue
          break
        }
        if (!this.push(this.buffer(offset + size, offset + endValue))) break
        offset += endValue
      } catch (e) {
        if (e.partialReadError) {
          this.lastSize = this.buffer.length
          break
        } else { throw e }
      }
    }
    this.buffer = this.buffer.slice(offset)
    return cb()
  }
}

class Framer extends Transform {
  _transform (chunk, _, cb) {
    const buffer = Buffer.alloc(sizeOfVarInt(chunk.length) + chunk.length)
    chunk.copy(buffer, writeVarInt(chunk.length, buffer, 0))
    this.push(buffer)
    return cb()
  }
}

function createInput (_ = true) {
  return new Splitter()
}

function createOutput (_ = true) {
  return new Framer()
}

module.exports = { createInput, createOutput }
