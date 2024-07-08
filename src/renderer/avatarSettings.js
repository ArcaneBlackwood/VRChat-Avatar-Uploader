import { AvatarList } from "./avatarList.js";
import { VRCAs } from "./vrcas.js";

export const AvatarSettings = {
	noAvatarIcon: "assets/noavatar.svg",
	iconImageData: null,
	iconImagePath: null,
	init(element) {
		this.nameInput = element.querySelector("#name");
		this.descInput = element.querySelector("#desc");
		this.tagCheckboxes = Array.from(element.querySelectorAll("input[name=tags]"));
		this.releaseRadio = element.querySelector("#release");
		this.releaseRadioChildren = this.releaseRadio.querySelectorAll('input');
		
		this.idInput = element.querySelector("#id");
		this.idNewElement = element.querySelector("#idnew");
		this.idWarnElement = element.querySelector("#idwarn");

		this.revertButton = element.querySelector("#revert");
		this.lockInputElement = element.querySelector("#lock");
		
		this.iconInputElement = element.querySelector("#iconinput");
		this.iconElement = element.querySelector(".mainIconImage img");


		this.revertButton.addEventListener("click", (e=>{
			if (AvatarList.selectedAvatar?.data)
				this.revertAvtarData(AvatarList.selectedAvatar.data, true);
			else
				this.revertAvtarData({
					id: "",
					name: "",
					desc: "",
					icon: null,
					tags: [],
					vrcas: []
				}, true);
		}).bind(this));
		this.iconInputElement.addEventListener("change", (function(e) {
			this.setIcon(this.iconInputElement.files[0]);
		}).bind(this));
		this.idInput.addEventListener("change", (function(e) {
			this.setID(this.idInput.value, true);
		}).bind(this));


		this.iconElement.src = this.noAvatarIcon;
		this.setID();
	},
	revertAvtarData(avatar, ignoreLock, isLoad) {
		avatar = avatar ?? AvatarList.selectedAvatar?.data;
		if (!avatar)
			return;

		this.setID(avatar.id);

		if (this.lockInputElement.checked && !ignoreLock)
			return;

		this.nameInput.value = avatar.name ?? "";
		this.descInput.value = avatar.desc ?? "";
		for (let tag of this.tagCheckboxes) {
			tag.checked = avatar.tags.includes(tag.value);
		}

		for (let radio of this.releaseRadioChildren)
			radio.checked = avatar.releaseStatus == radio.value;
		this.setIconUrl(avatar.icon);
		VRCAs.setAllVRCAS(avatar.vrcas, isLoad);
	},


	setID(id, fromInput) {
		id = id ?? "";
		var foundAvatar = AvatarList.selectAvatarID(id);
		if (id == "") {
			this.idNewElement.setAttribute("active", "true");
			this.idWarnElement.setAttribute("active", "false");
		} else if (!foundAvatar) {
			this.idNewElement.setAttribute("active", "false");
			this.idWarnElement.setAttribute("active", "true");
		} else {
			this.idNewElement.setAttribute("active", "false");
			this.idWarnElement.setAttribute("active", "false");
		}
		if (!fromInput)
			this.idInput.value = id;
	},


	///TODO: Make update status icon, info to viewer on if will upload image
	///TODO: Auto crop and resize image to fit requirements for icon
	setIcon(file) {
		if (file == null) {
			this.iconElement.src = AvatarList.selectedAvatar?.data?.icon || this.noAvatarIcon;
			return;
		}
		const reader = new FileReader();
		reader.onload = (event) => {
			this.iconElement.src = event.target.result;
			this.iconImageData = event.target.result;
		}
		this.iconImagePath = file.path;
		reader.readAsDataURL(file);
	},
	setIconUrl(url) {
		url = url ?? "";
		if (url == "") {
			this.iconElement.src = AvatarList.selectedAvatar?.data?.icon ?? this.noAvatarIcon;
			return;
		}
		this.iconImagePath = url;
		this.iconInputElement.value = "";
		this.iconElement.src = url;
		this.iconImageData = null;
	},
	async createNewAvatarData(currentUsername) {
		const releaseStatus = this.releaseRadio.querySelector('input:checked')?.value ?? "private";
		const avatarData = {
			id: (this.idInput.value??"").trim(),
			name: (this.nameInput.value??"").trim(),
			desc: (this.descInput.value??"").trim(),
			icon: (this.iconImagePath??AvatarList.selectedAvatar?.data?.icon??"").trim(),
			creator: currentUsername,
			//info: new Date().toLocaleString("en-NZ", { year: 'numeric', month: 'long', day: 'numeric' }),
			tags: this.tagCheckboxes.filter(tag=>tag.checked).map(tag=>tag.value),
			vrcas: VRCAs.vrcas.filter(vrca=>vrca.filePath != null).map(vrca=>({
				path: vrca.filePath,
				type: vrca.type
			})),
			releaseStatus
		};
		console.log("Avatar Data", avatarData);
		return avatarData;
	}
};