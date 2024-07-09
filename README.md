# VRChat Avatar Uploader
A simple program to upload avatars to VRChat.  Built for Avatar creators to distribute avatars to their clients without the need to request login details.

## 🚨 Currently nonfunctional!
Still working out some bugs.  If anyone has any advice Id be very happy to accept!

VRChat flags any uploaded avatars with "Security checks failed".  Maybe the package building from unity is missing something?  Possible that building the testing file misses some critical information inside the bundle that the typical build does?

<p align="center">
  <img src="./program-preview.png" alt="image">
</p>


## RUNNING FROM SOURCE

### Clone the repository
Use either of the following options:
- Using your terminal type `git clone https://github.com/ArcaneBlackwood/VRChat-Avatar-Uploader.git` and then `cd VRChat-Avatar-Uploader` to switch into the repo's directory
- Download the repo zipped off Github by downloading https://github.com/ArcaneBlackwood/VRChat-Avatar-Uploader/archive/refs/heads/main.zip (Can be found at the top of the page, a green `<> Code v` button, select `Download Zip`).  Extract the zipfile somewhere and open a terminal in that folder either by shift-right clicking and click `Open PowerShell window here`, or open command prompt from the start menu and `cd C:\Users\SomeUser\...` to the extracted folders location.

### Install the nessisary tools and dependencies
You will need NodeJS which can be found at https://nodejs.org/ 
Note Im using Node.js v20.15.0, which can be downloaded directly [here!](https://nodejs.org/dist/v20.15.1/node-v20.15.1-x64.msi)

Run `npm install` to install all the required packages for this repository.

### Starting directly
Run `npm start`

### Building Electron executable and installer
Run `npm build`
The built files can be found under `./dist/`
Standalone files can also be found under `./dist/win-unpacked/`


## BUILDING VRCA FILES FROM UNITY

Download and add the file [`./BundleExporter.cs`](https://raw.githubusercontent.com/ArcaneBlackwood/VRChat-Avatar-Uploader/main/BundleExporter.cs) to your Unity project, you can put it anywhere inside your Assets.

In Unity, Ensure you are logged into the VRChat SDK. Goto the menu at the top and click `VRChat SDK` -> `Utilities` -> `Bundle Exporter`.  You can then select the avatar you want to export, click `Export Bundle`, and choose a location to save the exported bundle.  This exported file can then be imported into the avatar uploader.