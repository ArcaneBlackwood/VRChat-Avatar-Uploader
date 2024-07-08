const Ajv = require('ajv');

const schemas = {
	VRCfile: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			extension: { type: 'string' },
			mimeType : { type: 'string', "enum": ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/svg＋xml", "image/tiff", "application/x-avatar", "application/x-world", "application/gzip", "application/x-rsync-signature", "application/x-rsync-delta", "application/octet-stream"]},
			name: { type: 'string' },
			ownerId: { type: 'string' },
			tags: { type: 'array', items: { type: 'string' } },
			versions: { type: 'array', items: { $ref: '#/definitions/VersionEntry' } },
		},
		required: ["id", "extension", "mimeType", "name", "ownerId", "tags", "versions"],
		definitions: {
			VersionEntry: {
				type: 'object',
				properties: {
					created_at: { type: "string", "format": "custom-date-time" },
					deleted: { type: "boolean" },
					status: { type: 'string', "enum": ["waiting", "complete", "none", "queued"]},
					version: { type: 'integer' },
					delta: { $ref: '#/definitions/fileDescriptor' },
					file: { $ref: '#/definitions/fileDescriptor' },
					signature: { $ref: '#/definitions/fileDescriptor' }
				},
				required: ["created_at", "status", "version"]
			},
			fileDescriptor: {
				type: 'object',
				properties: {
					status: { type: 'string', "enum": ["waiting", "complete", "none", "queued"]},
					url: { type: 'string' },
					md5: { type: 'string' },
					category: { type: 'string', "enum": ["multipart", "queued", "simple"] },
					sizeInBytes: { type: 'integer' },
					fileName: { type: 'string' },
					uploadId: { type: 'string' },
					cdns: { type: 'array', items: { type: 'string' } },
				},
				required: ["status", "url", "md5", "category", "sizeInBytes", "fileName", "uploadId"]
			}
		}
	}
};



const ajv = new Ajv();
ajv.addFormat('custom-date-time', function(dateTimeString) {
  if (typeof dateTimeString === 'object')
    dateTimeString = dateTimeString.toISOString();
	var time = Date.parse(dateTimeString);
  return isNaN(time) ? null : time;
});
for (let key in schemas) {
	const raw = schemas[key];
	schemas[key] = ajv.compile(raw);
	schemas[key].raw = raw;
}


class VRCfile {
    constructor(data) {
			Object.assign(this, data);
			if (data.error)
				return;
			if (!schemas.VRCfile(data)) {
				const valid = ajv.validate(schemas.VRCfile.raw, data)
				if (!valid) console.log(ajv.errors)
				throw new Error("Response contains invalid 'VRCfile' schema");
			}
    }
    GetLatestVersion() {
			return (this.versions ? this.versions.length : 0) - 1;
    }
    HasExistingOrPendingVersion() {
        let latestVersion = this.GetLatestVersion();
        if (latestVersion > 0) {
					latestVersion -= this.versions.filter(v => v === null || v.deleted).length;
        }
        return latestVersion > 0;
    }

    IsLatestVersionWaiting() {
        if (!this.HasExistingOrPendingVersion()) return false;
        const version = this.versions[this.GetLatestVersion()];
        if (version.status === "waiting") return true;
        return ((version.file?.status === "waiting") || (version.signature?.status === "waiting"));
    }

    IsLatestVersionQueued() {
        if (!this.HasExistingOrPendingVersion()) return false;
        const version = this.versions[this.GetLatestVersion()];
        if (version.status === "queued") return true;
        return ((version.file?.status === "queued") || (version.signature?.status === "queued"));
    }

    IsLatestVersionErrored() {
        if (!this.HasExistingOrPendingVersion()) return false;
        const version = this.versions[this.GetLatestVersion()];
        if (version.status === "error") return true;
        return ((version.file?.status === "error") || (version.signature?.status === "error"));
    }

    HasQueuedOperation() {
        if (this.IsLatestVersionWaiting()) return false;
        return this.HasExistingOrPendingVersion() && this.IsLatestVersionQueued();
    }
}


module.exports = {
	VRCfile
};