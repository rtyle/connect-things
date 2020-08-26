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

const http = require('http')

const log4js = require('log4js')

const upnp = require('peer-upnp')

// An instance of App will provide Device adapters
// for Things that don't have them.
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
	constructor(port, legrandPort, legrandHost, upnpHostAddresses) {
		// remember Device adapter constructors by deviceType
		this.deviceAdapterConstructorMap = new Map()

		// remember Device adapter instances by their Thing's unique uuid property
		this.deviceAdapterInstanceMap = new Map()

		this.logger = log4js.getLogger()

		this.c2cLogger	= log4js.getLogger('c2c')

		this.upnpLogger	= log4js.getLogger('upnp')

		const express = require('express')
		const app = express()
			.use(express.json())

		// create HTTP server to support Device adapters
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

		// discover c2c Device adapters by deviceType
		const C2cLightingControls = require('../lib/connect/c2c/lightingControls')
		const c2cLightingControls = new C2cLightingControls(this.c2cLogger, (deviceType, constructor) => {
			this.c2cLogger.info(`constructable ${deviceType}`)
			let constructors
			if (this.deviceAdapterConstructorMap.has(deviceType)) {
				constructors = this.deviceAdapterConstructorMap.get(deviceType)
			} else {
				this.deviceAdapterConstructorMap.set(deviceType, constructors = [])
			}
			constructors.push(constructor)
		})

		app.use('/c2c', express.Router()
			.post('/', (request, response) => {
				c2cLightingControls.handleHttpCallback(request, response)
			})
		)

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

		// forbid access to this.peer.httpHandler from other than upnpHostAddresses
		httpServer.removeListener('request', this.peer.httpHandler)
		app.use(upnpPrefix, express.Router()
			.all('*', (request, response) => {
				const url = upnpPrefix + request.url
				if (undefined === upnpHostAddresses || upnpHostAddresses.includes(request.socket.remoteAddress)) {
					request.url = url
					this.peer.httpHandler(request, response)
				} else {
					this.upnpLogger.debug('forbidden', request.socket.remoteAddress, request.socket.remotePort, url)
					response.sendStatus(403)
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

		// construct a Legrand Adorne LC7001 Thing factory
		// and handle its 'constructed' and 'changed' events
		const LegrandFactory = require('../lib/things/legrand/factory')
		new LegrandFactory(
				log4js.getLogger('legrand'), legrandPort, legrandHost)
			.on('constructed', (deviceType, thing) => {
				this.constructed(deviceType, thing)
			})
			.on('changed', (thing, serviceType, key, value) => {
				this.changed(thing, serviceType, key, value)
			})
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
		} else {
			this.logger.error('unconstructable', deviceType)
		}
	}

	// forward the changed Thing event to its Device adapters
	changed(thing, serviceType, key, value) {
		if (this.deviceAdapterInstanceMap.has(thing.uuid)) {
			this.deviceAdapterInstanceMap.get(thing.uuid).forEach(instance => {
				instance.changed(thing, serviceType, key, value)
			})
		} else {
			this.logger.error('unknown', thing.uuid)
		}
	}
}

const commander = require('commander')
const program = new commander.Command()
program
	.version('1.0.9')
	.option('-p, --port <port>', 'http server port', '8081')
	.option('-l, --legrand-port <port>', 'Legrand LC7001 port', '2112')
	.option('-L, --legrand-host <host>', 'Legrand LC7001 host', 'LCM1.local')
	.option('-U, --upnp-host <host>', 'UPnP host', 'smartthings.home')
	.option('--c2c-log <level>', 'Logging level for c2c', 'debug')
	.option('--upnp-log <level>', 'Logging level for UPnP', 'debug')
	.option('--legrand-log <level>', 'Logging level for Legrand', 'debug')
	.parse(process.argv)

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
		undefined === program.upnpHost
			? undefined
			: net.isIP(program.upnpHost)
				? [program.upnpHost]
				: (await dns.promises.lookup(program.upnpHost, {all: true})).map(it => it.address)
	)
})()
