var CustomElement = require("./customElement");
var { watchSelector, unwatchSelector } = require("./watchSelector");

class MediaControls extends CustomElement {
  constructor() {
    super();
    this.media = null;
    this.elements.playButton.addEventListener("click", this.onClickedPlay);
  }

  static get observedAttributes() {
    return ["for", "src"];
  }

  static get mirroredProps() {
    return ["for", "src"];
  }

  static get boundMethods() {
    return [
      "onWatch",
      "onMediaUpdate",
      "onClickedPlay"
    ];
  }

  static get subscriptions() {
    return [
      "play",
      "pause",
      "timeupdate",
      "canplaythrough"
    ]
  }

  attributeChangedCallback(attr, was, value) {
    switch (attr) {

      case "for":
        if (was) unwatchSelector(`[id="${was}"]`, this.onWatch);
        if (value) watchSelector(`[id="${value}"]`, this.onWatch)
        break;

      case "src":
        var media = document.createElement("audio");
        media.src = value;
        this.connect(media);
        break;

    }
  }

  connect(element) {
    if (element == this.media) return;
    if (this.media) {
      this.disconnect();
    }
    // subscribe to events
    this.media = element;
    if (element) {
      for (var e of MediaControls.subscriptions) {
        element.addEventListener(e, this.onMediaUpdate);
      }
    }
  }

  disconnect() {
    if (!this.media) return;
    // unsubscribe from events
    for (var e of MediaControls.subscriptions) {
      this.media.removeEventListener(e, this.onMediaUpdate);
    }
    this.media = null;
  }

  onWatch(element) {
    if (this.src) return;
    this.connect(element);
  }

  onMediaUpdate(e) {
    var { duration, currentTime, paused } = this.media;
    var ratio = currentTime / duration;
    var { labels, progress, playIcon, pauseIcon } = this.elements;
    try {
      var pLength = Math.ceil(progress.getTotalLength());
      var pDash = Math.ceil(ratio * pLength);
      progress.style.strokeDasharray = [pLength, pLength].join(" ");
      progress.style.strokeDashoffset = pDash;
      if (paused) {
        playIcon.style.display = "";
        pauseIcon.style.display = "none";
      } else {
        playIcon.style.display = "none";
        pauseIcon.style.display = "";
      }
    } catch (err) {
      // SVG code will fail if the button isn't immediately visible, it's fine.
    }
  }

  onClickedPlay() {
    if (!this.media) return;
    if (this.media.paused) {
      this.media.currentTime = 0;
      this.media.play();
      events.fire("media-play", this.media);
    } else {
      this.media.currentTime = 0;
      this.media.pause();
    }
  }

  static get template() {
    return require("./_media-controls.html");
  }

}

MediaControls.define("media-controls");