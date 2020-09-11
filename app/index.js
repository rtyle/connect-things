// Copyright (c) 2019 Ross Tyler, all rights reserved.
//
// This file is part of connect-things.
//
// connect-things is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// any later version.
//
// connect-things is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with connect-things.  If not, see <https://www.gnu.org/licenses/>.

const fs = require('fs')

const http = require('http')
const https = require('https')

const log4js = require('log4js')

const upnp = require('peer-upnp')

// An instance of App will provide Device adapters
// for Things that need to be connected.
// The Device adapters and Things are loosely coupled here.
//
// Anticipated Device adapter factories are constructed
// and tell us each deviceType they have a constructor for.
//
// Thing factories are created and expected to emit 'constructed'
// events as Things are dynamically discovered and constructed.
// A constructed event comes with a deviceType and the constructed Thing.
// Each known Device adapter constructor for this deviceType
// is used to create and associate an Device adapter for the Thing.
//
// The unique uuid property of a Thing
// is used to remember all the Device adapters created for it.
// When a Thing emits a 'changed' event,
// each associated Device adapter is found (using the Thing's uuid)
// and forwarded the event using its expected 'changed' method.
//
// The Device adapter implementation will expect a device specific interface
// from the Thing implementation and vice-versa.
// The 'changed' properties of a Thing are expected to be handled
// by the 'changed' method of its Device adapters.
// Conversely, Device adapter service actions will expect method support
// from their Thing.
// An App instance does not care about these details:
// the Things and Device adapters can work these out for themselves.
class App {
	constructor(port, legrandPort, legrandHost, connectSet, upnpHostAddresses, c2cOauthAddresses) {
		// remember Device adapter constructors by deviceType
		this.deviceAdapterConstructorMap = new Map()

		// remember Device adapter instances by their Thing's uuid
		this.deviceAdapterInstanceMap = new Map()

		this.logger = log4js.getLogger()
		this.c2cLogger	= log4js.getLogger('c2c')
		this.upnpLogger	= log4js.getLogger('upnp')

		if (0 < connectSet.size) {
			const express = require('express')
			const app = express()
				.use(express.json())
				.use(express.urlencoded({extended: true}))

			const httpServer = http.createServer(app)
			httpServer
				.on('error', (error) => {
					this.logger.error('httpServer', error.name + ':', error.message)
				})
				.on('connection', (socket) => {
					socket.on('error', (error) => {
						this.logger.error('httpServer connection', error.name + ':', error.message)
					})
				})
				.listen(port)

			if (connectSet.has('c2c')) {
				const key = fs.readFileSync('etc/key.pem' , 'utf8')

				// SmartThings insists on https protocol endpoints.
				// We assume that such will be provided publicly by a service like ngrok
				// which will tunnel such to our private http protocol endpoints.
				// however, a private https protocol endpoint is desirable to restrict
				// access to /c2c/oauth2/authorize to c2cOauthAddresses
				// (say, those of our phone on the same LAN).
				if (!(undefined === c2cOauthAddresses)) {
					const httpsServer = https.createServer({
						key:	key,
						cert:	fs.readFileSync('etc/cert.pem', 'utf8'),
					}, app)
					httpsServer
						.on('error', (error) => {
							this.logger.error('httpsServer', error.name + ':', error.message)
						})
						.on('connection', (socket) => {
							socket.on('error', (error) => {
								this.logger.error('httpsServer connection', error.name + ':', error.message)
							})
						})
						.listen(port + 1)
				}

				const c2cClientLocal		= require('../etc/c2cClientLocal')
				const c2cClientRemote		= require('../etc/c2cClientRemote')

				// prepare c2c interface and
				// discover c2c Device adapters by deviceType
				const C2cLightingControls = require('../lib/connect/c2c/lightingControls')
				const c2cLightingControls = new C2cLightingControls(
						this.c2cLogger, c2cClientRemote.id, c2cClientRemote.secret, (deviceType, constructor) => {
					this.c2cLogger.info(`constructable ${deviceType}`)
					let constructors
					if (this.deviceAdapterConstructorMap.has(deviceType)) {
						constructors = this.deviceAdapterConstructorMap.get(deviceType)
					} else {
						this.deviceAdapterConstructorMap.set(deviceType, constructors = [])
					}
					constructors.push(constructor)
				})

				const c2cRedirectUriMatch	= /https:\/\/c2c-(us|eu|ap)\.smartthings\.com\/oauth\/callback/

				const algorithm		= 'HS256'
				const sign		= {algorithm	:  algorithm}
				const verify		= {algorithms	: [algorithm], secret: key}

				const subjectToken	= {subject: 'token'}
				const signAuthorization	= Object.assign({}, sign, {expiresIn: '1m'}, subjectToken)
				const signRefresh	= Object.assign({}, sign, {expiresIn: '2d'}, subjectToken)
				const subjectAccess	= {subject: 'access'}
				const signAccess	= Object.assign({}, sign, {expiresIn: '1d'}, subjectAccess)

				const jwt	= require('jsonwebtoken')
				const ejwt	= require('express-jwt')

				app.use('/c2c', express.Router()
					.use('/oauth2', express.Router()
						.get('/authorize', (request, response) => {
							// this will come from an instance of the SmartThings app.
							// access may/should be limited to c2cOauthAddresses
							this.c2cLogger.info('>', request.socket.remoteAddress, '/c2c/oauth2/authorize')
							if ((undefined === c2cOauthAddresses || c2cOauthAddresses.includes(request.socket.remoteAddress))
									&& c2cClientLocal.id == request.query.client_id
									&& request.query.redirect_uri.match(c2cRedirectUriMatch)
									&& 'code' == request.query.response_type) {
								const redirect = request.query.redirect_uri
									+ '?state=' + request.query.state
									+ '&code='  + jwt.sign({}, key, signAuthorization)
								this.c2cLogger.info('<', 'redirect', redirect)
								response.redirect(redirect)
							} else {
								this.c2cLogger.error('<', '401', request.socket.remoteAddress, 'c2c/oauth2/authorize')
								response.sendStatus(401)
							}
						})
						.post('/token',
								ejwt(Object.assign({}, verify, subjectToken, {
									getToken: (request) => {
										switch (request.body.grant_type) {
										case 'authorization_code'	: return request.body.code
										case 'refresh_token'		: return request.body.refresh_token
										default				: return undefined
										}
									}
								})),
								(request, response) => {
							this.c2cLogger.info('>', request.socket.remoteAddress, '/c2c/oauth2/token')
							if (c2cClientLocal.id == request.body.client_id
									&& c2cClientLocal.secret == request.body.client_secret) {
								const send = {
									token_type:	'Bearer',
									access_token:	jwt.sign({}, key, signAccess),
									refresh_token:	jwt.sign({}, key, signRefresh),
									expires_in:	60 * 60 * 24,	// 1d
								}
								this.c2cLogger.info('<', 'token', send)
								response.send(send)
							} else {
								this.c2cLogger.error('<', '401', 'token')
								response.sendStatus(401)
							}
						})
					)
					.post('/resource',
							ejwt(Object.assign({}, verify, subjectAccess, {
								getToken: (request) => {
									return request.body.authentication.token
								}
							})),
							(request, response) => {
						this.c2cLogger.info('>', request.socket.remoteAddress, request.url, request.body.headers.interactionType)
						c2cLightingControls.handleHttpCallback(request, response)
					})
				)
			}

			if (connectSet.has('upnp')) {
				const upnpPrefix = '/upnp'

				// create the UPnP HTTP service for the server under upnpPrefix
				this.peer = upnp.createPeer({
						prefix: upnpPrefix,
						server: httpServer	// causes this.peer.httpHandler to be defined and listening
					})
					.on('ready', (peer) => {
						this.upnpLogger.info('peer ready')
					})
					.on('close', (peer) => {
						this.upnpLogger.error('peer closed')
					})
					.start()

				// unauthorize access to this.peer.httpHandler from other than upnpHostAddresses
				httpServer.removeListener('request', this.peer.httpHandler)
				app.use(upnpPrefix, express.Router()
					.all('*', (request, response) => {
						const url = upnpPrefix + request.url
						if (undefined === upnpHostAddresses || upnpHostAddresses.includes(request.socket.remoteAddress)) {
							request.url = url
							this.peer.httpHandler(request, response)
						} else {
							this.upnpLogger.debug('unauthorized', request.socket.remoteAddress, request.socket.remotePort, url)
							response.sendStatus(401)
						}
					})
				)

				// discover UPnP Device adapters by deviceType
				const upnpLightingControls = require('../lib/connect/upnp/lightingControls')
				new upnpLightingControls(this.upnpLogger, this.peer, (deviceType, constructor) => {
					this.upnpLogger.info(`constructable ${deviceType}`)
					let constructors
					if (this.deviceAdapterConstructorMap.has(deviceType)) {
						constructors = this.deviceAdapterConstructorMap.get(deviceType)
					} else {
						this.deviceAdapterConstructorMap.set(deviceType, constructors = [])
					}
					constructors.push(constructor)
				})
			}
		}

		// construct a Legrand Adorne LC7001 Thing factory
		// and handle its 'constructed' and 'changed' events
		const LegrandFactory = require('../lib/things/legrand/factory')
		new LegrandFactory(log4js.getLogger('legrand'), legrandPort, legrandHost)
			.on('constructed'	, this.constructed	.bind(this))
			.on('changed'		, this.changed		.bind(this))
	}

	// construct Device adapters for the deviceType of the Thing
	constructed(deviceType, thing) {
		if (this.deviceAdapterConstructorMap.has(deviceType)) {
			var instances
			if (this.deviceAdapterInstanceMap.has(thing.uuid)) {
				instances = this.deviceAdapterInstanceMap.get(thing.uuid)
			} else {
				this.deviceAdapterInstanceMap.set(thing.uuid, instances = [])
			}
			this.deviceAdapterConstructorMap.get(deviceType).forEach (constructor => {
				instances.push(constructor(deviceType, thing))
			})
		}
	}

	// forward the changed Thing event to its Device adapters
	changed(thing, serviceType, key, value) {
		if (this.deviceAdapterInstanceMap.has(thing.uuid)) {
			this.deviceAdapterInstanceMap.get(thing.uuid).forEach(instance => {
				instance.changed(thing, serviceType, key, value)
			})
		}
	}
}

const connectSet = new Set()
connectSet.add('upnp')
connectSet.add('c2c')
function disableConnect(connect) {
	if (connectSet.has(connect)) {
		connectSet.delete(connect)
	} else {
		throw `${connect} connect not supported or already disabled`
	}
}

const commander = require('commander')
const program = new commander.Command()
try {
	program
		.version('1.0.9')
		.option('-p, --port <port>', 'http server port', '8081')
		.option('-l, --legrand-port <port>', 'Legrand LC7001 port', '2112')
		.option('-L, --legrand-host <host>', 'Legrand LC7001 host', 'LCM1.local')
		.option('-U, --upnp-host <host>', 'UPnP host')
		.option('-C, --c2c-oauth <host>', 'c2c host to oauth authorize')
		.option('--c2c-log <level>', 'Logging level for c2c', 'debug')
		.option('--upnp-log <level>', 'Logging level for UPnP', 'debug')
		.option('--legrand-log <level>', 'Logging level for Legrand', 'debug')
		.option('--disable <connect>', 'Disable upnp|c2c', disableConnect)
		.parse(process.argv)
} catch (e) {
	console.log(e)
	process.exit(1)
}

log4js.configure({
	appenders: {
		out: {type: 'stdout'}
	},
	categories: {
		default	: {appenders: ['out'], level: 'debug'},
		c2c	: {appenders: ['out'], level: program.c2cLog},
		upnp	: {appenders: ['out'], level: program.upnpLog},
		legrand	: {appenders: ['out'], level: program.legrandLog}
	}
})

const net = require('net')
const dns = require('dns')

; (async () => {
	new App(parseInt(program.port), parseInt(program.legrandPort), program.legrandHost,
		connectSet,
		undefined === program.upnpHost
			? undefined
			: net.isIP(program.upnpHost)
				? [program.upnpHost]
				: (await dns.promises.lookup(program.upnpHost, {all: true})).map(it => it.address),
		undefined === program.c2cOauth
			? undefined
			: net.isIP(program.c2cOauth)
				? [program.c2cOauth]
				: (await dns.promises.lookup(program.c2cOauth, {all: true})).map(it => it.address)
	)
})()
