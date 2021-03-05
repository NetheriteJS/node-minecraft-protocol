const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const MojangAuthProvider = require('./mojang')
const fetch = require('node-fetch')

const XSTSRelyingParty = 'rp://api.minecraftservices.com/'
const MinecraftServicesBaseUrl = 'https://api.minecraftservices.com'
const MinecraftServicesLogWithXbox = `${MinecraftServicesBaseUrl}/authentication/login_with_xbox`
const MinecraftServicesEntitlement = `${MinecraftServicesBaseUrl}/entitlements/mcstore`
const MinecraftServicesProfile = `${MinecraftServicesBaseUrl}/minecraft/profile`

const fetchOptions = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'github:NetheriteJS/node-minecraft-protocol'
  }
}

function checkStatus (res) {
  if (res.ok) return res.json()
  throw Error(res.statusText)
}

class MicrosoftAuthProvider extends MojangAuthProvider {
  constructor (clientOptions = {}, serverOptions = {}) {
    super(clientOptions, serverOptions)
  }

  async clientAuth ({ username, password, clientToken = '' } = this.credentials) {
    this.credentials = { ...this.credentials, username, password, clientToken }
    const XAuthResponse = await XboxLiveAuth.authenticate(username, password, { XSTSRelyingParty })
      .catch((err) => {
        throw Error(err.details
          ? `Unable to authenticate with Xbox Live: ${JSON.stringify(err.details)}`
          : err
        )
      })
    const MineServicesResponse = await fetch(MinecraftServicesLogWithXbox, {
      method: 'post',
      ...fetchOptions,
      body: JSON.stringify({ identityToken: `XBL3.0 x=${XAuthResponse.userHash};${XAuthResponse.XSTSToken}` })
    }).then(res => {
      if (res.ok) return res.json()
      throw Error(res.statusText)
    })
    fetchOptions.headers.Authorization = `Bearer ${MineServicesResponse.access_token}`
    const MineEntitlements = await fetch(MinecraftServicesEntitlement, fetchOptions).then(checkStatus)
    if (MineEntitlements.items.length === 0) throw Error('This user does not have any items on its accounts according to minecraft services.')
    const MinecraftProfile = await fetch(MinecraftServicesProfile, fetchOptions).then(checkStatus)
    if (!MinecraftProfile.id) throw Error('This user does not own minecraft according to minecraft services.')
    // This profile / session here could be simplified down to where it just passes the uuid of the player to encrypt.js
    // That way you could remove some lines of code. It accesses client.session.selectedProfile.id so /shrug.
    // - Kashalls
    return (this.session = {
      accessToken: MineServicesResponse.access_token,
      selectedProfile: {
        name: MinecraftProfile.name,
        id: MinecraftProfile.id
      }
    })
  }

  async clientAuthToken () { throw new ReferenceError('Not implemented') }
  async clientAuthProfile () { throw new ReferenceError('Not implemented') }
}

module.exports = MicrosoftAuthProvider
