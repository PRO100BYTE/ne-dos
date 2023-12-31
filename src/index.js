import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import versionGitInfo from "./versionGitInfo.json";
const BrowserFS = require("browserfs");

window['VERSION'] = `${versionGitInfo.gitBranch}/${versionGitInfo.gitCommitHash}`;
window['BUILD_DATE'] = versionGitInfo.date;

BrowserFS.install(window);
BrowserFS.configure({
  fs: "MountableFileSystem",
  options: {
    "/": {
      fs: "AsyncMirror",
      options: {
        sync: { fs: "InMemory" },
        async: {
          fs: "IndexedDB",
          options: {
            storeName: "NEDOS"
          }
        }
      }
    },
    "/temp": {
      fs: "InMemory"
    }
  }
}, () => {
  window.fs = window.require("fs");
  window.path = window.require("path");

  setTimeout(() => {
    try {
      window.fs.writeFileSync(`/temp/host`, window.location.host);
    } catch (e) {
    }

    try {
      window.fs.writeFileSync(`/temp/language`, window.navigator.language);
    } catch (e) {
    }
    
    try {
      window.fs.writeFileSync(`/temp/user-agent`, window.navigator.userAgent);
    } catch (e) {
    }
    
    try {
      window.fs.writeFileSync(`/temp/user-agent.json`, JSON.stringify(window.navigator.userAgentData, null, 2));
    } catch (e) {
    }
    

    try {
      const { downlink, effectiveType, rtt, saveData } = navigator.connection;
      window.fs.writeFileSync(`/temp/connection`, JSON.stringify({ downlink, effectiveType, rtt, saveData }, null, 2));
    } catch (e) {}
  }, 100);

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <App />
  );
})
