const { Transform } = require('-stream')
const crypto = require('crypto')
const aesjs = require('aes-js')

class Cipher extends Transform {
  constructor (secret) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, secret, 1) // eslint-disable-line new-cap
  }

  _transform (chunk, _, cb) {
    try {
      const res = this.aes.encrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

class Decipher extends Transform {
  constructor (secret) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, secret, 1) // eslint-disable-line new-cap
  }

  _transform (chunk, _, cb) {
    try {
      const res = this.aes.decrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

function createInputNative (secret = null) {
  return crypto.createDecipheriv('aes-128-cfb8', secret, secret)
}

function createOutputNative (secret = null) {
  return crypto.createCipheriv('aes-128-cfb8', secret, secret)
}

function createInput (secret = null) { return new Decipher(secret) }
function createOutput (secret = null) { return new Cipher(secret) }

module.exports = crypto.getCiphers().includes('aes-128-cfb8')
  ? { createInput: createInputNative, createOutput: createOutputNative }
  : { createInput, createOutput }
