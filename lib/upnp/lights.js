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

const domain = 'schemas-upnp-org'
const version = '1'

class Device {
	constructor(peer, deviceType, thing) {
		console.log('new', deviceType, thing.friendlyName)

		this.peerDevice = peer.createDevice({
			autoAdvertise	: true,
			uuid		: thing.uuid,
			deviceType	: deviceType,
			productName	: 'upnp-things',
			productVersion	: '0.0.0',
			friendlyName	: `UPnP ${thing.friendlyName}`,
			manufacturer	: 'Ross Tyler',
			manufacturerURL	: 'https://github.com/rtyle',
			modelName	: `UPnP ${deviceType}`,
			modelURL	: 'https://github.com/rtyle/upnp-things',
		})

		switch (deviceType) {
		case `urn:${domain}:device:DimmableLight:1`: {
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
						console.log(this.device.friendlyName, 'SetLoadLevelTarget', inputs)
						let value = inputs.NewLoadLevelTarget
						this.set('LoadLevelTarget', value)
						this.notify('LoadLevelTarget')
						thing.SetLoadLevelTarget(value)
					},
					GetLoadLevelTarget: function(inputs) {
						console.log('GetLoadLevelTarget', inputs)
						value = thing.GetLoadLevelTarget()
						this.set('LoadLevelTarget', value)
						return {retLoadLevelTarget: value}
					},
					GetLoadLevelStatus: function(inputs) {
						console.log('GetLoadLevelStatus', inputs)
						value = thing.GetLoadLevelStatus()
						this.set('LoadLevelStatus', value)
						return {retLoadLevelStatus: value}
					}
				}
			})

			dimmingService.set('LoadLevelTarget', thing.GetLoadLevelTarget())
			dimmingService.set('LoadLevelStatus', thing.GetLoadLevelStatus())
			// fall through
		}
		case `urn:${domain}:device:BinaryLight:1`: {
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
						let value = inputs.NewTargetValue
						this.set('Target', value)
						this.notify('Target')
						thing.SetTarget(value)
					},
					GetTarget: function(inputs) {
						console.log('GetTarget', inputs)
						value = thing.GetTarget()
						this.set('Target', value)
						return {RetTargetValue: value}
					},
					GetStatus: function(inputs) {
						console.log('GetStatus', inputs)
						value = thing.GetStatus()
						this.set('Status', value)
						return {ResultStatus: value}
					}
				}
			})

			switchPowerService.set('Target', thing.GetTarget())
			switchPowerService.set('Status', thing.GetStatus())
			break;
		}
		default:
			console.error(`unexpected device type ${deviceType}`)
		}
	}

	changed(thing, serviceType, key, value) {
		console.log('changed', serviceType, thing.friendlyName, key, value)
		let service = this.peerDevice.services[serviceType]
		service.set(key, value)
		service.notify(key)
	}
}

module.exports = class Lights {
	constructor(peer, constructableDevice) {
		constructableDevice(`urn:${domain}:device:BinaryLight:1`	, (deviceType, thing) => {
			return new Device(peer, deviceType, thing)
		})
		constructableDevice(`urn:${domain}:device:DimmableLight:1`	, (deviceType, thing) => {
			return new Device(peer, deviceType, thing)
		})
	}
}
