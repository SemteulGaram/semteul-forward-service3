// node modules
const { join: pj } = require('path')
// dependency modules
const debug = require('debug')('self-analysis')
const clone = require('clone')
const fs = require('fs-extra')
// custom modules
// init modules
const EXCLUD_LIST = [
  'node_modules',
  '.git',
  'client/static/external',
  '__DEPRECATED__'
]
const VALID_EXTENSION = [
  'js',
  'bat',
  'sh',
  'css',
  'pug',
  'html'
]

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

async function analysis(dir = __dirname) {
  debug(`analysis: ${dir}`)
  const exclude = EXCLUD_LIST.slice().map(v => {return pj(dir, v)})

  debug(`exclude list: ${exclude.join(', ')}`)
  const [fileList, fileSize, folderList, folderSize, currentFolderSize]
    = await analysisFileList(dir, exclude)
  debug(`analysis - fileCount: ${fileList.length}, totalSize: ${currentFolderSize}`)

  const chars = [], lines = []
  let content, matched
  for(let v of fileList) {
    content = await fs.readFile(v, 'utf8')
    chars.push(content.length)
    matched = content.match(/\n/g)
    lines.push(matched ? matched.length + 1 : 1)
  }

  return {
    fileList: fileList,
    fileSize: fileSize,
    fileChars: chars,
    fileLines: lines,

    folderList: folderList,
    folderSize: folderSize,

    totalSize: currentFolderSize,
    totalHumanSize: humanFileSize(currentFolderSize, false),
    totalChars: chars.reduce((pv, cv) => {return pv + cv}),
    totalLines: lines.reduce((pv, cv) => {return pv + cv})
  }
}

async function analysisFileList(dir, exclude) {
  debug(`analysis folder: ${dir}`)
  let fileList = [], fileSize = [], folderList = [], folderSize = [], currentFolderSize = 0
  const list = await fs.readdir(dir)
  for(let v of list) {
    const path = pj(dir, v)
    const stats = await fs.lstat(path)
    // exclude check
    let pass = true
    exclude.forEach(v2 => {if(v2 === path) pass = false})
    if(!pass) {
      debug(`exclude: ${path}`)
      continue
    }
    // directory
    if(stats.isDirectory()) {
      const result = await analysisFileList(path, exclude)
      folderList.push(path)
      folderSize.push(result[4])
      currentFolderSize += result[4]
      fileList = fileList.concat(result[0])
      fileSize = fileSize.concat(result[1])
      folderList = folderList.concat(result[2])
      folderSize = folderSize.concat(result[3])
    // file
    }else {
      // extension check
      let pass = false
      VALID_EXTENSION.forEach(v2 => {if((new RegExp(`^.+?\.${v2}$`)).test(v)) pass = true})

      if(pass) {
        fileList.push(path)
        fileSize.push(stats.size)
        currentFolderSize += stats.size
        debug(`pass: ${v}`)
      }else debug(`fail: extension not matched ${v}`)
    }
  }
  return [fileList, fileSize, folderList, folderSize, currentFolderSize]
}

module.exports = analysis

/*
selfAnalysis(__dirname).then(result => {
  let files = result.fileList.length.toLocaleString(),
    chars = result.totalChars.toLocaleString(),
    lines = result.totalLines.toLocaleString(),
    size = result.totalHumanSize
  console.log('Self Analysis result:')
  console.log(`total files: ${files}`)
  console.log(`total chars: ${chars}`)
  console.log(`total lines: ${lines}`)
  console.log(`total size: ${size}`)
})
*/
