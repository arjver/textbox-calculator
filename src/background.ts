// console.log('background script loaded');

chrome.runtime.onInstalled.addListener(() => {
  // console.log('extension installed');
});


chrome.runtime.onConnect.addListener((port) => {
  // console.log('content script connected:', port);
});

// TODO this one shouldn't be needed, leave it just in case though?