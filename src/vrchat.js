const https = require('https');
const url = require('url');
const electron = require('electron');
const { getExtension, computeMD5Hash } = require("./utils.js");
const { VRCfile } = require("./vrchatParsers.js");
const { triggerMessage } = require('./messageBox.js');



const apiHost = "api.vrchat.cloud";
const apiPath = "/api/1/";
const doHTTPLogging = false;

var userAgentString = "";



const types = {
	"jpeg": ["image/jpeg", "jpeg"],
	"jpg": ["image/jpg","jpg"],
	"png": ["image/png","png"],
	"webp": ["image/webp","webp"],
	"gif": ["image/gif","gif"],
	"bmp": ["image/bmp","bmp"],
	"svg": ["image/svg＋xml","svg"],
	"tiff": ["image/tiff","tiff"],
	"avatar": ["application/x-avatar","vrca"],
	"world": ["application/x-world","vrcw"],
	"gzip": ["application/gzip","gzip"],
	"signature": ["application/x-rsync-signature","sig"],
	"delta": ["application/x-rsync-delta","delta"],
	//"": ["application/octet-stream",""]
};
function handleCookieSet(headers, cookies) {
	const setCookiesKey = Object.keys(headers).find(k => k.toLowerCase() == "set-cookie");
	if (!headers.hasOwnProperty(setCookiesKey)) return;
	const setCookies = headers[setCookiesKey].toString();
	
	const cookieEntries = setCookies.split(";").map(v => {
		const entry = v.split("=");
		if (entry.length != 2) return;
		return {
			key: entry[0].trim(),
			value: entry[1].trim()
		}
	});
	for (let entry of cookieEntries) {
		if (entry==undefined) continue;
		cookies[entry.key] = entry.value == "" ? undefined : entry.value;
	}
}
function appendCookies(headers, cookies) {
	var builder = [];
	for (let key in cookies) {
		builder.push(key+"="+cookies[key]);
	}
	headers["Cookie"] = builder.join("; ");
}

const allowedMethods = ["GET", "PUT", "POST", "DELETE"];
function httpRequst(data, method, location, objectSend, headers) {
	if (doHTTPLogging) {
		console.log(new Error("Stacktrace for locating").stack);
	}
	headers = headers ?? {};
	data.cookie = data.cookie ?? {};
	headers["user-agent"] = userAgentString;
	
	appendCookies(headers, data.cookie);
	
	if (data.apiKey)
		headers["apiKey"] = data.apiKey;
	if (data.auth)
		headers["auth"] = data.auth;
	if (data.twoFactorAuth)
		headers["twoFactorAuth"] = twoFactorAuth;
	if (objectSend)
		headers["Content-Type"] = "application/json";
	
	if (doHTTPLogging) {
		console.log("\tHTTP "+method+" "+apiPath + location);
		console.log("\tHEADERS SEND ",headers);
	}
	async function formatTriggerMessage(title, request, dataRequest, dataResponse) {
		var headerString = 
			Object.entries(headers).map(
				([k, v], i) => k + " = \t" + v
			).join("\n");
			
    const requestLine = `${request.method} ${request.path} HTTP/${request.agent.protocol}`;

		
		await triggerMessage(
			title + "\n\n\n" +
			"### REQUEST:\n" +
			requestLine + "\n" +
			headerString + "\n\n" +
			(dataRequest ?? "") + "\n\n\n" +
			"### RESPONSE: " + (request?.response?.statusCode ?? "") + "\n" +
			dataResponse ?? ""
		);
	}
	return new Promise((oncomplete, onerror) => {
		if (!allowedMethods.includes(method)) {
			onerror(new Error("Invalid http method"));
			return;
		}
		var request = https.request({
			host: apiHost,
			path: apiPath + location,
			port: 443,
			method, headers
		}, (response) => {
			request.response = response;
			if (response.statusCode == 429) {
				
				onerror(new Error("Too many requests to VRChat API :(\nTry wait a few minutes"));
				return;
			}
			handleCookieSet(response.headers, data.cookie);
			
			if (response.headers.auth)
				data.auth = response.headers.auth;
			if (response.headers.twoFactorAuth)
				data.twoFactorAuth = response.headers.twoFactorAuth;
			if (doHTTPLogging) {
				console.log("\tHEADERS READ",response.headers);
				console.log("\tSTATUS CODE",response.statusCode);
			}
			
			
			let allData = "";
      response.on("data", data => allData += data);
			response.on("end", _ => {
				try {
					const objectRecv = JSON.parse(allData);
					if (doHTTPLogging)
						console.log("\tDATA READ",objectRecv);
					if (objectRecv.error)
						throw new Error("VRCAPI: "+(objectRecv.error?.message ?? "Uknown error"));
					oncomplete({
						headers: response.headers,
						code: response.statusCode,
						data: objectRecv
					});
				} catch (e) {
					if (doHTTPLogging)
						console.log("\tDATA READ ERROR",allData);
					onerror(e);
				}
			});
		});
		request.on("error", onerror);
		if (objectSend) {
			var dataSend = JSON.stringify(objectSend);
			request.write(dataSend);
			if (doHTTPLogging)
				console.log("\tDATA SEND ",dataSend);
		}
		request.end();
	});
}
function uploadAWS(data, url, fileData, fileExtension) {
	var headers = {};
	const method = "put";
	
	const foundType = Object.entries(types).find(v => v[1][1]==fileExtension);
	if (!foundType) throw new Error("Invalid file type found! "+fileExtension);
	const mimeType = foundType[1][0];
	
	const regexEx = /^https?:\/\/([a-zA-Z0-9.\-]+)(\/.*)$/.exec(url??"");
	const host = regexEx[1];
	const path = regexEx[2];
	
	headers["user-agent"] = userAgentString;
	headers["Content-type"] = mimeType;
	headers['Content-Length'] = fileData.length;
	headers['Accept'] = "application/json";
	
	if (host.includes("vrchat")) {
		appendCookies(headers, data.cookie);
		if (data.apiKey)
			headers["apiKey"] = data.apiKey;
		if (data.auth)
			headers["auth"] = data.auth;
		if (data.twoFactorAuth)
			headers["twoFactorAuth"] = twoFactorAuth;
	}
	
	if (doHTTPLogging) {
		console.log("\tHTTP "+method+" "+url);
		console.log("\tHEADERS SEND ",headers);
		console.log("\tHTTP HOST:", host);
		console.log("\tHTTP PATH:", path);
	}
	
	return new Promise((oncomplete, onerror) => {
		if (regexEx?.length != 3) {
			onerror(new Error("Failed to parse invalid URL: "+url));
			return;
		}
		var request = https.request({
			host, path, port: 443, method, headers
		}, (response) => {
			if (response.statusCode == 429) {
				onerror(new Error("Too many requests to AWS API :("));
				return;
			}
			handleCookieSet(response.headers, data.cookie);
			
			if (doHTTPLogging) {
				console.log("\tHEADERS READ",response.headers);
				console.log("\tSTATUS CODE",response.statusCode);
			}
			
			let allData = "";
      response.on("data", data => allData += data);
			response.on("end", _ => {
				try {
					if (allData.trim()=="")
						var objectRecv = null;
					else if (/\s*<\?xml/.test(allData))
						var objectRecv = require('./xmlParser.js').parseXML(allData);
					else
						var objectRecv = JSON.parse(allData);
					if (doHTTPLogging)
						console.log("\tDATA READ ", objectRecv);
					oncomplete({
						headers: response.headers,
						code: response.statusCode,
						data: objectRecv
					});
				} catch (e) {
					if (doHTTPLogging)
						console.log("\tDATA READ RAW ```"+allData+"```");
					onerror(e);
				}
			});
		});
		request.on("error", onerror);
		
		try {
			request.write(fileData); //eol.auto(chunk.toString('utf8'))
			request.end();
		} catch (e) {
			request.end();
			onerror(e);
		}
	});
}




const requests = {
	async getConfig(data) {
		console.log("=== getConfig ");
		const response = await httpRequst(data, "GET", "config");
		return response;
	},
	async authorize(data, username, password) {
		console.log("=== authorize ");
		const headers = {};
		if (username && password) {
			const login = btoa(encodeURI(username)+":"+encodeURI(password));
			headers.Authorization = "Basic "+login;
		}
		const response = await httpRequst(data, "GET", "auth/user", null, headers);
		return response;
	},
	async authorize2FAEmail(data, code) {
		console.log("=== authorize2FAEmail ");
		const response = await httpRequst(data, "POST", "auth/twofactorauth/emailotp/verify", { code });
		return response;
	},
	async authorize2FAAuthenticator(data, code) {
		console.log("=== authorize2FA ");
		const response = await httpRequst(data, "POST", "auth/twofactorauth/totp/verify", { code });
		return response;
	},
	async authorize2FABackup(data, code) {
		console.log("=== authorize2FA ");
		const response = await httpRequst(data, "POST", "auth/twofactorauth/otp/verify", { code });
		return response;
	},
	async verifyLogin(data) {
		console.log("=== verifyLogin ");
		const response = await httpRequst(data, "GET", "auth");
		return response;
	},
	async logout(data) {
		console.log("=== logout ");
		const response = await httpRequst(data, "PUT", "logout");
		data.apiKey = undefined;
		data.auth = undefined;
		data.twoFactorAuth = undefined;
		return response;
	},
	async getOwnAvatars(data) {
		console.log("=== getOwnAvatars ");
		const response = await httpRequst(data, "GET", "avatars?sort=updated&user=me&n=100&releaseStatus=all&order=ascending");
		return response;
	},
	async getAvatar(data, avatarid) {
		console.log("=== getAvatar ");
		const response = await httpRequst(data, "GET", "avatars/"+avatarid);
		return response.data;
	},
	async deleteAvatar(data, avatarid) {
		console.log("=== deleteAvatar ");
		const response = await httpRequst(data, "DELETE", "avatars/"+avatarid);
		return response.data;
	},
	async createAvatar(data, avatarData) {
		console.log("=== createAvatar ");
		const response = await httpRequst(data, "POST", "avatars", avatarData);
		return response.data;
	},
	async updateAvatar(data, avatarid, avatarData) {
		console.log("=== updateAvatar ");
		const response = await httpRequst(data, "PUT", "avatars/"+avatarid, avatarData);
		return response.data;
	},
	
	
	async showFile(data, fileId) {
		console.log("=== showFile ");
		const response = await httpRequst(data, "GET", "file/"+fileId);
		return response.data;
	},
	async createFile(data, name, fileExtension, tags) {
		console.log("=== createFile ");
		const foundType = Object.entries(types).find(v => v[1][1]==fileExtension);
		if (!foundType)
			throw new Error("File type '"+fileExtension+"' not found");
		const typeData = foundType[1];
		
		const response = await httpRequst(data, "POST", "file", {
			name,
			mimeType: typeData[0],
			extension: typeData[1],
			tags
		});
		return response.data;
	},
	async createFileVersion(data, fileId, signatureMd5, signatureSizeInBytes, fileMd5, fileSizeInBytes) {
		console.log("=== createFileVersion ");
		const response = await httpRequst(data, "POST", "file/"+fileId, {
			signatureMd5, signatureSizeInBytes, fileMd5, fileSizeInBytes
		});
		return response.data;
	},
	async deleteFile(data, fileId) {
		console.log("=== deleteFile ");
		const response = await httpRequst(data, "DELETE", "file/"+fileId);
		return response.data;
	},
	async deleteFileVersion(data, fileId, versionId) {
		console.log("=== deleteFileVersion ");
		const response = await httpRequst(data, "DELETE", "file/"+fileId+"/"+versionId);
		return response.data;
	},
	async startFileUpload(data, fileId, versionId, fileType, partNumber) {
		console.log("=== startFileUpload ");
		const allowedTypes = ["file", "signature", "delta"];
		if (!allowedTypes.includes(fileType))
			throw new Error("Invalid filt type '"+fileType+"'");
		const response = await httpRequst(data, "PUT", "file/"+fileId+"/"+versionId+"/"+fileType+"/start"+
			(partNumber?"?partNumber="+partNumber:""));
		return response.data;
	},
	async finishFileUpload(data, fileId, versionId, fileType, etags) {
		console.log("=== finishFileUpload ");
		const allowedTypes = ["file", "signature", "delta"];
		if (!allowedTypes.includes(fileType))
			throw new Error("Invalid file type '"+fileType+"'");
		const response = await httpRequst(data, "PUT", "file/"+fileId+"/"+versionId+"/"+fileType+"/finish", {etags});
		return response.data;
	},
	async getFileUploadStatus(data, fileId, versionId, fileType) {
		console.log("=== getFileUploadStatus ");
		const allowedTypes = ["file", "signature", "delta"];
		if (!allowedTypes.includes(fileType))
			throw new Error("Invalid filt type '"+fileType+"'");
		const response = await httpRequst(data, "GET", "file/"+fileId+"/"+versionId+"/"+fileType+"/status");
		return response.data;
	},
	async getFileURL(data, fileId, version) {
		const fileData = await this.showFile(data, fileId);
		if (version == undefined) {
			version = -1;
			var url;
			for (var versionInfo of fileData.versions)
				if (versionInfo.file && version < versionInfo.version) {
					version = versionInfo.version;
					url = versionInfo.file.url;
				}
			return url;
		}
		for (var versionInfo of fileData.versions)
			if (version == versionInfo.version)
				return versionInfo.file.url;
	}
};

module.exports = {
	requests, uploadAWS, setUserAgentString(d) {
		userAgentString = d;
	}
};