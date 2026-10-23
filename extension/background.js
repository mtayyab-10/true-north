// ══════════════════════════════════════════════
// TASDEEQ BROWSER EXTENSION — SERVICE WORKER
// ══════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tasdeeq Pre-Submission Quality Gate extension installed.");
});

// Listener for tab updates or potential badge updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SET_BADGE") {
    if (sender.tab && sender.tab.id) {
      const text = message.count > 0 ? String(message.count) : "";
      chrome.action.setBadgeText({ tabId: sender.tab.id, text });
      chrome.action.setBadgeBackgroundColor({
        tabId: sender.tab.id,
        color: message.isBlocked ? "#f7574f" : "#f7a94f",
      });
    }
    sendResponse({ success: true });
    return true;
  }
});
