const EventEmitter = require('events')

const { shortTimeString } = require('./misc')

class ForwardLogger extends EventEmitter {
  constructor (doConsoleLog) {
    super()
    if (doConsoleLog) this.doConsoleLog()
  }

  static prefix (args, level) {
    Array.prototype.unshift.call(args, `${ shortTimeString(new Date()) }>${ (level+'').toUpperCase() }>`)
    return args
  }

  // TODO: level
  doConsoleLog () {
    this.on('log', (level, msgs) => {
      console[level].apply(console, ForwardLogger.prefix(msgs, level))
    })
  }

  debug () { this.emit('log', 'debug', arguments) }
  info () { this.emit('log', 'info', arguments) }
  warn () { this.emit('log', 'warn', arguments) }
  error () { this.emit('log', 'error', arguments) }
}

module.exports = ForwardLogger
