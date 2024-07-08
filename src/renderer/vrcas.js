export const VRCAs = {
	init(element) {
		this.element = element;
		
		this.template = document.getElementById("vrcaTemplate");
		this.list = document.getElementById("vrcas");
		this.addButton = document.getElementById("vrcaDelete");
		this.types = Array.prototype.map.call(this.template.content.querySelector("select").options, (o=>o.value));
		this.vrcas = [];
		
		document.body.addEventListener("avataruploaded", (function({id}) {
			this.vrcas.forEach(vrca=>{
				vrca.updateIcon.setAttribute("active", "false");
			});
		}).bind(this));
		this.addButton.addEventListener("click", (e=>{
			this.addVRCA();
		}).bind(this));
	},
	_getFreeVRCATypes() {
		const consumedTypes = this.vrcas.map(vrca=>vrca.type).filter(type=>type != "none");
		const freeTypes = this.types.map(type=>!consumedTypes.includes(type));
		if (freeTypes.reduce((t,v)=>(v ? 1 : 0) + t) == 0)
			return null;
		return freeTypes;
	},
	_updateVRCAUI() {
		var freeTypes = this._getFreeVRCATypes();
		this.vrcas.forEach((vrca,i) => {
			vrca.index = i;
			vrca.element.index = i;

			Array.prototype.forEach.call(vrca.dropdownElement.options, (v,i) => {
				const enabled = v.value == vrca.type || freeTypes[i];
				if (enabled == v.hasAttribute("disabled"))
					v.toggleAttribute("disabled");
			});
		});
	},
	
	
	setVRCAType(index, type) {
		if (!this.types.includes(type)) {
			console.error("VRCA type invalid: " + type);
			return;
		}
		const vrcaData = this.vrcas[index];
		vrcaData.dropdownElement.value = type;
	},
	setVRCAFile(index, path) {
		const vrcaData = this.vrcas[index];
		vrcaData.filePath = (path ?? "").trim();
		vrcaData.updateIcon.setAttribute("active", vrcaData.filePath != "");
	},
	deleteVRCA(index) {
		var vrcaData = this.vrcas.splice(index, 1);
		if (vrcaData.length == 0) {
			console.error("Failed to remove VRCA file " + index);
			return;
		}
		vrcaData = vrcaData[0];
		vrcaData.element.remove();
		this._updateVRCAUI();
	},
	deleteAllVRCAS() {
		for (let vrca of this.vrcas) {
			vrca.element.remove();
		}
		this.vrcas = [];
		this._updateVRCAUI();
	},
	addVRCA(type) {
		var freeTypes = this._getFreeVRCATypes();
		if (freeTypes == null)
			return;
		type = type ?? this.types[freeTypes.findIndex(v=>v)];
		freeTypes[this.types.indexOf(type)] = true;

		const clone = this.template.content.cloneNode(true);
		const baseEl = clone.lastElementChild;

		const dropdownElement = baseEl.querySelector("#type");
		const deleteButton = baseEl.querySelector("#vrcadelete");
		const fileElement = baseEl.querySelector("#vrca");
		//file
		const updateIcon = baseEl.querySelector("#update");
		const vrcaData = {
			element: baseEl,
			fileElement,
			updateIcon,
			dropdownElement,
			index: -1,
			type: type,
			file: undefined
		};

		deleteButton.vrca = vrcaData;
		deleteButton.addEventListener("click", ((e) => {
			this.deleteVRCA(e.target.vrca.index);
		}).bind(this));
		fileElement.vrca = vrcaData;
		fileElement.addEventListener("change", (e) => {
			const vrcaData = e.target.vrca;
			vrcaData.file = e.target.files[0];
			this.setVRCAFile(vrcaData.index, vrcaData.file.path);
		});
		dropdownElement.vrca = vrcaData;
		dropdownElement.addEventListener("change", ((e) => {
			e.target.vrca.type = e.target.value;
			this._updateVRCAUI();
		}).bind(this));
		dropdownElement.value = type

		const index = this.vrcas.length;
		this.list.appendChild(clone);
		this.vrcas.push(vrcaData);
		this._updateVRCAUI();
		
		return index;
	},
	setAllVRCAS(vrcas, isLoad) {
		this.deleteAllVRCAS();
		for (let vrca of vrcas) {
			const index = this.addVRCA(vrca.type);
			if (isLoad)
				this.setVRCAFile(index, vrca.path);
		}
	}
};