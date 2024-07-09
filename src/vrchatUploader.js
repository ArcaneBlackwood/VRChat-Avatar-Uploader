const { requests, uploadAWS } = require('./vrchat.js');
const fs = require('fs').promises;
const utils = require('./utils.js');
const { scaleAndCrop } = require('./imageScale.js');
const { VRCfile } = require("./vrchatParsers.js");
const unityVersion = "2022.3.6f1";

const MULTIPART_PART_SIZE = 100 * 1024 * 1024;

async function UploadMultipart(vrcLogin, filename, fileUploadType, currentFile, mimeType, md5, onProgress) {
	let uploadStatus;
	try {
		uploadStatus = await requests.getFileUploadStatus(vrcLogin, currentFile.id, currentFile.GetLatestVersion(), fileUploadType);
	} catch (e) {
		const e2 = new Error("Failed to get current file status: "+e.message);
		console.error(e, e2);
		throw e2;
	}
	
	const fileExtension = utils.getExtension(filename);
	let partNumber = 1;
	let etags = uploadStatus?.etags?.map?.(v=>v) ?? [];
	partNumber += uploadStatus?.nextPartNumber ?? 0;
	console.log("Loaded up existing etags: "+etags.join(', '));
	
	
	const fileStats = await fs.stat(filename);
	const fileSize = fileStats.size;
	let parts = Math.max(1, Math.floor(fileSize / MULTIPART_PART_SIZE));
	//let parts = Math.max(1, Math.floor(fileStream.length / MULTIPART_PART_SIZE));
	if (partNumber > 1) {
		onProgress?.("Resuming upload...", 0.5+0.5*partNumber / (parts+1));
	}
	let perPartProgress = 1 / parts;


	let bytesRead = 0;
	
	const buffer = Buffer.alloc(MULTIPART_PART_SIZE);

	const fileDescriptor = await fs.open(filename, 'r');
	
	

	while (bytesRead < fileSize) {
		if (partNumber > parts) {
			const e2 = new Error("Invalid part number index "+partNumber+"/"+parts);
			console.error(e2);
			throw e2;
		}
		const remainingBytes = fileSize - bytesRead;
		const bytesToRead = Math.min(MULTIPART_PART_SIZE, remainingBytes);
		
		
		let startUploadResp;
		try {
			startUploadResp = await requests.startFileUpload(vrcLogin, currentFile.id, currentFile.GetLatestVersion(), fileUploadType, partNumber);
		} catch (e) {
			const e2 = new Error("Failed to start upload for part "+partNumber+": "+e.message);
			console.error(e, e2);
			throw e2;
		}
		
		let uploadUrl = startUploadResp.url;
		if ((uploadUrl??"").trim() == "") {
			const e2 = new Error("Got invalid upload url, exiting upload");
			console.error(e2);
			throw e2;
		}
		
		onProgress?.("Uploading part "+partNumber+"/"+parts, 0.5+0.5*partNumber / (parts+1));

		try {
			var { bytesRead: chunkBytesRead } = await fileDescriptor.read(buffer, 0, bytesToRead, bytesRead);
		} catch (e) {
			const e2 = new Error('Error reading file:'+e.message);
			console.error(e, e2);
			throw e2;
		}
		const sizedArray = buffer.subarray(chunkBytesRead);
		console.log("Loaded "+chunkBytesRead+" from file");

		
		try {
			let result = await uploadAWS(vrcLogin, uploadUrl, sizedArray, md5, fileExtension);
			if (result?.headers?.etag != null) {
				let etagStr = result.headers.etag.trim();
				console.log("Got an etag "+etagStr+" from S3");
				etags.push(etagStr);
			}
		} catch (e) {
			const e2 = new Error("failed to upload "+filename+" to "+uploadUrl+": "+e.message);
			console.error(e, e2);
			throw e2;
		}
		
		await utils.sleep(200);
		console.log("Uploaded part "+partNumber+" out of "+parts);
		

		bytesRead += chunkBytesRead;
		partNumber++;
	}

	await fileDescriptor.close();
	console.log('File read successfully.');
	try {
		await requests.finishFileUpload(vrcLogin, currentFile.id, currentFile.GetLatestVersion(), fileUploadType, etags);
	} catch (e) {
			const e2 = new Error("Failed to finish upload: "+e.message);
			console.error(e, e2);
			throw e2;
	}
	onProgress?.("Uploaded "+parts+" parts", 1);
	return false;
}
async function UploadSimple(vrcLogin, filename, fileUploadType, currentFile, mimeType, md5, onProgress) {
	console.log("Uploading file '"+utils.getFilename(filename)+"'");
	let startUploadResp = await requests.startFileUpload(vrcLogin, currentFile.id, currentFile.GetLatestVersion(), fileUploadType);
	let uploadUrl = startUploadResp.url;

	//console.log("got upload url "+uploadUrl);
	if ((uploadUrl??"").trim() == "") {
		const e2 = new Error("Got invalid upload url");
		console.error(e2);
		throw e2;
	}
	
	const fileData = await fs.readFile(filename, {encoding: null});

	onProgress?.("Uploading part 1/1", 0.75);
	try {
		let response = await uploadAWS(vrcLogin, uploadUrl, fileData, md5, utils.getExtension(filename));
	} catch (e) {
		const e2 = new Error("failed to upload "+fileUploadType+" to "+uploadUrl+": "+e.message);
		console.error(e, e2);
		throw e2;
	}
	onProgress?.("Uploaded 1 parts", 1);

	//finishFileUpload(data, fileId, versionId, fileType, etags)
	await requests.finishFileUpload(vrcLogin, currentFile.id, currentFile.GetLatestVersion(), fileUploadType);
	console.log(fileUploadType+" upload complete");
	
	return false;
}

function getMimeType(extension) {
	
	if (extension == "vrcw")
			return "application/x-world";
	if (extension == "vrca")
			return "application/x-avatar";
	if (extension == "dll")
			return "application/x-msdownload";
	if (extension == "unitypackage")
			return "application/gzip";
	if (extension == "gz")
			return "application/gzip";
	if (extension == "jpg")
			return "image/jpg";
	if (extension == "png")
			return "image/png";
	if (extension == "sig")
			return "application/x-rsync-signature";
	if (extension == "delta")
			return "application/x-rsync-delta";
	
	return "application/octet-stream";
}
async function UploadFile(vrcLogin, filePath, asFilename, fileId, onProgress) {
	fileId = (fileId ?? "").trim();
	const creatingNewFile = fileId == "";
	onProgress?.("Creating/Fetching record", 0);
		
	let extension = utils.getExtension(filePath);
	//if (!types.hasOwnProperty(fileType)) throw new Error("Invalid file type found! "+fileType);
	const mimeType = getMimeType(extension);
	
	
	let currentFile;
	if (!creatingNewFile) {
		console.log("Updating existing file: "+fileId);
		currentFile = new VRCfile(await requests.showFile(vrcLogin, fileId)); ///TODO:  Force refresh
	} else {
		currentFile = new VRCfile(await requests.createFile(vrcLogin, asFilename, extension));
		console.log("Created a new file: "+currentFile.id);
	}

	console.log("Preparing for file upload...");

	if ((currentFile.id?.trim?.()??"") == "") {
		console.error("currentFile:",currentFile);
		throw new Error("Failed to load file info, aborting.");
	}

	if (currentFile.HasQueuedOperation()) {
		console.log("Existing file is not fully uploaded, cleaning up");
		await requests.deleteFileVersion(vrcLogin, currentFile.id, currentFile.GetLatestVersion());
		console.log("Cleaned up leftover queued uploads");
		// reload the file without a queued version
		currentFile = new VRCfile(await requests.showFile(vrcLogin, currentFile.id));
	}

	if (currentFile.IsLatestVersionErrored()) {
		console.log("Existing file failed to upload, cleaning up");
		await requests.deleteFileVersion(vrcLogin, currentFile.id, currentFile.GetLatestVersion());
		console.log("Cleaned up leftover errored uploads");
		currentFile = new VRCfile(await requests.showFile(vrcLogin, currentFile.id));
	}

	console.log("Processing file...");
	onProgress?.("Calculating Signatures", 0.25);

	let fullFileSize = (await fs.stat(filePath)).size;
	let fileMD5bytes;
	let fileMD5b64;
	try {
		fileMD5bytes = await utils.computeMD5Hash(filePath);
		fileMD5b64 = fileMD5bytes.toString('base64');
	} catch (e) {
		console.error(e);
		throw new Error("Failed to compute MD5 hash for file '"+filePath+"'");
	}



	let signatureFilePath = filePath + ".sig";
	await utils.computeBlake2Signature(filePath, signatureFilePath);
	
	const sigFileSize = (await fs.stat(signatureFilePath)).size;
	var sigMD5bytes;
	var sigMD5b64;
	try {
		sigMD5bytes = await utils.computeMD5Hash(signatureFilePath);
		sigMD5b64 = sigMD5bytes.toString('base64');
	} catch (e) {
		console.error(e);
		throw new Error("Failed to get signature MD5, exiting upload", e);
	}
	console.log("sigMD5b64:",sigMD5b64);
	console.log("fileMD5b64:",fileMD5b64);
	onProgress?.("Uploading", 0.5);

	// Check for existing files with same hashes first
	let isRetrying = false;
	if (currentFile.HasExistingOrPendingVersion()) {
		// if there is a file with the same hash
		if (fileMD5b64 == (currentFile.versions[currentFile.GetLatestVersion()]?.file?.md5 ?? "")) {
			if (!currentFile.IsLatestVersionWaiting()) {
				//throw new Error("File with the same hash is already uploaded");
				//Non critical, file already exists, exit
				console.log("File with the same hash is already uploaded, exiting successfully");
				return currentFile.versions[currentFile.GetLatestVersion()].file.url;
			}

			// file already exists and is in waiting state - we should try to upload
			isRetrying = true;
			console.log("File MD5 match, going to retry the file upload");
		} else if (currentFile.IsLatestVersionWaiting()) {
			console.log("File upload failed and we have a new file");
			await requests.deleteFileVersion(vrcLogin, currentFile.id, currentFile.GetLatestVersion());
			// reload the file without a broken version
			currentFile = new VRCfile(await requests.showFile(vrcLogin, currentFile.id));
		}
	}

	// check that we're trying to re-upload the exact same file on retry
	let versionAlreadyExists = false;
	if (isRetrying) {
		let version = currentFile.versions[currentFile.GetLatestVersion()];
		let isMatch = fullFileSize == version.file.sizeInBytes &&
									fileMD5b64 == version.file.md5 &&
									sigFileSize == version.signature.sizeInBytes &&
									sigMD5b64 == version.signature.md5;
		if (isMatch) {
			versionAlreadyExists = true;
			console.log("Files match, will attempt to re-upload");
		} else {
			console.log("Files do not fully match, removing latest version");
			await requests.deleteFileVersion(vrcLogin, currentFile.id, currentFile.GetLatestVersion());
			// reload the file without a broken version
			currentFile = new VRCfile(await requests.showFile(vrcLogin, currentFile.id));
		}
	}

	// if not retrying the last upload - create a new version entry
	if (!versionAlreadyExists) {
		let updatedFile = new VRCfile(await requests.createFileVersion(
			vrcLogin,
			currentFile.id,
			sigMD5b64, 
			sigFileSize,
			fileMD5b64,
			fullFileSize));
		if ((updatedFile.id??"").trim() == "") {
			throw new Error("Failed to create new file version, exiting upload");
		}
		console.log("Created new record. "+currentFile.GetLatestVersion()+" -> "+updatedFile.GetLatestVersion()+"");
		currentFile = updatedFile;
	} else {
		console.log("File already exists, skipping record creation");
	}

	let fileDescriptor = currentFile.versions[currentFile.GetLatestVersion()].file;
	let fileCategory = fileDescriptor.category;

	console.log("File upload type: ");

	console.log("Starting file upload");

	if (currentFile.versions[currentFile.GetLatestVersion()].file.status == "waiting") {
			if (fileCategory != "simple") {
					//UploadMultipart(vrcLogin, filename, fileUploadType, currentFile, mimeType, onProgress)
					try {
						await UploadMultipart(vrcLogin, filePath, "file", currentFile, mimeType, fileMD5b64, onProgress);
					} catch (e) {
							// cleanup the file if we created it
							if (creatingNewFile) {
									console.log("Cleanup, deleting created file");
									await requests.deleteFile(vrcLogin, currentFile.id);
							}

							throw e;
					}
			}
			else
			{
					//UploadSimple(vrcLogin, filename, fileUploadType, currentFile, mimeType, onProgress)
					try {
						await UploadSimple(vrcLogin, filePath, "file", currentFile, mimeType, fileMD5b64, onProgress);
					} catch(e) {
							// cleanup the file if we created it
							if (creatingNewFile) {
									console.log("Cleanup, deleting created file");
									await requests.deleteFile(vrcLogin, currentFile.id);
							}

							throw e;
					}
			}
			console.log("File Uploaded!");
	} else {
			console.log("File upload not waiting, thus isn't needed.");
	}

	fileDescriptor = currentFile.versions[currentFile.GetLatestVersion()].signature;
	fileCategory = fileDescriptor.category;

	console.log("Starting signature upload");

	if (currentFile.versions[currentFile.GetLatestVersion()].signature.status == "waiting") {
			if (fileCategory != "simple") {
					//UploadMultipart(vrcLogin, filename, fileUploadType, currentFile, mimeType, onProgress)
					try {
						await UploadMultipart(signatureFilePath, "signature", currentFile, "application/x-rsync-signature", sigMD5b64, onProgress);
					} catch(e) {
							// cleanup the file if we created it
							if (creatingNewFile) {
									console.log("Cleanup, deleting created file");
									await requests.deleteFile(vrcLogin, currentFile.id);
							}

							throw e;
					}
			}
			else
			{
					//UploadSimple(vrcLogin, filename, fileUploadType, currentFile, mimeType, onProgress)
					try {
						await UploadSimple(vrcLogin, signatureFilePath, "signature", currentFile, "application/x-rsync-signature", sigMD5b64, onProgress);
					} catch(e) {
							// cleanup the file if we created it
							if (creatingNewFile) {
									console.log("Cleanup, deleting created file");
									await requests.deleteFile(vrcLogin, currentFile.id);
							}

							throw e;
					}
			}
			console.log("signature uploaded!");
	} else {
			console.log("signature upload not waiting, thus isn't needed");
			//return;
	}

	currentFile = new VRCfile(await requests.showFile(vrcLogin, currentFile.id));
	let latestVersion = currentFile.versions[currentFile.GetLatestVersion()];

	console.log("waiting 1000ms for file to finish processing");
	await utils.sleep(1000);


	currentFile = new VRCfile(await requests.showFile(vrcLogin, currentFile.id));

	console.log("File upload finished");

	return currentFile.versions[currentFile.GetLatestVersion()].file.url;
}
function fileUrlToID(url) {
	const result = /file\/(file_.*?)(?:$|\/)/.exec(url);
	if (!result) return null;
	return result[1];
}
async function UploadAvatar(vrcLogin, avatarData, onProgress, currentUserInfo) {
	var creatingNewAvatar = avatarData.id == "", avatarId = avatarData.id;
	try {
		var remoteData;
	
		//### TRY FETCH AVATAR DETAILS IF EXISTING
		onProgress("fetchInfo", 0, "");
		if (!creatingNewAvatar) {
			onProgress("fetchInfo", 0.2, "Fetching existing");
			try {
				remoteData = await requests.getAvatar(vrcLogin, avatarData.id);
			} catch (e) {
				creatingNewAvatar = true;
				avatarId = "";
			}
			if (!creatingNewAvatar) {
				if (remoteData.authorId != currentUserInfo.id)
					throw "Provided avatar id owned by another user.";
				avatarId = remoteData.id;
				onProgress("fetchInfo", 1, "Fetching existing");
			}
		}
		
		
		//### UPLOAD NEW THUMBNAIL
		if (avatarData.icon != "" && !avatarData.icon.startsWith("http")) {
			onProgress("uploadImage", 0, "");
			let thumbnailPath = await scaleAndCrop(800, 600, avatarData.icon);
			let fileId = remoteData?.imageUrl == undefined ? "" : fileUrlToID(remoteData.imageUrl);
			
			//UploadFile(vrcLogin, filePath, asFilename, fileId, onProgress)
			fileUrl = await UploadFile(vrcLogin, thumbnailPath, utils.getFilename(thumbnailPath), fileId, function(info, progress) {
				onProgress("uploadImage", progress, info);
			});
			
			if ((fileUrl??"") == "")
				throw new Error("UploadFile returned null file id");
			console.log("Uploaded thumbnail '"+fileUrl+"'");
			onProgress("uploadImage", 1, "");
			
			var imageUrl = fileUrl;//await requests.getFileURL(vrcLogin, fileId);
		}
		
		
		//### CREATE AVATAR DETAILS IF NEW
		if (creatingNewAvatar) {
			onProgress("create", 0, "Creating new");
			if (imageUrl == undefined)
				throw "Must provide thumbnail for a new avatar.";
			
			remoteData = await requests.createAvatar(vrcLogin, {
				"name": avatarData.name,
				"description": avatarData.desc,
				"tags": avatarData.tags,
				"imageUrl": imageUrl,
				"releaseStatus": avatarData.releaseStatus,
				"unityVersion": unityVersion,
				"version": 0
			});
			avatarId = remoteData.id;
			console.log("Created new avatar descriptor '"+avatarId+"'");
		}
		
		
		//### UPDATE AVATAR DETAILS IF EXISTING
		var version = parseInt(remoteData.version ?? 0);
		if (!creatingNewAvatar) {
			onProgress("create", 0.5, "Updating");
			remoteData = await requests.updateAvatar(vrcLogin, avatarData.id, {
				"id": avatarData.id,
				"name": avatarData.name=="" ? null : avatarData.name,
				"description": avatarData.desc=="" ? null : avatarData.desc,
				"tags": avatarData.tags,
				"imageUrl": imageUrl ?? undefined,
				"releaseStatus": avatarData.releaseStatus,
				"unityVersion": unityVersion,
				"version": version + 1
			});
			avatarId = remoteData.id;
			onProgress("create", 1, "Updated");
		} else {
			onProgress("create", 1, "Created");
		}
		
		
		//### UPLOAD NEW FILES
		var index = 0;
		var progressSingle = 1 / avatarData.vrcas.length;
		onProgress("upload", 0, "");
		console.log("[REMOVE ME] remoteData.unityPackages=",remoteData.unityPackages);
		for (var vrca of avatarData.vrcas) {
			if (vrca.type == "none")
				throw "VRCA file invalid type 'none'.";
			
			var assetVersion = 0;
			var fileId = null;
			console.log("[REMOVE ME] vrca=",vrca);
			if (remoteData.unityPackages)
				for (var pack of remoteData.unityPackages) {
					if (pack.platform == vrca.type) {
						fileId = fileUrlToID(pack.assetUrl);
						assetVersion = parseInt(pack.assetVersion ?? 0);
						break;
					}
				}
			
			onProgress("upload", progressSingle * index, "Upload start");
			var fileURL = await UploadFile(vrcLogin, vrca.path, vrca.type + ".vrca", fileId, function(info, progress) {
				onProgress("upload", progressSingle * index + progress * progressSingle, info);
			});
			console.log("Uploaded bundle '"+fileURL+"'");
			
			try {
				remoteData = await requests.updateAvatar(vrcLogin, avatarId, {
					"assetUrl": fileURL,
					"platform": vrca.type,
					"unityVersion": unityVersion,
					"assetVersion": assetVersion + 1
				});
				index ++;
				onProgress("upload", progressSingle * index, "Added file to avatar");
			} catch (e) {
				if ((fileURL??"")!="")
					requests.deleteFile(vrcLogin, fileUrlToID(fileURL));
				
				throw e;
			}
		}
		
		return remoteData.id;
	} catch (e) {
		if (creatingNewAvatar) {
			if(avatarId)
				try {
					requests.deleteAvatar(vrcLogin, avatarId);
					console.log("Successfully deleted failed avatar '"+avatarId+"'");
				} catch (e) {
					console.error("Failed to delete failed avatar '"+avatarId+"'", e);
				}
			if ((imageUrl??"")!="")
				try {
					requests.deleteFile(vrcLogin, fileUrlToID(imageUrl));
					console.log("Successfully deleted failed avatar image '"+imageUrl+"'");
				} catch (e) { 
					console.log("Failed to delete failed avatar image '"+imageUrl+"'", e);
				}
		} 
		throw e;
	}
}


/*async function BuildAndUpload(target, avatar, thumbnailPath) {
	var bundlePath = ...;
	
	if (!target.TryGetComponent<PipelineManager>(out var pM)) {
			throw await HandleUploadError(new Error("Target avatar does not have a PipelineManager, make sure a PipelineManager component is present before uploading"));
	}
	
	var creatingNewAvatar = string.IsNullOrWhiteSpace(pM.blueprintId) || string.IsNullOrWhiteSpace(avatar.ID);

	if (creatingNewAvatar && (string.IsNullOrWhiteSpace(thumbnailPath) || !File.Exists(thumbnailPath)))
	{
			throw await HandleUploadError(new Error("You must provide a path to the thumbnail image when creating a new avatar"));
	}

	if (!creatingNewAvatar)
	{
			var remoteData = await VRCApi.GetAvatar(avatar.ID);
			if (APIUser.CurrentUser == null || remoteData.AuthorId != APIUser.CurrentUser?.id)
			{
					throw await HandleUploadError(new OwnershipException("Avatar's current ID belongs to a different user, assign a different ID"));
			}
	}

	if (string.IsNullOrWhiteSpace(pM.blueprintId))
	{
			Undo.RecordObject(pM, "Assigning a new ID");
			pM.AssignId();
	}

	try
	{
			if (creatingNewAvatar)
			{
					thumbnailPath = VRC_EditorTools.CropImage(thumbnailPath, 800, 600);
					_avatarData = await VRCApi.CreateNewAvatar(pM.blueprintId, avatar, bundlePath,
							thumbnailPath,
							(status, percentage) => { OnSdkUploadProgress?.Invoke(this, (status, percentage)); });
			}
			else
			{
					if (avatar.Tags?.Contains(VRCApi.AVATAR_FALLBACK_TAG) ?? false)
					{
							if (pM.fallbackStatus == PipelineManager.FallbackStatus.InvalidPerformance ||
									pM.fallbackStatus == PipelineManager.FallbackStatus.InvalidRig)
							{
									avatar.Tags = avatar.Tags.Where(t => t != VRCApi.AVATAR_FALLBACK_TAG).ToList();
							}
					}
					_avatarData = await VRCApi.UpdateAvatarBundle(pM.blueprintId, avatar, bundlePath,
							(status, percentage) => { OnSdkUploadProgress?.Invoke(this, (status, percentage)); });
			}
			
			_uploadState = SdkUploadState.Success;
			OnSdkUploadSuccess?.Invoke(this, _avatarData.ID);

			await FinishUpload();
	}
	catch (TaskCanceledException e)
	{
			AnalyticsSDK.AvatarUploadFailed(pM.blueprintId, !creatingNewAvatar);
			if (cancellationToken.IsCancellationRequested)
			{
					Core.Logger.LogError("Request cancelled", DebugLevel.API);
					throw await HandleUploadError(new Error("Request Cancelled", e));
			}
	} catch (e) {
		AnalyticsSDK.AvatarUploadFailed(pM.blueprintId, !creatingNewAvatar);
		throw await HandleUploadError(new Error(e.Message, e));
	}
}*/

module.exports = { UploadFile, UploadAvatar};