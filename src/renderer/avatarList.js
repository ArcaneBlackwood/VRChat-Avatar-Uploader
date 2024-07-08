import { Popups } from "./popups.js";
import { AvatarSettings } from "./avatarSettings.js";

function updateAvatarState(icon) {
	if (icon.selected) {
		if (icon.mouseDown)
			icon.setAttribute("state", "selectedActive");
		else if (icon.mouseHover)
			icon.setAttribute("state", "selectedHover");
		else
			icon.setAttribute("state", "selected");
	} else {
		if (icon.mouseDown)
			icon.setAttribute("state", "active");
		else if (icon.mouseHover)
			icon.setAttribute("state", "hover");
		else
			icon.setAttribute("state", "none");
	}
}
function updateSearch() {
	const term = this.searchInput.value;
	const results = utils.searchItems(
		this.avatars.map(avatar=>[
			avatar.data.name ?? "",
			avatar.data.desc ?? "",
			avatar.data.info ?? "",
			avatar.data.id ?? "",
			...(avatar.data.flags?.map?.(flag=>"+" + flag) ?? [])
		].join(" ")),
		term
	);
	results.forEach( ((visible,index) => {
		this.avatars[index].element.setAttribute("visible", visible ? "true" : "false");
	}).bind(this));
}

export const AvatarList = {
	init(element, onReload) {
		this.searchInput = element.querySelector("#avatarSearchText");
		this.searchButton = document.querySelector("#avatarSearch");
		this.listElement = document.querySelector(".avatars");
		this.avatarTemplate = document.querySelector("#avatarTemplate");
		this.reloadButton = document.getElementById("avatarReload");
		
		
		this.selectedAvatar = null;
		this.avatars = [];
		
		
		this.searchInput.addEventListener("change", updateSearch.bind(this));
		this.searchInput.addEventListener("keypress", updateSearch.bind(this));
		this.searchInput.addEventListener("paste", updateSearch.bind(this));
		this.searchInput.addEventListener("input", updateSearch.bind(this));
		this.searchButton.addEventListener("click", ((e) => {
			this.searchInput.value = "";
			updateSearch.call(this);
		}).bind(this));
		this.reloadButton.addEventListener("click", ((e) => {
			this.hideAvatars();
			onReload();
		}).bind(this));
		
		this.rawSelectId = null;
	},
	_initAvatarTemplate(element) {
		const icon = element.querySelector(".iconImage");
		element.selected = false;
		element.mouseHover = false;
		element.mouseDown = false;
		icon.index = element.index;
		icon.addEventListener("mousedown", function(e) {
			e.target.mouseDown = true;
			updateAvatarState(e.target);
		});
		icon.addEventListener("mouseup", function(e) {
			e.target.mouseDown = false;
			updateAvatarState(e.target);
		});
		icon.addEventListener("mouseenter", function(e) {
			e.target.mouseHover = true;
			updateAvatarState(e.target);
		});
		icon.addEventListener("mouseleave", function(e) {
			e.target.mouseDown = false;
			e.target.mouseHover = false;
			updateAvatarState(e.target);
		});
		icon.addEventListener("click", (function(e) {
			updateAvatarState(e.target);
			this.selectAvatar(e.target.index, true);
		}).bind(this));
	},
	_resizeAvatarTemplates(size) {
		const currentLength = this.listElement.childElementCount;
		if (currentLength < size) {
			for (let i = currentLength; i < size; i++) {
				const clone = this.avatarTemplate.content.cloneNode(true);
				clone.lastElementChild.index = i;
				this._initAvatarTemplate(clone.lastElementChild);
				this.listElement.appendChild(clone);
			}
		} else {
			for (let i = size; i < currentLength; i++) {
				this.listElement.lastElementChild.remove();
			}
		}
	},

	selectAvatar(index, fromList) {
		this.selectedAvatar = null;
		for (let avatar of this.avatars) {
			let newSelect = avatar.index == index;
			if (newSelect == avatar.element.selected) {
				if (!newSelect)
					continue;
				newSelect = false;
			}
			avatar.element.selected = newSelect;
			avatar.element.dispatchEvent(new CustomEvent("avatarselect",{
				selected: newSelect
			}));
			if (newSelect)
				this.selectedAvatar = avatar;
			updateAvatarState(avatar.element);
		}
		if (this.selectedAvatar) {
			AvatarSettings.setID(this.selectedAvatar.data.id, false);
			if (fromList)
				AvatarSettings.revertAvtarData(this.selectedAvatar.data);
		}
	},
	selectAvatarID(id, force) {
		this.rawSelectId = id;
		if (id == this.selectedAvatar?.id && !force) return;
		for (let avatar of this.avatars) {
			if (avatar.data.id == id) {
				if (avatar == this.selectedAvatar)
					return true;
				this.selectAvatar(avatar.index);
				return true;
			}
		}
		this.selectAvatar(-1);
		return false;
	},
	setAvatars(avatarData) {
		this._resizeAvatarTemplates(avatarData.length);
		this.avatars = avatarData.map((avatarData,i) => {
			const element = this.listElement.children[i];
			return {
				index: i,
				element,
				idText: element.querySelector(".id"),
				nameText: element.querySelector(".name"),
				infoText: element.querySelector(".info"),
				deleteButton: element.querySelector("#delete"),
				icon: element.querySelector(".iconImage"),
				data: avatarData
			};
		});
		for (let avatar of this.avatars) {
			avatar.idText.innerText = avatar.data.id ?? "ERR";
			avatar.nameText.innerText = avatar.data.name ?? "ERR";
			avatar.infoText.innerText = avatar.data.info ?? "";
			avatar.icon.src = avatar.data.icon ?? rootAssetDir+"noavatar.svg";

			avatar.deleteButton.data = avatar;
			avatar.deleteButton.addEventListener("click", function(e) {
				const d = this.data.data;
				Popups.popupConfirm("Are you sure you want to delete the avatar:\n" + d.id + "\n\n" + d.name + "\n\nIt will be perminant and unrecoverable!", ()=>eventSend.avatarDelete(d), null);
			});
			avatar.element.data = avatar;
			avatar.element.addEventListener("avatarselect", function(e) {
				//eventSend.avatarSelected(this.data.data);
				console.log((this.selected ? "Selected" : "Deselected") + " avatar[" + this.data.index + "]: " + this.data.data.name, this.data);
			});
		}
		
		this.showAvatars();
		if (this.rawSelectId)
			this.selectAvatarID(this.rawSelectId, true);
	},
	hideAvatars() {
		this.listElement.setAttribute("hidden", "true");
	},
	showAvatars() {
		this.listElement.setAttribute("hidden", "false");
	}

};