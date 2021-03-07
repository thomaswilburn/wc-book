class CustomElement extends HTMLElement {

  constructor() {
    super();
    // new.target is the current constructor function
    var def = new.target;

    // if a shadow template is defined, inject it and find marked elements
    this.shadowElements = {};
    if (def.shadowTemplate) {
      this.shadowRoot.innerHTML = def.template;
      this.shadowRoot.querySelectorAll(`[data-as]`).forEach(el => {
        var name = el.dataset.as;
        this.shadowElements[name] = el;
      });
    }

    // bind methods for events to the current element
    if (def.boundMethods) {
      def.boundMethods.forEach(f => this[f] = this[f].bind(this));
    }

    // these properties will update their attributes
    if (def.mirroredProps) {
      def.mirroredProps.forEach(p => Object.defineProperty(this, p, {
        get() { this.getAttribute(p) },
        set(v) { this.setAttribute(p, v); return v; }
      }));
    }
  }

  // send an event up the tree
  dispatch(event, detail) {
    var e = new CustomEvent(event, {
      bubbles: true,
      composed: true,
      detail
    });
    this.dispatchEvent(e);
  }

  // looks for a static template getter on the class
  // injects that HTML into the element's light DOM
  // returns a hash of "data-as" elements
  // this is memoized and will only "run" once
  illuminate() {
    // get the light DOM template
    var template = this.constructor.lightTemplate;
    // inject into the node and query for marked elements
    this.innerHTML = template;
    var manuscript = {};
    var landmarks = this.querySelectorAll("[data-as]");
    for (var l of landmarks) {
      var key = l.dataset.as;
      manuscript[key] = l;
    }
    // replace this method with a memoized version
    this.illuminate = () => manuscript;
    // return the elements lookup
    return manuscript;
  }

  // handle registration
  static define(tag) {
    try {
      window.customElements.define(tag, this);
    } catch (err) {
      console.log(`Couldn't (re)define ${tag} element`);
    }
  }
}