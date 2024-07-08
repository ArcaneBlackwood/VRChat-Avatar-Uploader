const { log } = require('console');
const fs = require('fs');


const persistenceLocation = "./Persistence.json";


const vrcLogin = {};
var vrcLoginLoaded = false;
const config = {
	saveLogin: false
};

async function save() {
	const data = {config};
	if (config.saveLogin)
		data.vrcLogin = vrcLogin;
	
	try {
		if (fs.existsSync(persistenceLocation))
			await new Promise((accept, error) => {
				fs.unlink(persistenceLocation, (err) => {
					if (err) error(err);
					accept();
				});
			});
		
		await fs.promises.writeFile(persistenceLocation, JSON.stringify(data));
		console.log(`Persistence saved to ${persistenceLocation}`);
	} catch (error) {
		console.error(`Error saving persistence to ${persistenceLocation}:`, error);
	}
}

async function load() {
	try {
		if (!fs.existsSync(persistenceLocation))
			return;
		const jsonData = await fs.promises.readFile(persistenceLocation, 'utf8');
		const data = JSON.parse(jsonData);
		vrcLoginLoaded = data.vrcLogin && data.config.saveLogin;
		if (vrcLoginLoaded)
			Object.assign(vrcLogin, data.vrcLogin);
		Object.assign(config, data.config);
		console.log(`Persistence loaded from ${persistenceLocation}`);
	} catch (error) {
		console.error(`Error loading persistence from ${persistenceLocation}:`, error);
		return null;
	}
}


module.exports = {
	save, load, isVRCLoginLoaded() {
		return vrcLoginLoaded;
	}, vrcLogin, config
};