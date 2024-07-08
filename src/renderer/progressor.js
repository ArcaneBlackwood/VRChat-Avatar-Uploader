function state(message, estimatedTime) {
	return {
		message,
		estimatedTime: estimatedTime ?? 0
	};
}

const states = {
	upload: {
		states: {
			assemble: state("Assembeling avatar data", 1),
			confirm: state("Confirming avatar upload", 1),
			fetchInfo: state("Fetching info", 2),
			uploadImage: state("Uploading thumbnail", 4),
			create: state("Creating VRC avatar", 2),
			upload: state("Uploading VRC Avatar", 10),
			complete: state("Uploaded avatar successfully!")
		}
	},
	loadPackage: {
		states: {
			select: state("Selecting file...", 2),
			open: state("Opening file", 1),
			decompress: state("Decompressing file", 20),
			load: state("Loading file", 1),
			complete: state("Import package success!")
		}
	},
	savePackage: {
		states: {
			assemble: state("Assembeling avatar data", 1),
			select: state("Selecting save location...", 2),
			create: state("Creating package file", 2),
			compress: state("Compressing package data", 20),
			complete: state("Export package success!")
		}
	}
};



for (let stateType in states) {
	const stateData = states[stateType];
	stateData.statesArray = Object.entries(stateData.states).map(([k,v],i)=>{
		v.index = i;
		v.key = k;
		return v;
	}
	);
	const total = stateData.statesArray.reduce((t,v)=>t + (v.estimatedTime ?? 0), 0);
	let runningTotal = 0;
	stateData.totalEstimatedTime = total;
	for (let stateName in stateData.states) {
		const state = stateData.states[stateName];
		state.runningTotal = runningTotal;
		runningTotal += state.estimatedTime
	}
}

export const Progressor = {
	states,
	init(statusElement, progressBarElement) {
		this.statusElement = statusElement;
		this.progressBarElement = progressBarElement;
		this.type = null;
		this.state = null;
		this.setStatus();
	},
	setProgressType(type) {
		this.type = states[type];
		if (this.type == null) {
			console.error("Invalid progress info state type: " + type);
			return;
		}
		this.state = this.type.statesArray[0];
		this.setStatus();
		//console.log("setProgressType "+type);
	},
	setProgressState(stateName) {
		if (!this.type.states.hasOwnProperty(stateName))
			console.error("Invalid state name: '"+stateName+"'");
		this.state = this.type.states[stateName] ?? this.state;
		this.setStatus();
		this.setProgress(0);
		//console.log("setProgressState "+stateName);
	},
	setProgress(completion) {
		const totalTime = this.type.totalEstimatedTime;
		const timeOffset = this.state.runningTotal;
		const time = this.state.estimatedTime;

		const amount = (timeOffset + time * (completion ?? 0)) / totalTime * 100;

		this.progressBarElement.firstElementChild.style.width = amount + "%";
		//console.log("setProgress state="+this.state.key+", totalTime="+totalTime+", timeOffset="+timeOffset+", completion="+completion+"%, time="+time);
	},
	setStatus(statusText, error) {
		if (this.state)
			this.statusElement.innerText = this.state.message+"\n"+(statusText ?? "");
		else
			this.statusElement.innerText = (statusText ?? "");
		
		this.progressBarElement.setAttribute("style", error ? "error" : null);
		//console.log("setStatus "+(error?"error ":"")+statusText);
	},
};