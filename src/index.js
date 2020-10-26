const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// Default settings
let settings = {
  fps: 30,
  followMouseThroughMonitors: true,
  resizeWindowOnSmallSize: true
};

let mouseInterval = null;

// Rare black screens with accel enabled
app.disableHardwareAcceleration();


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 1000,
    icon: __dirname + "/assets/icon.png",
    webPreferences: {
      nodeIntegration: true,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.setMenuBarVisibility(false);

  mainWindow.setTitle("Mouse tracker");

  function mouseIntervalFunc() {
    clearInterval(mouseInterval);

    let prevXY = { x: 0, y: 0 };
    // Register and start hook
    mouseInterval = setInterval(() => {
      const currentXY = screen.getCursorScreenPoint();
      if (prevXY.x !== currentXY.x || prevXY.y != currentXY.y) {
        prevXY = currentXY;
        mainWindow.webContents.send("cursorUpdate", {
          x: currentXY.x,
          y: currentXY.y,
          display: screen.getDisplayNearestPoint(currentXY)
        });
      }
    }, 1000 / settings.fps);
  }

  ipcMain.on('windowResize', (e, size) => {
    mainWindow.setBounds(size);
  })

  ipcMain.on('applySettings', (e, newSettings) => {
    settings = newSettings;

    // Restart the mouse capturing
    mouseIntervalFunc();
  });

  // Start intervalling the mouse
  mouseIntervalFunc();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
