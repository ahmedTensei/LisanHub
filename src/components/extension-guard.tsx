/**
 * Development only. Password-manager extensions (Bitwarden and relatives) stamp
 * every element with attributes such as `bis_skin_checked` before React
 * hydrates, and React then reports a hydration mismatch for each of them.
 *
 * The guard removes those attributes from the server-rendered elements, at most
 * once per element, and stops as soon as hydration has finished (or after 15 s).
 * It never touches nodes the extension adds itself (its autofill menu), so the
 * two can never chase each other in a loop. Production builds skip it: React
 * ignores extra attributes there.
 */
export const EXTENSION_GUARD_SCRIPT = `(function(){
  var names = ["bis_skin_checked", "bis_register"];
  var serverNodes = null;
  var cleaned = new WeakSet();
  function strip(el) {
    if (!el || el.nodeType !== 1 || cleaned.has(el) || !serverNodes.has(el)) return;
    var removed = false;
    for (var i = el.attributes.length - 1; i >= 0; i--) {
      var name = el.attributes[i].name;
      if (names.indexOf(name) !== -1 || name.indexOf("__processed_") === 0) {
        el.removeAttribute(name);
        removed = true;
      }
    }
    if (removed) cleaned.add(el);
  }
  var observer = new MutationObserver(function(records) {
    for (var i = 0; i < records.length; i++) {
      if (records[i].type === "attributes") strip(records[i].target);
    }
  });
  function start() {
    if (serverNodes) return;
    serverNodes = new WeakSet();
    var all = document.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) serverNodes.add(all[i]);
    for (var j = 0; j < all.length; j++) strip(all[j]);
    observer.observe(document.documentElement, { attributes: true, subtree: true });
    setTimeout(stop, 15000);
  }
  function stop() {
    observer.disconnect();
  }
  window.__lisanhubExtensionGuardStop = stop;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();`;
