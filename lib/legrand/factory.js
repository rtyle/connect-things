const uuidv3 = require('uuid/v3')
const EventEmitter = require('events')
const Hub = require('./hub')

const namespace = 'b7f041bf-dc87-47dd-a706-ff293240d84c'

class Device extends EventEmitter {
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
	set(key, value) {
		if (this[key] !== value) {
			this[key] = value
			this.emit('change', key, value)
		}
	}
	setOwn(key, value) {
		switch (key) {
		case 'Name':
			this.set('friendlyName', value)
			break;
		default:
			// ignore
		}
	}
	refresh() {
		this.factory.hub.requestReportZoneProperties(this.key)
	}
}

class BinaryLight extends Device {
	constructor(factory, key) {
		super(factory, key)
		this.deviceType = 'urn:schemas-upnp-org:device:BinaryLight:1'
	}
	setOwn(key, value) {
		switch (key) {
		case 'Power': {
			let stringValue = value ? '1' : '0'
			if (!this.hasOwnProperty('Target')) {
				this.set('Target', stringValue)
			}
			this.set('Status', stringValue)
			break;
		}
		default:
			super.setOwn(key, value)
		}
	}
	SetTarget(value) {
		this.set('Target', value)
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
	constructor(factory, key) {
		super(factory, key)
		this.deviceType = 'urn:schemas-upnp-org:device:DimmableLight:1'
	}
	setOwn(key, value) {
		switch (key) {
		case 'PowerLevel': {
			if (!this.hasOwnProperty('LoadLevelTarget')) {
				this.set('LoadLevelTarget', value)
			}
			this.set('LoadLevelStatus', value)
			break;
		}
		default:
			super.setOwn(key, value)
		}
	}
	SetLoadLevelTarget(value) {
		this.set('LoadLevelTarget', value)
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
			this.emit('new', device)
			device.on('change', (key, value) => {
				this.emit('change', device, key, value)
			})
		}
	}
}
