const { PLAY } = require('../../enums').states

function ClientPlugin (client, {
  disconnectTimeout = 30 * 1000
} = {}) {
  let timeout = null
  function onKeepAlive ({ keepAliveId }) {
    if (timeout) { clearTimeout(timeout) }
    timeout = setTimeout(() => client.end(), disconnectTimeout)
    client.write('keep_alive', { keepAliveId })
  }
  client
    .on('keep_alive', onKeepAlive)
    .on('end', () => clearTimeout(timeout))
}

function onPlayerConnect (disconnectTimeout, checkTimeoutInterval, client) {
  let keepAlive = false
  let lastKeepAlive = null
  let keepAliveTimer = null
  let sendKeepAliveTime
  function keepAliveLoop () {
    if (!keepAlive) return
    // check if the last keepAlive was too long ago (kickTimeout)
    const elapsed = new Date() - lastKeepAlive
    if (elapsed > disconnectTimeout) {
      client.end('KeepAliveTimeout')
      return
    }
    sendKeepAliveTime = new Date()
    client.write('keep_alive', {
      keepAliveId: Math.floor(Math.random() * 2147483648)
    })
  }
  function onKeepAlive () {
    if (sendKeepAliveTime) client.latency = (new Date()) - sendKeepAliveTime
    lastKeepAlive = new Date()
  }
  function startKeepAlive (state) {
    if (state !== PLAY) return
    keepAlive = true
    lastKeepAlive = new Date()
    keepAliveTimer = setInterval(keepAliveLoop, checkTimeoutInterval)
    client.on('keep_alive', onKeepAlive)
  }
  client
    .on('state', state => startKeepAlive(state))
    .on('end', () => clearInterval(keepAliveTimer))
}

function ServerPlugin (server, {
  disconnectTimeout = 30 * 1000,
  checkTimeoutInterval = 4 * 1000
} = {}) {
  server.on('connect', onPlayerConnect.bind(null, disconnectTimeout, checkTimeoutInterval))
}

module.exports = { ClientPlugin, ServerPlugin }
