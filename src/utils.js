const { dialog, app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { log } = require('console');
const fs = require('fs');
const crypto = require('crypto');
const blake2 = require('blake2');

function c(value) {//cast signed 4bit
	return BigInt(new Int32Array(new BigInt64Array([value]).buffer)[0]); //Its gross I know QuQ
}
function cU(value) {//cast unsigned 4bit
	return value & 0xFFFFFFFFn;
}
function cL(value) {//cast signed 8bit
	return new BigInt64Array([value])[0];
}
function cUL(value) {//cast unsigned 8bit
	return value & 0xFFFFFFFFFFFFFFFFn;
}
class Rollsum {
    constructor() {
        this.RS_CHAR_OFFSET = 31n;
        this.s1 = 0n;
        this.s2 = 0n;
    }
    Update(buf) {
        let s1 = this.s1;
        let s2 = this.s2;
				let i;
				
        for (i = 0; i < (buf.length - 4); i += 4) {
					const b0 = BigInt(buf[i]),
								b1 = BigInt(buf[i + 1]),
								b2 = BigInt(buf[i + 2]),
								b3 = BigInt(buf[i + 3]);
					
					s2 += cUL(
						cUL(4n * cUL(s1 + b0)) +
						cU(3n * b1) + cU(2n * b2) + 
						b3 + c(10n * this.RS_CHAR_OFFSET)
					);
					s1 += cU(
						b0 + b1 + b2 + b3 +
						c(4n * this.RS_CHAR_OFFSET)
					);
					s1 = cUL(s1);
        }
        for (; i < buf.length; i++) {
            s1 += BigInt(buf[i]) + this.RS_CHAR_OFFSET;
						s1 = cUL(s1);
            s2 += s1;
        }

        this.s1 = s1;
        this.s2 = cUL(s2);
    }
    Digest() {
        return Buffer.from(new BigInt64Array([cUL(this.s2 << 16n) | cUL(this.s1 & 0xffffn)]).buffer);
    }
}

const BlockLength = 2 * 1024;
const StrongSumLength = 32;
const BlocksToBuffer = 100;
const Blake2MagicNumber = 0x72730137;
async function computeBlake2Signature(filePath, sigFilePath) {
	const buffer = Buffer.alloc(BlockLength);

	const fileStats = await fs.promises.stat(filePath);
	const fileDescriptor = await fs.promises.open(filePath, 'r');
	const sigFile = await fs.promises.open(sigFilePath, 'w');
	
	const fileSize = fileStats.size;
	
	
	await sigFile.write(Buffer.from(new Int32Array([
		Blake2MagicNumber,
		BlockLength,
		StrongSumLength
	]).buffer).swap32());

	let bytesRead, offset = 0, block, a;
	while (offset < fileSize) {
		bytesRead = await fileDescriptor.read(buffer, 0, BlockLength, -1);
		if (bytesRead.bytesRead > 0) {
			block = buffer.slice(0, bytesRead.bytesRead);
			//buffer.fill(0xFF, bytesRead.bytesRead, BlockLength);
			//const block = buffer;
			
			const sum = new Rollsum();
			sum.Update(block);
			await sigFile.write(sum.Digest().slice(0,4).swap32());
			
			const hash = blake2.createHash('blake2b', {digestLength: StrongSumLength});
			hash.update(block);
			await sigFile.write(hash.digest());
		}
		offset += bytesRead.bytesRead;
	}

	await fileDescriptor.close();
	await sigFile.close();
	//console.log("Last block: ", block.toString("hex"));
	//console.log(a);
}


async function computeMD5Hash(filePath) {
    const hash = crypto.createHash('md5');
    const fileStream = fs.createReadStream(filePath);

    return await new Promise((resolve, reject) => {
			fileStream.on('error', reject);
			fileStream.on('data', chunk => hash.update(chunk));
			//fileStream.on('end', () => resolve(hash.digest('hex')));
			fileStream.on('end', () => resolve(hash.digest()));
    });
}


function sleep(millis) {
	return new Promise(complete => setTimeout(complete, millis));
}
function formatDate(date) {
	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	const day = date.getDate();
	const month = date.getMonth();
	const year = date.getFullYear();
	const weekday = weekdays[date.getDay()];

	let suffix = 'th';
	if (day === 1 || day === 21 || day === 31) {
		suffix = 'st';
	} else if (day === 2 || day === 22) {
		suffix = 'nd';
	} else if (day === 3 || day === 23) {
		suffix = 'rd';
	}

	return `${weekday} ${day}${suffix} ${months[month]} ${year}`;
}
function convertVRCAvatarToVRCA(avatars) {
	var newAvatars = [];
	for (let avatar of avatars) {
		try {
			newAvatars.push({
				id: avatar.id,
				name: avatar.name,
				desc: avatar.description,
				info: "Created "+formatDate(new Date(avatar.created_at))+". "+avatar.releaseStatus,
				tags: avatar.tags,
				vrcas: avatar.unityPackages.map(package_ => ({
					url: package_.assetUrl ?? "",
					urlObj: package_.assetUrlObject,
					type: ({
						"standalonewindows": "standalonewindows",
						"android": "android"
					})[package_.platform] ?? "none"
				})),
				icon: avatar.imageUrl,
				releaseStatus: avatar.releaseStatus
			});
		} catch (e) {
			console.log("Failed to parse avatar: ", avatar);
		}
	}
	return newAvatars;
}
function getExtension(filePath) {
	const regexMatch = /.*\.(\w+)(?:\?.*)?/.exec(filePath);
	return regexMatch[1]==null ? "" : regexMatch[1];
}
function getFilename(path) {
	var regex = /\\|\//gm;

	var lastIndex = -1, match;
	while ((match = regex.exec(path)) !== null)
		lastIndex = match.index+1;
		
	const iconFilenameIndex = Math.max(0,lastIndex);
	var iconFilename = path.substr(iconFilenameIndex);
	return iconFilename;
}
function searchItems(items, searchTerm) {
	const search = searchTerm.toLowerCase().split(/\s(?=(?:[^"]*"[^"]*")*[^"]*$)/g).map(s=>s.replace(/"/g, ""));
	return items.map(item=>{
		const itemLower = item.toLowerCase();
		return search.some(v=>itemLower.includes(v));
	}
	);
}

module.exports = {
	sleep, formatDate, convertVRCAvatarToVRCA, computeMD5Hash, computeBlake2Signature, Rollsum, getFilename, searchItems, getExtension
};
