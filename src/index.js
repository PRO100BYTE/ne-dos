import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import versionGitInfo from "./versionGitInfo.json";

window['VERSION'] = `${versionGitInfo.gitBranch}/${versionGitInfo.gitCommitHash}`;
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);