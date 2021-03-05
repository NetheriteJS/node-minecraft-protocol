const { Duplex, PassThrough } = require('stream')
const debug = require('debug')('minecraft-protocol:network')
const AbortController = globalThis.AbortController || require('abort-controller')

const ConstructorFunction = Symbol('StreamPipeline__ConstructorFunction')
const ConstructorOptions = Symbol('StreamPipeline__ConstructorOptions')

class StreamPipeline extends Duplex {
  static get ConstructorFunction () { return ConstructorFunction }
  static get ConstructorOptions () { return ConstructorOptions }

  constructor (streams = new Map()) {
    if (!streams.size) throw new Error('No streams passed to StreamPipeline')
    const controller = new AbortController()
    super({ signal: controller.signal })
    this.controller = controller
    this.streams = new Map()
    this.index = []
    this.options = new WeakMap()
    this._errorHandler = (err) => this.emit(err)
    for (const [name, stream] of streams.entries()) {
      debug(`Adding stream "${name}" (instanceof ${stream.constructor.name})`)
      this.set(name, stream)
      this.options.set(stream, stream[ConstructorOptions])
    }
  }

  get errorHandler () { return this._errorHandler }
  set errorHandler (func) { this._errorHandler = func.bind(this) }

  get length () { return this.index.length }
  get first () { return this.get(this.index[0]) }
  get last () { return this.get(this.index[this.index.length - 1]) }

  get (name) {
    if (typeof name === 'number') name = this.index[name]
    return this.streams.get(name)
  }

  has (name) {
    return typeof name === 'number'
      ? name >= 0 && name < this.length
      : this.index.includes(name)
  }

  before (i) {
    if (typeof i !== 'number') i = this.index.indexOf(i)
    return ~i && this.has(--i) ? this.get(i) : null
  }

  after (i) {
    if (typeof i !== 'number') i = this.index.indexOf(i)
    return ~i && this.has(++i) ? this.get(i) : null
  }

  set (name, value) {
    if (this.has(name)) {
      const prev = this.get(name)
      if (prev === value) return
      prev.off('error', this.errorHandler).end()
      this.controller.signal.off('abort', prev.endBinded)
      const before = this.before(name)
      const after = this.after(name)
      if (before) { before.unpipe(prev) }
      if (after) { prev.unpipe(after) }
    } else {
      this.index.push(name)
    }
    this.streams.set(
      typeof name === 'number' ? this.index[name] : name,
      value.on('error', this.errorHandler)
    )
    this.controller.signal.on('abort', (value.endBinded = value.end.bind(value)))
    const before = this.before(name)
    const after = this.after(name)
    if (before) {
      before.pipe(value)
    } else {
      this.writableHighWaterMark = value.writableHighWaterMark
    }
    if (after) {
      value.pipe(after)
    } else {
      this.readableHighWaterMark = value.readableHighWaterMark
    }
    return value
  }

  update (name, options) {
    if (!this.has(name)) throw new Error('Unable to update stream undefined')
    const stream = this.get(name)
    const oldOptions = this.options.get(stream) || {}
    const constructor = stream[ConstructorFunction]
    if (stream.constructor.Hotreloadable && typeof options === 'object') {
      // Easy case - just update stream options on-the-fly
      for (const key in options) {
        if (oldOptions[key] === options[key]) continue
        stream[key] = (oldOptions[key] = options[key])
      }
      this.options.set(stream, oldOptions)
      debug(`Updated stream "${name}"`)
    } else if (constructor) {
      let newOptions = oldOptions
      let newStream = new PassThrough()
      if (options) {
        newOptions = Object.assign(newOptions, options)
        newStream = constructor(newOptions)
      }
      newStream[ConstructorFunction] = constructor
      newStream[ConstructorOptions] = newOptions
      this.options.set(newStream, newOptions)
      this.set(name, newStream)
      debug(`Reloaded stream "${name}"`)
    } else {
      throw new Error(`Unable to update stream ${stream.constructor.name}#${name}`)
    }
  }

  _read (i) {
    const last = this.last
    let chunk = last.read(i)
    if (chunk === null) return
    this.push(chunk)
    while ((chunk = last.read()) !== null) {
      this.push(chunk)
    }
  }

  _write (chunk, _, next) {
    const first = this.first
    if (first.write(chunk, _)) {
      process.nextTick(next)
    } else {
      first.once('drain', next)
    }
  }
}

module.exports = StreamPipeline
