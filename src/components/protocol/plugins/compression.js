const { LOGIN } = require('../../enums').states

function ClientPlugin (client) {
  function onCompressionRequest ({ threshold }) {
    client.outputPipeline.update('compression', { threshold })
  }
  client.once('compress', onCompressionRequest)
}

function onPlayerConnect (client, threshold) {
  function enableCompression (state) {
    if (state !== LOGIN) return
    client.write('compress', { threshold })
    client.inputPipeline.update('compression', { threshold })
    client.off('state', enableCompression)
  }
  client.on('state', enableCompression)
}

function ServerPlugin (server, { compressionThreshold = -1 } = {}) {
  if (compressionThreshold < 0) return
  server.on('connect', onPlayerConnect.bind(null, compressionThreshold))
}

module.exports = { ClientPlugin, ServerPlugin }
