import { AvatarSettings } from "./avatarSettings.js";
import { Progressor } from "./progressor.js";

export const LoadSave = {
  init(packageNameElement, saveButton, loadButton, currentUsername) {
		this.packageNameElement = packageNameElement;
		this.saveButton = saveButton;
		this.loadButton = loadButton;
		this.currentUsername = currentUsername;

		this.loadedPackage = null;

		this.saveButton.addEventListener("click", this.save.bind(this));
		this.loadButton.addEventListener("click", this.load.bind(this));
	},
	_updatePackageName(name) {
		this.packageNameElement.innerText = name || "No package loaded";
	},
	async save(e) {
		try {
			Progressor.setProgressType("savePackage");
			Progressor.setProgressState("assemble");
			await electron.compressedPackage(
				AvatarSettings.nameInput.value,
				await AvatarSettings.createNewAvatarData(this.currentUsername.value),
				(function() {
					Progressor.setProgressState("complete");
				}).bind(this),
				Progressor.setProgressState.bind(Progressor),
				(function(error) {
					Progressor.setStatus("Error: " + error?.message, true);
				}).bind(this),
				(function(filepath) {
					var fileName = utils.getFilename(filepath);
					this._updatePackageName(fileName);
				}).bind(this)
			);
		} catch (e) {
			Progressor.setStatus("Error: " + e?.message, true);
			console.error(e);
		}
	},
	async load(e) {
		try {
			Progressor.setProgressType("loadPackage");
			Progressor.setProgressState("select");
			await electron.uncompressPackage(
				(function(newPackage) {
					try {
						Progressor.setProgressState("load");
						this.loadedPackage = newPackage;
						AvatarSettings.revertAvtarData(newPackage.config, true, true);
						Progressor.setProgressState("complete");
					} catch (e) {
						console.error(e);
						throw e;
					}
				}).bind(this),
				Progressor.setProgressState.bind(Progressor),
				(function(error) {
					Progressor.setStatus("Error: " + error?.message, true);
				}).bind(this),
				(function(filepath) {
					try {
						var lastSlashIndex = Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\"));
						if (lastSlashIndex == -1) {
							Progressor.setStatus();
							return;
						}
						var fileName = filepath.substr(lastSlashIndex + 1);
						this._updatePackageName(fileName);
					} catch (e) {
						console.error(e);
						throw e;
					}
				}).bind(this)
			);
		} catch (e) {
			Progressor.setStatus("Error: " + e?.message, true);
			console.error(e);
		}
	}
};