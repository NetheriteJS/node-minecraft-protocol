const EventEmitter = require('events').EventEmitter
const debug = require('debug')('minecraft-protocol')
const network = require('./network')
const states = require('./enum').states
const net = require('net')
const srvResolve = require('util').promisify(require('dns').resolveSrv)

class ClientSocket extends EventEmitter {
  constructor (isServer, version, customPackets, hideErrors = false) {
    super()
    // Options
    this.options = null
    this.framingEnabled = true
    this.compressionOptions = null
    this.encryptionOptions = null
    this.serializationOptions = {
      state: states.HANDSHAKING,
      isServer: !!isServer,
      version,
      customPackets,
      hideErrors
    }
    // Networking
    this.inputPipeline = network.createInput({
      framing: this.framingEnabled,
      compression: this.compressionOptions,
      encryption: this.encryptionOptions,
      serialization: this.serializationOptions
    })
    this.outputPipeline = network.createOutput({
      framing: this.framingEnabled,
      compression: this.compressionOptions,
      encryption: this.encryptionOptions,
      serialization: this.serializationOptions
    })
    this.inputPipeline.on('error', err => this.emit('error', err))
    this.outputPipeline.on('error', err => this.emit('error', err))
    // Server
    this.packetsToParse = {}
    this.ended = true
    this.latency = 0
    this.closeTimer = null
    this.closeTimeout = 30 * 1000
  }

  /// Compatibility with NMP API
  get hideErrors () { return this.serializationOptions.hideErrors }
  set hideErrors (hideErrors) {
    this.serializationOptions.hideErrors = hideErrors
    this.compressionOptions.hideErrors = hideErrors
    this.inputPipeline.update('serialization', { hideErrors })
    this.outputPipeline.update('serialization', { hideErrors })
    this.inputPipeline.update('compression', { hideErrors })
    this.outputPipeline.update('compression', { hideErrors })
  }

  get state () { return this.serializationOptions.state }
  set state (state) {
    this.serializationOptions.state = state
    this.inputPipeline.update('serialization', { state })
    this.outputPipeline.update('serialization', { state })
    if (this.splitter) {
      this.inputPipeline.update('framing', {
        recognizeLegacyPing: state === states.HANDSHAKING
      })
    }
    this.serializer.on('error', (e) => {
      e.field = [
        this.protocolState,
        this.isServer ? 'toClient' : 'toServer',
        ...(e.field ? e.field.split('.').slice(0, -1) : [])
      ].join('.')
      e.message = `Serialization error for ${e.field} : ${e.message}`
      this.emit('error', e)
    })

    this.deserializer.on('error', (e) => {
      e.field = [
        this.protocolState,
        this.isServer ? 'toServer' : 'toClient',
        ...(e.field ? e.field.split('.').slice(0, -1) : [])
      ].join('.')
      e.message = `Deserialization error for ${e.field} : ${e.message}`
      this.emit('error', e)
    })

    this.deserializer.on('data', (parsed) => {
      const {
        data: { name, params },
        metadata,
        buffer
      } = parsed
      metadata.name = name
      metadata.state = state
      debug(`read packet ${state}.${name}`)
      if (debug.enabled) {
        const s = JSON.stringify(params, null, 2)
        debug(s && s.length > 10000 ? params : s)
      }
      this.emit(name, params)
      this.emit(`packet.${name}`, params, metadata)
      this.emit(`raw.${name}`, buffer, metadata)
      this.emit('packet', params, metadata)
      this.emit('raw', buffer, metadata)
    })
  }

  get customPackets () { return this.serializationOptions.customPackets }
  set customPackets (customPackets) {
    this.serializationOptions.customPackets = customPackets
    this.inputPipeline.update('serialization', { customPackets })
    this.outputPipeline.update('serialization', { customPackets })
  }

  get version () { return this.serializationOptions.version }
  set version (version) {
    this.serializationOptions.version = version
    this.inputPipeline.update('serialization', { version })
    this.outputPipeline.update('serialization', { version })
  }

  get isServer () { return this.inputPipeline.get('serialization').isServer }
  set isServer (isServer) {
    this.serializationOptions.isServer = isServer
    this.inputPipeline.update('serialization', { isServer })
    this.outputPipeline.update('serialization', { isServer })
  }

  get compressionThreshold () {
    return this.compressor === null ? -2 : this.compressor.threshold
  }

  set compressionThreshold (threshold) {
    this.outputPipeline.update('compression', { threshold })
  }

  get deserializer () { return this.inputPipeline.get('serialization') }
  set deserializer (v) { return this.inputPipeline.set('serialization', v) }
  get serializer () { return this.outputPipeline.get('serialization') }
  set serializer (v) { return this.outputPipeline.set('serialization', v) }
  get splitter () { return this.inputPipeline.get('framing') }
  set splitter (v) { return this.inputPipeline.set('framing', v) }
  get framer () { return this.outputPipeline.get('framing') }
  set framer (v) { return this.outputPipeline.set('framing', v) }
  get decompressor () { return this.inputPipeline.get('compression') }
  set decompressor (v) { return this.inputPipeline.set('compression', v) }
  get compressor () { return this.outputPipeline.get('compression') }
  set compressor (v) { return this.outputPipeline.set('compression', v) }
  get decipher () { return this.inputPipeline.get('encryption') }
  set decipher (v) { return this.inputPipeline.set('encryption', v) }
  get cipher () { return this.outputPipeline.get('encryption') }
  set cipher (v) { return this.outputPipeline.set('encryption', v) }

  _endSocket () {
    if (this.ended) return
    this.ended = true
    clearTimeout(this.closeTimer)
    this.emit('end', this._endReason || 'SocketClosed')
  }

  _onFatalError (err) {
    this.emit('error', err)
    this._endSocket()
  }

  setSocket (socket) {
    this.ended = false
    this.socket = socket
      .setNoDelay()
      .setTimeout(3000, this._endSocket)
      .once('connect', () => this.emit('connect'))
      .once('error', this._onFatalError)
      .once('close', this._endSocket)
      .once('end', this._endSocket)

    this.socket.pipe(this.inputPipeline)
    this.outputPipeline.pipe(this.socket)
  }

  setEncryption (secret) {
    this.inputPipeline.update('encryption', secret)
    this.outputPipeline.update('encryption', secret)
  }

  setCompressionThreshold (threshold) { this.compressionThreshold = threshold }
  setSerializer (state) { this.state = state }

  end (reason) {
    this._endReason = reason
    this.inputPipeline.controller.abort()
    this.outputPipeline.controller.abort()
    if (this.socket) {
      this.socket.end()
      this.closeTimer = setTimeout(
        this.socket.destroy.bind(this.socket),
        this.closeTimeout
      )
    }
  }

  write (name, params) {
    if (!this.serializer.writable) return
    debug('writing packet ' + this.state + '.' + name)
    debug(params)
    this.serializer.write({ name, params })
  }

  writeRaw (buffer) {
    if (!this.compressor.writable) return
    this.compressor.write(buffer)
  }

  // TCP/IP-specific (not generic Stream) method for backwards-compatibility
  connect (port = 255565, host = 'localhost') {
    this.options = { ...this.options, port, host }
    if (this.options.connect) {
      this.options.connect = SocketConnect
    }
    this.options.connect(this)
  }
}

async function SocketConnect (socket) {
  const { port, host, stream } = socket.options
  // Use stream if provided
  if (stream) {
    socket.setSocket(stream)
    socket.emit('connect')
    return
  }
  // If port was not defined (defauls to 25565), host is not an ip neither localhost
  if (port === 25565 && net.isIP(host) === 0 && host !== 'localhost') {
    // Try to resolve SRV records for the domain
    try {
      const [{ name: host2, port: port2 }] = await srvResolve('_minecraft._tcp.' + host)
      socket.options.host = host2
      socket.options.port = port2
      socket.setSocket(net.connect(port2, host2))
      return
    } catch {}
  }
  // Otherwise, just connect using the provided hostname and port
  socket.setSocket(net.connect(port, host))
}

module.exports = ClientSocket
