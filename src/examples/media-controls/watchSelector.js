var watchList = new Map();

var glance = function (watch) {
  var result = document.querySelector(watch.selector);
  watch.callbacks.forEach(function (c) {
    if (c.previous == result) return;
    c(result);
    c.previous = result;
  });
};

var observer = new MutationObserver(function (mutations) {
  watchList.forEach(glance);
});

observer.observe(document.body, {
  subtree: true,
  childList: true,
  attributeFilter: ["id"],
});

var watchSelector = function (selector, callback) {
  var watch = watchList.get(selector) || { selector, callbacks: [] };
  if (watch.callbacks.includes(callback)) return;
  watch.callbacks.push(callback);
  try {
    glance(watch);
    watchList.set(selector, watch);
  } catch (err) {
    console.error(err);
  }
};

var unwatchSelector = function (selector, callback) {
  var watching = watchList.get(selector);
  if (!watching) return;
  watching.callbacks = watching.callbacks.filter((c) => c != callback);
  if (!watching.callbacks.length) {
    watchList.delete(selector);
  }
};

module.exports = { watchSelector, unwatchSelector };
