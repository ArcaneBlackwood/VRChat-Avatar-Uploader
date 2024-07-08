import { Screens } from "./screens.js";
import { AvatarList } from "./avatarList.js";

function initPopupsConfirm(element, manager) {
	element.confirm = null;
	element.cancel = null;

	element.text = element.querySelector("label");
	const cancelButton = element.querySelector("#cancel");
	const confirmButton = element.querySelector("#confirm");
	const butEnable = element.confirmButtonEnable = e=>{
		if (!element.confirmTimer)
			return
		element.confirmTimer = null;
		confirmButton.disabled = false;
	};

	element.focusDefault = function() {
		confirmButton.focus();
	};
	element.reset = function() {
		if (element.confirmTimer)
			butEnable();
		confirmButton.disabled = true;
		element.confirmTimer = setTimeout(butEnable, 1000);
		element.focusDefault();
	};

	cancelButton.addEventListener("click", function(e) {
		element.cancel?.();
		butEnable();
		manager.deactivate();
	});
	confirmButton.addEventListener("click", function(e) {
		element.confirm?.();
		butEnable();
		manager.deactivate();
	});
	element.addEventListener("clickout", function(e) {
		element.cancell?.();
		butEnable();
	});
	
	return element;
}
function init2FA(element, manager) {
	element.confirm = null;
	element.cancel = null;

	element.text = element.querySelector("label");
	const codeInput = element.querySelector("#code");
	const cancelButton = element.querySelector("#cancel");
	const confirmButton = element.querySelector("#confirm");

	element.focusDefault = function() {
		codeInput.focus();
	};
	element.reset = function() {
		codeInput.value = "";
		element.focusDefault();
	};

	cancelButton.addEventListener("click", function(e) {
		element.cancel?.();
		manager.deactivate();
	});
	confirmButton.addEventListener("click", function(e) {
		element.confirm?.(codeInput.value);
		manager.deactivate();
	});
	element.addEventListener("clickout", function(e) {
		element.cancell?.();
	});
	
	return element;
}
function initMessage(element, manager) {
	element.exit = null;

	element.text = element.querySelector("label");
	const okButton = element.querySelector("#ok");

	element.focusDefault = function() {
		okButton.focus();
	};
	element.reset = function() {
		element.focusDefault();
	};

	okButton.addEventListener("click", function(e) {
		element.exit?.();
		manager.deactivate();
	});
	element.addEventListener("clickout", function(e) {
		element.cancell?.();
	});
	
	return element;
}
function initAvatarConfirm(element, manager) {
	const idAdd = element.querySelector(".id");
	const imageAdd = element.querySelector(".image");
	const nameAdd = element.querySelector(".name");
	const descAdd = element.querySelector(".desc");
	const tagsAdd = element.querySelector(".tags");
	const questAdd = element.querySelector(".quest");
	const desktopAdd = element.querySelector(".desktop");
	
	const idAddLabel = idAdd.querySelector("label.property");
	const imageAddLabel = imageAdd.querySelector("label.property");
	const nameAddLabel = nameAdd.querySelector("label.property");
	const descAddLabel = descAdd.querySelector("label.property");
	const tagsAddContent = tagsAdd.querySelector(".content");
	const questAddLabel = questAdd.querySelector("label.property");
	const desktopAddLabel = desktopAdd.querySelector("label.property");
	function setState(state, element, label, text) {
		element.setAttribute("active", state ? "true" : "false");
		if (state && label)
			label.innerText = text;
	}
	element.assemble = function(avatarData) {
		const current = AvatarList.selectedAvatar?.data;
		
		var state = avatarData.id != "";
		idAdd.setAttribute("active", state ? "true" : "false");
		if (state)
			idAddLabel.innerText = avatarData.id;
		
		state = avatarData.name != "" && avatarData.name != current?.name;
		nameAdd.setAttribute("active", state ? "true" : "false");
		if (state)
			nameAddLabel.innerText = avatarData.name;
		
		state = avatarData.desc != "" && avatarData.desc != current?.desc;
		descAdd.setAttribute("active", state ? "true" : "false");
		if (state)
			descAddLabel.innerText = avatarData.desc;
		
		state = avatarData.icon != "" && avatarData.icon != current?.icon;
		imageAdd.setAttribute("active", state ? "true" : "false");
		
		state = avatarData.tags.length > 0;
		tagsAdd.setAttribute("active", state ? "true" : "false");
		if (state) {
			while (tagsAddContent.firstChild)
				tagsAddContent.removeChild(tagsAddContent.lastChild);
			for (let tag of avatarData.tags) {
				const tagEl = document.createElement("label");
				tagEl.className = "property sized";
				tagEl.innerText = tag;
				tagsAddContent.appendChild(tagEl);
			}
		}
		
		questAdd.setAttribute("active", "false");
		desktopAdd.setAttribute("active", "false");
		for (let vrca of avatarData.vrcas) {
			if (vrca.type == "android") {
				questAddLabel.innerText = utils.getFilename(vrca.path);
				questAdd.setAttribute("active", "true");
			} else if (vrca.type == "standalonewindows") {
				desktopAddLabel.innerText = utils.getFilename(vrca.path);
				desktopAdd.setAttribute("active", "true");
			}
		}
		
		
	}
	
	
	element.confirm = null;
	element.cancel = null;

	element.text = element.querySelector("#text");
	const cancelButton = element.querySelector("#cancel");
	const confirmButton = element.querySelector("#confirm");
	const butEnable = element.confirmButtonEnable = e=>{
		if (!element.confirmTimer)
			return
		element.confirmTimer = null;
		confirmButton.disabled = false;
	};

	element.focusDefault = function() {
		confirmButton.focus();
	};
	element.reset = function() {
		if (element.confirmTimer)
			butEnable();
		confirmButton.disabled = true;
		element.confirmTimer = setTimeout(butEnable, 1000);
		element.focusDefault();
	};

	cancelButton.addEventListener("click", function(e) {
		element.cancel?.();
		butEnable();
		manager.deactivate();
	});
	confirmButton.addEventListener("click", function(e) {
		element.confirm?.();
		butEnable();
		manager.deactivate();
	});
	element.addEventListener("clickout", function(e) {
		element.cancell?.();
		butEnable();
	});
	
	return element;
}

export const Popups = {
	init(popupsElement) {
		this.popupsElement = popupsElement;;
		this.lastPopup = null;

		this.popups = {
			confirm: initPopupsConfirm(this.popupsElement.querySelector(".confirm"), this),
			authcode: init2FA(this.popupsElement.querySelector(".code"), this),
			message: initMessage(this.popupsElement.querySelector(".message"), this),
			avatarConfirm: initAvatarConfirm(this.popupsElement.querySelector(".avatarConfirm"), this)
		};
		
		/*popupsElement.addEventListener("click", clickOut);*/
		for (let popup of this.popupsElement.querySelectorAll(".popupBox")) {
			popup.addEventListener("click", e=>{
				e.preventDefault();
				e.stopPropagation();
			});
		}
		const popupPreventKeys = ["Tab", "Enter", "Space"];
		document.addEventListener('keydown', function(event) {
			if (!this.lastPopup)
				return;

			if (event.key == "Escape")
				this.clickOut();
			if (!popupPreventKeys.includes(event.key))
				return
			for (let element = event.target; element != null; element = element.parentElement) {
				if (element == this.popupsElement)
					return;
			}
			event.preventDefault();
			event.stopPropagation();
			this.lastPopup.focusDefault();
		}.bind(this));
	},

	toggleActive(element, disable) {
		if (element == null) return;
		var focusableElements = element.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');

		focusableElements.forEach(function(element) {
			if (disable)
				element.lastDisabled = element.disabled;
			element.disabled = disable ? true : element.lastDisabled;
		});
	},
	clickOut() {
		if (this.lastPopup == null)
			return;
		//Send event to popups to trigger proper closing and event triggers
		this.lastPopup.dispatchEvent(new Event("clickout"));
		this.deactivate();
	},
	activate(popup) {
		if (this.lastPopup)
			this.clickOut();
		popup.reset();
		this.lastPopup = popup;
		this.popupsElement.setAttribute("active", "true");
		this.lastPopup.setAttribute("active", "true");
		popup.focus();
		popup.focusDefault();

		if (Screens.activeScreen)
			this.toggleActive(Screens.activeScreen, true);
	},
	deactivate() {
		this.popupsElement.setAttribute("active", "false");
		this.lastPopup.setAttribute("active", "false");
		this.lastPopup = null;
		this.toggleActive(Screens.activeScreen, false);
	},
	

	popupConfirm(message, confirmCallback, cancelCallback) {
		const popup = this.popups.confirm;
		popup.confirm = confirmCallback;
		popup.cancel = cancelCallback;
		popup.text.innerText = message;
		this.activate(popup);
	},
	popup2FA(message, confirmCallback, cancelCallback) {
		const popup = this.popups.authcode;
		popup.confirm = confirmCallback;
		popup.cancel = cancelCallback;
		popup.text.innerText = message;
		this.activate(popup);
	},
	popupMessage(message, exitCallback) {
		const popup = this.popups.message;
		popup.exit = exitCallback;
		popup.text.innerText = message;
		this.activate(popup);
	},
	popupUploadConfirm(message, avatarData, confirmCallback, cancelCallback) {
		const popup = this.popups.avatarConfirm;
		popup.text.innerText = message;
		popup.confirm = confirmCallback;
		popup.cancel = cancelCallback;
		popup.assemble(avatarData);
		this.activate(popup);
	}
};