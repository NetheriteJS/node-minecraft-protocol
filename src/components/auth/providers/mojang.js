const { promisify } = require('util')
const UUID = require('uuid-1345')
const YggdrasilClient = require('yggdrasil')
const YggdrasilServer = YggdrasilClient.server
const { promises: fs, existsSync } = require('fs')
const mcDefaultFolderPath = require('minecraft-folder-path')
const path = require('path')

class MojangAuthProvider {
  constructor (clientOptions = {}, serverOptions = {}) {
    this.client = YggdrasilClient(clientOptions)
    this.server = YggdrasilServer(serverOptions)
    this.credentials = {}
    this.session = {}
  }

  /** Login using username+password pair with clientToken */
  async clientAuth ({ username, password, clientToken = UUID.v4().toString().replace(/-/g, '') } = this.credentials) {
    this.credentials = { ...this.credentials, username, password, clientToken }
    const { username: user, password: pass, clientToken: token } = this.credentials
    const { accessToken, selectedProfile } = await promisify(this.client.auth)({ token, user, pass })
    return (this.session = { accessToken, displayName: selectedProfile.name, selectedProfile })
  }

  /** Login using token */
  async clientAuthToken () { throw new ReferenceError('Not implemented') }

  /** Login using credentials in launcher_profiles.json */
  async clientAuthProfile ({ username } = this.credentials) {
    const profilesPath = path.join(
      existsSync(mcDefaultFolderPath) ? mcDefaultFolderPath : '.',
      'launcher_profiles.json'
    )
    if (!existsSync(profilesPath)) throw new Error('Profiles file not exists')
    const { clientToken, selectedUser, authenticationDatabase } = JSON.parse(await fs.readFile(profilesPath, 'utf8'))
    this.credentials = { ...this.credentials, username, clientToken }
    const lowerUsername = username.toLowerCase()
    const profile = Object.values(authenticationDatabase).find(entry =>
      entry.username.toLowerCase() === lowerUsername ||
      Object.values(entry.profiles).some(v => v.displayName.toLowerCase() === lowerUsername)
    )
    if (!profile) {
      throw new Error(`Username ${username} not found`)
    }
    if (!await promisify(this.client.validate)(profile.accessToken)) {
      throw new Error('Profile access token is invalid')
    }
    const { accessToken: oldToken } = profile
    const selectedProfile = {
      id: selectedUser.profile,
      name: selectedUser.account
    }
    const accessToken = await promisify(this.client.refresh)(oldToken, clientToken)
    return (this.session = { accessToken, displayName: username, selectedProfile })
  }

  async clientLogout ({ username, password } = this.credentials) {
    await promisify(this.client.signout)({ username, password })
    return (this.session = (this.credentials = {}))
  }

  async serverJoin ({ accessToken, selectedProfile } = this.session, { serverId, sharedSecret, serverKey }) {
    await promisify(this.server.join)(
      accessToken, selectedProfile, serverId, sharedSecret, serverKey
    )
  }

  async serverConfirm (username, { serverId, sharedSecret, serverKey }) {
    await promisify(this.server.hasJoined)(
      username, serverId, sharedSecret, serverKey
    )
  }
}

module.exports = MojangAuthProvider
