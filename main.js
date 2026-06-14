const { app, BrowserWindow } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    alwaysOnTop: true, 
    webPreferences: {
      contextIsolation: true
    }
  })

  // Linux/Wayland fix: Force the window level to "screen-saver" or "pop-up-menu"
  win.setAlwaysOnTop(true, 'screen-saver')

  win.loadURL('http://127.0.0.1:5000')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


// Terminal 1: Start your Python Backend
// Make sure you run this from your ~/JAMHacks 10 directory to start your Flask server:
//
// Bash
// ./.venv/bin/python app.py


// Terminal 2: Start your Electron Frontend
// Open a brand-new terminal window or tab, make sure you are in the same folder, and launch Electron:
//
// Bash
// npm start or ELECTRON_OZONE_PLATFORM_HINT=x11 npm start