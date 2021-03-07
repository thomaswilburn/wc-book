var styles = `
  :host {
    position: relative;
    display: block;
  }

  * {
    box-sizing: border-box;
  }

  input {
    display: block;
    width: 100%;
  }

  .dropdown {
    position: absolute;
    width: 100%;
    margin: 0;
    padding: 0;
    max-height: 180px;
    list-style-type: none;
    z-index: 999;
    overflow-y: auto;
  }

  .above .dropdown {
    bottom: 100%;
  }

  .dropdown li {
    padding: 2px 4px;
    background: white;
    border-bottom: 1px solid #DDD;
    text-align: left;
    cursor: pointer;
  }

  .dropdown .selected {
    background: #DDD;
  }
`;

var guid = 0;
var COMPOSED = { composed: true, bubbles: true };

class AutocompleteInput extends HTMLElement {

  constructor() {
    super();
    var id = guid++;
    this.value = null;
    this.attachShadow({ mode: "open" });
    this.cancelBlur = false;

    var autoBind = [
      "onMenuClick",
      "onMenuTouch",
      "onBlur",
      "onInput",
      "onKeyPress",
      "onMutation",
      "closeMenu"
    ];
    autoBind.forEach(f => this[f] = this[f].bind(this));

    // add style
    var style = document.createElement("style");
    style.innerHTML = styles;
    this.shadowRoot.appendChild(style);

    this.container = document.createElement("div");
    this.shadowRoot.appendChild(this.container);
    this.container.setAttribute("role", "combobox");
    this.container.setAttribute("aria-haspopup", "listbox");
    this.container.setAttribute("aria-owns", `listbox-${id}`);

    this.input = document.createElement("input");
    this.input.setAttribute("aria-controls", `listbox-${id}`);
    this.input.setAttribute("aria-activedescendant", "");
    this.container.appendChild(this.input);

    var bounce = null;
    // debounce the inputs
    this.input.addEventListener("input", e => {
      if (bounce) {
        clearTimeout(bounce);
      }
      bounce = setTimeout(() => {
        bounce = null;
        this.onInput();
      }, 150);
    });
    // don't debounce arrow keys
    this.input.addEventListener("keydown", this.onKeyPress);
    this.input.addEventListener("blur", this.onBlur);

    this.observer = new MutationObserver(this.onMutation);
    this.list = null;
    this.entries = [];
    this.selectedIndex = -1;

    this.menuElement = document.createElement("ul");
    this.menuElement.id = `listbox-${id}`;
    this.menuElement.setAttribute("role", "listbox");
    this.menuElement.classList.add("dropdown");
    this.container.appendChild(this.menuElement);
    this.menuElement.addEventListener("click", this.onMenuClick);
    this.menuElement.addEventListener("mousedown", this.onMenuTouch);
    this.menuElement.addEventListener("touchstart", this.onMenuTouch);
  }

  connectedCallback() {
    if (document.readyState != "complete") {
      document.addEventListener("load", () => {
        var id = this.getAttribute("list");
        if (!this.list && id) this.attributeChangedCallback("list", id, id);
      });
    }
  }

  // reflect inner input value to the host component
  get value() {
    return this.input ? this.input.value : "";
  }

  set value(v) {
    if (this.input) {
      var updated = this.input.value != v;
      if (updated) {
        this.input.value = v;
        var changeEvent = new CustomEvent("change", COMPOSED);
        this.dispatchEvent(changeEvent);
      }
    }
  }

  static get observedAttributes() {
    return [
      "list"
    ]
  }

  attributeChangedCallback(attr, was, is) {
    switch (attr) {
      case "list":
        // un-observe the old list
        if (this.list) {
          this.observer.disconnect();
          this.list = null;
        }
        // find and monitor the list
        this.list = document.querySelector("#" + is);
        if (this.list) {
          this.observer.observe(this.list, {
            childList: true,
            characterData: true
          });
          // update with existing items
          this.updateListEntries();
        }
        break;

    }
  }

  // if <datalist> changes, update our internal representation
  onMutation(e) {
    this.updateListEntries();
  }

  // read the contents of the <datalist> and build an internal array of options
  updateListEntries() {
    if (!this.list) return;
    this.entries = Array.from(this.list.children).map(function(option, index) {
      if (!option.value) return;
      return {
        value: option.value,
        label: option.innerHTML,
        index
      }
    }).filter(v => v);
  }

  // actually produce the menu when typing
  onInput() {
    var value = this.input.value;
    this.menuElement.innerHTML = "";
    if (!value) return;

    // filter the entries via a regex
    var matcher = new RegExp(value, "i");
    var matching = this.entries.filter(e => e.label.match(matcher));
    if (!matching.length) return;

    // limit the matches
    matching = matching.slice(0, 100);
    var found = matching.find(r => r.index == this.selectedIndex);
    if (!found) this.selectedIndex = matching[0].index;
    // populate the dropdown with options
    var listItems = matching.forEach(entry => {
      var li = document.createElement("li");
      li.dataset.index = entry.index;
      li.dataset.value = entry.value;
      li.innerHTML = entry.label;
      li.setAttribute("role", "option");
      li.id = `list-${guid}-item-${entry.index}`;
      if (entry.index == this.selectedIndex) {
        li.classList.add("selected");
        this.input.setAttribute("aria-activedescendant", li.id);
      }
      this.menuElement.appendChild(li);
    });
    var position = this.input.getBoundingClientRect();
    var below = window.innerHeight - position.bottom;
    this.container.classList.toggle("above", below < this.menuElement.offsetHeight);
    this.container.setAttribute("aria-expanded", "true");
  }

  // handle arrow keys and enter/escape
  onKeyPress(e) {
    switch (e.code) {
      case "ArrowDown":
      case "ArrowUp":
        var shift = e.code == "ArrowDown" ? 1 : -1;
        var current = this.menuElement.querySelector(".selected");
        var newIndex;
        if (current) {
          var currentIndex = Array.from(this.menuElement.children).indexOf(current);
          var newIndex = (currentIndex + shift) % this.menuElement.children.length;
          if (newIndex < 0) newIndex = this.menuElement.children.length + newIndex;
          current.classList.remove("selected");
        } else {
          newIndex = shift == 1 ? 0 : this.menuElement.children.length - 1;
        }
        var li = this.menuElement.children[newIndex];
        if (li) {
          li.classList.add("selected");
          this.input.setAttribute("aria-activedescendant", li.id);
          this.selectedIndex = li.dataset.index;
        }
      break;

      case "Enter":
        var chosen = this.entries[this.selectedIndex];
        if (!chosen) return;
        this.setValue(chosen);
      break;

      case "Escape":
        this.input.value = "";
        this.closeMenu();
      break;
    }
  }

  // called when a menu item is clicked or user presses enter
  setValue(entry) {
    if (entry) {
      this.input.value = entry.label;
      this.menuElement.innerHTML = "";
      this.value = this.input.value;
        var changeEvent = new CustomEvent("change", COMPOSED);
      this.dispatchEvent(changeEvent);
    } else {
      this.input.value = "";
    }
    this.closeMenu();
  }

  onMenuClick(e) {
    var index = e.target.dataset.index;
    if (index == null) return;
    this.menuElement.innerHTML = "";
    this.selectedIndex = index;
    var entry = this.entries[index];
    this.setValue(entry);
  }

  onMenuTouch() {
    this.cancelBlur = true;
  }

  onBlur() {
    if (this.cancelBlur) return;
    this.closeMenu();
  }

  closeMenu() {
    this.menuElement.innerHTML = "";
    this.container.setAttribute("aria-expanded", "false");
    this.input.setAttribute("aria-activedescendant", "");
    this.cancelBlur = false;
  }

}