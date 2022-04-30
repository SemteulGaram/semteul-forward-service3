const EventEmitter = require('events')
const net = require('net')
const { URL } = require('url')

const exErr = require('./extend-error')
const { isObject, callbackHandler } = require('./misc')

// lazy load due to circulation problem
let ForwardManager = null
const ForwardConnection = require('./forward-connection')

class ForwardService extends EventEmitter {
  constructor (manager, name, options) {
    // lazy load due to circulation problem
    if (!ForwardManager) ForwardManager = require('./forward-manager')

    // valid check
    if (!(manager instanceof ForwardManager)) throw exErr({
      message: 'parameter[0] must instance of ForwardManager',
      code: 'ERR_INVALID_PARAMETER'
    })

    options = ForwardService.optionsFilter(options)

    // init
    super()

    this.name = name
    this.manager = manager
    this._opt = options
    this._destURL = null

    this.logger = manager.logger
    this.loggerPrefix = `service[${name}]>`

    this.status = 0

    this._server = null
    this._serverTimeoutId = null
    this.serverTimeoutAt = null

    this._conns = {}
    // this._connCounter = 0
    this._delConnsBytesRead = 0
    this._delConnsBytesWritten = 0

    // finalize
    this._updateDest()
    this.i('instance created -', this.pathString())

    if (this._opt.autoStart) this.open().catch(_ => {})
  }

  // logger controls
  d () { this.logger.debug(this.loggerPrefix, ...arguments) }
  i () { this.logger.info(this.loggerPrefix, ...arguments) }
  w () { this.logger.warn(this.loggerPrefix, ...arguments) }
  e () { this.logger.error(this.loggerPrefix, ...arguments) }

  // valid check controls
  static optionsFilter (options) {
    const newOptions = {}
    const dest = new URL('net://localhost/')

    if (ForwardService.isValidPort(options.source)) {
      newOptions.source = parseInt(options.source)
    } else throw exErr({
      message: 'invalid source option (source option must be integer(>=0, <65535))',
      code: 'ERR_INVALID_SOURCE'
    })

    if (ForwardService.isValidPort(options.dest)) {
      dest.port = options.dest
      newOptions.dest = dest.host
    } else if (ForwardService.isValidHost(options.dest)) {
      dest.host = options.dest
      newOptions.dest = dest.host
    } else throw exErr({
      message: 'invalid dest option (dest option must be instance of host or port)',
      code: 'ERR_INVALID_DEST'
    })

    if (ForwardService.isValidTimeout(options.idleTimeout)) {
      newOptions.idleTimeout = parseInt(options.idleTimeout)
    } else throw exErr({
      message: 'Invalid connection idle timeout value',
      code: 'ERR_INVALID_TIMEOUT'
    })

    newOptions.autoStart = !!options.autoStart

    return newOptions
  }

  static isValidPort (port) {
    const pI = parseInt(port)
    return ((port == pI) && pI >= 0 && pI < 0xffff)
  }

  static isValidHost (host) {
    const url = new URL('net://localhost/')
    url.host = host // Invalid host values assigned to the host property are ignored.
    return url.host === host
  }

  static isValidTimeout (timeout) {
    const tI = parseInt(timeout)
    return ((timeout == tI), tI >= 0)
  }

  // alternative access controls
  get configData () { return this._opt }
  get source () { return this._opt.source }
  get dest () { return this._opt.dest }
  get destHost () { return this._destURL.host }
  get destHostname () { return this._destURL.hostname }
  get destPort () { return this._destURL.port || 80 }
  get idleTimeout () { return this._opt.idleTimeout }

  // private methods
  _generateConnUid (socket) {
    // return '' + (this._connCounter++)
    return `${socket.remoteAddress}:${socket.remotePort}`
  }

  _updateDest () {
    this._destURL = new URL('net://localhost/')
    this._destURL.host = this._opt.dest
  }

  // status indecators
  isServerOpen () {
    return (isObject(this._server) && this._server.listening)
  }

  isOpen () {
    return !!(this.status & this.ServiceStatus.OPEN)
  }

  isLocked () {
    return !!(this.status & this.ServiceStatus.CHANGING)
  }

  // public methods
  toPlainData () {
    const conns = {}
    let totalBytesRead = this._delConnsBytesRead
    let totalBytesWritten = this._delConnsBytesWritten
    Object.keys(this._conns).forEach(key => {
      conns[key] = this._conns[key].toPlainData()
      totalBytesRead += conns[key].bytesRead
      totalBytesWritten += conns[key].bytesWritten
    })

    return {
      name: this.name,
      status: this.status,
      isAutoStart: this._opt.autoStart,
      closeTimeoutAt: this.serverTimeoutAt,
      source: this.source,
      dest: this.dest,
      idleTimeout: this.idleTimeout,
      totalBytesRead,
      totalBytesWritten,
      conns
    }
  }

  pathString () {
    return `port[${this._opt.source}] <-> host[${this._opt.dest}]`
  }

  changeOptions (options) {
    if (this.isLocked()) throw exErr({
      message: 'Service locked due to changing status',
      code: 'ERR_SERVICE_CHANGING'
    })

    if (this.isOpen()) throw exErr({
      message: 'Service already opened',
      code: 'ERR_ALREADY_OPEN'
    })

    this._opt = ForwardService.optionsFilter(options)
    this._updateDest()

    this.i('options changed -', this.pathString())
    this.emit('optionsChanged', JSON.parse(JSON.stringify(this._opt)))
  }

  // service controls
  open () {
    const that = this
    return new Promise(function (resolve, reject) {
      // valid check
      if (that.isLocked()) return reject(exErr({
        message: 'Service locked due to changing status',
        code: 'ERR_SERVICE_CHANGING'
      }))

      if (that.isOpen()) return reject(exErr({
        message: 'Service already opened',
        code: 'ERR_ALREADY_OPEN'
      }))

      // init
      that.d('service opening...')
      that.status |= that.ServiceStatus.CHANGING
      that._server = net.createServer({ pauseOnConnect: true })

      // server event handle
      that._server.on('connection', clientSocket => {
        const uid = that._generateConnUid(clientSocket)

        that._conns[uid] = new ForwardConnection(that, uid, clientSocket, that.idleTimeout)
        // connection instance event handle
        that._conns[uid].on('error', err => {
          that.w(`connection[${uid}] unhandled exception:`, err)
        })
        that._conns[uid].on('destroy', () => {
          that._delConnsBytesRead += that._conns[uid].client.bytesRead
          that._delConnsBytesWritten += that._conns[uid].client.bytesWritten

          that.emit('connectionDestroyed', uid)
          delete that._conns[uid]
        })

        that.emit('connectionCreated', uid)
      })

      that._server.listen(that.source)

      callbackHandler(that._server, 'listening', 'error', err => {
        that.status -= that.ServiceStatus.CHANGING
        if (err) {
          // TODO: { that._server.close() } <- need it?
          that.e('service open fail -', err)
          that.status |= that.ServiceStatus.ERROR
          that.emit('error', err)
          reject(err)
        } else {
          that.i('service open -', that.pathString())
          that.status |= that.ServiceStatus.OPEN
          that.emit('open')
          resolve()
        }
      })
    })
  }

  close (timeout) {
    const that = this
    return new Promise(function (resolve, reject) {
      // valid check
      if (that.isLocked()) return reject(exErr({
        message: 'Service locked due to changing status',
        code: 'ERR_SERVICE_CHANGING'
      }))

      if (!that.isOpen()) return reject(exErr({
        message: 'Service already closed',
        code: 'ERR_ALREADY_CLOSE'
      }))

      // init
      timeout = parseInt(timeout)
      that.i(`service closing...${
        timeout > 0
        ? ' (timeout: ' + timeout + ')'
        : timeout === 0
          ? ' (inmediatly)'
          : ''
      }`)
      that.status |= that.ServiceStatus.CHANGING

      callbackHandler(that._server, 'close', 'error', err => {
        if (that._serverTimeoutId !== null) clearTimeout(that._serverTimeoutId)
        that.serverTimeoutAt = null
        that._serverTimeoutId = null

        if (that.status & that.ServiceStatus.CHANGING) that.status -= that.ServiceStatus.CHANGING

        if (err) {
          // TODO: { that._server.close() } <- need it?
          that.status |= that.ServiceStatus.ERROR
          if (that.status & that.ServiceStatus.OPEN) that.status -= that.ServiceStatus.OPEN
          that.e('service close fail -', err)
          that.emit('error', err)
          // that._server = null
          reject(err)
        } else {
          if (that.status & that.ServiceStatus.OPEN) that.status -= that.ServiceStatus.OPEN
          that.i('service close')
          that.emit('close')
          that._server = null
          resolve()
        }
      })

      if (timeout === 0) {
        that.destroyAllConnection()
      } else if (timeout > 0) {
        that.serverTimeoutAt = Date.now() + timeout
        that._serverTimeoutId = setTimeout(() => {
          that.serverTimeoutAt = null
          that._serverTimeoutId = null
          that.destroyAllConnection()
        }, timeout)
      }

      that._server.close()
    })
  }

  getConnection (uid) {
    return this._conns[uid]
  }

  destroyConnection (uid) {
    if (!this.getConnection(uid)) return false
    this.i('destroy connection -', uid)
    this.getConnection(uid).destroy()
    return true
  }

  destroyAllConnection () {
    this.i('destory all connection')
    Object.keys(this._conns).forEach(uid => {
      this._conns[uid].destroy()
    })
  }
}
ForwardService.ServiceStatus = {
  OPEN: 1,
  ERROR: 2, // TODO: ERROR status handle methods
  CHANGING: 4
}
ForwardService.prototype.ServiceStatus = ForwardService.ServiceStatus

module.exports = ForwardService
