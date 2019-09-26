# upnp-things
Put a UPnP face on your things.

Although this supports an architecture for providing a UPnP interface to general things, the only such things realized now are Switch and Dimmer devices reachable through a local [Legrand Adorne LC7001 hub](https://www.legrand.us/adorne/products/wireless-whole-house-lighting-controls/lc7001.aspx).

The [Legrand Adorne Wi-Fi Ready Switch, Dimmer Switch and Outlet devices](https://www.legrand.us/adorne/products/wireless-whole-house-lighting-controls.aspx) will be discovered as device URNs
* schemas-upnp-org:device:BinaryLight:1
* schemas-upnp-org:device:DimmableLight:1

Which correspond to
* [OCF UPnP BinaryLight](http://upnp.org/specs/ha/UPnP-ha-BinaryLight-v1-Device.pdf)
* [OCF UPnP DimmableLight](http://upnp.org/specs/ha/UPnP-ha-DimmableLight-v1-Device.pdf)

A companion project is [upnp-connect](https://www.github.com/rtyle/upnp-connect) which connects these things through a local SmartThings hub to SmartThings device types with Switch and SwitchLevel capabilities. Together, these projects may be used to replace SmartThings to Legrand Adorne LC7001 hub integration through Samsung’s ARTIK Cloud. Samsung has abandoned the ARTIK Cloud and Legrand has no plans to provide an alternative. This is an alternative.

## Installation

**upnp-things** is a JavaScript application that expects to be run in a [nodejs](https://nodejs.org/en/download/) environment.
It was developed using, at the time, the *Latest LTS Version: 10.16.3* of nodejs.
**upnp-things** can be installed using the Node Package Manager [npm](https://www.npmjs.com/get-npm).
You can use *npm*, as a normal user, in an empty directory, to install **upnp-things** in this directory with all of its dependencies:
```
npm install upnp-things
```
If the current directory is not already an npm managed project directory, npm will warn you about missing project files.
It may also warn you on deprecated module usage. These warnings can be safely ignored:
```
npm WARN deprecated node-uuid@1.4.0: Use uuid module instead
npm WARN saveError ENOENT: no such file or directory, open '/home/upnp-things/package.json'
npm notice created a lockfile as package-lock.json. You should commit this file.
npm WARN enoent ENOENT: no such file or directory, open '/home/upnp-things/package.json'
npm WARN upnp-things No description
npm WARN upnp-things No repository field.
npm WARN upnp-things No README data
npm WARN upnp-things No license field.
```
npm will create (or update) a package-lock.json file which describes the npm packages installed.
The packages themselves can be found under a node_modules subdirectory.

To inspect the **upnp-things** command line options and run it:
```
node node_modules/upnp-things/index.js --help
node node_modules/upnp-things/index.js
```
One should be able to make this run automatically in most environments.
It has been tested to run on Linux.
### Run as a Linux systemd service
As root,
```
cp node_modules/upnp-things/upnp-things.service /etc/systemd/system/
```
Read this file for further instructions.
