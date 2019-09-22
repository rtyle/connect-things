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

// A Hub is used to communicate with a Legrand LC7001 hub.
// Such a hub, by default, advertises itself using 'LCM1' as its mDNS name
// (you may be able to change this from the Legrand Lighting Control app)
// and listens for TCP connections on port 2112.
//
// Over a connection, null terminated JSON encoded messages flow.
// Unsolicited messages from the hub will have an ID attribute of 0.
// Solicited responses from the hub will echo the ID from the associated request.
//
// A 'Service:value' event with the message
// is emitted using the Service value from the message.
// 
// An 'ID:value' event with the message
// is emitted using the ID value from the message.
// To receive this event, specify a "once" closure argument on the request.
// It is probably better to register general 'Service:value' interest.
//
// When a hub connection fails,
// reconnection attempts will be made until it succeeds.
// A responsive hub will send periodic (once every ~5 seconds)
// Service:ping messages.
// This implementation will "cork" its output stream
// (buffering messages for later) until it receives a Service:ping message.
// 'cork' and 'uncork' events are emitted as this state changes.
// 'uncork' (when the hub on a new connection first becomes responsive)
// might be a good time to make inventory requests of the hub.
//
// This implementation does not handle most of the messages that the hub supports.
// It only supports a few requests (for device inventory and state)
// and expects event handlers to know how to handle the responses.

const EventEmitter = require('events')
const net = require('net')

module.exports = class Hub extends EventEmitter {

	// scatter null terminated, JSON encoded messages from stream chunk
	// return the index of the beginning of the next message
	scatter(chunk) {
		let begin = 0
		let end
		while (-1 !== (end = chunk.indexOf(0, begin))) {
			let json = chunk.toString('utf8', begin, end)
			console.log('\t\t', json)
			try {
				let event = JSON.parse(json)
				this.emit('ID:' + event.ID, event)
				this.emit('Service:' + event.Service, event)
			} catch (error) {
				console.error('socket', error)
			}
			begin = end + 1
		}
		return begin
	}

	static get defaultPort() {return 2112}
	static get defaultHost() {return 'LCM1.local'}

	constructor(port = defaultPort, host = defaultHost) {
		super()

		this.id = 0

		this.socket = new net.Socket()

		// cork the socket's write stream until we get a ping
		this.socket.cork()
		this.corked = true
		this.on('Service:ping', (event) => {
			if (this.corked) {
				this.corked = false
				process.nextTick(() => {
					this.socket.uncork()
					this.emit('uncork')
				})
			}
		})

		console.log('socket connecting to', host + ':' + port)
		this.socket
			.on('error', (error) => {
				console.error('socket', error.name + ':', error.message)
			})
			.on('timeout', () => {
				console.log('socket timeout')
				this.socket.end()
			})
			.on('end', () => {
				console.log('socket end')
			})
			.on('close', () => {
				console.log('socket closed')
				if (!this.corked) {
					this.emit('cork')
					this.socket.cork()
					this.corked = true
				}
				setTimeout(() => {
					console.log('socket connecting to', host + ':' + port)
					this.socket.connect(port, host)
				}, 8000)
			})
			.on('connect', () => {
				console.log('socket connected')
				this.previous = Buffer.from([])
				this.socket.setTimeout(60000)
			})
			// https://github.com/nodejs/node/issues/25969
			// readable event not emitted after net.Socket reconnects
			.on('data', (next) => {
				if (this.previous.length) {
					let concat = Buffer.concat(
						[this.previous, next], this.previous.length + next.length)
					this.previous = concat.slice(this.scatter(concat))
				} else {
					this.previous = next.slice(this.scatter(next))
				}
			})
			.connect(port, host)
	}

	request(action, once = null) {
		let id = ++this.id
		action.ID = id
		if (null !== once) {
			this.once('ID:' + id, once)
		}
		console.log('\t', JSON.stringify(action))
		this.socket.write(JSON.stringify(action) + '\x00')
		return this
	}

	requestReportSystemProperties(once = null) {
		return this.request({Service: 'ReportSystemProperties'}, once)
	}

	requestSystemInfo(once = null) {
		return this.request({Service: 'SystemInfo'}, once)
	}

	requestListZones(once = null) {
		return this.request({Service: 'ListZones'}, once)
	}

	requestReportZoneProperties(zid, once = null) {
		return this.request({Service: 'ReportZoneProperties', ZID: zid}, once)
	}

	requestSetZoneProperties(zid, propertyList, once = null) {
		return this.request({Service: 'SetZoneProperties', ZID: zid, PropertyList: propertyList}, once)
	}
}
