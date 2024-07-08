const { initializeWindow, userAgentString, rootPath } = require('./electronWindow.js');
const { dialog } = require('electron');
const { log } = require('console');
const { UploadFile, UploadAvatar } = require('./vrchatUploader.js');
const persistence = require('./persistence.js');
const vrchat = require('./vrchat.js');
const ipc = require('./mainIPC.js');
const utils = require('./utils.js');
const fs = require('fs');

var userInfo;

function vrcResponseCheck(response) {
	if (!response || !response.data) {
		this.setLoginInfo("Unknown error, no response");
		return true;
	}
	if (response.data.error) {
		this.setLoginInfo(response.data.error.message);
		return true;
	}
	if (response.data.requiresTwoFactorAuth) {
		const emailSupported = response.data.requiresTwoFactorAuth.includes("emailOtp");
		const authenticatorSupported = response.data.requiresTwoFactorAuth.includes("totp");
		const textSupported = response.data.requiresTwoFactorAuth.includes("sms");
		const backupSupported = response.data.requiresTwoFactorAuth.includes("otp");
		
		this.request2FA({type: emailSupported ? "emailOtp" : "otp"});
		return true;
	}
	return false;
}
async function loadAvatars() {
	response = await vrchat.requests.getOwnAvatars(persistence.vrcLogin);
	if (vrcResponseCheck.call(this, response)) return;
	if (!Array.isArray(response.data)) {
		this.setLoginInfo("VRC API returned incorrect avatars array response JSON");
		log(response);
		return;
	}
	myAvatars = utils.convertVRCAvatarToVRCA(response.data);
	
	this.setDisplayName(userInfo.displayName);
	this.setAvatars(myAvatars);
}
async function verifyLoggedIn() {
	try {
		var response = await vrchat.requests.authorize(persistence.vrcLogin);
	} catch(e) {
		return false;
	}
	if (vrcResponseCheck.call(this, response)) return false;
	var success = response.code == 200 && !response.data.error && response.data.verified !== false;
	if (success) {
		userInfo = response.data;
	}
	return success;
}





(async function () {
	var myAvatars = [];
	var apiConfig;

	initializeWindow();
	vrchat.setUserAgentString(userAgentString);
	await persistence.load();

	ipc.setup({
		async load(e) {
			this.setUserAgentString(userAgentString);
			this.setRootPath(rootPath);
			apiConfig = await vrchat.requests.getConfig(persistence.vrcLogin);
			if (vrcResponseCheck.call(this, apiConfig)) return; 
			persistence.vrcLogin.apiKey = apiConfig.data.clientApiKey;
			if (!persistence.vrcLogin.apiKey) {
				this.setLoginInfo("Undefined API key from response", apiConfig);
				return;
			}
			
			const loggedIn = persistence.isVRCLoginLoaded() ? await verifyLoggedIn.call(this) : false;
			if (loggedIn) {
				await loadAvatars.call(this);
				this.setScreen("main");
			} else {
				this.setScreen("login");
				this.setLoginSave(persistence.config.saveLogin);
			}
		},
		async logout(e) {
			persistence.config.saveLogin = false;
			var response = await vrchat.requests.logout(persistence.vrcLogin);
			if (vrcResponseCheck.call(this, response)) return; 
			
			this.setScreen("login");
			this.setLoginSave(persistence.config.saveLogin);
		},
		async submit2FA(e, {code, type}) {
			var response;
			if (type=="emailOtp")
				response = await vrchat.requests.authorize2FAEmail(persistence.vrcLogin, code);
			else
				response = await vrchat.requests.authorize2FAAuthenticator(persistence.vrcLogin, code);
			if (vrcResponseCheck.call(this, response)) return; 
		
			if (response.data.verified === false) {
				this.setLoginInfo("Invalid 2FA code");
				return;
			}
			if (response.code == 200) {
				const loggedIn = await verifyLoggedIn.call(this);
				if (loggedIn) {
					if (!verifyLoggedIn.call(this)) {
						this.setLoginInfo("Cannot verify logged in, try relog");
						return;
					}
					await loadAvatars.call(this);
					this.setScreen("main");
				} else {
					this.setLoginInfo("Unkown error, logged in, but cannot verify login");
				}
				return;
			}
		},
		async loginAttempt(e, data) {
			persistence.config.saveLogin = data.save;
			
			var response = await vrchat.requests.authorize(persistence.vrcLogin, data.username, data.password);
			if (vrcResponseCheck.call(this, response)) return;
			if (response.code == 200) {
				const loggedIn = await verifyLoggedIn.call(this);
				if (loggedIn) {
					userInfo = response.data;
					await loadAvatars.call(this);
					this.setScreen("main");
				} else {
					this.setLoginInfo("Unkown error, logged in, but cannot verify login");
				}
				return;
			}
		},
		async avatarSelected(e, avatar) {
			
		},
		async avatarDelete(e, avatar) {
			var response = await vrchat.requests.deleteAvatar(persistence.vrcLogin, avatar.id);
			if (vrcResponseCheck.call(this, {data: response})) return;
			await loadAvatars.call(this);
		},
		async promptSave(e, {filename, filedata}) {
			const data = await dialog.showSaveDialog({
				defaultPath: filename,
				filters: [
					{ name: 'VRChat Packaged Avatar', extensions: ['vrcpa'] },
					{ name: 'All Files', extensions: ['*'] }
				]
			});
			if (data.canceled)
				this.promptSaveCancel(false);
			else {
				if (filedata) {
					fs.writeFile(data.filePath, filedata, err => {
						if (err) {
						console.error(err);
						this.promptSaveCancel(err);
						} else
						this.promptSaveSuccess(data.filePath);
					});
				} else
					this.promptSaveSuccess(data.filePath);
			}
		},
		async promptOpen(e, d) {
			const data = await dialog.showOpenDialog({
				filters: [
					{ name: 'VRChat Packaged Avatar', extensions: ['vrcpa'] },
					{ name: 'All Files', extensions: ['*'] }
				]
			});
			if (data.canceled)
				this.promptOpenCancel(false);
			else
				this.promptOpenSuccess(data.filePaths[0]);
		},
		async avatarUpload(e, avatarData) {
			try {
				var id = await UploadAvatar(persistence.vrcLogin, avatarData, (function(category, progress, message) {
					this.avatarUploadProgress({type: category, completion: progress, message});
				}).bind(this), userInfo); 
			} catch (e) {
				this.avatarUploaded({id: null, message: e});
				console.error(e);
				return;
			}
			
			this.avatarUploaded({id, message: "Upload complete"});
		},
		async reload() {
			await loadAvatars.call(this);
		}
	});
})();