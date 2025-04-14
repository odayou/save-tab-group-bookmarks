
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
  // 根据页面所在的标签组获取标签组ID，设置为选中
  // name = group-item 的checckbox跟当前页面所属的标签组ID相同
  const groupCheckbox = document.querySelector(`input[type="checkbox"][name="group-item"][value="${groupId}"]`);
  if (groupCheckbox) {
    groupCheckbox.checked = true;
  }

  // 设置选中的标签组
  const groupCheckboxes = document.querySelectorAll(".group-checkbox:checked");
  
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

// <!-- 1. 列出所有标签组，标题展示组内有多少个标签页; 2. 支持展开具体组的内容。3.支持多选，选中的组可以保存到收藏夹的指定位置 -->
// 1. 列出所有标签组，标题展示组内有多少个标签页
let currentGroupId = null;
const groupsContainer = document.getElementById("groups");
groupsContainer.innerHTML = "";
chrome.storage.local.get("tabGroup", (result) => {
  // currentGroupId = result.tabGroup.id;
  console.log("groupId:", result.tabGroup);
  // You can now use groupId to perform further actions
})
chrome.tabs.query({}, async (tabs) => {
  const groups = await chrome.tabGroups.query({});
  for (const group of groups) {
    console.log('group',group);
    const groupTabs = tabs.filter(t => t.groupId === group.id);
    // 选中的组
    const isChecked = group.id === currentGroupId;

    const groupElement = document.createElement("div");
    groupElement.className = "group-item";
    groupElement.innerHTML = `
      <label>
        <input type="checkbox" name="group-item" checked=${isChecked} value="${group.id}" class="group-checkbox" />
        <div class="color-tag" style="background-color: ${group.color}"></div>
        <div class="group-info">
          <span class="group-title">${group.title}</span>
          <span class="tab-count">共${groupTabs.length}个页面</span>
        </div>
      </label>
    `;
    groupsContainer.appendChild(groupElement);
  }
});

// 2. 支持展开具体组的内容。
// 3.支持多选，选中的组可以保存到收藏夹的指定位置
// 4. 支持搜索过滤，输入框实时过滤
// 5. 支持设置默认保存位置，保存时可以选择是否覆盖
// 初始化时获取书签树
getBookmarkTree();