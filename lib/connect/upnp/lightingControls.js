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

// The UPnP LightningControls described here
//
//	https://openconnectivity.org/developer/specifications/upnp-resources/upnp/lighting-controls-v-1-0
//
// are supported with the following Device, Service and State variables
//
// 	`urn:${domain}:device:BinaryLight:${version}`
//		`urn:${domain}:service:SwitchPower:${version}`
//			Target
//			Status
// 	`urn:${domain}:device:DimmableLight:${version}`
//		`urn:${domain}:service:SwitchPower:${version}`
//		`urn:${domain}:service:Dimming:${version}`
//			LoadLevelTarget
//			LoadLevelStatus
//
// 'changed' Events from the Thing associated with a Device
// are expected to be forwarded to the Device's changed method
// which will update the named state variable with a new value
// and notify all UPnP subscribers of the change in its service.
//
// UPnP getter and setter methods forward requests
// to like-named getter and setter methods of its Thing.
//
// Things must also provide the following properties
//
//	uuid
//	friendlyName

const domain = 'schemas-upnp-org'
const version = '1'

class Device {
	constructor(logger, peer, deviceType, thing) {
		this.logger = logger

		logger.info('new', deviceType, thing.friendlyName)

		this.peerDevice = peer.createDevice({
			autoAdvertise	: true,
			uuid		: thing.uuid,
			domain		: domain,
			deviceType	: deviceType,
			version		: version,
			productName	: 'upnp-things',
			productVersion	: '0.0.0',
			friendlyName	: thing.friendlyName,
			manufacturer	: 'Ross Tyler',
			manufacturerURL	: 'https://github.com/rtyle',
			modelName	: `UPnP ${deviceType}`,
			modelURL	: 'https://github.com/rtyle/connect-things',
		})

		switch (deviceType) {
		case `urn:${domain}:device:DimmableLight:${version}`: {
			let dimmingService = this.peerDevice.createService({
				domain		: domain,
				type		: 'Dimming',
				version		: version,

				// description will be published as XML
				description: {
					actions: {
						SetLoadLevelTarget: {
							inputs: {
								NewLoadLevelTarget: 'LoadLevelTarget'	// state variable
							}
						},
						GetLoadLevelTarget: {
							outputs: {
								retLoadLevelTarget: 'LoadLevelTarget'	// state variable
							}
						},
						GetLoadLevelStatus: {
							outputs: {
								retLoadLevelStatus: 'LoadLevelStatus'	// state variable
							}
						}
					},
					/* state */ variables: {	// name: 'type'
						LoadLevelTarget: 'ui1',
						LoadLevelStatus: 'ui1'
					}
				},

				implementation: {
					SetLoadLevelTarget: function(inputs) {
						logger.info('>', this.device.friendlyName, 'SetLoadLevelTarget', inputs)
						thing.SetLoadLevelTarget(inputs.NewLoadLevelTarget)
					},
					GetLoadLevelTarget: function(inputs) {
						logger.info('>', this.device.friendlyName, 'GetLoadLevelTarget', inputs)
						let value = thing.GetLoadLevelTarget()
						this.set('LoadLevelTarget', value)
						let outputs = {retLoadLevelTarget: value}
						logger.info('<', this.device.friendlyName, 'GetLoadLevelTarget', outputs)
						return outputs
					},
					GetLoadLevelStatus: function(inputs) {
						logger.info('>', this.device.friendlyName, 'GetLoadLevelStatus', inputs)
						let value = thing.GetLoadLevelStatus()
						this.set('LoadLevelStatus', value)
						let outputs = {retLoadLevelStatus: value}
						logger.info('<', this.device.friendlyName, 'GetLoadLevelStatus', outputs)
						return outputs
					}
				}
			})

			dimmingService.set('LoadLevelTarget', thing.GetLoadLevelTarget())
			dimmingService.set('LoadLevelStatus', thing.GetLoadLevelStatus())
			// fall through
		}
		case `urn:${domain}:device:BinaryLight:${version}`: {
			let switchPowerService = this.peerDevice.createService({
				domain		: 'schemas-upnp-org',
				type		: 'SwitchPower',
				version		: version,

				// description will be published as XML
				description: {
					actions: {
						SetTarget: {
							inputs: {
								NewTargetValue: 'Target'	// state variable
							}
						},
						GetTarget: {
							outputs: {
								RetTargetValue: 'Target'	// state variable
							}
						},
						GetStatus: {
							outputs: {
								ResultStatus: 'Status'		// state variable
							}
						}
					},
					/* state */ variables: {	// name: 'type'
						Target: 'boolean',
						Status: 'boolean'
					}
				},

				implementation: {
					SetTarget: function(inputs) {
						logger.info('>', this.device.friendlyName, 'SetTarget', inputs)
						thing.SetTarget(inputs.NewTargetValue)
					},
					GetTarget: function(inputs) {
						logger.info('>', this.device.friendlyName, 'GetTarget', inputs)
						let value = thing.GetTarget()
						this.set('Target', value)
						let outputs = {RetTargetValue: value}
						logger.info('<', this.device.friendlyName, 'GetTarget', outputs)
						return outputs
					},
					GetStatus: function(inputs) {
						logger.info('>', this.device.friendlyName, 'GetStatus', inputs)
						let value = thing.GetStatus()
						this.set('Status', value)
						let outputs = {ResultStatus: value}
						logger.info('<', this.device.friendlyName, 'GetStatus', outputs)
						return outputs
					}
				}
			})

			switchPowerService.set('Target', thing.GetTarget())
			switchPowerService.set('Status', thing.GetStatus())
			break;
		}
		default:
			logger.error('unexpected device type', deviceType)
		}
	}

	changed(thing, serviceType, key, value) {
		this.logger.info('<', thing.friendlyName, 'notify', serviceType, key, value)
		let service = this.peerDevice.services[serviceType]
		service.set(key, value)
		service.notify(key)
	}
}

// The LightingControls constructor tells its caller which UPnP deviceTypes we have constructors for
module.exports = class LightingControls {
	constructor(logger, peer, constructableDevice) {
		constructableDevice(`urn:${domain}:device:BinaryLight:${version}`	, (deviceType, thing) => {
			return new Device(logger, peer, deviceType, thing)
		})
		constructableDevice(`urn:${domain}:device:DimmableLight:${version}`	, (deviceType, thing) => {
			return new Device(logger, peer, deviceType, thing)
		})
	}
}
