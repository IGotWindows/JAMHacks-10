const BASE_URL = "http://localhost:5000";

// Track the widget window ID so we don't open duplicates
let widgetWindowId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_WIDGET") {
    openWidget(message.path || "/dashboard");
    sendResponse({ ok: true });
  } else if (message.type === "GET_WIDGET_STATE") {
    sendResponse({ windowId: widgetWindowId });
  }
  return true;
});

async function openWidget(path) {
  // If the widget is already open, focus it and navigate
  if (widgetWindowId !== null) {
    try {
      const win = await chrome.windows.get(widgetWindowId, { populate: true });
      await chrome.windows.update(widgetWindowId, { focused: true });

      // Navigate the widget's tab to the new path if requested
      if (win.tabs && win.tabs.length > 0) {
        await chrome.tabs.update(win.tabs[0].id, { url: BASE_URL + path });
      }
      return;
    } catch {
      // Window was closed outside our tracking — reset and re-open
      widgetWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: BASE_URL + path,
    type: "popup",
    width: 440,
    height: 760,
    focused: true,
  });

  widgetWindowId = win.id;
}

// Clear tracked ID when the widget window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === widgetWindowId) {
    widgetWindowId = null;
  }
});
