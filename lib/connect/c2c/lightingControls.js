// Copyright (c) 2020 Ross Tyler, all rights reserved.
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

// A LightingControls object provides
// SmartThings Cloud-to-Cloud (c2c) device type handlers
// (c2c-dimmer and c2c-switch, with Switch and SwitchLevel capabilities)
// Device adaptations to similarly capable UPnP (abstracted) things
// as these UPnP deviceType things are constructed
// 
// 	`urn:${domain}:device:BinaryLight:${version}`
// 	`urn:${domain}:device:DimmableLight:${version}`
// 
// The Device adapters converse with the SmartThings cloud using st-schema-node.
//
//	https://github.com/SmartThingsCommunity/st-schema-nodejs
//
// This gives SmartThings the ability for discovery of these devices (adaptations).
// Once SmartThings c2c device type handlers are created/associated with them,
// they can be commanded to perform their capabilities and
// their state can be refreshed.
//
// 'changed' Events from the Thing associated with a Device
// result in the changed state being pushed to SmartThings.

// Things must also provide the following properties
//
//	uuid
//	friendlyName

const fs = require('fs')

const {DiscoveryDevice, DiscoveryRequest, SchemaConnector, StateUpdateRequest} = require('st-schema')
const StateDevice = require('../../../node_modules/st-schema/lib/state/StateDevice')

// standardize on UPnP deviceType identifiers
const domain = 'schemas-upnp-org'
const version = '1'

class Device {
	constructor(logger, connector, deviceType, thing) {
		this.logger	= logger
		this.connector	= connector
		this.thing	= thing

		logger.info('new', deviceType, thing.friendlyName)

		switch (deviceType) {
		case `urn:${domain}:device:DimmableLight:${version}`:
			this.handler = 'c2c-dimmer'
			break
		case `urn:${domain}:device:BinaryLight:${version}`:
			this.handler = 'c2c-switch'
			break
		default:
			logger.error('unexpected device type', deviceType)
		}
	}

	discovery(discoveryDevice) {
		this.logger.info('<', this.thing.friendlyName, 'discovery', this.handler)
		discoveryDevice.manufacturerName('connect-things')
		discoveryDevice.modelName(this.handler)
		discoveryDevice.addCategory(this.thing.friendlyName.match(/fan/i) ? 'fan' : 'light')
	}

	discoveryRequest(request) {
		if (this.hasOwnProperty('handler')) {
			const discoveryDevice = new DiscoveryDevice(
				this.thing.uuid, this.thing.friendlyName, this.handler)
			this.discovery(discoveryDevice)
			request.addDevice(discoveryDevice)
		}
	}

	discoveryResponse(response) {
		if (this.hasOwnProperty('handler')) {
			const discoveryDevice = response.addDevice(
				this.thing.uuid, this.thing.friendlyName, this.handler)
			this.discovery(discoveryDevice)
		}
	}

	stateRefreshLevel(stateDevice) {
		const value = this.thing.GetLoadLevelStatus()
		this.logger.info('<', this.thing.friendlyName, 'level', value)
		stateDevice.addState('main', 'st.switchLevel', 'level', value);
	}

	stateRefreshSwitch(stateDevice) {
		const value = '1' == this.thing.GetStatus() ? 'on' : 'off'
		this.logger.info('<', this.thing.friendlyName, 'switch', value)
		stateDevice.addState('main', 'st.switch', 'switch', value);
	}

	stateRefreshHealthCheck(stateDevice, healthStatus) {
		this.logger.info('<', this.thing.friendlyName, 'healthStatus', healthStatus)
		stateDevice.addState('main', 'st.healthCheck', 'healthStatus', healthStatus);
	}

	stateRefresh(stateDevice) {
		if (this.hasOwnProperty('handler')) {
			switch (this.handler) {
			case 'c2c-dimmer':
				this.stateRefreshLevel(stateDevice)
				// fall through ...
			case 'c2c-switch':
				this.stateRefreshSwitch(stateDevice)
				break;
			}
			this.stateRefreshHealthCheck(stateDevice, 'online')
		}
	}

	command(commands, response) {
		if (this.hasOwnProperty('handler')) {
			for (const command of commands) {
				switch (command.command) {
				case 'setLevel': {
					const value = command.arguments[0]
					this.logger.info('>', this.thing.friendlyName, 'SetLoadLevelTarget', value)
					this.thing.SetLoadLevelTarget(value)
					break;
				}
				case 'on': {
					const value = '1'
					this.logger.info('>', this.thing.friendlyName, 'SetTarget', value)
					this.thing.SetTarget(value)
					break;
				}
				case 'off': {
					const value = '0'
					this.logger.info('>', this.thing.friendlyName, 'SetTarget', value)
					this.thing.SetTarget(value)
					break;
				}
				}
			}
		}
	}

	changed(thing, serviceType, key, value) {
		this.logger.info('<', this.thing.friendlyName, 'changed', serviceType, key, value)
		if (undefined === this.connector.callbackUrls || undefined === this.connector.callbackAuthentication) {
			this.logger.error('<', this.thing.friendlyName, 'callback undefined')
		} else {
			let stateDevice
			switch (serviceType) {
			case `urn:${domain}:service:SwitchPower:${version}`:
				if ('Status' == key) {
					stateDevice = new StateDevice(thing.uuid)
					this.stateRefreshSwitch(stateDevice)
				}
				break
			case `urn:${domain}:service:Dimming:${version}`:
				if ('LoadLevelStatus' == key) {
					stateDevice = new StateDevice(thing.uuid)
					this.stateRefreshLevel(stateDevice)
				}
				break
			}
			if (stateDevice) {
				this.stateRefreshHealthCheck(stateDevice, 'online')
				new StateUpdateRequest(this.connector.clientId, this.connector.clientSecret)
					.updateState(this.connector.callbackUrls, this.connector.callbackAuthentication, [stateDevice],
						this.connector.callbackAuthenticationRefresh.bind(this.connector))
			}
		}
	}
}

const prefix = 'etc/c2c'

// The LightingControls constructor tells its caller which UPnP deviceTypes we have constructors for
module.exports = class LightingControls extends SchemaConnector {

	constructor(logger, clientId, clientSecret, constructableDevice) {
		super({
			clientId:	clientId,
			clientSecret:	clientSecret
		})

		this.logger		= logger
		this.clientId		= clientId
		this.clientSecret	= clientSecret

		// it is OK if our callbackAccessHandler has not yet been called
		this.callbackAuthenticationFile = `${prefix}CallbackAuthentication.json`
		try {
			this.callbackAuthentication = JSON.parse(fs.readFileSync(this.callbackAuthenticationFile))
		} catch (e) {
			logger.debug(e)
		}
		this.callbackUrlsFile = `${prefix}CallbackUrls.json`
		try {
			this.callbackUrls = JSON.parse(fs.readFileSync(this.callbackUrlsFile))
		} catch (e) {
			logger.debug(e)
		}

		this.deviceMap = new Map()

		super
			.discoveryHandler((accessToken, discoveryResponse, body) => {
				for (const [uuid, device] of this.deviceMap) {
					device.discoveryResponse(discoveryResponse)
				}
			})
			.stateRefreshHandler((accessToken, stateRefreshResponse, body) => {
				for (const bodyDevice of body.devices) {
					const key = bodyDevice.externalDeviceId
					const stateDevice = stateRefreshResponse.addDevice(key)
					if (this.deviceMap.has(key)) {
						this.deviceMap.get(key).stateRefresh(stateDevice)
					} else {
						this.logger.info('<', key, 'healthStatus', 'offline')
						stateDevice.addState('main', 'st.healthCheck', 'healthStatus', 'offline');
					}
				}
			})
			.commandHandler((accessToken, commandResponse, bodyDevices, body) => {
				for (const bodyDevice of bodyDevices) {
					const uuid = bodyDevice.externalDeviceId
					if (this.deviceMap.has(uuid)) {
						this.deviceMap.get(uuid).command(bodyDevice.commands, commandResponse)
					}
				}
			})
			.callbackAccessHandler((access_token, callbackAuthentication, callbackUrls, body) => {
				this.callbackAuthenticationRefresh(callbackAuthentication)
				this.logger.debug('>', 'callbackUrls')
				this.callbackUrls = callbackUrls
				fs.writeFileSync(this.callbackUrlsFile, JSON.stringify(callbackUrls))
			})
			.integrationDeletedHandler((access_token, body) => {
				delete this.callbackAuthentication
				delete this.callbackUrls
				fs.unlinkSync(this.callbackAuthenticationFile)
				fs.unlinkSync(this.callbackUrlsFile)
			})

		constructableDevice(`urn:${domain}:device:BinaryLight:${version}`	, this.constructDevice.bind(this))
		constructableDevice(`urn:${domain}:device:DimmableLight:${version}`	, this.constructDevice.bind(this))
	}

	constructDevice(deviceType, thing) {
		const device = new Device(this.logger, this, deviceType, thing)
		this.deviceMap.set(thing.uuid, device)
		if (undefined === this.callbackUrls || undefined === this.callbackAuthentication) {
			this.logger.error('<', thing.friendlyName, 'callback undefined')
		} else {
			const request = new DiscoveryRequest(this.clientId, this.clientSecret)
			device.discoveryRequest(request)
			request.sendDiscovery(this.callbackUrls, this.callbackAuthentication,
				this.callbackAuthenticationRefresh.bind(this))
		}
		return device
	}

	callbackAuthenticationRefresh(callbackAuthentication) {
		this.logger.debug('>', 'callbackAuthentiation')
		this.callbackAuthentication = callbackAuthentication
		fs.writeFileSync(this.callbackAuthenticationFile, JSON.stringify(callbackAuthentication))
	}
}
