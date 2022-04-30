function customError (obj, baseOn = Error) {
  if (typeof obj === 'object') {
    const err = new baseOn(obj.message)
    for (let key in obj) if (key !== 'message') err[key] = obj[key]
    return err
  } else return new baseOn(obj)
}

module.exports = customError
