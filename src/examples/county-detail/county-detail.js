var ElementBase = require("../elementBase");
var Retriever = require("../retriever");

var $ = require("../../lib/qsa"); // querySelector alias
var track = require("../../lib/tracking"); // Google Analytics events

// related components and styles
require("../results-table");
require("../county-map");
require("./county-detail.less");

// load headshots for presidential candidates from a Google sheet
var mugs = require("mugs.sheet.json");

var {
  formatAPDate,
  formatTime,
  groupBy,
  mapToElements,
  toggleAttribute
} = require("../utils");

// generate a color lookup for well-known candidates
var colorSet = new Set();
for (var m in mugs) {
  if (mugs[m].color) colorSet.add(mugs[m].color);
}
var colorKey = Array.from(colorSet);

class CountyDetail extends ElementBase {
  constructor() {
    super();
    // a Retriever is a utility for observing files on S3 for updates
    this.fetch = new Retriever(this.load);
    this.palette = {};
    // listen for events dispatched from the inner map
    this.addEventListener("map-click", function(e) {
      var fips = e.detail.fips;
      track("click-county", fips);
      var elements = this.illuminate();
      elements.countySelect.value = fips;
      this.updateTable(fips);
    });
  }

  static get boundMethods() {
    return ["load", "onSelectCounty"];
  }

  static get observedAttributes() {
    return ["src", "party", "live", "map"];
  }

  static get mirroredProps() {
    return ["src"];
  }

  attributeChangedCallback(attr, was, value) {
    switch (attr) {
      case "src":
        this.fetch.watch(value, this.getAttribute("live") || 60);
        break;

      case "party":
        this.render();
        break;

      case "live":
        if (typeof value == "string") {
          this.fetch.start(value);
        } else {
          this.fetch.stop();
        }
        break;

      case "map":
        var elements = this.illuminate();
        elements.map.src = value;
        break;
    }
  }

  load(data) {
    this.cache = data;
    this.render();
  }

  render() {
    var colors = colorKey.slice();

    var elements = this.illuminate();
    this.classList.remove("uncontested");
    var data = this.cache;
    if (!data) return;
    var { races, test } = data;

    /* *** PROCESSING START *** */

    var party = this.getAttribute("party");
    if (!party || party == "undefined") party = false;

    // filter races by type - no weird alignments
    var [race] = races.filter(
      r => (party ? r.party == party : true) && r.type && !r.type.match(/alignment/i)
    );

    var results = race.results;
    var counties = {};
    var fips = {};
    var totals = {}; // state-wide totals

    var candidates = new Set();

    // aggregate data based on county results
    results.forEach(function(r) {
      var top = null;
      r.candidates.forEach(function(candidate) {
      // create an empty totals object when first seeing a candidate
        if (!totals[candidate.id])
          totals[candidate.id] = {
            first: candidate.first,
            last: candidate.last,
            id: candidate.id,
            votes: 0
          };
        totals[candidate.id].votes += candidate.votes;
        if (!top || candidate.percentage > top.percentage) {
          top = candidate;
        }
        delete candidate.winner;
        candidates.add(candidate.id);
      });
      // counties are only marked as winners when all votes are in
      if (r.reportingPercentage == 100) {
        top.winner = true;
      }
      // add each county to our lookup objects
      counties[r.county] = r.fips;
      fips[r.fips] = r.county;
    });

    if (candidates.size == 1) {
      // suppress display for uncontested races
      return this.classList.add("uncontested");
    }

    // for future map use: determine the palette by statewide total position
    var statewide = Object.values(totals);
    statewide.sort((a, b) => b.votes - a.votes);

    // generate a consistent palette between the table and map
    var palette = {};
    statewide.slice(0, colors.length).forEach(function(s, i) {
      var color = mugs[s.last] && mugs[s.last].color;

      if (color) {
        var index = colors.indexOf(color);
        colors.splice(index,1);

        palette[s.id] = {
          id: s.id,
          first: s.first,
          last: s.last,
          color: color,
          order: i
        };
      } else {
        palette[s.id] = {
          id: s.id,
          first: s.first,
          last: s.last,
          order: i
        };
      }
    });
    
    var index = 0;
    for (var p in palette) {
      var candidate = palette[p];
      if (!candidate.color) {
        candidate.color = colors[index];
        index += 1;
      }
    }

    if (statewide.length > colors.length) {
      palette.other = {
        id: "other",
        last: "Other",
        color: "#bbb",
        order: 999
      };
    }

    /* *** PROCESSING END *** */

    // paint the map with county results
    elements.map.render(palette, race.results, this.dataset.state);

    // generate the county select drop-down items
    counties = Object.keys(counties)
      .sort()
      .map(county => ({ county, id: counties[county] }));
    mapToElements(elements.countySelect, counties, function(data) {
      var option = document.createElement("option");
      option.innerHTML = data.county.replace(/\s[a-z]/g, match =>
        match.toUpperCase()
      );
      option.value = data.id;
      return option;
    });

    // by default, show the largest county in the state
    var maxPop = 0;
    var maxFips;
    results.forEach(function(r) {
      if (r.population > maxPop) {
        maxPop = r.population;
        maxFips = r.fips;
      }
    });

    elements.countySelect.value = maxFips;
    elements.map.highlightCounty(maxFips);
    this.updateTable(maxFips);
  }

  updateTable(fips) {
    if (fips == 0) return;
    var elements = this.illuminate();
    var { resultsTable } = elements;
    var data = this.cache;
    var party = this.getAttribute("party");
    if (!party || party == "undefined") party = false;
    if (!data) return;

    var { races } = data;
    // filter races by type - no weird alignments
    var [race] = races.filter(
      r => (party ? r.party == party : true) && r.type && !r.type.match(/alignment/i)
    );
    var [result] = race.results.filter(r => r.fips == fips);

    resultsTable.setAttribute(
      "headline", 
      result.county + ` (Pop. ${result.population.toLocaleString()})`
    );
    resultsTable.setAttribute("max", 99);
    if (result) resultsTable.render(result);
  }

  static get template() {
    return require("./_template.html");
  }

  onSelectCounty() {
    var elements = this.illuminate();
    var fips = elements.countySelect.value;
    track("select-county", fips);
    this.updateTable(fips);
    elements.map.highlightCounty(fips);
  }

  illuminate() {
    var elements = super.illuminate();
    elements.countySelect.addEventListener("change", this.onSelectCounty);
    return elements;
  }
}

CountyDetail.define("county-detail");
