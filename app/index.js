const upnp = require('../peer-upnp/lib/peer-upnp')
const http = require('http')

const server = http.createServer()
server.listen(8081)

// Create a UPnP Peer.
var peer = upnp.createPeer({
        prefix: "/upnp",
        server: server
})
.on('ready', (peer) => {
        console.log("ready");
})
.on('close', (peer) => {
        console.log("closed");
})
.start();

const domain = 'schemas-upnp-org'
const version = '1'

function newDevice(factory, device) {
	console.log(`new ${device.friendlyName}`)

	let deviceType = device.constructor.name

	let peerDevice = peer.createDevice({
		autoAdvertise	: true,
		uuid		: device.uuid,
		deviceType	: device.deviceType,
		productName	: 'upnp-it',
		productVersion	: '0.0.0',
		friendlyName	: `UPnP ${device.friendlyName}`,
		manufacturer	: 'Ross Tyler',
		manufacturerURL	: 'https://github.com/rtyle',
		modelName	: `UPnP ${deviceType}`,
		modelURL	: 'https://github.com/rtyle/upnp-it',
	})

	switch (deviceType) {
	case 'DimmableLight': {
		let dimmingService = peerDevice.createService({
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
					device.SetLoadLevelTarget(value)
				},
				GetLoadLevelTarget: function(inputs) {
					console.log('GetLoadLevelTarget', inputs)
					value = device.GetLoadLevelTarget()
					this.set('LoadLevelTarget', value)
					return {retLoadLevelTarget: value}
				},
				GetLoadLevelStatus: function(inputs) {
					console.log('GetLoadLevelStatus', inputs)
					value = device.GetLoadLevelStatus()
					this.set('LoadLevelStatus', value)
					return {retLoadLevelStatus: value}
				}
			}
		})

		dimmingService.set('LoadLevelTarget', device.GetLoadLevelTarget())
		dimmingService.set('LoadLevelStatus', device.GetLoadLevelStatus())
		// fall through
	}
	case 'BinaryLight': {
		let switchPowerService = peerDevice.createService({
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
					device.SetTarget(value)
				},
				GetTarget: function(inputs) {
					console.log('GetTarget', inputs)
					value = device.GetTarget()
					this.set('Target', value)
					return {RetTargetValue: value}
				},
				GetStatus: function(inputs) {
					console.log('GetStatus', inputs)
					value = device.GetStatus()
					this.set('Status', value)
					return {ResultStatus: value}
				}
			}
		})

		switchPowerService.set('Target', device.GetTarget())
		switchPowerService.set('Status', device.GetStatus())
		break;
	}
	default:
		console.error(`unexpected device type ${deviceType}`)
	}
}

function change(factory, device, key, value) {
	console.log(`change ${device.friendlyName} ${key} ${value}`)
	let type
	switch (key) {
	case 'Target':
	case 'Status':
		type = 'SwitchPower'
		break;
	case 'LoadLevelTarget':
	case 'LoadLevelStatus':
		type = 'Dimming'
	}
	let serviceType = 'urn:' + domain + ':service:' + type + ':' + version
	let service = peer.devices[device.uuid].services[serviceType]
	service.set(key, value)
	service.notify(key)
}

const Factory = require('../lib/legrand/factory')
var factory = new Factory

factory
.on('new', (device) => {
	newDevice(factory, device)
})
.on('change', (device, key, value) => {
	change(factory, device, key, value)
})
