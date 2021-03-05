const NBT = require('prismarine-nbt')
const UUID = require('uuid-1345')
const zlib = require('zlib')

const PartialReadError = require('protodef').utils.PartialReadError

function readUUID (buffer, offset) {
  if (offset + 16 > buffer.length) { throw new PartialReadError() }
  return {
    value: UUID.stringify(buffer.slice(offset, 16 + offset)),
    size: 16
  }
}
function writeUUID (value, buffer, offset) {
  const buf = UUID.parse(value)
  buf.copy(buffer, offset)
  return offset + 16
}
const sizeOfUUID = 16

function readNbt (buffer, offset) {
  return NBT.proto.read(buffer, offset, 'nbt')
}
function writeNbt (value, buffer, offset) {
  return NBT.proto.write(value, buffer, offset, 'nbt')
}
function sizeOfNbt (value) {
  return NBT.proto.sizeOf(value, 'nbt')
}

function readOptionalNbt (buffer, offset) {
  if (offset + 1 > buffer.length) { throw new PartialReadError() }
  if (buffer.readInt8(offset) === 0) return { size: 1 }
  return NBT.proto.read(buffer, offset, 'nbt')
}
function writeOptionalNbt (value, buffer, offset) {
  if (value === undefined) {
    buffer.writeInt8(0, offset)
    return offset + 1
  }
  return NBT.proto.write(value, buffer, offset, 'nbt')
}
function sizeOfOptionalNbt (value) {
  return value !== undefined ? NBT.proto.sizeOf(value, 'nbt') : 1
}

// Length-prefixed compressed NBT, see differences: http://wiki.vg/index.php?title=Slot_Data&diff=6056&oldid=4753
function readCompressedNbt (buffer, offset) {
  if (offset + 2 > buffer.length) { throw new PartialReadError() }
  const length = buffer.readInt16BE(offset)
  if (length === -1) return { size: 2 }
  if (offset + 2 + length > buffer.length) { throw new PartialReadError() }

  const compressedNbt = buffer.slice(offset + 2, offset + 2 + length)

  const nbtBuffer = zlib.gunzipSync(compressedNbt) // TODO: async

  const results = NBT.proto.read(nbtBuffer, 0, 'nbt')
  return {
    size: length + 2,
    value: results.value
  }
}
function writeCompressedNbt (value, buffer, offset) {
  if (value === undefined) {
    buffer.writeInt16BE(-1, offset)
    return offset + 2
  }
  const nbtBuffer = Buffer.alloc(sizeOfNbt(value))
  NBT.proto.write(value, nbtBuffer, 0, 'nbt')

  const compressedNbt = zlib.gzipSync(nbtBuffer) // TODO: async
  compressedNbt.writeUInt8(0, 9) // clear the OS field to match MC

  buffer.writeInt16BE(compressedNbt.length, offset)
  compressedNbt.copy(buffer, offset + 2)
  return offset + 2 + compressedNbt.length
}
function sizeOfCompressedNbt (value) {
  if (value === undefined) { return 2 }

  const nbtBuffer = Buffer.alloc(sizeOfNbt(value, 'nbt'))
  NBT.proto.write(value, nbtBuffer, 0, 'nbt')

  const compressedNbt = zlib.gzipSync(nbtBuffer) // TODO: async

  return 2 + compressedNbt.length
}

function readRestBuffer (buffer, offset) {
  return {
    value: buffer.slice(offset),
    size: buffer.length - offset
  }
}
function writeRestBuffer (value, buffer, offset) {
  value.copy(buffer, offset)
  return offset + value.length
}
function sizeOfRestBuffer (value) {
  return value.length
}

function readEntityMetadata (buffer, offset, { type, endVal }) {
  let cursor = offset
  const metadata = []
  let item
  while (true) {
    if (offset + 1 > buffer.length) { throw new PartialReadError() }
    item = buffer.readUInt8(cursor)
    if (item === endVal) {
      return {
        value: metadata,
        size: cursor + 1 - offset
      }
    }
    const results = this.read(buffer, cursor, type, {})
    metadata.push(results.value)
    cursor += results.size
  }
}
function writeEntityMetadata (value, buffer, offset, { type, endVal }) {
  const self = this
  value.forEach(function (item) {
    offset = self.write(item, buffer, offset, type, {})
  })
  buffer.writeUInt8(endVal, offset)
  return offset + 1
}
function sizeOfEntityMetadata (value, { type }) {
  let size = 1
  for (let i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {})
  }
  return size
}

function readTopBitSetTerminatedArray (buffer, offset, { type }) {
  let cursor = offset
  const values = []
  let item
  while (true) {
    if (offset + 1 > buffer.length) { throw new PartialReadError() }
    item = buffer.readUInt8(cursor)
    buffer[cursor] = buffer[cursor] & 127 // removes top bit
    const results = this.read(buffer, cursor, type, {})
    values.push(results.value)
    cursor += results.size
    if ((item & 128) === 0) { // check if top bit is set, if not last value
      return {
        value: values,
        size: cursor - offset
      }
    }
  }
}
function writeTopBitSetTerminatedArray (value, buffer, offset, { type }) {
  const self = this
  let prevOffset = offset
  value.forEach(function (item, i) {
    prevOffset = offset
    offset = self.write(item, buffer, offset, type, {})
    buffer[prevOffset] = i !== value.length - 1 ? (buffer[prevOffset] | 128) : buffer[prevOffset] // set top bit for all values but last
  })
  return offset
}
function sizeOfTopBitSetTerminatedArray (value, { type }) {
  let size = 0
  for (let i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {})
  }
  return size
}

module.exports = {
  compiler: {
    Read: {
      UUID: ['native', readUUID],
      restBuffer: ['native', readRestBuffer],
      nbt: ['native', readNbt],
      optionalNbt: ['native', readOptionalNbt],
      compressedNbt: ['native', readCompressedNbt],
      entityMetadataLoop: ['parametrizable', (compiler, { type, endVal }) => {
        let code = 'let cursor = offset\n'
        code += 'const data = []\n'
        code += 'while (true) {\n'
        code += `  if (ctx.u8(buffer, cursor).value === ${endVal}) return { value: data, size: cursor + 1 - offset }\n`
        code += '  const elem = ' + compiler.callType(type, 'cursor') + '\n'
        code += '  data.push(elem.value)\n'
        code += '  cursor += elem.size\n'
        code += '}'
        return compiler.wrapCode(code)
      }],
      topBitSetTerminatedArray: ['parametrizable', (compiler, { type, endVal }) => {
        let code = 'let cursor = offset\n'
        code += 'const data = []\n'
        code += 'while (true) {\n'
        code += '  const item = ctx.u8(buffer, cursor).value\n'
        code += '  buffer[cursor] = buffer[cursor] & 127\n'
        code += '  const elem = ' + compiler.callType(type, 'cursor') + '\n'
        code += '  data.push(elem.value)\n'
        code += '  cursor += elem.size\n'
        code += '  if ((item & 128) === 0) return { value: data, size: cursor - offset }\n'
        code += '}'
        return compiler.wrapCode(code)
      }]
    },
    Write: {
      UUID: ['native', writeUUID],
      restBuffer: ['native', writeRestBuffer],
      nbt: ['native', writeNbt],
      optionalNbt: ['native', writeOptionalNbt],
      compressedNbt: ['native', writeCompressedNbt],
      entityMetadataLoop: ['parametrizable', (compiler, { type, endVal }) => {
        let code = 'for (const i in value) {\n'
        code += '  offset = ' + compiler.callType('value[i]', type) + '\n'
        code += '}\n'
        code += `return offset + ctx.u8(${endVal}, buffer, offset)`
        return compiler.wrapCode(code)
      }],
      topBitSetTerminatedArray: ['parametrizable', (compiler, { type }) => {
        let code = 'let prevOffset = offset\n'
        code += 'let ind = 0\n'
        code += 'for (const i in value) {\n'
        code += '  prevOffset = offset\n'
        code += '  offset = ' + compiler.callType('value[i]', type) + '\n'
        code += '  buffer[prevOffset] = ind !== value.length-1 ? (buffer[prevOffset] | 128) : buffer[prevOffset]\n'
        code += '  ind++\n'
        code += '}\n'
        code += 'return offset'
        return compiler.wrapCode(code)
      }]
    },
    SizeOf: {
      UUID: ['native', sizeOfUUID],
      restBuffer: ['native', sizeOfRestBuffer],
      nbt: ['native', sizeOfNbt],
      optionalNbt: ['native', sizeOfOptionalNbt],
      compressedNbt: ['native', sizeOfCompressedNbt],
      entityMetadataLoop: ['parametrizable', (compiler, { type }) => {
        let code = 'let size = 1\n'
        code += 'for (const i in value) {\n'
        code += '  size += ' + compiler.callType('value[i]', type) + '\n'
        code += '}\n'
        code += 'return size'
        return compiler.wrapCode(code)
      }],
      topBitSetTerminatedArray: ['parametrizable', (compiler, { type }) => {
        let code = 'let size = 0\n'
        code += 'for (const i in value) {\n'
        code += '  size += ' + compiler.callType('value[i]', type) + '\n'
        code += '}\n'
        code += 'return size'
        return compiler.wrapCode(code)
      }]
    }
  },
  interpreter: {
    UUID: [readUUID, writeUUID, sizeOfUUID],
    nbt: [readNbt, writeNbt, sizeOfNbt],
    optionalNbt: [readOptionalNbt, writeOptionalNbt, sizeOfOptionalNbt],
    compressedNbt: [readCompressedNbt, writeCompressedNbt, sizeOfCompressedNbt],
    restBuffer: [readRestBuffer, writeRestBuffer, sizeOfRestBuffer],
    entityMetadataLoop: [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
    topBitSetTerminatedArray: [readTopBitSetTerminatedArray, writeTopBitSetTerminatedArray, sizeOfTopBitSetTerminatedArray]
  }
}
