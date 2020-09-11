# connect-things
Connect your things.

This supports a general architecture for providing connections to things.
The only things realized now are
Switch and Dimmer devices reachable through a local [Legrand Adorne LC7001 hub](https://www.legrand.us/adorne/products/wireless-whole-house-lighting-controls/lc7001.aspx).

The [Legrand Adorne Wi-Fi Ready Switch, Dimmer Switch and Outlet devices](https://www.legrand.us/adorne/products/wireless-whole-house-lighting-controls.aspx) will be discovered as device URNs
* schemas-upnp-org:device:BinaryLight:1
* schemas-upnp-org:device:DimmableLight:1

Which correspond to
* [OCF UPnP BinaryLight](http://upnp.org/specs/ha/UPnP-ha-BinaryLight-v1-Device.pdf)
* [OCF UPnP DimmableLight](http://upnp.org/specs/ha/UPnP-ha-DimmableLight-v1-Device.pdf)

The only connections realized now are a
UPnP connection through a SmartThings hub and a
SmartThings Cloud Connector Schema App.

This project may be used to replace SmartThings to Legrand Adorne LC7001 hub integration through Samsung’s ARTIK Cloud.
Samsung has abandoned the ARTIK Cloud and Legrand has no plans to provide an alternative.
This is an alternative.

## Installation

**connect-things** is a JavaScript application that expects to be run in a [nodejs](https://nodejs.org/en/download/) environment.
It was developed using, at the time, the *Latest LTS Version: 12.18.3* of nodejs.
**connect-things** can be installed by [git](https://git-scm.com/downloads)
and the Node Package Manager [npm](https://www.npmjs.com/get-npm).
You can use these, as a normal user, to install **connect-things** with all of its dependencies:
```
git clone https://github.com/rtyle/connect-things
(cd connect-things; npm install)
```
To inspect the **connect-things** command line options and run it:
```
node . --help
node .
```

## UPnP Connection Through a SmartThings Hub

A companion project is [upnp-connect](https://github.com/rtyle/upnp-connect) which connects these things through a local SmartThings hub to SmartThings device types with Switch and SwitchLevel capabilities.

Since only the SmartThings hub will need access, it is recommended to exclude all others ...
```
node . --upnp-host smartthings.home
```
... where *smartthings.home* resolves to the SmartThings hub (use IP address otherwise).

## SmartThings Cloud Connector Schema App

Assuming that SmartThings will not be able to reach the connect-things service directly,
an [ngrok](https://ngrok.com/) (or equivalent) tunnel to it will be required.
One side of the tunnel should target the port (default, 8081) of the connect-things host/service
and the other side of the tunnel should be identified reliably with your custom [subdomain](https://ngrok.com/docs#http-subdomain).
For example,

```
ngrok http -subdomain=yoursubdomainhere 8081
```

Replace *yoursubdomainhere* (above and below) with your chosen, unique, reliable custom [subdomain](https://ngrok.com/docs#http-subdomain).

The
[SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace)
must be used to create a
[project](https://smartthings.developer.samsung.com/workspace/projects).
The
[new project](https://smartthings.developer.samsung.com/workspace/projects/new)
should be created for this
**Device Integration**
with a
**SmartThings Cloud Connector**
of type
**SmartThings Schema Connector**.
After naming your project, the next step will be to
**Register App**
of the
*Cloud Connector*.
It will be a
**Webhook Endpoint**
with a
*Target URL*
of
```
https://yoursubdomainhere.ngrok.io/c2c/resource
```

Set up the
*credentials required to access the cloud which hosts the devices*
(connect-things).
Follow the instructions in
[etc/c2cClientLocal.js](https://github.com/rtyle/connect-things/blob/master/etc/c2cClientLocal.js)
to generate (and remember) your own unique id and secret for the connect-things (local) client
and use these to fill in the
**Client ID**
and
**Client Secret**
fields.

The
**Authorization URI**
should be reachable from the device running the SmartThings app used to onboard connect-things.
It is most secure (and advised) if this device is connected to the same LAN as the connect-things host.
For example ...
```
https://connect-things.home:8082/c2c/oauth2/authorize
```
* where *connect-things.home* resolves to the host running connect-things (use IP address otherwise),
* connect-things is running an http service on port 8081 (default)
* and an https service on the next port (8082), dedicated to phone.home, which will only be so if run with the
```
--c2c-auth phone.home
```
... option where phone.home resolves to the host running the SmartThings app (use IP address otherwise) used to onboard connect-things.

The
**Token URI**
must be reachable from SmartThings.
```
https://yoursubdomainhere.ngrok.io/c2c/oauth2/token
```

The optional
**OAuth Scope(s)**
should be left empty.

Next, fill in the
**App Display Name**
with, say
"connect-things"
and choose a logo, say
[connect-c2c-things.png](https://github.com/rtyle/connect-things/blob/master/connect-c2c-things.png)

**Copy**
the your own unique SmartThings (remote)
**Client ID**
and
**Client Secret**
and paste (remember) them into
[etc/c2cClientRemote.js](https://github.com/rtyle/connect-things/blob/master/etc/c2cClientRemote.js).

You can then **Deploy to Test**.

Run connect-things for first-time onboarding.
```
rm -f etc/c2cCallbackAuthentication.json
rm -f etc/c2cCallbackUrls.json
node . --c2c-oauth phone.home
```
Any etc/c2cCallback*.json files are removed first because they will be overwritten
as part of establishing a new relationship with SmartThings.
Old content will probably not work.
Expect
```
<timestamp> [ERROR] c2c - < <deviceFriendlyName> callback undefined
```
messages from each device until the new relationship is forged.

From the SmartThings app (run on phone.home),
[enable Developer Mode](https://smartthings.developer.samsung.com/docs/testing/developer-mode.html)
then add
(**+**)
a
**Device**
by
**device type**.
Scroll to the bottom and click
**My Testing Devices**.
Under
*My setup apps*,
click
**connect-things**.
Select the
**Location**
and
**Room**
that devices will be added to and click
**Next**.

The local SmartThings app should automatically be authenticated and tokens should be exchaged between connect-things and SmartThings.
```
Connection between SmartThings and connect-things is successful
Close this page to finish setup.
```
Close the page.
```
Successfully connected to connect-things.
```
Click
**Done**.



## Automatic Run

From the connect-things host, change directory to where it is 
One should be able to make this run automatically in most environments.
It has been tested to run on Linux.
### Run as a Linux systemd service
As root,
```
cp connect-things/connect-things.service /etc/systemd/system/
```
Read this file for further instructions.
