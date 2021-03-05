/*
class Transaction {
  static from ([name, value]) { return new Transaction(name, value) }
  constructor (name, value) {
    this.name = name
    this.value = value
  }

  apply (target) { target[this.name] = this.value }
}
*/

class ClientPluginManager {
  constructor (client) {
    this.client = client
    this.plugins = new Map()
    // this.transactions = new Map()
  }

  createProxy (name) {
    return new Proxy(this.client, {
      set: this.proxySet.bind(this, name),
      deleteProperty: this.proxyDeleteProperty.bind(this, name)
    })
  }

  proxySet (client, pluginName, prop, value) {
    // const revertTransaction = new Transaction(prop, client[prop])
    const reflectionResult = Reflect.set(client, prop, value)
    // if (reflectionResult && !Object.getOwnPropertyDescriptor(client, prop).get) {
    //   this.transactions.get(pluginName).push(revertTransaction)
    // }
    return reflectionResult
  }

  proxyDeleteProperty (client, pluginName, prop) {
    // const revertTransaction = new Transaction(prop, client[prop])
    const reflectionResult = Reflect.deleteProperty(client, prop)
    // if (reflectionResult && !Object.getOwnPropertyDescriptor(client, prop).get) {
    //   this.transactions.get(pluginName).add(revertTransaction)
    // }
    return reflectionResult
  }

  register (name, plugin, options = {}) {
    // this.transactions.set(name, new Set())
    const inst = plugin(this.createProxy(name), options)
    this.plugins.set(name, inst)
  }

  unregister (name) {
    if (name.onunload) name.onunload()
    // const transactions = Array.from(this.transactions.get(name)).reverse()
    this.plugins.delete(name)
    // this.transactions.delete(name)
    // for (const transaction of transactions) {
    //   transaction.apply(this.client)
    // }
  }
}

class ServerPluginManager extends ClientPluginManager {
  get server () { return this.client }
}

class PluginManager {
  constructor (client = null, server = null) {
    this.client = new ClientPluginManager(client)
    this.server = new ServerPluginManager(server)
    this.plugins = new Set()
    this.clientPlugins = new WeakMap()
    this.serverPlugins = new WeakSet()
  }

  loadPlugin ({ ClientPlugin, ServerPlugin }, options = {}) {
    const uniqueID = Symbol('PluginManager__UniqueID')
    this.plugins.add(uniqueID)
    if (ClientPlugin) {
      this.clientPlugins.set(ClientPlugin, uniqueID)
      this.client.register(uniqueID, ClientPlugin, options)
    }
    if (ServerPlugin) {
      this.serverPlugins.set(ServerPlugin, uniqueID)
      this.server.register(uniqueID, ServerPlugin, options)
    }
  }

  unloadPlugin ({ ClientPlugin, ServerPlugin }) {
    const clientUniqueID = this.clientPlugins.get(ClientPlugin)
    const serverUniqueID = this.serverPlugins.get(ServerPlugin)
    if (clientUniqueID && serverUniqueID && clientUniqueID !== serverUniqueID) {
      throw new Error('Passed constructors from different plugins (DAFUQ?)')
    }
    const uniqueID = clientUniqueID || serverUniqueID
    if (!uniqueID) {
      throw new Error('Plugin not found')
    }
    this.plugins.delete(uniqueID)
    if (clientUniqueID) {
      this.clientPlugins.delete(ClientPlugin)
      this.client.unregister(clientUniqueID)
    }
    if (ServerPlugin) {
      this.serverPlugins.delete(ServerPlugin)
      this.server.unregister(uniqueID)
    }
  }
}

module.exports = { PluginManager, ClientPluginManager, ServerPluginManager }
