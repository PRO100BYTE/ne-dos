import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import versionGitInfo from "./versionGitInfo.json";
const BrowserFS = require("browserfs");

window['VERSION'] = `${versionGitInfo.gitBranch}/${versionGitInfo.gitCommitHash}`;

BrowserFS.install(window);
BrowserFS.configure({
  fs: "LocalStorage",
  options: {
    storeName: "NEDOS"
  }
}, () => {
  window.fs = window.require("fs");
  window.path = window.require("path");

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <App />
  );
})
