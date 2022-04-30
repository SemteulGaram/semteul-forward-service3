const EventEmitter = require('events')
const fs = require('fs')

const debug = require('debug')('ConfigManager')
const jsonBeautify = require("json-beautify")

const { isFunction, callbackHandler } = require('./misc')

// TODO: test script
class ConfigManager extends EventEmitter {
  constructor (configPath) {
    debug('new instance:', configPath)
    super()

    this.configPath = configPath
    this.onIO = false
    this.reserveRead = false
    this.reserveData = null
  }

  save (plainData, callback) {
    debug('save: Request')

    if (isFunction(callback)) {
      debug('save: Register callback' + (callback.name ? ': ' + callback.name : ''))
      callbackHandler(this, 'saved', 'saveFail', callback)
    }

    if (this.reserveData) debug('save: Saving reserved data')
    this.reserveData = null

    if (this.onIO) {
      debug('save: Attempt to save during I/O. reserve it')
      return this.reserveData = plainData
    }

    let data = null
    try {
      data = jsonBeautify(plainData, null, 2, 20)
    } catch (err) {
      err.isJsonError = true
      return this.emit('saveFail', err)
    }

    const onWriteFinish = err => {
      if (err) debug('save: Fail due to FileSystemError:', err)
      else debug('save: Success')

      this.onIO = false
      if (!this.reserveData) err ? this.emit('saveFail', err) : this.emit('save')
      this._nextTask()
    }

    this.onIO = true
    fs.writeFile(this.configPath, data, onWriteFinish)
  }

  saveAsync (plainData) {
    const that = this
    return new Promise(function (resolve, reject) {
      that.save(plainData, err => { err ? reject(err) : resolve() })
    })
  }

  load (callback) {
    debug('load: Request')
    if (isFunction(callback)) {
      debug('load: Register callback' + (callback.name ? ': ' + callback.name : ''))
      callbackHandler(this, 'loaded', 'loadFail', callback)
    }

    if (this.reserveRead) {
      debug('load: Already requested. ignore it.')
      return
    }

    const onReadFinish = (err, content) => {
      this.onIO = false
      let data = null

      if (!err) {
        try {
          data = JSON.parse(content)
        } catch (err2) {
          err2.isJsonError = true
          err = err2
          debug('Read fail due to JSONParseError:', err)
        }
      }

      if (err && err.isJsonError) {
        debug('load: Fail due to JsonParseError:', err)
      } else if (err) {
        debug('load: Fail due to FileSystemError:', err)
      } else {
        debug('load: Success')
      }

      err ? this.emit('loadFail', err) : this.emit('loaded', data)
      this._nextTask()
    }

    this.onIO = true
    fs.readFile(this.configPath, onReadFinish)
  }

  loadAsync () {
    const that = this
    return new Promise(function (resolve, reject) {
      that.load((err, data) => { err ? reject(err) : resolve(data) })
    })
  }

  _nextTask () {
    if (this.reserveData) {
      this.save(this.reserveData)
    } else if (this.reserveRead) {
      this.reserveRead = false
      this.load()
    }
  }
}

module.exports = ConfigManager
