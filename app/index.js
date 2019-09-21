// Copyright (c) 2019 Ross Tyler.
//
// This file is part of upnp-it.
//
// upnp-it is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// any later version.
//
// upnp-it is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with upnp-it.  If not, see <https://www.gnu.org/licenses/>.

const http = require('http')

const upnp = require('../peer-upnp/lib/peer-upnp')

class App {
	constructor() {
		const server = http.createServer()
		server.listen(8081)

		this.peer = upnp.createPeer({
			prefix: "/upnp",
			server: server
		})
		.on('ready', (peer) => {
			console.log("ready");
		})
		.on('close', (peer) => {
			console.log("closed");
		})
		.start();

		this.constructorMap = new Map()

		const Lights = require('../lib/upnp/lights')
		new Lights(this.peer, (deviceType, deviceConstructor) => {
			console.log(`constructable ${deviceType}`)
			this.constructorMap.set(deviceType, deviceConstructor)
		})

		this.instanceMap = new Map()

		const LegrandFactory = require('../lib/it/legrand/factory')
		new LegrandFactory()
		.on('new', (deviceType, it) => {
			if (this.constructorMap.has(deviceType)) {
				this.instanceMap.set(it.uuid, this.constructorMap.get(deviceType)(deviceType, it))
			} else {
				console.error('unconstructable', deviceType)
			}
		})
		.on('change', (it, serviceType, key, value) => {
			if (this.instanceMap.has(it.uuid)) {
				this.instanceMap.get(it.uuid).change(it, serviceType, key, value)
			} else {
				console.error('unknown', it.uuid)
			}
		})
	}
}

new App
