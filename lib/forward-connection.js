const EventEmitter = require('events')
const net = require('net')

const { isObject } = require('./misc')
let ForwardService = null // need lazy loading

class ForwardConnection extends EventEmitter {
  constructor (ctx, uid, clientSocket, idleTimeout) {
    // lazy load due to circulation problem
    if (!ForwardService) ForwardService = require('./forward-service')

    // valid check
    if (!(ctx instanceof ForwardService)) throw exErr({
      message: 'ctx parameter must instance of ForwardService',
      code: 'ERR_INVALID_PARAMETER'
    })
    if (!(clientSocket instanceof net.Socket)) throw exErr({
      message: 'client parameter must inatnce of net.Socket',
      code: 'ERR_INVALID_PARAMETER'
    })
    if (clientSocket.destroyed) {
      throw exErr({
        message: 'Client socket destroyed before open',
        code: 'ERR_CLIENT_DESTROYED'
      })
    } // TODO: handle on parent instance

    // init
    super()

    this.uid = uid
    this.ctx = ctx
    this.logger = ctx.logger
    this.loggerPrefix = `service[${this.ctx.name}]> connection[${this.uid}]>`

    this.status = 0
    this.client = clientSocket
    this.dest = net.createConnection(this.ctx.destPort,
      this.ctx.destHostname)
    this.dest.pause()
    this.idleTimeout = idleTimeout || 0

    // client handle
    if (idleTimeout != 0) this.client.setTimeout(this.idleTimeout, () => {
      this.emit('timeout')
      this.destroy()
    })

    //this.client.removeAllListeners('error')
    this.client.on('error', err => {
      // TODO: handle some error (EPIPE, EEXHUST, ECONRESET, ENOBUF, ENIARG)
      this.d('client> exception -', err)
    })

    this.client.on('close', () => {
      this.d('client> close')
      this.destroy()
    })

    // destination handle
    this.dest.on('error', err => {
      // TODO: error handle?
      this.d('dest> exception -', err)
    })

    this.dest.on('close', () => {
      this.d('dest> close')
      this.destroy()
    })

    this.dest.on('connect', () => {
      this.dest.pipe(this.client)
      this.client.pipe(this.dest)
      //this.resume() auto resumed

      this.status |= this.ConnStatus.PIPE
      this.d('established')
      this.emit('piped')
    })

    this.i('connection created')
  }

  // logger controls
  d () { this.logger.debug(this.loggerPrefix, ...arguments) }
  i () { this.logger.info(this.loggerPrefix, ...arguments) }
  w () { this.logger.warn(this.loggerPrefix, ...arguments) }
  e () { this.logger.error(this.loggerPrefix, ...arguments) }

  toPlainData () {
    return {
      uid: this.uid,
      status: this.statCode,
      bytesRead: this.client.bytesRead,
      bytesWritten: this.client.bytesWritten,
      clientFamily: this.client.remoteFamily,
      clientAddress: this.client.remoteAddress,
      clientPort: this.client.remotePort
    }
  }

  destroy () {
    if (!this.client.destroyed) this.client.destroy()
    if (!this.dest.destroyed) this.dest.destroy()
    if (!(this.status & this.ConnStatus.DESTROY)) {
      this.status += this.ConnStatus.DESTROY
      this.i(`destroy`)
      this.emit('destroy')
    }
  }

  isPaused () {
    return this.client.isPaused() || this.dest.isPaused()
  }

  pause () {
    this.client.pause()
    this.dest.pause()
    this.emit('pause')
  }

  resume () {
    this.client.resume()
    this.dest.resume()
    this.emit('resume')
  }
}
ForwardConnection.ConnStatus = {
  'PIPE': 1,
  'DESTROY': 2
}
ForwardConnection.prototype.ConnStatus = ForwardConnection.ConnStatus

module.exports = ForwardConnection
