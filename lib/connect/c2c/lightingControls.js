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

/*
curl -H 'Content-Type: application/json' -X POST -d '{
	"headers": {
		"schema"		: "st-schema",
		"version"		: "1.0",
		"interactionType"	: "discoveryRequest",
		"requestId"		: "0"
	},
	"authentication": {
		"tokenType"		: "Bearer",
		"token"			: "token received during oauth from partner"
	}
}' http://localhost:8081/c2c/

curl -H 'Content-Type: application/json' -X POST -d '{
	"headers": {
		"schema"		: "st-schema",
		"version"		: "1.0",
		"interactionType"	: "stateRefreshRequest",
		"requestId"		: "1"
	},
	"authentication": {
		"tokenType"		: "Bearer",
		"token"			: "token received during oauth from partner"
	}
}' http://localhost:8081/c2c/

curl -H 'Content-Type: application/json' -X POST -d '{
	"headers": {
		"schema"		: "st-schema",
		"version"		: "1.0",
		"interactionType"	: "commandRequest",
		"requestId"		: "2"
	},
	"authentication": {
		"tokenType"		: "Bearer",
		"token"			: "token received during oauth from partner"
	},
	"devices": [
		{
			"externalDeviceId": "e884183c-6ce6-3752-98cb-d91fe0f28196",
			"deviceCookie": {
				"lastcookie": "cookie value"
			},
			"commands": [
				{
					"component"	: "main",
					"capability"	: "st.switchLevel",
					"command"	: "setLevel",
					"arguments"	: [80]
				},
				{
					"component"	: "main",
					"capability"	: "st.switch",
					"command"	: "on",
					"arguments"	: []
				}
			]
		}
	]
}' http://localhost:8081/c2c/

*/

const {SchemaConnector, DeviceErrorTypes} = require('st-schema')

// standardize on UPnP deviceType identifiers
const domain = 'schemas-upnp-org'
const version = '1'

class Device {
	constructor(logger, connector, deviceType, thing) {
		this.logger	= logger
		this.connector	= connector
		this.thing	= thing

		logger.info('new', deviceType, thing.friendlyName)

		const splitName = this.thing.friendlyName.split(':', 2)
		this.friendlyName = splitName.pop()
		if (splitName.length) {
			this.roomName = splitName.pop()
		}

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

	discovery(response) {
		if (this.hasOwnProperty('handler')) {
			this.logger.info('<', this.thing.friendlyName, 'discover', this.handler)
			const discoveryDevice = response.addDevice(this.thing.uuid, this.friendlyName, this.handler)
			if (this.hasOwnProperty('roomName')) {
				discoveryDevice.roomName(this.roomName)
			}
			if (this.thing.friendlyName.match(/fan/i)) {
				discoveryDevice.addCategory('fan')
			} else {
				discoveryDevice.addCategory('light')
			}
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

	stateRefresh(response) {
		if (this.hasOwnProperty('handler')) {
			const stateDevice = response.addDevice(this.thing.uuid)
			switch (this.handler) {
			case 'c2c-dimmer':
				this.stateRefreshLevel(stateDevice)
				// fall through ...
			case 'c2c-switch':
				this.stateRefreshSwitch(stateDevice)
				break;
			}
		}
	}

	command(commands, response) {
		if (this.hasOwnProperty('handler')) {
			const stateDevice = response.addDevice(this.thing.uuid)
			for (const command of commands) {
				switch (command.command) {
				case 'setLevel': {
					const value = command.arguments[0]
					this.logger.info('>', this.thing.friendlyName, 'SetLoadLevelTarget', value)
					this.thing.SetLoadLevelTarget(value)
					this.stateRefreshLevel(stateDevice)
					break;
				}
				case 'on': {
					const value = '1'
					this.logger.info('>', this.thing.friendlyName, 'SetTarget', value)
					this.thing.SetTarget(value)
					this.stateRefreshSwitch(stateDevice)
					break;
				}
				case 'off': {
					const value = '0'
					this.logger.info('>', this.thing.friendlyName, 'SetTarget', value)
					this.thing.SetTarget(value)
					this.stateRefreshSwitch(stateDevice)
					break;
				}
				}
			}
		}
	}

	changed(thing, serviceType, key, value) {
		this.logger.info('<', this.thing.friendlyName, 'TODO changed', serviceType, key, value)
	}
}

// The LightingControls constructor tells its caller which UPnP deviceTypes we have constructors for
module.exports = class LightingControls extends SchemaConnector {

	constructor(logger, constructableDevice) {
		super()

		this.logger = logger

		this.deviceMap = new Map()

		super
			.discoveryHandler((accessToken, discoveryResponse, body) => {
				for (const [uuid, device] of this.deviceMap) {
					device.discovery(discoveryResponse)
				}
			})
			.stateRefreshHandler((accessToken, stateRefreshResponse, body) => {
				for (const [uuid, device] of this.deviceMap) {
					device.stateRefresh(stateRefreshResponse)
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

		constructableDevice(`urn:${domain}:device:BinaryLight:${version}`	, (deviceType, thing) => {
			return this.constructDevice(deviceType, thing)
		})
		constructableDevice(`urn:${domain}:device:DimmableLight:${version}`	, (deviceType, thing) => {
			return this.constructDevice(deviceType, thing)
		})
	}

	constructDevice(deviceType, thing) {
		const device = new Device(this.logger, this.connector, deviceType, thing)
		this.deviceMap.set(thing.uuid, device)
		return device
	}
}
