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

// A Factory dynamically constructs Things
// as they are seen reported by its Legrand hub.
// As they are constructed, the Factory emits a 'constructed' event for each
// which includes the UPnP deviceType and the constructed Thing instance.
//
// Each Thing performs a mapping between
// native Legrand hub zone property names/values and
// general UPnP lightingControls state variable names/values.
//
// Things will emit 'changed' events
// as their UPnP state variables are seen to have been changed
// in assocatied reports from its Legrand hub.
//
// Things will also support necessary setters and getters for
// UPnP lightingContols state variables, depending on the Legrand DeviceType.

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
		this.deviceType = `urn:${domain}:device:BinaryLight:${version}`
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
		this.deviceType = `urn:${domain}:device:DimmableLight:${version}`
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

	constructor(logger, port = Hub.defaultPort, host = Hub.defaultHost) {
		super()

		this.logger = logger

		this.namespace = uuidv3(`${host}:${port}`, namespace)
		this.map = new Map()
		this.hub = new Hub(logger, port, host)
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
				this.logger.error('unexpected device type', value.DeviceType)
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
