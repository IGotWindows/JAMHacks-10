const BASE_URL = "http://localhost:5000";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_APP") {
    chrome.tabs.create({ url: BASE_URL + (message.path || "/dashboard") });
    sendResponse({ ok: true });

  } else if (message.type === "OPEN_WIDGET") {
    // Legacy popup path — reuse as tab open
    chrome.tabs.create({ url: BASE_URL + (message.path || "/dashboard") });
    sendResponse({ ok: true });

  } else if (message.type === "GET_WIDGET_STATE") {
    // Sidebar doesn't track a window ID — always "open"
    sendResponse({ windowId: null });

  } else if (message.type === "REQUEST_SYNC") {
    // Ask any open Flask tab to re-push its localStorage to chrome.storage
    chrome.tabs.query(
      { url: ["http://127.0.0.1:5000/*", "http://localhost:5000/*"] },
      (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: "REQUEST_SYNC" }).catch(() => {});
        });
      }
    );
    sendResponse({ ok: true });
  }

  return true;
});
