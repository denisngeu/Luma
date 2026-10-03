const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumaDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: '0.3.5',
  flashTaskbar: () => ipcRenderer.send('luma:flash-frame'),
  minimize: () => ipcRenderer.send('luma:minimize'),
  maximize: () => ipcRenderer.send('luma:maximize'),
  close: () => ipcRenderer.send('luma:close'),
  isMaximized: () => ipcRenderer.invoke('luma:is-maximized'),
});
