const EventEmitter = require('events')
const { join: pJoin } = require('path')
const net = require('net')
const { URL } = require('url')

const fs = require('fs-extra')
const jsonBeautify = require("json-beautify")

const exErr = require('./extend-error')
const { isObject, isFunction, callbackHandler } = require('./misc')

const ConfigManager = require('./config-manager')
const ForwardService = require('./forward-service')
const ForwardConnection = require('./forward-connection')

class ForwardManager extends EventEmitter {
  constructor (configPath, logger, callback) {
    // init
    super()

    /*
     * version infomation
     * [major version].[minor version].[snapshot]
     */
    Object.defineProperties(this, {
      version: { get () { return 'v3.1.2' } }
    })

    callbackHandler(this, 'ready', 'error', callback)

    this.status = 0
    this.notiList = []
    this.notiCount = 0
    this.notiMaxCount = 100

    this._cm = new ConfigManager(configPath)
    this.logger = logger || console
    this.loggerPrefix = 'manager>'

    this._services = {}
    this._profiles = {
      // TODO: remove default setting
      ssh: {
        source: 8080,
        dest: 'localhost:22',
        idleTimeout: 0,
      }
    }

    // async init
    ;(async () => {
      // handle config
      try {
        this._profiles = await this._cm.loadAsync()
      } catch (err) {
        if (isObject(err), err.code === 'ENOENT') {
          this.i('Config file not exists. Creating.')
          this._saveConfig()
        } else {
          const msg = `Unexpected error occur during load config. All changes will be lost!: ${err.stack}`
          this.e(msg)
          this._addNoti('error', msg)
        }
      }

      // instance initialize from config
      for (let name in this._profiles) {
        this._services[name] = new ForwardService(this, name, this._profiles[name])
        this._initProfile(name)
      }

    })().then(() => {
      this.i('ready')
      this.emit('ready')
    }).catch(err => {
      const msg = `init error: ${err.stack}`
      this.e(msg)
      this._addNoti('error', msg)
      this.emit('error', err)
    })
  }

  // logger controls
  d () { this.logger.debug(this.loggerPrefix, ...arguments) }
  i () { this.logger.info(this.loggerPrefix, ...arguments) }
  w () { this.logger.warn(this.loggerPrefix, ...arguments) }
  e () { this.logger.error(this.loggerPrefix, ...arguments) }

  // destory instance recursivly
  destroy () {
    // TODO
  }

  // ConfigManager controls
  // save config non-blocking
  _saveConfig () {
    this._cm.save(this._profiles, err => {
      if (err) {
        const msg = `Can't save config file. All changes will be lost!: ${err.stack}`
        this.w(msg)
        this._addNoti('warn', msg)
      }
    })
  }

  // notification controls
  _addNoti (level, message) {
    this.notiList.push({
      l: level,
      m: message,
      i: this.notiCount
    })

    this.status |= this.ManagerStatus.NOTIFICATION

    while (this.notiList.length > this._notiMaxCount) this.notiList.shift()

    this.emit('notificationAdd', this.notiCount++)
  }

  clearNoti (index) {
    for (var i in this.notiList) if (this.notiList[i].i === index) {
      this.notiList[i].splice(i, 1)
      break
    }
    if (!this.notiList.length && (this.status & this.ManagerStatus.NOTIFICATION))
      this.status -= this.ManagerStatus.NOTIFICATION
  }

  clearAllNoti () {
    this.notiList = []
    this.notiCount = 0
    if (this.status & this.ManagerStatus.NOTIFICATION)
      this.status -= this.ManagerStatus.NOTIFICATION
  }

  // profile controls
  _initProfile (name) {
    this._services[name].on('error', err => {
      this.w(`service[${name}] unhandled exception:`, err)
    })
    this._services[name].on('optionsChanged',
      profile => { this._saveService(name, profile) }
    )
    this.emit('profileInitialized', name)
  }

  _saveService (name, profile) {
    this._profiles[name] = profile
    this._saveConfig()
  }

  async createProfile (name, profile) {
    // valid check
    if (this.getService(name)) {
      throw exErr({
        message: 'Profile name is already taken.',
        code: 'ERR_OCCUPIED_PROFILE_NAME'
      })
    }
    profile = ForwardService.optionsFilter(profile)

    // save profile (none-blocking)
    this._profiles[name] = profile
    this._saveConfig()

    // create instance
    this._services[name] = new ForwardService(this, name, profile)
    this._initProfile(name)

    // finalize
    this.i(`Profile created: ${name}`)
    this.emit('profileCreated', name)
  }

  async removeProfile (name, timeout) {
    // valid check
    if (!this.getService(name)) {
      throw exErr({
        message: 'Profile not exists.',
        code: 'ERR_PROFILE_NOT_EXISTS'
      })
    }

    // destroy & remove instance
    this.d(`Profile removing: ${name}`)
    this.emit('profileRemove', name)

    // close service
    if (this.getService(name).isOpen()) await this.getService(name).close(timeout)
    delete this._services[name]

    // save profile (none-blocking)
    delete this._profiles[name]
    this._saveConfig()

    this.i(`Profile removed: ${name}`)
    this.emit('profileRemoved', name)
  }

  async startProfile (name) {
    // valid check
    if (!this.getService(name)) {
      throw exErr({
        message: 'Profile not exists.',
        code: 'ERR_PROFILE_NOT_EXISTS'
      })
    }

    // start service
    await this.getService(name).open()
  }

  async stopProfile (name, timeout) {
    // valid check
    if (!this.getService(name)) {
      throw exErr({
        message: 'Profile not exists.',
        code: 'ERR_PROFILE_NOT_EXISTS'
      })
    }

    await this.getService(name).close(timeout)
  }

  // service controls
  getService (name) { return this._services[name] }

  // export control
  toPlainData () {
    const services = {}
    Object.keys(this._services).forEach(name => {
      services[name] = this._services[name].toPlainData()
    })

    return {
      status: this.status,
      services
    }
  }
}
ForwardManager.ManagerStatus = {
  'READY': 1,
  'NOTIFICATION': 2
}
ForwardManager.prototype.ManagerStatus = ForwardManager.ManagerStatus

ForwardManager.ForwardService = ForwardService
ForwardManager.ForwardConnection = ForwardConnection

module.exports = ForwardManager
