export const Screens = {
	activeScreen: null,
	init(screensElement) {
		this.screens = Object.fromEntries(
			Array.prototype.map.call(screensElement, (s,i)=>
				[s.getAttribute("name") ?? "screen" + i, s]
		));
		this.activeScreen = null;
		eventRecv.setScreen(((e,screen) => {
			if (!this.screens.hasOwnProperty(screen))
				throw new Error("Screen doenst exist: " + screen);
			if (this.activeScreen)
				this.activeScreen.setAttribute("active", "false");
			this.activeScreen = this.screens[screen];
			this.activeScreen.setAttribute("active", "true");

			console.log("Renderer set screen: " + screen);
			document.body.dispatchEvent(new CustomEvent("screenswitch",{
				screen
			}));
		}).bind(this));
	}
};