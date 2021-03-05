const fs = require('fs/promises')

const serverPluginWrapper = (plugin, server, options, client) => plugin(client, server, options)

async function ClientPlugin (client, options) {
  const clientLegacyPlugins = await fs.readdir('../client')
  for (const path of clientLegacyPlugins) {
    require(path)(client, options)
  }
}

async function ServerPlugin (server, options) {
  const serverLegacyPlugins = await fs.readdir('../server')
  for (const path of serverLegacyPlugins) {
    server.on('connection', serverPluginWrapper.bind(null, require(path), server, options))
  }
}

module.exports = { ClientPlugin, ServerPlugin }
