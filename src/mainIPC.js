const { ipcMain } = require('electron');
const { log } = require('console');
const { getMainWindow } = require ('./electronWindow.js');

var ipcTransmitters = {};
function setup(recievers) {
	ipcMain.on("sync-recievers", (e, data) => {
		const mainWindow = getMainWindow();
		for (let transmitter of data) {
			ipcTransmitters[transmitter] = (data) => {
				mainWindow.webContents.send(transmitter, data);
			};
		}
		mainWindow.webContents.send("sync-recievers", Object.keys(recievers));
	});
	
	for (let event in recievers) {
		if (!recievers.hasOwnProperty(event)) continue;
		const eventName = event;
		
		ipcMain.on(eventName, async function(e, data)  {
			try {
				await recievers[eventName].call(ipcTransmitters, e, data);
			} catch (e) {
				ipcTransmitters.backendError?.(e);
				console.error("Caught error in IPC handlers:", e);
			}
		});
	}
}

module.exports = {
	setup, getSenders() {
		return ipcTransmitters;
	}
};