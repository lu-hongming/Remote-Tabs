// Enhanced service worker for the Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Device Tabs Sidebar extension installed');
  
  // Initialize storage
  chrome.storage.local.set({
    expandedDevices: [],
    lastSyncTime: Date.now()
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

// Enhanced tab event listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.runtime.sendMessage({ 
      action: 'tabUpdated', 
      tab,
      timestamp: Date.now()
    }).catch(() => {
      // Ignore errors if sidebar is not open
    });
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  chrome.runtime.sendMessage({ 
    action: 'tabCreated', 
    tab,
    timestamp: Date.now()
  }).catch(() => {
    // Ignore errors if sidebar is not open
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  chrome.runtime.sendMessage({ 
    action: 'tabRemoved', 
    tabId,
    timestamp: Date.now()
  }).catch(() => {
    // Ignore errors if sidebar is not open
  });
});

// Handle window focus changes to refresh data
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.runtime.sendMessage({ 
      action: 'windowFocused',
      timestamp: Date.now()
    }).catch(() => {
      // Ignore errors if sidebar is not open
    });
  }
});