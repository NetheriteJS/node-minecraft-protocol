const plugins = {
  keepalive: require('./plugins/keepalive')
}

function initClientPlugins (client, options = {}) {
  for (const name in options) {
    if (!options[name]) continue
    plugins[name].ClientPlugin(client, options[name])
  }
  return client
}

function initServerPlugins (server, options = {}) {
  for (const name in options) {
    if (!options[name]) continue
    plugins[name].ServerPlugin(server, options[name])
  }
  return server
}

module.exports = { initClientPlugins, initServerPlugins }
