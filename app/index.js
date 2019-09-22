// Copyright (c) 2019 Ross Tyler, all rights reserved.
//
// This file is part of upnp-things.
//
// upnp-things is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// any later version.
//
// upnp-things is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with upnp-things.  If not, see <https://www.gnu.org/licenses/>.

const http = require('http')

const upnp = require('../peer-upnp/lib/peer-upnp')

// An instance of App will provide UPnP Device interfaces
// for Things that don't have them.
// The UPnP Device interfaces and Things are loosely coupled here.
//
// Anticipated UPnP Device factories are constructed
// and tell us each UPnP deviceType they have a constructor for.
//
// Thing factories are created and expected to emit 'constructed'
// events as Things are dynamically discovered and constructed.
// A constructed event comes with a UPnP deviceType and the constructed Thing.
// If there is a known UPnP Device constructor for this deviceType
// it is used to create and associate a UPnP Device interface for the Thing.
//
// The unique uuid property of a Thing
// is used to remember the UPnP Device created for it.
// When a Thing emits a 'changed' event,
// the associated UPnP Device interface is found (using the Thing's uuid)
// and forwarded the event using its expected 'changed' method.
//
// The UPnP Device implementation will expect a device specific interface
// from the Thing implementation and vice-versa.
// The 'changed' properties of a Thing are expected to be handled
// by the 'changed' method of its UPnP Device.
// Conversely, UPnP Device service actions will expect method support
// from their Thing.
// An App instance does not care about these details:
// the Things and UPnP Devices can work these out for themselves.
class App {
	constructor() {
		// create HTTP server to support UPnP
		const server = http.createServer()
		server.listen(8081)

		// create the UPnP HTTP service for the server under /upnp
		this.peer = upnp.createPeer({
			prefix: "/upnp",
			server: server
		})
		.on('ready', (peer) => {
			console.log('UPnP peer ready');
		})
		.on('close', (peer) => {
			console.log('UPnP peer closed');
		})
		.start();

		// remember UPnP Device constructors by deviceType
		this.deviceTypeConstructorMap = new Map()

		// discover UPnP Device constructors for UPnP light types
		const Lights = require('../lib/upnp/lights')
		new Lights(this.peer, (deviceType, deviceConstructor) => {
			console.log(`constructable ${deviceType}`)
			this.deviceTypeConstructorMap
				.set(deviceType, deviceConstructor)
		})

		// remember Thing instances by their unique uuid property
		this.thingInstanceMap = new Map()

		// construct a Legrand Adorne LC7001 Thing factory
		// and handle its 'constructed' and 'changed' events
		const LegrandFactory = require('../lib/things/legrand/factory')
		new LegrandFactory()
		.on('constructed', (deviceType, thing) => {
			this.constructed(deviceType, thing)
		})
		.on('changed', (thing, serviceType, key, value) => {
			this.changed(thing, serviceType, key, value)
		})
	}

	// construct a UPnP Device interface for the deviceType of the Thing
	constructed(deviceType, thing) {
		if (this.deviceTypeConstructorMap.has(deviceType)) {
			this.thingInstanceMap.set(thing.uuid,
				this.deviceTypeConstructorMap.get(deviceType)
					(deviceType, thing))
		} else {
			console.error('unconstructable', deviceType)
		}
	}

	// forward the changed Thing event to its UPnP Device interface
	changed(thing, serviceType, key, value) {
		if (this.thingInstanceMap.has(thing.uuid)) {
			this.thingInstanceMap.get(thing.uuid)
				.changed(thing, serviceType, key, value)
		} else {
			console.error('unknown', thing.uuid)
		}
	}
}

new App
