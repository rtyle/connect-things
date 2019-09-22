// Copyright (c) 2019 Ross Tyler, all rights reserved.
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

const uuidv3 = require('uuid/v3')
const EventEmitter = require('events')
const Hub = require('./hub')

const domain = 'schemas-upnp-org'
const version = '1'

const namespace = 'b7f041bf-dc87-47dd-a706-ff293240d84c'

class Thing extends EventEmitter {
	constructor(factory, key) {
		super()
		this.factory = factory
		this.key = key
		this.uuid = uuidv3(key.toString(), factory.namespace)
	}
	reconcile(value) {
		Object.keys(value).forEach((key) => {
			this.setOwn(key, value[key])
		})
	}
	set(serviceType, key, value) {
		if (this[key] !== value) {
			this[key] = value
			this.emit('changed', serviceType, key, value)
		}
	}
	setOwn(key, value) {
		switch (key) {
		case 'Name':
			this.set(null, 'friendlyName', value)
			break;
		default:
			// ignore
		}
	}
	refresh() {
		this.factory.hub.requestReportZoneProperties(this.key)
	}
}

class BinaryLight extends Thing {
	static get serviceType() {
		return `urn:${domain}:service:SwitchPower:${version}`
	}
	constructor(factory, key) {
		super(factory, key)
		this.deviceType = `urn:${domain}:device:BinaryLight:1`
	}
	setOwn(key, value) {
		switch (key) {
		case 'Power': {
			let stringValue = value ? '1' : '0'
			if (!this.hasOwnProperty('Target')) {
				this.set(BinaryLight.serviceType, 'Target', stringValue)
			}
			this.set(BinaryLight.serviceType, 'Status', stringValue)
			break;
		}
		default:
			super.setOwn(key, value)
		}
	}
	SetTarget(value) {
		this.set(BinaryLight.serviceType, 'Target', value)
		this.factory.hub.requestSetZoneProperties(this.key, {Power: new Boolean(parseInt(value))})
		this.refresh()
	}
	GetTarget() {
		this.refresh()
		return this.Target
	}
	GetStatus() {
		this.refresh()
		return this.Status
	}
}

class DimmableLight extends BinaryLight {
	static get serviceType() {
		return `urn:${domain}:service:Dimming:${version}`
	}
	constructor(factory, key) {
		super(factory, key)
		this.deviceType = `urn:${domain}:device:DimmableLight:1`
	}
	setOwn(key, value) {
		switch (key) {
		case 'PowerLevel': {
			if (!this.hasOwnProperty('LoadLevelTarget')) {
				this.set(DimmableLight.serviceType, 'LoadLevelTarget', value)
			}
			this.set(DimmableLight.serviceType, 'LoadLevelStatus', value)
			break;
		}
		default:
			super.setOwn(key, value)
		}
	}
	SetLoadLevelTarget(value) {
		this.set(DimmableLight.serviceType, 'LoadLevelTarget', value)
		this.factory.hub.requestSetZoneProperties(this.key, {PowerLevel: parseInt(value)})
		this.refresh()
	}
	GetLoadLevelTarget() {
		this.refresh()
		return this.LoadLevelTarget
	}
	GetLoadLevelStatus() {
		this.refresh()
		return this.LoadLevelStatus
	}
}

module.exports = class Factory extends EventEmitter {

	constructor(port = Hub.defaultPort, host = Hub.defaultHost) {
		super()
		this.namespace = uuidv3(`${host}:${port}`, namespace)
		this.map = new Map()
		this.hub = new Hub(port, host)
		this.hub
			.on('Service:ReportZoneProperties', (event) => {
				this.reconcile(event.ZID, event.PropertyList)
			})
			.on('Service:ZonePropertiesChanged', (event) => {
				this.reconcile(event.ZID, event.PropertyList)
			})
			.on('Service:ListZones', (event) => {
				event.ZoneList.forEach((element) => {
					this.hub.requestReportZoneProperties(element.ZID)
				})
			})
			.on('uncork', () => {
				this.hub
					.requestReportSystemProperties()
					.requestSystemInfo()
					.requestListZones()
			})
	}

	reconcile(key, value) {
		if (this.map.has(key)) {
			this.map.get(key).reconcile(value)
		} else {
			let device
			switch (value.DeviceType) {
			case 'Switch':
				device = new BinaryLight(this, key)
				break;
			case 'Dimmer':
				device = new DimmableLight(this, key)
				break;
			default:
				console.error(`unexpected device type ${value.DeviceType}`)
				return null
			}
			this.map.set(key, device)
			device.reconcile(value)
			this.emit('constructed', device.deviceType, device)
			device.on('changed', (serviceType, key, value) => {
				this.emit('changed', device, serviceType, key, value)
			})
		}
	}
}
