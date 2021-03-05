const { ProtoDef, Serializer, FullPacketParser } = require('protodef')
const { ProtoDefCompiler } = require('protodef').Compiler
const minecraftData = require('minecraft-data')
const protocolDatatypes = require('../datatypes')
const protocolStates = require('../../states')
const merge = require('lodash.merge')
const get = require('lodash.get')

const protocols = new Map()

function createProtocol (state, direction, version, customPackets, compiled = true) {
  const key = state + ';' + direction + ';' + version + (compiled ? ';c' : '')
  if (protocols.has(key)) return protocols.get(key)
  let proto
  if (compiled) {
    proto = new ProtoDefCompiler()
    proto.addTypes(protocolDatatypes.compiler)
  } else {
    proto = new ProtoDef(false)
    proto.addTypes(protocolDatatypes.interpreter)
  }
  const mcData = minecraftData(version)
  proto.addProtocol(merge(mcData.protocol, get(customPackets, [mcData.version.majorVersion])), [state, direction])
  if (compiled) { proto = proto.compileProtoDefSync() }
  protocols.set(key, proto)
  return proto
}

function createInput ({ state = protocolStates.HANDSHAKING, isServer = false, version, customPackets, compiled = true, noErrorLogging = false } = {}) {
  return new FullPacketParser(createProtocol(state, isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet', noErrorLogging)
}

function createOutput ({ state = protocolStates.HANDSHAKING, isServer = false, version, customPackets, compiled = true } = {}) {
  return new Serializer(createProtocol(state, !isServer ? 'toServer' : 'toClient', version, customPackets, compiled), 'packet')
}

module.exports = { createInput, createOutput }
