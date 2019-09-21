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
				console.error(error)
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

		console.log('connecting to ' + host + ':' + port)
		this.socket
			.on('error', (error) => {
				console.error(error.name + ': ' + error.message)
			})
			.on('timeout', () => {
				console.log('timeout')
				this.socket.end()
			})
			.on('end', () => {
				console.log('end')
			})
			.on('close', () => {
				console.log('closed')
				if (!this.corked) {
					this.emit('cork')
					this.socket.cork()
					this.corked = true
				}
				setTimeout(() => {
					console.log('connecting to ' + host + ':' + port)
					this.socket.connect(port, host)
				}, 8000)
			})
			.on('connect', () => {
				console.log('connected')
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
