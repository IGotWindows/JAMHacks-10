const openBtn = document.getElementById("openBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

function setStatus(isOpen) {
  if (isOpen) {
    statusDot.classList.add("running");
    statusText.textContent = "Widget is open";
    openBtn.textContent = "Bring to Front";
    openBtn.classList.add("active");
  } else {
    statusDot.classList.remove("running");
    statusText.textContent = "Widget closed";
    openBtn.textContent = "Open Widget";
    openBtn.classList.remove("active");
  }
}

// Check if the widget is already open when the popup opens
chrome.runtime.sendMessage({ type: "GET_WIDGET_STATE" }, (res) => {
  setStatus(res?.windowId !== null && res?.windowId !== undefined);
});

openBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_WIDGET", path: "/dashboard" });
  setStatus(true);
  // Close the extension popup after launching
  setTimeout(() => window.close(), 150);
});

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const path = btn.dataset.path;
    chrome.runtime.sendMessage({ type: "OPEN_WIDGET", path });
    setTimeout(() => window.close(), 150);
  });
});
