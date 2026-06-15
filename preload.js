const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
    quitApp: () => ipcRenderer.send('quit-app'),
    onboardingComplete: () => ipcRenderer.send('onboarding-complete'),
    onStyleChange: (callback) => ipcRenderer.on('change-style', (event, style) => callback(style)),
    onPaletteChange: (callback) => ipcRenderer.on('change-palette', (event, palette) => callback(palette)),
    visualizerReady: () => ipcRenderer.send('visualizer-ready'),
    requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission')
});

