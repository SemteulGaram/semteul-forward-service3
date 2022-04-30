// forward service middleware for socket.io
const { resolve: pResolve } = require('path')
const { inspect } = require('util')

const efs = require('fs-extra')

const ForwardManager = require('./forward-manager')
//const ForwardLogger = require('./forward-logger')
const { isObject, shortTimeString } = require('./misc')

// ForwardService version
let forwardServiceVersion = null
// middleware protocol version
const middlewareVersion = '1'

const configPath = pResolve(__dirname, '..', 'forward-manager-config.json')
let fm = null // forward managet instance
let fmLogger = null // forward logger instance
let io = null // socket.io instance
const sioConns = {}

try {
  const content = efs.readJsonSync(pResolve(__dirname, '..', 'package.json'))
  console.log('ForwardService version:', content.version)
  forwardServiceVersion = content.version
} catch(err) {
  console.error(err)
  console.error('FAIL READ "version" FROM "package.json"')
  forwardServiceVersion = err.message
}

class ForwardLogger {
  constructor (max) {
    this.history = []
    this.maxHistory = max || 512
  }

  _base (level, args) {
    const logObj = {
      level,
      msg: `[${shortTimeString(new Date())}] `
        + args.map(v => isObject(v) ? inspect(v) : v).join(' ')
    }

    this.history[this.history.length] = logObj
    if (this.history.length > this.maxHistory)
      this.history.splice(0, this.history.length - this.maxHistory)

    console[level](logObj.msg)
    if (io) io.emit('log', logObj)
  }

  debug () { this._base('debug', Array.prototype.slice.call(arguments)) }

  info () { this._base('info', Array.prototype.slice.call(arguments)) }

  warn () { this._base('warn', Array.prototype.slice.call(arguments)) }

  error () { this._base('error', Array.prototype.slice.call(arguments)) }
}

/*
 * Handle ForwardManager 3 way
 *
 * 1. Send full status every 3~10 seconds
 *   - Not enough but simple - SELECTION
 * 2. Send all changes using events
 *   - Heavy and complex - DISMISS
 * 3. Capture changes in to special area and commit to client every 3~10 second
 *   - Best but too complex - DISMISS
 */
function handleSIO (sio) {
  io = sio
  sio.on('connection', socket => {
    // register
    const id = `${socket.request.socket.remoteAddress}:${socket.request.socket.remotePort}`
    if (sioConns[id]) console.warn('[WARN] ForwardMiddleware> handleSIO> duplicated sio id:', id) // TODO: remove this
    sioConns[id] = socket

    // unregister
    socket.on('disconnect', () => {
      delete sioConns[id]
    })

    // ForwardManager information
    const reqInfomation = () => {
      socket.emit('infomation', {
        forwardServiceVersion,
        middlewareVersion
      })
    }
    socket.on('reqInfomation', reqInfomation)

    // refresh request
    const reqCurrentData = () => { socket.emit('currentData', fm.toPlainData()) }
    socket.on('reqCurrentData', reqCurrentData)

    // refresh log history request
    const reqLogHistory = () => { socket.emit('logHistory', fmLogger.history) }
    socket.on('reqLogHistory', reqLogHistory)

    // profile create request
    socket.on('createProfile', (name, profile) => {
      fm.createProfile(name, profile).then(() => {
        socket.emit('resCreateProfile', {
          success: true
        })
      }).catch(err => {
        socket.emit('resCreateProfile', {
          success: false,
          error: inspect(err)
        })
      })
    })

    // profile remove request
    socket.on('removeProfile', (name, timeout) => {
      fm.removeProfile(name, timeout).then(() => {
        socket.emit('resRemoveProfile', {
          success: true
        })
      }).catch(err => {
        socket.emit('resRemoveProfile', {
          success: false,
          error: inspect(err)
        })
      })
    })

    // profile update request
    socket.on('updateProfile', (name, profile) => {
      let service = null
      if (!(service = fm.getService(name))) {
        socket.emit('resUpdateProfile', {
          success: false,
          error: 'Service not exists'
        })
        return
      }

      try {
        service.changeOptions(profile)
        socket.emit('resUpdateProfile', {
          success: true,
        })
      } catch (err) {
        switch (err.code) {
          case 'ERR_SERVICE_CHANGING':
            err = 'Service status is now changing. try again later'
            break
          case 'ERR_ALREADY_OPEN':
            err = 'Service server is open. close it first'
          default:
            err = inspect(err)
        }
        socket.emit('resUpdateProfile', {
          success: false,
          error: err
        })
      }
    })

    // profile start request
    socket.on('startProfile', name => {
      fm.startProfile(name).then(() => {
        socket.emit('resStartProfile', {
          success: true
        })
      }).catch(err => {
        socket.emit('resStartProfile', {
          success: false,
          error: inspect(err)
        })
      })
    })

    // profile stop request
    socket.on('stopProfile', (name, timeout) => {
      fm.stopProfile(name, timeout).then(() => {
        socket.emit('resStopProfile', {
          success: true
        })
      }).catch(err => {
        socket.emit('resStopProfile', {
          success: false,
          error: inspect(err)
        })
      })
    })
    // TODO: more methods

    // send current data once
    console.log('new sio connection', id)
    socket.emit('connect')
  })
}

fmLogger = new ForwardLogger()
fm = new ForwardManager(configPath, fmLogger, (err) => {
  if (err) {
    console.error(err)
    console.error('GLOBAL FORWARD MANAGER ERROR')
  }
})

module.exports = {
  instance: fm,
  handleSIO,
  middlewareVersion,
  forwardServiceVersion
}
