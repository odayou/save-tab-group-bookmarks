chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-tab-group",
    title: "将标签组添加到收藏夹",
    contexts: ["action", "page"],
    // 图标
  //  icons: {
  //    "16": "icon.png",
  //    "32": "icon.png",
  //    "48": "icon.png",
  //    "128": "icon.png"
  //  }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-tab-group") {
    if (tab.groupId !== -1) {
      chrome.action.openPopup();
    }
  }
});
