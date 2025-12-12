// 初始化时创建菜单项，但默认隐藏
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-tab-group",
    title: chrome.i18n.getMessage("context_menu_save"),
    contexts: ["action", "page","page_action","browser_action","frame","all"],
    visible: false,
  });
});


// 点击右键时，如果当前页面不属于标签组，则隐藏菜单项
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.groupId !== -1) {
    chrome.contextMenus.update("save-tab-group", { visible: true });
  } else {
    chrome.contextMenus.update("save-tab-group", { visible: false });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-tab-group") {
    if (tab.groupId !== -1) {
      // groupId传到popup.js
      const group = await chrome.tabGroups.get(tab.groupId);
      // tabGroup对象传到popup.js
      chrome.storage.local.set({ tabGroup: group });
      chrome.action.openPopup();
    }
  }
});
