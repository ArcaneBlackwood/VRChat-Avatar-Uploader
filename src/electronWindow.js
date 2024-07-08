const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const persistence = require('./persistence.js');
const os = require('os');

const electronVersion = process.versions.electron;
let platformString;
switch(os.platform()) {
  case 'linux':
    platformString = 'Linux';
    break;
  case 'win32':
    platformString = 'Windows';
    break;
  case 'darwin':
    platformString = 'Mac';
    break;
  default:
    platformString = 'Unknown';
}
const userAgentString = `VRCAvatarUploader/1.0.0 (Electron/${electronVersion}; ${platformString}) AppleWebKit (compatible; VRCUploader/1.0.0; +mail://redstonemaster4952@gmail.com)`;


var mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 800,
		icon: "src/renderer/assets/icon-64.ico",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.resolve(app.getAppPath(), 'src/renderer/preload.js'),
      nodeIntegration: true,
			contextIsolation: true
    }
  });
	mainWindow.webContents.userAgent = userAgentString;
  mainWindow.loadFile('src/renderer/index.html');
}
function initialize() {
	app.whenReady().then(createWindow);
	app.on('web-contents-created', (e, wc) => {
		wc.setWindowOpenHandler(({ url }) => {
			shell.openExternal(url);
			return { action: 'deny' };
		});
	});
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') app.quit();
	});
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
	let asyncOperationDone = false;

	app.on("before-quit", async (e) => {
		if (!asyncOperationDone) {
			e.preventDefault();
			await persistence.save();
			asyncOperationDone = true;
			app.quit();
		}
	});
}

module.exports = {
	initializeWindow: initialize,
	getMainWindow() {
		return mainWindow;
	},
	userAgentString,
	rootPath: app.getAppPath(),
};