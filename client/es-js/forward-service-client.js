import "babel-polyfill";
import nodeInspect from 'util-inspect'
import SioClient from 'socket.io-client'

function humanFileSize (bytes, si) {
  const thresh = si ? 1000 : 1024
  if(Math.abs(bytes) < thresh) return bytes + ' B'
  const units = si
    ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
    : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB']
  let u = -1
  do { bytes /= thresh }
  while (++u < units.length - 1 && Math.abs(bytes) >= thresh)
  return bytes.toFixed(1)+' '+units[u];
}

function shortTimeString (date) {
  return date.getHours().toString().padStart(2, '0')
    + ':' + date.getMinutes().toString().padStart(2, '0')
    + ':' + date.getSeconds().toString().padStart(2, '0')
    + '.' + date.getMilliseconds().toString().padStart(3, '0')
}

function extend (target, source, overwrite) {
  for (let key in source) if (overwrite || !(key in target)) target[key] = source[key]
  return target
}

function canHasProperty (v) { return v !== undefined && v !== null }
function isObject (obj) { return obj !== null && typeof obj === 'object' }
const isArray = Array.isArray
function isFunction (func) { return typeof func === 'function' }
function isString (str) { return typeof str === 'string' }
function isNumber (num) { return typeof num === 'number' }
const isInteger = Number.isInteger
const isSafeInteger = Number.isSafeInteger
function instanceOf (obj, type) { return isFunction(type) && obj instanceof type }

function changeTextNode (element, text, justAppend) {
  if (!justAppend) while (element.firstChild) element.removeChild(element.firstChild)
  element.appendChild(document.createTextNode(text + ''))
}

class LoggerControl {
  constructor (rootElement, options) {
    this.eRoot = rootElement
    this.eMain = document.createElement('div')
    this.eMain.classList.add('logger-control')

    this.options = extend(options || {}, {
      maxHistory: 512,
      consoleLogging: false,
      appendTimeString: false,
      logLevel: 'debug',
      showLogLevel: 'info'
    }, false)

    this._history = []
    this.destroyed = false

    this.changeLogLevel(this.options.logLevel)
    this.changeShowLogLevel(this.options.showLogLevel)
  }

  destroy () {
    this.disattch()
    this._removeAllChild()
    this.eRoot = null
    this._history = null
    this.destroyes = true
  }

  attach () {
    this.eRoot.appendChild(this.eMain)
  }

  disattach () {
    this.eRoot.removeChild(this.eMain)
  }

  forceUpdate (newHistory) {
    this._removeAllChild()
    this._history = newHistory

    let over = null
    if ((over = this._history.length - this.options.maxHistory) > 0) {
      this._history.splice(0, over)
    }

    this._history.forEach(v => {
      const elm = document.createElement('pre')
      elm.classList.add('log', v.level)
      elm.appendChild(document.createTextNode(v.msg))
      this.eMain.appendChild(elm)
    })

    this.eMain.scrollTop = this.eMain.scrollHeight - this.eMain.clientHeight
  }

  changeShowLogLevel (level) {
    if (['debug', 'info', 'warn', 'error', 'none'].indexOf(level) === -1) return

    this.eMain.classList.remove('no-error', 'no-warn', 'no-info', 'no-debug')

    switch (level) {
      case 'none':
        this.eMain.classList.add('no-error')
      case 'error':
        this.eMain.classList.add('no-warn')
      case 'warn':
        this.eMain.classList.add('no-info')
      case 'info':
        this.eMain.classList.add('no-debug')
    }
  }

  changeLogLevel (level) {
    if (['debug', 'info', 'warn', 'error', 'none'].indexOf(level) === -1) return
    this.logLevel = level
  }

  _removeAllChild () {
    while (this.eMain.firstChild) this.eMain.removeChild(this.eMain.firstChild)
  }

  _addLog (logObj) {
    this._history[this._history.length] = logObj

    const elm = document.createElement('pre')
    elm.classList.add('log', logObj.level)
    elm.appendChild(document.createTextNode(logObj.msg))

    const bindBottom = Math.abs(this.eMain.scrollTop + this.eMain.clientHeight - this.eMain.scrollHeight) < 16
    this.eMain.appendChild(elm)
    if (bindBottom) this.eMain.scrollTop = this.eMain.scrollHeight - this.eMain.clientHeight

    // max history check
    let over = null
    if ((over = this._history.length - this.options.maxHistory) > 0) {
      this._history.splice(0, over)
      while (over--) this.eMain.removeChild(this.eMain.children[over])
    }
  }

  _logBase (level, args) {
    switch (level) {
      case 'debug':
        if (this.options.logLevel === 'info') return
      case 'info':
        if (this.options.logLevel === 'warn') return
      case 'warn':
        if (this.options.logLevel === 'error') return
      case 'error':
        if (this.options.logLevel === 'none') return
    }
    if (this.options.appendTimeString) args.unshift(`[${ shortTimeString(new Date()) }]`)
    if (this.options.consoleLogging) console[level](...args)
    this._addLog({
      level,
      msg: args.map(v => isObject(v) ? nodeInspect(v) : v).join(' ')
    })
  }

  debug () { this._logBase('debug', [ ...arguments ]) }
  info () { this._logBase('info', [ ...arguments ]) }
  warn () { this._logBase('warn', [ ...arguments ]) }
  error () { this._logBase('error', [ ...arguments ]) }

  handleSocketIO (sio) {
    sio.on('log', logObj => {
      this._logBase(logObj.level, [ logObj.msg ])
    })
  }
}

class SimplePopup {
  constructor (elementHTML) {
    this.eMain = document.createElement('div')
    this.eMain.classList.add('comp-popup', 'c-t')
    this.eCell = document.createElement('div')
    this.eCell.classList.add('c-c')
    this.eInline = document.createElement('div')
    this.eInline.classList.add('c-i')
    this.eInline.innerHTML = elementHTML
    this.eCell.appendChild(this.eInline)
    this.eMain.appendChild(this.eCell)
  }

  isShow () { return !!this.eMain.parentElement }

  show () {
    if (!this.isShow()) document.body.appendChild(this.eMain)
  }

  hide () {
    if (this.isShow()) this.eMain.parentElement.removeChild(this.eMain)
  }
}

class SimpleToast {
  constructor (options) {
    this.options = extend(options || {}, {
      location: 'downerRight', // ['upperLeft', 'upperRight', 'downerLeft', 'downerRight']
      contentOrder: 'ITB', // I: icon, T: text, B: button
      defaultBgColor: '#333333',
      defaultTextColor: '#FFFFFF',
      defaultHideAfter: 5000,
      maxToast: 5,
      maxHistroy: 100,
      checkInterval: 100
    }, false)
    this._optionsValidator()

    this.eMain = document.createElement('div')
    this.eMain.classList.add('comp-toast')
    this.eMain.style.position = 'fixed'
    this._styleUpdate()

    /*
     * toast object struct
     * {string} uid
     * {Element} element
     * {number} birth
     * {number} hideAfter
     * {number} hideAt
     */
    this._toasts = {}
    this._iuid = null
    this._uidCounter = 0
  }

  _generateUid () {
    return this._uidCounter++
  }

  _onInterval () {
    return !!this._iuid
  }

  _startInterval () {
    if (!this._onInterval()) {
      this._iuid = setInterval(this._update.bind(this), this.options.checkInterval)
    }
  }

  _stopInterval () {
    if (this._onInterval()) {
      clearInterval(this._iuid)
      this._iuid = null
    }
  }

  _optionsValidator () {
    if (['upperLeft', 'upperRight', 'downerLeft', 'downerRight']
      .indexOf(this.options.location) === -1) {

      console.warn('Invalid SimpleToast.options.location:', this.options.location)
      this.options.location = 'downerRight'
    }

    if (!this.options.contentOrder.match(/^[ITB]{1,3}$/)) {

      console.warn('Invalid SimpleToast.options.contentOrder:', this.options.contentOrder)
      this.options.contentOrder = 'ITB'
    }
  }

  _styleUpdate () {
    switch (this.options.location) {
      case 'upperLeft':
        extend(this.eMain.style, {
          top: 0,
          right: '',
          bottom: '',
          left: 0,
          textAlign: 'left'
        }, true)
        break
      case 'upperRight':
        extend(this.eMain.style, {
          top: 0,
          right: 0,
          bottom: '',
          left: '',
          textAlign: 'right'
        }, true)
        break
      case 'downerLeft':
        extend(this.eMain.style, {
          top: '',
          right: '',
          bottom: 0,
          left: 0,
          textAlign: 'left'
        }, true)
        break
      case 'downerRight':
        extend(this.eMain.style, {
          top: '',
          right: 0,
          bottom: 0,
          left: '',
          textAlign: 'right'
        }, true)
        break
    }

    this._disattachAllToast()
    // TODO: show last toast

  }

  _update () {
    const now = Date.now()
    let v = null
    let online = false
    let count = 0
    Object.keys(this._toasts).reverse().forEach(uid => {
      v = this._toasts[uid]
      if (v.element.parentElement) {
        online = true
        if (++count > this.options.maxToast || v.hideAt < now) {
          v.element.parentElement.removeChild(v.element)
        }
      }
    })

    if (!online) this._stopInterval()
  }

  _disattachAllToast () {
    while (this.eMain.firstChild) this.eMain.removeChild(this.eMain.firstChild)
  }

  _attachToast (element) {
    if (this.options.location.startsWith('upper')
      && this.eMain.firstChild) {

      this.eMain.firstChild.before(element)
    } else {
      this.eMain.appendChild(element)
    }

    this._startInterval()
  }

  isAttach () { return !!this.eMain.parentElement }

  attach () {
    if (!this.isAttach()) document.body.appendChild(this.eMain)
  }

  disattach () {
    if (this.isAttach()) this.eMain.remove()
  }

  hideAllToast () {
    this._disattachAllToast()
  }

  toast (input, hideAfter) {
    if (!isObject(input)) input = { text: 'Invalid input: ' + input }

    const uid = this._generateUid()
    const container = document.createElement('div')
    container.classList.add('toast')
    const element = document.createElement('div')
    element.classList.add('inline')
    element.style.backgroundColor = input.bgColor || this.options.defaultBgColor
    element.style.color = input.textColor || this.options.defaultTextColor

    let innerEle = null
    for (let v of this.options.contentOrder.split('')) {
      switch (v) {
        case 'T':
          innerEle = document.createElement('span')
          innerEle.classList.add('text')
          innerEle.innerText = input.text || '[blank message]'
          if (!innerEle.innerHTML) innerEle.appendChild(document.createTextNode(input.text || '[blank message]'))
          element.appendChild(innerEle)
          break
        case 'I':
          if (!input.icon) continue
          innerEle = document.createElement('span')
          innerEle.classList.add('icon', 'mdi', ...input.icon.split(' '))
          element.appendChild(innerEle)
          break
        case 'B':
          if (!input.buttonText) continue
          innerEle = document.createElement('button')
          innerEle.classList.add('button')
          innerEle.innerText = input.buttonText
          if (isFunction(input.buttonFunction)) innerEle.addEventListener('click', input.buttonFunction)
          element.appendChild(innerEle)
          break
        default: console.error('SimpleToast: Invalid contentOrder -', this.options.contentOrder)
      }
    }

    container.appendChild(element)

    this._toasts[uid] = {
      uid,
      element: container,
      birth: Date.now(),
      hideAfter: input.hideAfter || this.options.defaultHideAfter
    }
    this._toasts[uid].hideAt = this._toasts[uid].birth + this._toasts[uid].hideAfter

    this._attachToast(container)
  }
}

class ForwardManagerControl {
  constructor (rootElement, options) {
    this.eRoot = rootElement

    this.eMain = document.createElement('div')
    this.eMain.classList.add('fmc')
    this.eMain.innerHTML = `<div class="manager">
      <span class="title mdi mdi-swap-horizontal"> Semteul Forward Service</span>
      &nbsp;<span class="version"></span>
      <hr/>
      <div class="status">
        <p class="title h2-icon mdi mdi-heart"> Service status</p>
        <table class="connect large-icon">
          <tr class="img">
            <td class="status-icon img mdi mdi-server-network-off"></td>
          </tr>
          <tr class="desc">
            <td class="status-desc desc"></td>
          </tr>
        </table>
      </div>
      <hr/>
      <div class="setting">
        <p class="title h2-icon mdi mdi-settings"> Control panel</p>
        <button class="btn-create-profile"><span class="mdi mdi-plus"> Profile create</span></button>
        <div class="update-interval">
          <span class="desc">Data update interval: </span>
          <div class="indecator">
            <div class="bar"></div>
          </div>
          <br/>
          <input class="input"></input>
          <span class="tail"> milliseconds</span>
          <button class="submit">
            <span class="mdi mdi-timer"> Update</span>
          </button>
        </div>
      </div>
      <hr/>
      <div class="local-logger">
        <div class="header">
          <span class="title h2-icon mdi mdi-console"> Local log</span>
          <select class="log-level">
            <option value="debug">Debug</option>
            <option value="info" selected>Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="none">None</option>
          </select>
          <button class="toggle"><span class="mdi mdi-chevron-up"></span></button>
        </div>
        <div class="container"></div>
      </div>
      <hr/>
      <div class="remote-logger">
        <div class="header">
          <span class="title h2-icon mdi mdi-console"> Remote log</span>
          <select class="log-level">
            <option value="debug">Debug</option>
            <option value="info" selected>Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="none">None</option>
          </select>
          <button class="toggle"><span class="mdi mdi-chevron-up"></span></button>
        </div>
        <div class="container"></div>
      </div>
    </div>
    <div class="service-list"></div>`
    // title
    this.eVersion = this.eMain.querySelector('.manager > .version')
    // status
    this.eStatusIcon = this.eMain.querySelector('.manager > .status .status-icon')
    this.eStatusDesc = this.eMain.querySelector('.manager > .status .status-desc')
    // setting
    this.eBtnCreateProfile = this.eMain.querySelector('.manager > .setting > .btn-create-profile')
    // setting - update interval
    this.eInterval = this.eMain.querySelector('.manager > .setting > .update-interval')
    this.eIIndecator = this.eInterval.querySelector('.indecator')
    this.eIIndecatorBar = this.eInterval.querySelector('.indecator > .bar')
    this.eIDesc = this.eInterval.querySelector('.desc')
    this.eIInput = this.eInterval.querySelector('.input')
    this.eISubmit = this.eInterval.querySelector('.submit')
    // logger
    this.eLocalLogger = this.eMain.querySelector('.manager > .local-logger')
    this.eLLContainer = this.eLocalLogger.querySelector('.container')
    this.eLLLogLevel = this.eLocalLogger.querySelector('.log-level')
    this.eRemoteLogger = this.eMain.querySelector('.manager > .remote-logger')
    this.eRLContainer = this.eRemoteLogger.querySelector('.container')
    this.eRLLogLevel = this.eRemoteLogger.querySelector('.log-level')
    this.eServiceList = this.eMain.querySelector('.service-list')

    this.ePuCP = new SimplePopup(`
      <div class="create-profile">
        <div class="title">
          <span class="mdi mdi-server-plus"> Profile create</span>
        </div>
        <hr/>
        <p class="key name mdi mdi-rename-box"> Profile name</p>
        <input class="value name" type="text" placeholder="name..."></input>
        <p class="key dest mdi mdi-earth"> Destination host</p>
        <input class="value dest" type="text" placeholder="host || port..."></input>
        <p class="key source mdi mdi-ethernet"> Source port</p>
        <input class="value source" type="text" placeholder="port..."></input>
        <p class="key timeout mdi mdi-timer"> Idle timeout</p>
        <input class="value timeout" type="text" placeholder="milliseconds..." value="0"></input>
        <p class="key auto mdi mdi-power-settings"> Auto start</p>
        <input class="value auto" type="checkbox"></input>
        <br/>
        <span class="mdi mdi-information-outline"> Idle timeout: 0 to disable <span class="mdi mdi-timer-off"></span></span>
        <hr/>
        <div class="buttons">
          <button class="submit"><span class="mdi mdi-server-plus"> Create</span></button>
          <button class="cancel"><span class="mdi mdi-window-close"> Close</span></button>
        </div>
      </div>
    `)
    // popup
    this.ePuCPTitle = this.ePuCP.eMain.querySelector('.title')
    this.ePuCPName = this.ePuCP.eMain.querySelector('.value.name')
    this.ePuCPDest = this.ePuCP.eMain.querySelector('.value.dest')
    this.ePuCPSource = this.ePuCP.eMain.querySelector('.value.source')
    this.ePuCPTimeout = this.ePuCP.eMain.querySelector('.value.timeout')
    this.ePuCPAuto = this.ePuCP.eMain.querySelector('.value.auto')
    this.ePuCPSubmit = this.ePuCP.eMain.querySelector('.buttons > .submit')
    this.ePuCPSubmitInner = this.ePuCPSubmit.querySelector('span')
    this.ePuCPCancel = this.ePuCP.eMain.querySelector('.buttons > .cancel')

    // data
    this.services = {}
    this.updateDelay = 3000
    this._lastUpdateAt = null
    this._updateUid = null
    this.sio = SioClient()
    this.toaster = new SimpleToast({ location: 'downerRight' })
    this.toaster.attach()
    this.localLogger = new LoggerControl(this.eLLContainer, { appendTimeString: true, consoleLogging: true })
    this.localLogger.attach()
    this.remoteLogger = new LoggerControl(this.eRLContainer)
    this.remoteLogger.attach()
    this._profileModifyTarget = null
    this._updateIntervalReady = false
    this._raf = (window['requestAnimationFrame'] || window['setTimeout']).bind(window)
    this._caf = (window['cancelAnimationFrame'] || window['clearTimeout']).bind(window)
    this._afUid = null
    this._bindedDoAnimationFrame = this._doAnimationFrame.bind(this)

    // event handle
    this.eBtnCreateProfile.addEventListener('click', _ => {
      this._profileModifyTarget = null
      this._changeCreateProfileFormMode('add')
      this.ePuCP.show()
    })

    this.eIInput.addEventListener('keypress', event => {
      if (event.code === 'Enter') {
        this._updateUpdateInterval()
      }
    })

    this.eISubmit.addEventListener('click', _ => {
      this._updateUpdateInterval()
    })

    this.ePuCPSubmit.addEventListener('click', _ => {
      this.ePuCP.hide()
      if (this._profileModifyTarget) { // modify
        this.i('request<updateProfile>')
        this.sio.emit('updateProfile', this._profileModifyTarget, {
          dest: this.ePuCPDest.value,
          source: this.ePuCPSource.value,
          idleTimeout: this.ePuCPTimeout.value || 0,
          autoStart: this.ePuCPAuto.checked
        })
        this.sio.once('resUpdateProfile', status => {
          this.i('response<updateProfile>', status)
          if (status.success) {
            this.toaster.toast({
              text: 'Success profile update',
              icon: 'mdi-check mdi-24px',
              bgColor: '#4CAF50',
              hideAfter: 3000
            })
          } else {
            this.toaster.toast({
              text: 'Fail profile update: ' + status.error,
              icon: 'mdi-alert mdi-24px',
              bgColor: '#F44336',
              hideAfter: 16000
            })
          }
          this.updateNow()
        })
      } else { // add
        this.i('request<createProfile>')
        this.sio.emit('createProfile', this.ePuCPName.value, {
          dest: this.ePuCPDest.value,
          source: this.ePuCPSource.value,
          idleTimeout: this.ePuCPTimeout.value || 0,
          autoStart: this.ePuCPAuto.checked
        })
        this.sio.once('resCreateProfile', status => {
          this.i('response<createProfile>', status)
          if (status.success) {
            this.toaster.toast({
              text: 'Success profile create',
              icon: 'mdi-check mdi-24px',
              bgColor: '#4CAF50',
              hideAfter: 3000
            })
          } else {
            this.toaster.toast({
              text: 'Fail profile create: ' + status.error,
              icon: 'mdi-alert mdi-24px',
              bgColor: '#F44336',
              hideAfter: 16000
            })
          }
          this.updateNow()
        })
      }
      this._resetCreateProfileForm()
    })

    this.ePuCPCancel.addEventListener('click', _ => {
      this.ePuCP.hide()
      this._resetCreateProfileForm()
    })

    this.eLLLogLevel.addEventListener('change', event => {
      this.localLogger.changeShowLogLevel(event.target.selectedOptions[0].value)
    })

    this.eRLLogLevel.addEventListener('change', event => {
      this.remoteLogger.changeShowLogLevel(event.target.selectedOptions[0].value)
    })

    // socket io event
    this.sio.on('connect', () => {
      this.i('service connected')
      this._changeStatus('connect')
      this.reqInfomation()
      this.reqUpdate()
      this.reqLogHistory()
    })

    this.sio.on('disconnect', () => {
      this._changeStatus('disconnect')
      this.i('service disconnected')
    })

    this.sio.on('reconnecting', attempt => {
      this.i('reconnect attempt', attempt)
      this._changeStatus('attempt', attempt)
    })

    this.sio.on('reconnect', () => {
      this.i('service reconnect')
      this._changeStatus('connect')
      this.reqInfomation()
    })

    this.sio.on('currentData', data => {
      this.d('service updated')
      this._update(data)
    })

    this.remoteLogger.handleSocketIO(this.sio)

    // attach default
    this.attach()
    this._setupUpdateInterval()
    this._requestAnimationFrame()
    this.i('ForwardManagerControl instance ready')
  }

  get statusText () { return this.eStatusDesc.innerText }
  set statusText (v) { changeTextNode(this.eStatusDesc, v) }

  destroy () {
    this.w('ForwardManagerControl instance destroyed')
    this._cancelAnimationFrame()
    this.cancelUpdate()
    this.sio.disconnect()
    this.disattach()
  }

  d () { this.localLogger.debug(...arguments) }
  i () { this.localLogger.info(...arguments) }
  w () { this.localLogger.warn(...arguments) }
  e () { this.localLogger.error(...arguments) }

  attach () {
    this.d('ForwardManagerControl form attached')
    this.eRoot.appendChild(this.eMain)
  }

  disattach () { // no need
    this.d('ForwardManagerControl form disattached')
    this.eRoot.removeChild(this.eMain)
  }

  reqInfomation () {
    this.d('reqInfomation')
    this.sio.emit('reqInfomation')
    this.sio.once('infomation', v => {
      changeTextNode(this.eVersion, `v${v.forwardServiceVersion}-${v.middlewareVersion}`)
    })
  }

  reqLogHistory () {
    this.d('reqLogHistory')
    this.sio.emit('reqLogHistory')
    this.sio.once('logHistory', v => { this.remoteLogger.forceUpdate(v) })
  }

  reqUpdate (delay) {
    this._updateUid = setTimeout(() => {
      this.sio.emit('reqCurrentData')
    }, delay)
  }

  updateNow () {
    this.sio.emit('reqCurrentData')
  }

  cancelUpdate () {
    clearTimeout(this._updateUid)
  }

  _requestAnimationFrame () {
    this._afUid = this._raf(this._bindedDoAnimationFrame)
  }

  _cancelAnimationFrame () {
    this._caf(this._afUid)
    this._afUid = null
  }

  _doAnimationFrame () {
    this._updateUpdateIntervalIndecator()

    this._requestAnimationFrame()
  }

  _update (data) {
    this.cancelUpdate()

    try {
      const remoteServices = data.services
      Object.keys(this.services).forEach(name => {
        if (!remoteServices[name]) {
          // delete instance
          this.services[name].destroy()
          delete this.services[name]
        }
      })
      Object.keys(remoteServices).forEach(name => {
        if (this.services[name]) {
          // update instance
          this.services[name].update(remoteServices[name])
        } else {
          // create instance
          this.services[name] = new ServiceInstanceControl(this, this.eServiceList,
            remoteServices[name])
        }
      })
    } catch (err) {
      this.e('refresh fail', err)
      if (!this._updateFailed) {
        this._updateFailed = true
        this.toaster.toast({
          text: 'Refresh data fail (This message only show once): ' + nodeInspect(err),
          icon: 'mdi-alert mdi-24px',
          bgColor: '#F44336',
          hideAfter: 16000
        })
      }
    }

    this._lastUpdateAt = Date.now()
    this.reqUpdate(this.updateDelay)
  }

  _changeStatus (status, retryAttempt) {
    this.d('_changeStatus:', status)
    switch (status) {
      case 'connect':
        this.statusText = 'Connected'
        this.eStatusIcon.className = 'status-icon img mdi mdi-lan-connect'
        break
      case 'disconnect':
        this.statusText = 'Disconnected'
        this.eStatusIcon.className = 'status-icon img mdi mdi-lan-disconnect'
        break
      case 'attempt':
        this.statusText = `Attempt connect... (${retryAttempt})`
        this.eStatusIcon.className = 'status-icon img mdi mdi-lan-pending'
        break
      default:
        this.statusText = 'Undefined status: ' + v
    }
  }

  _resetCreateProfileForm () {
    this.d('_resetCreateProfileForm')
    this._createProfileFormPreValue('', '', '', 0, false)
  }

  _createProfileFormPreValue (name, dest, source, timeout, autostart) {
    this.d('_createProfileFormPreValue')
    this.ePuCPName.value = name
    this.ePuCPDest.value = dest
    this.ePuCPSource.value = source
    this.ePuCPTimeout.value = timeout
    this.ePuCPAuto.checked = autostart
  }

  _changeCreateProfileFormMode (mode) {
    this.d('_changeCreateProfileFormMode:', mode)
    switch (mode) {
      case 'add':
        this.ePuCPTitle.className = 'mdi mdi-server-plus'
        changeTextNode(this.ePuCPTitle, ' Profile create')
        this.ePuCPSubmitInner.className = 'mdi mdi-server-plus'
        changeTextNode(this.ePuCPSubmitInner, ' Create')
        this.ePuCPName.disabled = false
        break
      case 'modify':
        this.ePuCPTitle.className = 'mdi mdi-settings'
        changeTextNode(this.ePuCPTitle, ' Profile setting')
        this.ePuCPSubmitInner.className = 'mdi mdi-check'
        changeTextNode(this.ePuCPSubmitInner, ' Update')
        this.ePuCPName.disabled = true
        break
    }
  }

  _setupUpdateInterval () {
    this.d('_setupUpdateInterval')
    this.eIInput.value = this.updateDelay
    this._updateIntervalReady = true
  }

  _updateUpdateInterval () {
    const v = parseInt(this.eIInput.value)
    this.i('_updateUpdateInterval:', v)
    if (!(v >= 500 && v <= 60000)) {
      this.toaster.toast({
        text: 'Update interval must range(>= 500, <= 60000) of integer',
        icon: 'mdi-alert mdi-24px',
        bgColor: '#F44336',
        hideAfter: 16000
      })
      return
    }

    this.updateDelay = v
    this.updateNow()
  }

  _updateUpdateIntervalIndecator () {
    if (!this._updateIntervalReady) return

    this.eIIndecatorBar.style.left = ((Date.now() - this._lastUpdateAt) / this.updateDelay * 100) + '%'
  }
}

class ServiceInstanceControl {
  constructor (ctx, rootElement, instanceData) {
    this.ctx = ctx
    // element control
    this.eRoot = rootElement
    this.eMain = document.createElement('div')
    this.eMain.classList.add('service', 'detail')
    this.eMain.innerHTML = `<div class="header">
      <span class="status-icon">
        <span class="open mdi mdi-pause" title="Service open indecator"></span>
        <span class="autostart mdi mdi-autorenew" title="Autostart enabled"></span>
        <span class="alert mdi mdi-alert" title="Error occur"></span>
      </span>
      <span class="name mdi"> [service name]</span>
      <span class="path">[path]</span>
      <span class="data">[data]</span>
      <span class="summary">[summary]</span>
      <span class="btn-detail mdi mdi-dots-vertical"></span>
    </div>
    <div class="detail">
      <span class="start mdi mdi-pause"> Server ON</span>
      <span class="setting mdi mdi-settings"> Setting</span>
      <span class="delete mdi mdi-delete"> Remove</span>
      <span class="count mdi mdi-server"> Connections: -</span>
    </div>
    <div class="conn-list"></div>`
    this.eHeader = this.eMain.querySelector('.service > .header')
    this.eStatusIcon = this.eMain.querySelector('.service > .header > .status-icon')
    this.eIsOpen = this.eStatusIcon.querySelector('.open')
    this.eIsAutostart = this.eStatusIcon.querySelector('.autostart')
    this.eIsAlert = this.eStatusIcon.querySelector('.alert')
    this.eName = this.eMain.querySelector('.service > .header > .name')
    this.ePath = this.eMain.querySelector('.service > .header > .path')
    this.eData = this.eMain.querySelector('.service > .header > .data')
    this.eSummary = this.eMain.querySelector('.service > .header > .summary')

    this.eDetail = this.eMain.querySelector('.service > .detail')
    this.eDTStart = this.eDetail.querySelector('.start')
    this.eDTSetting = this.eDetail.querySelector('.setting')
    this.eDTDelete = this.eDetail.querySelector('.delete')
    this.eDTCount = this.eDetail.querySelector('.count')

    this.eConns = this.eMain.querySelector('.service > .conn-list')

    // data
    this.lastData = null

    // event handle
    this.eHeader.addEventListener('click', _ => {
      this.eMain.classList.toggle('detail')
      this.ctx.updateNow()
    })

    this.eDTStart.addEventListener('click', _ => {
      if (this.lastData.status & 1) { // close
        this.i('request<stopProfile>')
        this.ctx.sio.emit('stopProfile', this.lastData.name, 0)
        this.ctx.sio.once('resStopProfile', status => {
          this.i('response<stopProfile>', status)
          if (status.success) {
            this.ctx.toaster.toast({
              text: 'Profile stop success',
              icon: 'mdi-check mdi-24px',
              bgColor: '#4CAF50',
              hideAfter: 3000
            })
          } else {
            this.ctx.toaster.toast({
              text: 'Fail profile stop: ' + status.error,
              icon: 'mdi-alert mdi-24px',
              bgColor: '#F44336',
              hideAfter: 16000
            })
          }
          this.ctx.updateNow()
        })
      } else { // open
        this.i('request<startProfile>')
        this.ctx.sio.emit('startProfile', this.lastData.name)
        this.ctx.sio.once('resStartProfile', status => {
          this.i('response<startProfile>', status)
          if (status.success) {
            this.ctx.toaster.toast({
              text: 'Profile start success',
              icon: 'mdi-check mdi-24px',
              bgColor: '#4CAF50',
              hideAfter: 3000
            })
          } else {
            this.ctx.toaster.toast({
              text: 'Fail profile start: ' + status.error,
              icon: 'mdi-alert mdi-24px',
              bgColor: '#F44336',
              hideAfter: 16000
            })
          }
          this.ctx.updateNow()
        })
      }
    })

    this.eDTSetting.addEventListener('click', _ => {
      this.ctx._profileModifyTarget = this.lastData.name
      this.ctx._changeCreateProfileFormMode('modify')
      this.ctx._createProfileFormPreValue(this.lastData.name, this.lastData.dest,
        this.lastData.source, this.lastData.idleTimeout, this.lastData.isAutoStart)
      this.ctx.ePuCP.show()
    })

    this.eDTDelete.addEventListener('click', _ => {
      this.i('request<removeProfile>')
      this.ctx.sio.emit('removeProfile', this.lastData.name, 0)
      this.ctx.sio.once('resRemoveProfile', status => {
        this.i('response<removeProfile>', status)
        if (status.success) {
          this.ctx.toaster.toast({
            text: 'Profile remove success',
            icon: 'mdi-check mdi-24px',
            bgColor: '#4CAF50',
            hideAfter: 3000
          })
        } else {
          this.ctx.toaster.toast({
            text: 'Fail profile remove: ' + status.error,
            icon: 'mdi-alert mdi-24px',
            bgColor: '#F44336',
            hideAfter: 16000
          })
        }
        this.ctx.updateNow()
      })
    })

    // init
    this.update(instanceData)
    this.attach()
  }

  destroy () {
    this.disattach()
  }

  d () { this.ctx.localLogger.debug(...arguments) }
  i () { this.ctx.localLogger.info(...arguments) }
  w () { this.ctx.localLogger.warn(...arguments) }
  e () { this.ctx.localLogger.error(...arguments) }

  isAttach () { return !!this.eMain.parentElement }

  attach () {
    if (!this.isAttach()) this.eRoot.appendChild(this.eMain)
  }

  disattach () {
    if (this.isAttach()) this.eMain.parentElement.removeChild(this.eMain)
  }

  isDetailEnable () {
    return this.eMain.classList.contains('detail')
  }

  update (instanceData) {
    this._updateStatus(instanceData.status, instanceData.isAutoStart)
    this._updateName(instanceData.name)
    this._updatePath(instanceData.source, instanceData.dest)
    this._updateData(instanceData.totalBytesRead, instanceData.totalBytesWritten)
    if (this.isDetailEnable()) this._updateDetail(instanceData)
    else this._updateSummary(Object.keys(instanceData.conns).length)
    this._updateConnections(instanceData.conns)
    this.lastData = instanceData
  }

  _updateStatus (status, autostart) {
    this.eIsOpen.classList.remove('mdi-play', 'mdi-pause')
    if (status & 1) { // open
      this.eIsOpen.classList.add('mdi-play')
    } else {
      this.eIsOpen.classList.add('mdi-pause')
    }

    if (status & 4) { // error
      this.eIsAlert.style.display = 'inline-block'
    } else {
      this.eIsAlert.style.display = 'none'
    }

    if (autostart) { // auto start enable
      this.eIsAutostart.style.display = 'inline-block'
    } else {
      this.eIsAutostart.style.display = 'none'
    }
  }

  _updateName (name) { changeTextNode(this.eName, ' ' + name) }

  _updatePath (source, dest) {
    this.ePath.innerHTML = `<span class="client mdi mdi-ethernet">${
      '&nbsp;' + source
    }</span><span class="link mdi mdi-swap-horizontal"></span><span class="dest mdi mdi-earth">${
      '&nbsp;' + dest
    }</span>`
  }

  _updateData (read, write) {
    this.eData.innerHTML = `<pre class="write mdi mdi-desktop-mac"> ${
      '&nbsp;' + humanFileSize(write, false).padStart(10)
    }</pre><span class="link mdi mdi-swap-horizontal"></span><pre class="write mdi mdi-earth"> ${
      '&nbsp;' + humanFileSize(read, false).padStart(10)
    }</pre>`
  }

  _updateSummary (connCount) { changeTextNode(this.eSummary, 'connections: ' + connCount) }

  _updateDetail (data) {
    if (data.status & 1) { // is open
      this.eDTStart.className = 'start mdi mdi-pause'
      changeTextNode(this.eDTStart, ' Server stop')
    } else {
      this.eDTStart.className = 'start mdi mdi-play'
      changeTextNode(this.eDTStart, ' Server start')
    }

    changeTextNode(this.eDTCount, ' Connections: ' + Object.keys(data.conns).length)
  }

  _updateConnections (conns) {
    while (this.eConns.firstChild) this.eConns.removeChild(this.eConns.firstChild)
    let ele = null
    Object.keys(conns).forEach(key => {
      const conn = conns[key]
      ele = document.createElement('div')
      ele.classList.add('conn')
      ele.innerHTML = `<span class="client mdi mdi-desktop-mac">${
        '&nbsp;' + conn.clientAddress + ':' + conn.clientPort
      }</span> - <span class="data"><pre class="write mdi mdi-desktop-mac"> ${
        '&nbsp;' + humanFileSize(conn.bytesWritten, false).padStart(10)
      }</pre><span class="link mdi mdi-swap-horizontal"></span><pre class="write mdi mdi-earth"> ${
        '&nbsp;' + humanFileSize(conn.bytesRead, false).padStart(10)
      }</pre></span>`

      this.eConns.appendChild(ele)
    })
  }
}

window.fmc = new ForwardManagerControl(document.body)
