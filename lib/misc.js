// misc v1.1

/***
 * Idea & Notes
 *
 * - 자바스크립트는 곧 오브젝트.
 *   오브젝트를 자유자제로 다루는게 곳 자바스크립트를 마스터 하는 길
 *   Next> 오브젝트가 플레인인지 판별하는 메소드 구현
 */

const { inspect } = require('util')

const clone = require('clone')
const _isBuffer = require('is-buffer')

const exErr = require('./extend-error')

// things which make me frowned upon
function canHasProperty (v) { return v !== undefined && v !== null }
function isObject (obj) { return obj !== null && typeof obj === 'object' }
const isArray = Array.isArray
const isBuffer = _isBuffer
function isFunction (func) { return typeof func === 'function' }
function isString (str) { return typeof str === 'string' }
function isNumber (num) { return typeof num === 'number' }
const isInteger = Number.isInteger
const isSafeInteger = Number.isSafeInteger
function instanceOf (obj, type) { return isFunction(type) && obj instanceof type }
function isDev () { return ('' + process.env.NODE_ENV).toLowerCase() !== 'production'}

function getDeepProperty(obj, propertyChain) {
  return propertyChain.reduce((pv, cv) => canHasProperty(pv) ? pv[cv] : undefined, obj)
}

function getClassName (obj) {
  if (!canHasProperty(obj)) return undefined
  if (!isFunction(obj)) obj = obj.constructor
  if (obj.name) return obj.name
  const match = obj.toString().match(/^function [\w]+/)
  return match ? match[0].substring(9) : undefined
}

function format (str, ...args) {
  if (!isString(str)) return str
  else return str.replace(/{(\d+)}/g, (_, i) => args[i])
}

// inspect format
function iFormat (str, ...args) {
  if (!isString(str)) return str
  for (var key in args) if (isObject(args[key])) args[key] = inspect(args[key])
  return str.replace(/{(\d+)}/g, (_, i) => args[i])
}

// https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
function deepFreeze(o) {
  var prop, propKey;
  Object.freeze(o); // 외부의 감싸는 객체 o부터 얼림
  for (propKey in o) {
    prop = o[propKey];
    if (!o.hasOwnProperty(propKey) || !(typeof prop === 'object') || Object.isFrozen(prop)) {
      // 내부 객체인 prop이 o에 있지 않고 프로토타입 객체에 있거나, prop의 타입이 object가 아니거나, prop이 이미 얼려있다면 얼리지 않고 통과
      // 이렇게 하면 이미 얼려진 prop 내부에 얼려지지 않은 객체 A가 있을 경우, A는 여전히 얼려지지 않는 상태로 남게됨
      continue;
    }

    deepFreeze(prop); // 재귀 호출
  }
}

function humanFileSize(bytes, si) {
  const thresh = si ? 1000 : 1024
  if(Math.abs(bytes) < thresh) return bytes + ' B'
  const units = si
    ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
    : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB']
  let u = -1
  do {bytes /= thresh} while(++u < units.length - 1 && Math.abs(bytes) >= thresh)
  return bytes.toFixed(1)+' '+units[u];
}

function extend (target, source, overwrite) {
  for (let key in source) if (overwrite || !(key in target)) target[key] = source[key]
  return target
}

function recursiveExtend (target, source, overwrite = false, innerObjectClone = true) {
  for (let key in source) {

    if (key in target) {

      if (isObject(source[key]) && isObject(target[key])) {
        recursiveExtend(target[key], source[key], overwrite, innerObjectClone)
        continue

      } else if (!overwrite) continue
    }

    if (isObject(source[key]) && innerObjectClone) target[key] = clone(source[key])
    else target[key] = source[key]
  }
  return target
}

function safeDefineProperties (target, options) {
  Object.keys(options).forEach(v => extend(options[v], (options[v].get || options[v].set)
    ? safeDefineProperties.DEFAULT_ACCESSOR_DESCRIPTOR
    : safeDefineProperties.DEFAULT_DATA_DESCRIPTOR, false))
  return Object.defineProperties(target, options)
}
safeDefineProperties.DEFAULT_DATA_DESCRIPTOR = {
  configurable: false,
  enumerable: false,
  writable: false
}
safeDefineProperties.DEFAULT_ACCESSOR_DESCRIPTOR = {
  configurable: false,
  enumerable: false
}

function objectIndexOf (obj, value) {
  if (isObject(obj)) for (let key in obj) if (obj[key] === value) return key
  return -1
}

function shortTimeString (date) {
  return date.getHours().toString().padStart(2, '0')
    + ':' + date.getMinutes().toString().padStart(2, '0')
    + ':' + date.getSeconds().toString().padStart(2, '0')
    + '.' + date.getMilliseconds().toString().padStart(3, '0')
}

function callbackHandler (emitter, resolveName, rejectName, callback) {
  emitter.once(resolveName, (...args) => {
    emitter.removeListener(rejectName, callback)
    callback.call(global, null, ...args)
  })

  emitter.once(rejectName, err => {
    emitter.removeListener(resolveName, callback)
    callback.call(global, err)
  })
}

module.exports = {
  canHasProperty,
  isObject,
  isArray,
  isBuffer,
  isFunction,
  isString,
  isNumber,
  isInteger,
  isSafeInteger,
  instanceOf,
  isDev,
  getDeepProperty,
  getClassName,
  format,
  iFormat,
  deepFreeze,
  clone,
  humanFileSize,
  extend,
  recursiveExtend,
  safeDefineProperties,
  objectIndexOf,
  shortTimeString,
  callbackHandler
}
