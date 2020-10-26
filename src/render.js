const { desktopCapturer, ipcRenderer } = require('electron');
var EventEmitter = require('events');

let display = null;
let rect = { width: 1000, height: 1000 };

// This way it will not switch between sources and crash
let switchingMonitors = false;
const switchingEmitter = new EventEmitter();

let stream = null;

// Buttons
const videoElement = document.querySelector('#vid1');
const settingsBtn = document.querySelector('.settings-button');
const settingsScreen = document.querySelector('.settings');
const fpsSlider = document.querySelector("#fps-slider");
const fps = document.querySelector("#fps");
const followMouseSelect = document.querySelector("#follow-mouse");
const resizeSmallSelect = document.querySelector("#resize-small");

// Add listeners
window.addEventListener('resize', adjustWindowSize);

settingsBtn.addEventListener('click', () => {
  settingsScreen.style.display =
    settingsScreen.style.display != "flex" ? "flex" : "none"
  settingsBtn.firstChild.src = settingsBtn.firstChild.src.includes("close.svg") ? "assets/settings.svg" : "assets/close.svg"
});

fpsSlider.addEventListener('change', e => {
  setSetting("fps", e.target.value, true);
  fps.innerHTML = getSetting("fps");
});

followMouseSelect.addEventListener('change', e => {
  setSetting("followMouseThroughMonitors", e.target.checked);
});

resizeSmallSelect.addEventListener('change', e => {
  setSetting("resizeWindowOnSmallSize", e.target.checked);
});

// Set values
fpsSlider.value = getSetting("fps");
fps.innerHTML = getSetting("fps");
followMouseSelect.checked = getSetting("followMouseThroughMonitors");
resizeSmallSelect.checked = getSetting("resizeWindowOnSmallSize");

// Apply saved settings to electron process
ipcRenderer.send("applySettings", getSetting());


// Change the videoSource window to show
async function selectSource() {

  if (stream != null) {
    console.log("Stopping prev stream");
    console.log(stream.getTracks()[0].stop());
  }

  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });

  const source = inputSources.find(src => src.display_id == display.id);

  if (!source) return;

  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        minWidth: display.workAreaSize.width,
        maxWidth: display.workAreaSize.width,
        minHeight: display.workAreaSize.height,
        maxHeight: display.workAreaSize.height
      }
    }
  };

  // Create a Stream
  stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Preview the source in a video element
  videoElement.srcObject = stream;
  videoElement.play();
}

ipcRenderer.on('cursorUpdate', async (e, newPos) => {

  if (display) {

    // Switched displays, only switch if settings is enabled
    if (newPos.display.id != display.id && getSetting("followMouseThroughMonitors")) {
      console.log("Switched display", newPos);
      display = newPos.display;
      await switchScreen();
    }

    const distanceToXBound = Math.abs(display.bounds.x - newPos.x);
    const distanceToYBound = Math.abs(display.bounds.y - newPos.y);

    const leftSpacing = clamp(
      distanceToXBound,
      rect.width / 2, // Half of the rect size, this is so the cursor can stay centered
      display.bounds.width - (rect.width / 2) // Take of half of rect size, this is so cursor stays centered
    ) * -1 // To make it a negative number
      + rect.width / 2; // To center the cursor


    const topSpacing = clamp(
      distanceToYBound,
      rect.height / 2,
      display.bounds.height - (rect.height / 2)
    ) * -1
      + rect.height / 2;

    videoElement.style.left = leftSpacing + "px";
    videoElement.style.top = topSpacing + "px";

  }
  // If display is not assinged yet       
  else if (display == null) {
    console.log("Initialized display");
    display = newPos.display;
    await switchScreen();
  }

  // If window is bigger than content, request electron to resize the window
  adjustWindowSize();

});

function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}

async function switchScreen() {

  // Wait for switching monitors to turn false
  if (switchingMonitors) await new Promise(res => () => {
    console.log("Waiting for previous switch to finish");
    switchingEmitter.once("switched", res);
  });

  switchingMonitors = true;
  videoElement.style.width = display.workAreaSize.width + "px";
  videoElement.style.height = display.workAreaSize.height + "px";
  await selectSource();

  // All done send switched event
  switchingMonitors = false;
  switchingEmitter.emit("switched");
}

function adjustWindowSize() {

  if (!display) return;

  rect = { width: window.innerWidth, height: window.innerHeight };

  // If window is bigger than content, request electron to resize the window
  if (display.workAreaSize.width < rect.width) {
    ipcRenderer.send("windowResize", { width: display.workAreaSize.width });
  }

  if (display.workAreaSize.height < rect.height) {
    ipcRenderer.send("windowResize", { height: display.workAreaSize.height });
  }
}

function getSetting(setting) {
  let settings = localStorage.getItem("settings") || {
    fps: 30,
    followMouseThroughMonitors: true,
    resizeWindowOnSmallSize: true
  };

  if (typeof settings == "string") {
    settings = JSON.parse(settings);
  }

  return setting ? settings[setting] : settings;
}

function setSetting(setting, value, electron) {

  const settings = getSetting();

  settings[setting] = value;

  localStorage.setItem("settings", JSON.stringify(settings));

  // Is an electron setting
  if (electron) {
    ipcRenderer.send("applySettings", settings);
  }
}