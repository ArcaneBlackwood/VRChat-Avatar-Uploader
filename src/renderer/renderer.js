import { Popups } from "./popups.js";
import { AvatarList } from "./avatarList.js";
import { Progressor } from "./progressor.js";
import { Screens } from "./screens.js";
import { Resizer } from "./resizer.js";
import { LoginManager } from "./loginManager.js";
import { VRCAs } from "./vrcas.js";
import { AvatarSettings } from "./avatarSettings.js";
import { LoadSave } from "./loadSave.js";
import { Upload } from "./upload.js";

function id(elId) {
	return document.getElementById(elId);
}
//Wrapper for error detection, preload always reports the highest trace inside the preload itself, not anything from renderer.
window.eventRecv = {};
Object.keys(eventRecvUnwrapped).forEach(key => {
	let copyEvent = eventRecvUnwrapped[key];
	window.eventRecv[key] = function(callback) {
		copyEvent(function() {
			try {
				callback.apply(this, arguments);
			} catch (e) {
				console.error("IPC HANDLER", e);
				try {
					Popups.popupMessage("IPH Handler " + err.name + ":\n" + err.message);
				} catch (e) { }
				throw e;
			}
		});
	}
});

window.addEventListener('DOMContentLoaded', () => {
	console.log("DOMContentLoaded");

	electron.onReady(function(events) {
		try {
			eventSend.load();


			const logoutButton = document.getElementById("logout");
			const currentUsername = {value: ""};
			const currentUserLabel = document.getElementById("loggedinas");
			logoutButton.addEventListener("click", function() {
				Popups.popupConfirm("Are you sure you want to logout of " + currentUserLabel.innerText + "?", () => {
					console.log("Send event logout");
					eventSend.logout()
				}
				, null);
			});
			eventRecv.setDisplayName((e,name) => {
				currentUserLabel.innerText = name;
				currentUsername.value = name;
			});

			
			Popups.init(document.querySelector(".popups"));
			Screens.init(Array.from(document.getElementsByClassName("screen")));
			Progressor.init(id("status"), id("progressmain"));
			const resizer = new Resizer(document.querySelector(".resizerh"));
			
			AvatarList.init(id("avatarList"), () => eventSend.reload());
			eventRecv.setAvatars(function(e, avatarData) {
				try {
					AvatarList.setAvatars(avatarData);
				} catch (e) {
					console.error(e);
				}
			});
			VRCAs.init(document.querySelector(".vrcas"));
			AvatarSettings.init(id("settingsBase"));
			
			LoginManager.init(id("login"));
			
			LoadSave.init(id("packagename"), id("save"), id("load"), currentUsername);
			Upload.init(id("upload"), currentUsername);


			eventRecv.backendError((e,err) => {
				Popups.popupMessage("Backend " + err.name + ":\n" + err.message);
				console.error("BACKEND", err);
			});
		} catch (e) {
			console.error(e);
			try {
				Popups.popupMessage("Frontend " + err.name + ":\n" + err.message);
			} catch (e) { }
		}
	});
});
