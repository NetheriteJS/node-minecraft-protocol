const StreamPipeline = require('./pipeline')
const { PassThrough } = require('stream')

const transforms = {
  compression: require('./transforms/compression'),
  encryption: require('./transforms/encryption'),
  framing: require('./transforms/framing'),
  serialization: require('./transforms/serialization')
}

function createInput (options = {}) {
  const streams = new Map()
  for (const name in options) {
    const constructor = transforms[name].createInput
    const stream = options[name]
      ? constructor(options[name])
      : new PassThrough()
    stream[StreamPipeline.ConstructorFunction] = constructor
    streams.set(name, stream)
  }
  return new StreamPipeline(streams)
}

function createOutput (options = {}) {
  const streams = new Map()
  for (const name in options) {
    const constructor = transforms[name].createOutput
    const stream = options[name]
      ? constructor(options[name])
      : new PassThrough()
    stream[StreamPipeline.ConstructorFunction] = constructor
    stream[StreamPipeline.ConstructorOptions] = options
    streams.set(name, stream)
  }
  return new StreamPipeline(streams.reverse())
}

module.exports = { createInput, createOutput, StreamPipeline }
