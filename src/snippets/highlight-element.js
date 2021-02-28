class HighlightElement extends HTMLElement {
  constructor() {
    super();
    this.highlight = false;
    this.addEventListener("click", () => this.toggleHighlight());
  }

  toggleHighlight() {
    this.highlight = !this.highlight;
    if (this.highlight) {
      this.style.background = "yellow";
    } else {
      this.style.background = "";
    }
  }
}
