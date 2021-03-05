const MojangAuthProvider = require('./mojang')

class ElyByAuthProvider extends MojangAuthProvider {
  constructor (clientOptions = {}, serverOptions = {}) {
    super({
      host: 'https://authserver.ely.by/auth',
      ...clientOptions
    }, {
      host: 'https://authserver.ely.by/session',
      ...serverOptions
    })
  }

  async clientAuthToken () { throw new ReferenceError('Not implemented') }
  async clientAuthProfile () { throw new ReferenceError('Not implemented') }
}

module.exports = ElyByAuthProvider
