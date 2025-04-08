async function getBookmarkTree(filter = "") {
  const tree = await chrome.bookmarks.getTree();
  console.log('tree',tree);
  const select = document.getElementById("bookmarkFolder");
  select.innerHTML = "";
  function traverse(nodes, prefix = "") {
    for (const node of nodes) {
      if (node.url) continue;
      if (!filter || (node.title && node.title.toLowerCase().includes(filter.toLowerCase()))) {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = prefix + node.title;
        // title
        option.title = prefix + node.title;
        option.dataset.level = prefix.split("/").length - 1;
        option.style.paddingLeft = `${option.dataset.level * 10}px`;
        option.style.color = node.children ? "#000" : "#999";
        option.style.fontWeight = node.children ? "bold" : "normal";
        option.style.display = node.children ? "block" : "none";
        // 悬浮高亮
        option.addEventListener("mouseover", () => {
          option.style.backgroundColor = "#f0f0f0";
        });
        option.addEventListener("mouseout", () => {
          option.style.backgroundColor = "";
        });
        if (node.children) {
          const childCount = node.children.length;
          option.textContent += ` (${childCount})`;
        }
        // if (node.children && node.children.length > 0) {
        //   const childOption = document.createElement("option");
        //   childOption.value = node.id;
        //   childOption.textContent = "Loading...";
        //   childOption.style.display = "none";
        //   select.appendChild(childOption);
        // }

        select.appendChild(option);
      }
      if (node.children) traverse(node.children, prefix + node.title + " / ");
    }
  }
  traverse(tree);
  chrome.storage.local.get("defaultFolderId", (res) => {
    if (res.defaultFolderId && select.querySelector(`option[value="${res.defaultFolderId}"]`)) {
      select.value = res.defaultFolderId;
    }
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  getBookmarkTree(e.target.value);
});

document.getElementById("saveGroup").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const groupId = tab.groupId;
  if (groupId === -1) return alert("此标签页未加入任何标签组");

  const group = await chrome.tabGroups.get(groupId);
  const groupTabs = (await chrome.tabs.query({})).filter(t => t.groupId === groupId);
  const nameInput = document.getElementById("folderName").value.trim();
  const folderName = nameInput || group.title || ("标签组 - " + new Date().toLocaleString());
  const parentId = document.getElementById("bookmarkFolder").value;

  if (document.getElementById("setDefaultFolder").checked) {
    chrome.storage.local.set({ defaultFolderId: parentId });
  }

  const folder = await chrome.bookmarks.create({ title: folderName, parentId });
  for (const t of groupTabs) {
    await chrome.bookmarks.create({ parentId: folder.id, title: t.title, url: t.url });
  }
  alert("标签组已添加到收藏夹！");
  // 关闭弹窗
  window.close();
  // // 关闭标签组
  // await chrome.tabGroups.update(groupId, { collapsed: true });
  // // 移除标签组
  // await chrome.tabGroups.remove(groupId);
});

getBookmarkTree();