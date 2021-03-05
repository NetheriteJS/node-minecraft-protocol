const defaultVersion = '1.16.4'
const versions = ['1.7', '1.8', '1.9', '1.10', '1.11.2', '1.12.2', '1.13.2', '1.14.4', '1.15.2', '1.16.4']

const states = {
  HANDSHAKING: 'handshaking',
  STATUS: 'status',
  LOGIN: 'login',
  PLAY: 'play'
}

const nextStates = {
  1: states.STATUS,
  2: states.LOGIN
}

module.exports = {
  defaultVersion,
  states,
  nextStates,
  versions
}
