console.log('background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('ext installed');
});
