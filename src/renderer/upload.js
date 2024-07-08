import { AvatarSettings } from "./avatarSettings.js";
import { Progressor } from "./progressor.js";
import { Popups } from "./popups.js";

export const Upload = {
	init(uploadButton, currentUsername) {
		this.uploadButton = uploadButton;
		this.currentUsername = currentUsername;
			
			
		this.uploadButton.addEventListener("click", this.uploadAvatar.bind(this));
		eventRecv.avatarUploaded((e,{id, message}) => {
			if (id == null || id == "") {
				Progressor.setStatus(message ?? "Failed to upload.", true);
				return;
			}
			AvatarSettings.setID(id);
			eventSend.reload();
			
			Progressor.setProgressState("complete");
			document.body.dispatchEvent(new CustomEvent("avataruploaded",{
				id
			}));
		});
		eventRecv.avatarUploadFail((e,err) => {
			Progressor.setStatus("Avatar upload error! " + err.message, true);
		});
		eventRecv.avatarUploadProgress((e,{type, completion, message}) => {
			if (type)
				Progressor.setProgressState(type);
			Progressor.setProgress(completion??0);
			if (message)
				Progressor.setStatus(message);
		});
	},
	async uploadAvatar() {
		try {
			Progressor.setProgressType("upload");
			Progressor.setProgressState("assemble");
			
			const avatarData = await AvatarSettings.createNewAvatarData(this.currentUsername.value);
			const verifyInfo = this.verifyAvatar(avatarData);
			if (verifyInfo) {
				Progressor.setStatus(verifyInfo, true);
				return;
			}
			
			Progressor.setProgressState("confirm");
			await new Promise((accept, reject) => Popups.popupUploadConfirm("Confirm avatar uploading: ", avatarData, accept, () => reject("User confirmation rejected")));
		
			eventSend.avatarUpload(avatarData);
		} catch (e) {
			Progressor.setStatus(e?.message??e, true);
		}
	},
	verifyUpload() {
		
	},
	verifyAvatar(data) {
	
		for (let vrca of data.vrcas)
			if ((vrca.type??none) == "none")
				return "Please set type for VRCA '"+utils.getFilename(vrca.path)+"'";
		
		if (data.name == "")
			return "Avatar requires name before uploading";
		
		if (data.icon == "")
			return "Avatar requires icon before uploading";
		
		///TODO: Add more indepth testing
	}
};