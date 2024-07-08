export class Resizer {
	constructor(element) {
		this.element = element;
		this.resizeBefore = element.previousElementSibling;
		this.resizeAfter = element.nextElementSibling;

		this.dragging = false;
		
		this.element.addEventListener("mousedown", (function(e) {
			this.dragging = true;
			console.log("Resizer click");
		}).bind(this));
		document.addEventListener("mousemove", (function(e) {
			if (this.dragging)
				this.updateDragBasis(e.movementX * -2);
		}).bind(this));
		document.addEventListener("mouseup", (function(e) {
			this.dragging = false;
		}).bind(this));
		
		this.updateDragBasis(0);
	}
	updateDragBasis(delta) {
		var pose = this.element.pose + delta;
		this.element.pose = pose || 0;
		var before = pose < 0 ? -pose : 0;
		var after = pose > 0 ? pose : 0;
		this.resizeBefore.style.flexBasis = before + "px";
		this.resizeAfter.style.flexBasis = after + "px";
	}
};