const { resolve } = require('path')
const selfAnalysis = require('./self-analysis')

selfAnalysis(resolve(__dirname, '..')).then(result => {
  let files = result.fileList.length.toLocaleString(),
    chars = result.totalChars.toLocaleString(),
    lines = result.totalLines.toLocaleString(),
    size = result.totalHumanSize
  console.log('Self Analysis result:')
  console.log(`total files: ${files}`)
  console.log(`total chars: ${chars}`)
  console.log(`total lines: ${lines}`)
  console.log(`total size: ${size}`)
}).catch(console.error)
