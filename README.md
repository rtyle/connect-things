# connect-things
Connect your things.

This supports a general architecture for providing connections to things.
The only things realized now are
Switch and Dimmer devices reachable through a local [Legrand Adorne LC7001 hub](https://www.legrand.us/adorne/products/wireless-whole-house-lighting-controls/lc7001.aspx).
The only connections realized now are
UPnP through a SmartThings hub and
direct SmartThings schema connections to the SmartThings cloud.


The [Legrand Adorne Wi-Fi Ready Switch, Dimmer Switch and Outlet devices](https://www.legrand.us/adorne/products/wireless-whole-house-lighting-controls.aspx) will be discovered as device URNs
* schemas-upnp-org:device:BinaryLight:1
* schemas-upnp-org:device:DimmableLight:1

Which correspond to
* [OCF UPnP BinaryLight](http://upnp.org/specs/ha/UPnP-ha-BinaryLight-v1-Device.pdf)
* [OCF UPnP DimmableLight](http://upnp.org/specs/ha/UPnP-ha-DimmableLight-v1-Device.pdf)

A companion project is [upnp-connect](https://github.com/rtyle/upnp-connect) which connects these things through a local SmartThings hub to SmartThings device types with Switch and SwitchLevel capabilities. Together, these projects may be used to replace SmartThings to Legrand Adorne LC7001 hub integration through Samsung’s ARTIK Cloud. Samsung has abandoned the ARTIK Cloud and Legrand has no plans to provide an alternative. This is an alternative.

## Installation

**connect-things** is a JavaScript application that expects to be run in a [nodejs](https://nodejs.org/en/download/) environment.
It was developed using, at the time, the *Latest LTS Version: 10.16.3* of nodejs.
**connect-things** can be installed by [git](https://git-scm.com/downloads)
and the Node Package Manager [npm](https://www.npmjs.com/get-npm).
You can use these, as a normal user, to install **connect-things** with all of its dependencies:
```
git clone https://github.com/rtyle/connect-things
(cd connect-things; npm install)
```
To inspect the **connect-things** command line options and run it:
```
node connect-things/index.js --help
node connect-things/index.js
```
One should be able to make this run automatically in most environments.
It has been tested to run on Linux.
### Run as a Linux systemd service
As root,
```
cp connect-things/connect-things.service /etc/systemd/system/
```
Read this file for further instructions.
