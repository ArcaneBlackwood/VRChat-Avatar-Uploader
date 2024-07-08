const parser = new require('xml2js').Parser();

async function parseXML(dataRaw) {
	return await parser.parseStringPromise(dataRaw)
}

module.exports = { parseXML };