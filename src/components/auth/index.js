const providers = {
  elyby: require('./providers/elyby'),
  microsoft: require('./providers/microsoft'),
  mojang: require('./providers/mojang'),
  offline: require('./providers/offline')
}

class AuthManager {
  static get providers () { return providers }

  constructor (options = {}) {
    this.onlineMode = false
    this.providerOptions = options
    this.currentProvider = null
  }

  get credentials () { return this.currentProvider && this.currentProvider.credentials }
  get session () { return this.currentProvider && this.currentProvider.session }

  async getProvider (name) {
    if (!name && !this.currentProvider) {
      throw new Error('Please log in with specified auth provider first')
    }
    if (this.currentProvider && (!name || this.currentProvider.constructor === this.providers[name])) {
      return this.currentProvider
    }
    return this.setProvider(name)
  }

  async setProvider (name) {
    const Provider = providers[name]
    if (!Provider) throw new Error(`Auth provider ${name} is not defined`)
    if (this.currentProvider) await this.clientLogout()
    return (this.currentProvider = new Provider(this.providerOptions[name]))
  }

  async clientLogin (name, credentials) {
    const provider = this.getProvider(name)
    if (credentials.token) {
      await provider.clientAuthToken(credentials)
    } else if (credentials.password) {
      await provider.clientAuth(credentials)
    } else {
      await provider.clientAuthProfile(credentials)
    }
  }

  async clientJoin (name, server) {
    await this.getProvider(name).serverJoin(this.session, server)
  }

  async clientLogout (name) {
    await this.getProvider(name).clientLogout()
  }

  async serverLogin (name, username, server) {
    await this.getProvider(name).serverConfirm(username, server)
  }
}

module.exports = AuthManager
