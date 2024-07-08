const { ipcRenderer, contextBridge } = require('electron');
const {compressedPackage, uncompressPackage, setUserAgentString, setRootPath} = require("./packageArchiver.js");
const utils = require("../utils.js");




var callbacks = {};
function promptSave(filename, callbackSave, callbackCancel, filedata) {
	return new Promise((accept, reject) => {
		callbacks.promptSaveSuccess = function(filepath) {
			accept(filepath);
			if (callbackSave)
				callbackSave.apply(this, arguments);
		};
		callbacks.promptSaveCancel = function() {
			reject();
			if (callbackCancel)
				callbackCancel.apply(this, arguments);
		};
		eventSend.promptSave({filename, filedata});
	});
}
function promptOpen(callbackOpen, callbackCancel) {
	return new Promise((accept, reject) => {
		callbacks.promptOpenSuccess = function(filepath) {
			accept(filepath);
			if (callbackOpen)
				callbackOpen.apply(this, arguments);
		};
		callbacks.promptOpenCancel = function() {
			reject();
			if (callbackCancel)
				callbackCancel.apply(this, arguments);
		};
		eventSend.promptOpen();
	});
}



const eventSend = {};
const eventRecv = {};
var onReadyCallback, ready = false;

function SetupIPC(recievers, expose) {
	ipcRenderer.on("sync-recievers", (e, data) => {
		for(let transmitter of data) {
			eventSend[transmitter] = function(data) {
				ipcRenderer.send(transmitter, data);
			};
		}
		contextBridge.exposeInMainWorld('eventSend', eventSend);
		if (onReadyCallback) onReadyCallback();
		ready = true;
	});
	ipcRenderer.send("sync-recievers", recievers);
	
	for (let event of recievers) {
		let eventName = event; // Create a new variable scoped to the loop iteration
		eventRecv[event] = (callback) => {
			ipcRenderer.addListener(event, callback);
		};
	}
	contextBridge.exposeInMainWorld('eventRecvUnwrapped', eventRecv);

	eventRecv.promptSaveSuccess((e, d) => callbacks.promptSaveSuccess?.(d));
	eventRecv.promptSaveCancel((e, d) => callbacks.promptSaveCancel?.({name:"Cancel"}));
	eventRecv.promptOpenSuccess((e, d) => callbacks.promptOpenSuccess?.(d));
	eventRecv.promptOpenCancel((e, d) => callbacks.promptOpenCancel?.({name:"Cancel"}));
	eventRecv.setUserAgentString((e, d) => setUserAgentString(d));
	eventRecv.setRootPath((e, d) => setRootPath(d));
	contextBridge.exposeInMainWorld('electron', Object.assign({
		onReady(callback) {
			if (ready) callback();
			onReadyCallback = callback;
		},
	}, expose));
	contextBridge.exposeInMainWorld("utils", utils);
}
try {
	SetupIPC([
		"backendError",
		"setScreen", "setAvatars", "setDisplayName",
		"promptSaveSuccess", "promptSaveCancel",
		"promptOpenSuccess","promptOpenCancel",
		"avatarUploaded","avatarUploadProgress","avatarUploadFail",
		"request2FA", "setLoginInfo", "setLoginSave", "setUserAgentString", "setRootPath"
	], {
		//promptSave, promptOpen,
		
		async compressedPackage(filename, config, callbackSuccess, callbackProgress, callbackError, callbackFileSelected) {
			var errored = false;
			try {
				function onSuccess() {
					if (errored) return;
					callbackSuccess.apply(this, arguments);
				}
				function onProgress() {
					if (errored) return;
					callbackProgress.apply(this, arguments);
				}
				function onError() {
					if (errored) return;
					errored = true;
					callbackError.apply(this, arguments);
				}
				callbackProgress("select");
				const filepath = await promptSave(filename, null, callbackError);
				callbackProgress("create");
				callbackFileSelected?.(filepath);
				await compressedPackage(filepath, config, onSuccess, onProgress, onError);
			} catch (e) {
				console.error(e);
				onError(e);
			}
		},
		async uncompressPackage(callbackSuccess, callbackProgress, callbackError, callbackFileSelected) {
			var errored = false;
			try {
				function onSuccess() {
					if (errored) return;
					callbackSuccess.apply(this, arguments);
				}
				function onProgress() {
					if (errored) return;
					callbackProgress.apply(this, arguments);
				}
				function onError() {
					if (errored) return;
					errored = true;
					callbackError.apply(this, arguments);
				}
				const filepath = await promptOpen(null, callbackError);
				callbackFileSelected?.(filepath);
				await uncompressPackage(filepath, onSuccess, onProgress, onError);
			} catch (e) {
				console.error(e);
				onError(e);
			}
		},
	});
} catch (e) {
	console.error ("PRELOAD", e);
}