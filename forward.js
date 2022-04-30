#!/usr/bin/env node
const http = require('http')
const https = require('https')
const net = require('net')
const { join: pJoin } = require('path')
const { inspect, promisify } = require('util')

const debug = require('debug')('SFS3:main')
const chalk = require('chalk')
const fs = require('fs-extra')
const jsonBeautify = require("json-beautify")
const Koa = require('koa')
const KoaRewrite = require('koa-rewrite')
const KoaBody = require('koa-body')
const KoaViews = require('koa-views')
const KoaStaticCache = require('koa-static-cache')
const SIO = require('socket.io')

//const forwardManager = require('./lib/forward-manager-wrapper.js')
const forwardService = require('./lib/forward-middleware')
process.title = 'semteul-forward-service-v' + forwardService.forwardServiceVersion

const DEFAULT_CONFIG = {
  "http": {
    "enable": true,
    "port": 9998
  },
  "https": {
    "enable": false,
    "port": 9999,
    "cert": {
      "chain": "/etc/letsencrypt/live/<YOUR-SITE-NAME>/fullchain.pem",
      "privKey": "/etc/letsencrypt/live/<YOUR-SITE-NAME>/privKey.pem"
    }
  },
  "password": ""
}

// Koa define
const app = new Koa()
// serve index.html
app.use(KoaRewrite('/', '/index.html'))
// body parser
app.use(KoaBody())
// static resource
app.use(KoaStaticCache(pJoin(__dirname, 'client/static'), {
  prefix: '/',
  dynamic: true
}))

// http, https 서버 관리
class AppServer {
  constructor (ctx, httpCallback, options) {
    this.ctx = ctx
    this.httpCallback = httpCallback
    this.opt = options
    this.http = { run: false, server: null }
    this.https = { run: false, server: null }
    this.sio = new SIO()
    this.ctx.sio = this.sio
    this._socketIOHandle()
  }

  async start () {
    const pList = []
    if (this.opt.http.enable) {
      this.http.server = http.createServer(this.httpCallback)
      this.http.server.listenAsync = promisify(this.http.server.listen)
      pList.push(this.http.server.listenAsync(this.opt.http.port))
      this.http.run = true
      this.sio.attach(this.http.server)
      console.log('Http server starting... - port:', this.opt.http.port)
    }

    if (this.opt.https.enable) {
      this.https.server = https.createServer({
        cert: await fs.readFile(this.opt.https.cert.chain),
        key: await fs.readFile(this.opt.https.cert.privKey)
      }, this.httpCallback)
      this.https.server.listenAsync = promisify(this.https.server.listen)
      pList.push(this.https.server.listenAsync(this.opt.https.port))
      this.https.run = true
      this.sio.attach(this.https.server)
      console.log('Https server starting... - port:', this.opt.https.port)
    }

    console.log('Socket.IO server starting...')

    await Promise.all(pList)
    console.log('Server started')
    return this
  }

  /*
  stop () {
    if (this.http.run) {
      // TODO
    }

    if (this.https.run) {
      // TODO
    }
  }
  */

  _socketIOHandle () {
    forwardService.handleSIO(this.sio)
  }

}

// 컨피그 파일 유효성 확인
let config = null
let appServer = null

fs.readJSON(pJoin(__dirname, 'config.json')).then(v => { config = v }, err => {
  if (err.code === 'ENOENT') {
    fs.writeFile(pJoin(__dirname, 'config.json'), jsonBeautify(DEFAULT_CONFIG, null, 2, 20)).then(() => {
      console.log('Config created. restart service after adjust it.')
      console.log(chalk.yellow('[WARNING] SSL(https) strongly recommended. Please disable http if not for testing purposes'))
    }).catch(err => {
      console.error('Config creation FAIL:', inspect(err))
      process.exit(1)
    })
  } else {
    console.error(chalk.red('Config parse ERROR:', inspect(err)))
    process.exit(1)
  }
}).then(() => {
  appServer = new AppServer(app.context, app.callback(), config)
  return appServer.start()
}).then(() => {
  console.log('App started')
  require('./lib/self-analysis-run')
}).catch(err => {
  console.error(err)
  console.log('App start fail. process exit in 10sec')
  setTimeout(() => { process.exit(1) }, 10000)
})
