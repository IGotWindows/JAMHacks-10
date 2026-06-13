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

  // Get screen dimensions to position the widget on the right side
  const screen = await chrome.system?.display?.getInfo().catch(() => null);
  const screenWidth = screen?.[0]?.bounds?.width ?? 1920;
  const screenHeight = screen?.[0]?.bounds?.height ?? 1080;

  const width = 440;
  const height = 760;
  const left = screenWidth - width - 20;
  const top = Math.floor((screenHeight - height) / 2);

  const win = await chrome.windows.create({
    url: BASE_URL + path,
    type: "popup",
    width,
    height,
    left,
    top,
  });

  widgetWindowId = win.id;
}

// Clear tracked ID when the widget window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === widgetWindowId) {
    widgetWindowId = null;
  }
});
