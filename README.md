# Ubiquiti UniFi Protect

Adds support for Ubiquiti UniFi Protect devices in Homey.

## Supported devices

* UniFi® Protect (Network Video Recorder):
	* UniFi® Cloud Key v2 Pro
	* UniFi® Dream Machine Pro (UnifiOs)
	* UniFi® Protect Network Video Recorder (UnifiOs)
* UniFi® Video Camera G3 series:
	* UVC-G3
	* UVC-G3-AF
	* UVC-G3-DOME
	* UVC-G3-FLEX
	* UVC-G3-MICRO
	* UVC-G3-PRO
* UniFi® Video Camera G4 series:
	* UVC-G4-PRO
	* UVC-G4-BULLET

## Getting started

1. Create a local access user in the UniFi Protect web interface (used only for Homey.
2. Install this UniFi Protect app on your Homey.
3. Go to the UniFi Protect app's settings page.
4. You will be prompted to enter the credentials of the UniFi Video user you created in step 2 and some network information.
5. Start the 'add device wizard' in Homey, search for your UniFi Cloud Key and/or cameras and add them to your devices.
6. If the user credentials changed in UniFi Protect, they can be updated on the UniFi Protect app's settings page.

## Usage

* A flow can be triggered when motion detection on a camera starts or ends.
* A flow can be triggered when a snapshot is created on a camera. This card supplies the name of the camera that created the snapshot and the snapshot image itself.
* A flow action card can be used to create a snapshot, which is is saved to an Image tag.
* A flow action card is available to set a camera's recording mode, being one of 'Don't record', 'Always record' or 'Record only motion'.

## Notice
In a beta version of Unifi Protect, all information about the NVR itself has been removed. We have made the NVR itself deprecated as a device and will be removed in the next version.
Remove the NVR from your devices. The NVR is also no longer obliged to install it first.

## Troubleshooting / FAQ
* Question: I am using UniFi® Dream Machine Pro and can't connect.
    * A: You must select 'UnifiOs' in the Application Settings.
* Question: I get a lot of false motion alerts. Is there anything to do about that?
    * A: Turn off 'Enable Auto Rotate' and rotate the camera manually.
    * A: Remove the default motion zone and create a motion zone with only the zone what you want to detect motions.
    * A: Set 'Minimum seconds of motion to trigger event' on 1 second or higher
    * Do you have more tips? let me know!
* Question: I am using a UnifiOS device, I don't see any storage information.
    * A: UnifiOS device does not release storage information through the API.


## Feedback

If you find a bug or if you are missing a feature, please [create an issue here](https://github.com/steffjenl/com.ubnt.unifiprotect/issues).
Thank you for using this app!

## Attributions

Icons made by [Google](https://www.flaticon.com/authors/google) from [Flaticon](https://www.flaticon.com/)
