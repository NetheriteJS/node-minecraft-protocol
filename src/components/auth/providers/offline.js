const crypto = require('crypto')
const UUID = require('uuid-1345')
const { promises: fs, existsSync } = require('fs')
const mcDefaultFolderPath = require('minecraft-folder-path')
const path = require('path')

function javaUUID (s) {
  const hash = crypto.createHash('md5')
  hash.update(s, 'utf8')
  const buffer = hash.digest()
  buffer[6] = (buffer[6] & 0x0f) | 0x30
  buffer[8] = (buffer[8] & 0x3f) | 0x80
  return buffer
}

class OfflineModeProvider {
  constructor () {
    this.credentials = {}
    this.session = {}
  }

  async clientAuth ({ username, clientToken = UUID.v4().toString().replace(/-/g, '') } = this.credentials) {
    this.credentials = { ...this.credentials, username, clientToken }
    const selectedProfile = this.session.selectedProfile || {
      id: (new UUID(javaUUID(`OfflinePlayer:${username}`))).toString(),
      name: username
    }
    return (this.session = {
      accessToken: '',
      displayName: selectedProfile.name,
      selectedProfile
    })
  }

  async clientAuthToken () { throw new ReferenceError('Not implemented') }
  async clientAuthProfile ({ username } = this.credentials) {
    const profilesPath = path.join(
      existsSync(mcDefaultFolderPath) ? mcDefaultFolderPath : '.',
      'launcher_profiles.json'
    )
    if (!existsSync(profilesPath)) throw new Error('Profiles file not exists')
    const { clientToken } = JSON.parse(await fs.readFile(profilesPath, 'utf8'))
    return this.clientAuth(this.credentials = { ...this.credentials, username, clientToken })
  }

  async clientLogout () { return (this.session = null) }
  async clientJoinServer () {}
  async serverJoinConfirm () {}
}

module.exports = OfflineModeProvider
