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
