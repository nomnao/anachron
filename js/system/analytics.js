// Counting what people do on ANACHRON, with GoatCounter.
// Only the name of the action is sent (e.g. "open-paint"), never
// file names, text, pictures or videos.
//
// GoatCounter's script is loaded in index.html. If it hasn't loaded,
// or an ad blocker stopped it, nothing is counted and everything else
// works as usual. It also ignores localhost, so testing on your own
// computer isn't counted.

export function trackEvent(name) {
  window.goatcounter?.count?.({ path: name, title: name, event: true });
}
