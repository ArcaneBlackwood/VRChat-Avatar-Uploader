const utils = require("../utils.js");
const fs = require('fs');
const archiver = require('archiver');
const unzipper = require('unzipper');
const https = require('https');

var rootPath = "";
const workingFileDirectory = "/files/"; //Must start and end with /


var userAgentString = "";
async function downloadFile(url, destinationPath) {
	const options = {
		headers: {
			'User-Agent': userAgentString
		},
		followRedirects: true
	};
	const response = await new Promise((resolve, reject) => {
		https.get(url, options, async (response) => {
			resolve(response);
		}).on('error', (err) => {
			console.log("File download error");
			reject(err);
		});
	});
	
	if (response.statusCode == 302)
		return await downloadFile(response.headers.location, destinationPath);
	
	await new Promise((resolve, reject) => {
		const file = fs.createWriteStream(destinationPath);
		response.pipe(file);
		file.on('finish', () => {
			file.close();
			resolve();
		});
	});
}
async function compressedPackage(location, config, onSuccess, onUpdate, onError) {
	
	if (!fs.existsSync(rootPath + workingFileDirectory)){
		fs.mkdirSync(rootPath + workingFileDirectory);
	}
	if (config.icon != "") {
		var iconFilename = "icon." + utils.getExtension(config.icon);
		if (config.icon.startsWith("http")) {
			var iconFile = rootPath + workingFileDirectory + iconFilename;
			await downloadFile(config.icon, iconFile);
		} else {
			var iconFile = config.icon;
		}
		config.icon = iconFilename;
	}
	const packageJSONContent = JSON.stringify(config);


	await new Promise((done, err) => {
		try {
			fs.unlink(location, done);
		} catch (e) {
			err(e);
		}
	});
	
	var exited = false;
	try {
		await new Promise(async (accept, reject) => {
			const output = fs.createWriteStream(location, {flags: 'w'});
			const archive = archiver('zip', {
				zlib: { level: 9 } // Set compression level to maximum
			});

			output.on('close', function() {
				accept();
				if (this.closed) return;
				console.log('error not closed');
			});
			output.on('error', (err) => {
				reject(err);
			});
			archive.on('warning', function(err) {
				if (err.code === 'ENOENT') {
					console.warn(err);
				} else {
					reject(err);
				}
			});
			archive.on('error', function(err) {
				reject(err);
			});
			if (onUpdate)
				archive.on('progress', (e)=> {
					if (exited) return;
					onUpdate("compress", 0);
				});


			archive.pipe(output);
			for (let vrca of config.vrcas) {
				let vrcaName = vrca.type+".vrca";//utils.getFilename(filePath)
				archive.file(vrca.path, { name: vrcaName });
				vrca.path = vrcaName;
			}
			config.vrcas.forEach(vrca => {
				archive.file(vrca.path, { name: utils.getFilename(vrca.path) });
				
			});
			if (iconFile)
				archive.file(iconFile, { name: iconFilename });
			archive.append(packageJSONContent, { name: 'package.json' });
			
			await archive.finalize();

			if (output.closed) return;
			output.close();
		});
		if (exited) return;
		onSuccess?.();
	} catch (e) {
		if (exited) return;
		onError?.(e);
	} finally {
		exited = true;
	}
}

async function uncompressPackage(packageLocation, onSuccess, onUpdate, onError) {
	onUpdate?.("open");

	const extractedFiles = [];
	let packageJsonContent = null;
	let packageJsonFound = false;
	//const config = {};
	
	if (!fs.existsSync(rootPath + workingFileDirectory)){
		fs.mkdirSync(rootPath + workingFileDirectory);
	}

	onUpdate?.("decompress", 0);

	var exited = false;
	try {
		const result = await new Promise((accept, reject) => {
			fs.stat(packageLocation, (err, stats) => {
				if (err) {
					reject(err);
					return;
				}
				const totalSize = stats.size;
				let processedSize = 0;
				fs.createReadStream(packageLocation)
					.pipe(unzipper.Parse())
					.on('entry', entry => {
						const fileName = entry.path;
						const type = entry.type; // 'Directory' or 'File'

						if (fileName === 'package.json') {
							packageJsonFound = true;
							entry.buffer().then(data => {
								packageJsonContent = JSON.parse(data.toString());
							});
						} else if (type === 'File') {
							const destinationPath = rootPath + workingFileDirectory + fileName;
							entry.pipe(fs.createWriteStream(destinationPath));
							extractedFiles.push({name: fileName, path: destinationPath});
						} else {
							entry.autodrain();
						}

						processedSize += entry.vars.uncompressedSize;
						if (!exited)
							onUpdate?.("decompress", processedSize / totalSize);
					})
					.on('close', () => {
						//console.log(packageJsonContent);
						if (packageJsonFound) {
							if (packageJsonContent.icon != "") {
								packageJsonContent.icon = rootPath + workingFileDirectory + packageJsonContent.icon;
							}
							const vrcaPaths = packageJsonContent.vrcas.map(v => v.path);
							const iconPath = packageJsonContent.icon;
							for (let file of extractedFiles) {
								if (file.name == iconPath) {
									packageJsonContent.icon = file.path;
									continue;
								}
								const vrcaIndex = vrcaPaths.indexOf(file.name)
								if (vrcaIndex > -1) {
									packageJsonContent.vrcas[vrcaIndex].path = file.path;
									continue;
								}
							}
							accept({ config: packageJsonContent });
						} else
							reject(new Error('package.json not found in the zip file.'));
					})
					.on('error', err => {
						reject(err);
					});
			})
		});
		onSuccess?.(result);
	} catch(e) {
		onError?.(err);
	} finally {
		exited = true;
	}
}
module.exports = {compressedPackage, uncompressPackage, setUserAgentString(d) {
	userAgentString = d;
}, setRootPath(d) {
	rootPath = d;
}};