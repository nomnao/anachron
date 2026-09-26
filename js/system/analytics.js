// Counting what people do on ANACHRON, with GoatCounter and
// Google Analytics. Only the name of the action is sent
// (e.g. "open-paint"), never file names, text, pictures or videos.
//
// Both are loaded in index.html. If either hasn't loaded, or an ad
// blocker stopped it, that one just isn't counted and everything
// else works as usual. Neither counts testing on localhost.

export function trackEvent(name) {
  window.goatcounter?.count?.({ path: name, title: name, event: true });

  // Google Analytics only allows letters, numbers and underscores
  // in event names: "open-paint" becomes "open_paint"
  window.gtag?.('event', name.replaceAll('-', '_'));
}
