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

const domain = 'schemas-upnp-org'
const version = '1'

class Device {
	constructor(peer, deviceType, it) {
		console.log('new', deviceType, it.friendlyName)

		this.peerDevice = peer.createDevice({
			autoAdvertise	: true,
			uuid		: it.uuid,
			deviceType	: deviceType,
			productName	: 'upnp-it',
			productVersion	: '0.0.0',
			friendlyName	: `UPnP ${it.friendlyName}`,
			manufacturer	: 'Ross Tyler',
			manufacturerURL	: 'https://github.com/rtyle',
			modelName	: `UPnP ${deviceType}`,
			modelURL	: 'https://github.com/rtyle/upnp-it',
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
						it.SetLoadLevelTarget(value)
					},
					GetLoadLevelTarget: function(inputs) {
						console.log('GetLoadLevelTarget', inputs)
						value = it.GetLoadLevelTarget()
						this.set('LoadLevelTarget', value)
						return {retLoadLevelTarget: value}
					},
					GetLoadLevelStatus: function(inputs) {
						console.log('GetLoadLevelStatus', inputs)
						value = it.GetLoadLevelStatus()
						this.set('LoadLevelStatus', value)
						return {retLoadLevelStatus: value}
					}
				}
			})

			dimmingService.set('LoadLevelTarget', it.GetLoadLevelTarget())
			dimmingService.set('LoadLevelStatus', it.GetLoadLevelStatus())
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
						it.SetTarget(value)
					},
					GetTarget: function(inputs) {
						console.log('GetTarget', inputs)
						value = it.GetTarget()
						this.set('Target', value)
						return {RetTargetValue: value}
					},
					GetStatus: function(inputs) {
						console.log('GetStatus', inputs)
						value = it.GetStatus()
						this.set('Status', value)
						return {ResultStatus: value}
					}
				}
			})

			switchPowerService.set('Target', it.GetTarget())
			switchPowerService.set('Status', it.GetStatus())
			break;
		}
		default:
			console.error(`unexpected device type ${deviceType}`)
		}
	}

	change(it, serviceType, key, value) {
		console.log(`change serviceType, ${it.friendlyName} ${key} ${value}`)
		let service = this.peerDevice.services[serviceType]
		service.set(key, value)
		service.notify(key)
	}
}

module.exports = class Lights {
	constructor(peer, constructableDevice) {
		constructableDevice(`urn:${domain}:device:BinaryLight:1`	, (deviceType, it) => {
			return new Device(peer, deviceType, it)
		})
		constructableDevice(`urn:${domain}:device:DimmableLight:1`	, (deviceType, it) => {
			return new Device(peer, deviceType, it)
		})
	}
}
