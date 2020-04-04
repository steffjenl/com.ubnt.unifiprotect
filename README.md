# UniFi Video

Adds support for Ubiquiti UniFi Protect devices in Homey.

## Supported devices

* UniFi® Protect (Network Video Recorder):
	* UVC‑NVR
* UniFi® Video Camera G3 series:
	* UVC-G3
	* UVC-G3-AF
	* UVC-G3-DOME
	* UVC-G3-FLEX
	* UVC-G3-PRO
* UniFi® Video Camera G4 series:
	* UVC-G4-PRO

## Getting started

1. Create a user in the UniFi Video web interface that belongs to a group that has permissions `view camera` and `edit camera`.
2. Enable 'local access' for the user and remember the username and password, you will need them later.
3. Install this UniFi Video app on your Homey.
4. Start the 'add device wizard' in Homey, search for your UniFi NVR and/or cameras and add them to your devices. You will be prompted to enter the credentials of the UniFi Video user you created in step 2.
5. If the user credentials changed in UniFi Video, they can be updated on the UniFi Video app's settings page.

## Usage

* A flow can be triggered when motion detection on a camera starts or ends.
* A flow can be triggered when a snapshot is created on a camera. This card supplies the name of the camera that created the snapshot and the snapshot image itself.
* A flow action card can be used to create a snapshot, which is is saved to an Image tag.
* A flow action card is available to set a camera's recording mode, being one of 'Don't record', 'Always record' or 'Record only motion'.

## Troubleshooting / FAQ

Q: I can't seem to create a snapshot, what's wrong?
A: Make sure the UniFi Video user is part of a group that has the `view camera` permission.

Q: I can't seem to change the recording mode on a camera, what's wrong?
A: Make sure the UniFi Video user is part of a group that has the `edit camera` permission.

Q: I am running UniFi Protect on a Cloud Key V2, can I use this app with it?
A: Unfortunately, UniFi Protect is not supported.

## Feedback

If you find a bug or if you are missing a feature, please [create an issue here](https://github.com/j0bro/com.ubnt.unifivideo/issues).
Thank you for using this app!

## Attributions

Icons made by [Google](https://www.flaticon.com/authors/google) from [Flaticon](https://www.flaticon.com/)

[i1]: https://github.com/j0bro/com.ubnt.unifivideo/issues/1
[i2]: https://github.com/j0bro/com.ubnt.unifivideo/issues/2
[i5]: https://github.com/j0bro/com.ubnt.unifivideo/issues/5
[i6]: https://github.com/j0bro/com.ubnt.unifivideo/issues/6
