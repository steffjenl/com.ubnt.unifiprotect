Features:
Use your UniFi Protect cameras as motion alert sensors.
Monitor your UniFi Cloud Key's health in a dedicated, new UniFi Cloud Key device.

Supported device models:
- UniFi® Protect (Network Video Recorder):
	- UniFi® Cloud Key v2 Pro
	- UniFi® Dream Machine Pro (UnifiOs)
	- UniFi® Protect Network Video Recorder (UnifiOs)
- UniFi® Video Camera G3 series:
	- UVC-G3
	- UVC-G3-AF
	- UVC-G3-DOME
	- UVC-G3-FLEX
	- UVC-G3-MICRO
	- UVC-G3-PRO
- UniFi® Video Camera G4 series:
	- UVC-G4-PRO
	- UVC-G4-BULLET

Note: if you are upgrading from a previous (beta) version, please re-add your devices.

Getting started:
1. Create a local access user in the UniFi Protect web interface (used only for Homey.
2. Install this UniFi Protect app on your Homey.
3. Go to the UniFi Protect app's settings page.
4. You will be prompted to enter the credentials of the UniFi Video user you created in step 2 and some network information.
5. Start the 'add device wizard' in Homey, search for your UniFi Cloud Key and/or cameras and add them to your devices.
6. If the user credentials changed in UniFi Protect, they can be updated on the UniFi Protect app's settings page.

Usage:
- A flow can be triggered when motion detection on a camera starts or ends.
- A flow can be triggered when a snapshot is created on a camera. This card supplies the name of the camera that created the snapshot and the snapshot image itself.
- A flow action card can be used to create a snapshot, which is is saved to an Image tag.
- A flow action card is available to set a camera's recording mode, being one of 'Don't record', 'Always record' or 'Record only motion'.

Troubleshooting / FAQ:
- Q: I am using UniFi® Dream Machine Pro and can't connect.
- A: You must select 'UnifiOs' in the Application Settings.

- Q: I am using a UnifiOs device and the snapshot url is not working
- A: Because the UnifiOs required an Cookie, you can try https://hub.docker.com/r/silvenga/unifi-udm-api-proxy
