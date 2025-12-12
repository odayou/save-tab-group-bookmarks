

// 获取书签树
async function getBookmarkTree(filter = "") {
  const tree = await chrome.bookmarks.getTree();
  const select = document.getElementById("bookmarkFolder");
  select.innerHTML = "";
  
  function traverse(nodes, prefix = "") {
    for (const node of nodes) {
      if (node.url) continue;
      if (!filter || (node.title && node.title.toLowerCase().includes(filter.toLowerCase()))) {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = prefix + node.title;
        option.title = prefix + node.title;
        option.dataset.level = prefix.split("/").length - 1;
        option.style.paddingLeft = `${option.dataset.level * 10}px`;
        
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
  
  // 设置默认文件夹
  chrome.storage.local.get("defaultFolderId", (res) => {
    if (res.defaultFolderId && select.querySelector(`option[value="${res.defaultFolderId}"]`)) {
      select.value = res.defaultFolderId;
    }
    
    // 更新默认位置文字
    updateDefaultFolderText();
  });
}

// 更新已选中分组信息
function updateSelectedGroupsInfo() {
  const selectedCheckboxes = document.querySelectorAll('input[name="group-item"]:checked');
  const infoElement = document.getElementById('selectedGroupsInfo');
  
  if (selectedCheckboxes.length === 0) {
    infoElement.style.display = 'none';
    return;
  }
  
  infoElement.style.display = 'block';
  
  if (selectedCheckboxes.length === 1) {
    // 单个选中，显示分组名称
    const groupId = selectedCheckboxes[0].value;
    const groupElement = document.querySelector(`input[name="group-item"][value="${groupId}"]`).closest('.group-item');
    const groupTitle = groupElement.querySelector('.group-title').textContent;
    infoElement.textContent = chrome.i18n.getMessage("selected_single", [groupTitle]);
  } else {
    // 多个选中，显示数量
    infoElement.textContent = chrome.i18n.getMessage("selected_multiple", [selectedCheckboxes.length.toString()]);
  }
}

// 滚动到已选中的分组
function scrollToSelectedGroup() {
  const selectedCheckbox = document.querySelector('input[name="group-item"]:checked');
  if (selectedCheckbox) {
    const groupElement = selectedCheckbox.closest('.group-item');
    const groupsContainer = document.getElementById('groups');
    
    // 计算滚动位置，确保选中的组可见
    const containerRect = groupsContainer.getBoundingClientRect();
    const elementRect = groupElement.getBoundingClientRect();
    const scrollTop = groupElement.offsetTop - groupsContainer.offsetTop - containerRect.height / 2 + elementRect.height / 2;
    
    groupsContainer.scrollTop = scrollTop;
    
    // 添加短暂的高亮效果
    groupElement.style.backgroundColor = 'rgba(0, 120, 212, 0.15)';
    setTimeout(() => {
      groupElement.style.backgroundColor = '';
    }, 1000);
  }
}

// 更新全选复选框状态
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("selectAllGroups");
  const groupCheckboxes = document.querySelectorAll('input[name="group-item"]');
  const checkedCheckboxes = document.querySelectorAll('input[name="group-item"]:checked');
  
  selectAllCheckbox.checked = groupCheckboxes.length > 0 && groupCheckboxes.length === checkedCheckboxes.length;
  
  // 更新已选中分组信息
  updateSelectedGroupsInfo();
}

// 渲染当前打开的标签组
async function renderOpenedGroups() {
  const groupsContainer = document.getElementById("groups");
  groupsContainer.innerHTML = "";
  
  const tabs = await chrome.tabs.query({});
  const groups = await chrome.tabGroups.query({});
  
  // 获取可能从右键菜单传递过来的tabGroup
  let targetGroupId = null;
  const storedGroup = await chrome.storage.local.get("tabGroup");
  if (storedGroup.tabGroup) {
    targetGroupId = storedGroup.tabGroup.id;
    // 清除存储的tabGroup，避免下次打开还被选中
    chrome.storage.local.remove("tabGroup");
  }
  
  if (groups.length === 0) {
    groupsContainer.innerHTML = `<div class="empty-state">${chrome.i18n.getMessage("no_tab_group")}</div>`;
    return;
  }
  
  for (const group of groups) {
    const groupTabs = tabs.filter(t => t.groupId === group.id);
    
    // 检查是否需要选中当前标签组
    const isChecked = targetGroupId === group.id;
    
    const groupElement = document.createElement("div");
    groupElement.className = "group-item";
    
    // 创建标签页列表HTML
    let tabsHTML = '';
    for (const tab of groupTabs) {
      if (tab.url) {
        tabsHTML += `
          <div class="tab-item">
            <a href="${tab.url}" target="_blank">${tab.title || tab.url}</a>
          </div>
        `;
      }
    }
    
    groupElement.innerHTML = `
      <div class="group-header">
        <label style="display: flex; align-items: center; width: 100%;">
          <input type="checkbox" name="group-item" value="${group.id}" class="group-checkbox" ${isChecked ? 'checked' : ''} />
          <div class="group-toggle" data-group-id="${group.id}">▶</div>
          <div class="color-tag" style="background-color: ${group.color}"></div>
          <div class="group-info">
            <span class="group-title">${group.title || chrome.i18n.getMessage("unnamed_group")}</span>
            <span class="tab-count">${chrome.i18n.getMessage("total_pages", [groupTabs.length.toString()])}</span>
          </div>
        </label>
      </div>
      <div class="tab-list" id="tab-list-${group.id}">
        ${tabsHTML}
      </div>
    `;
    
    groupsContainer.appendChild(groupElement);
  }
  
  // 绑定展开/折叠事件
  bindToggleEvents();
  
  // 重新绑定全选事件
  bindSelectAllEvent();
  
  // 更新全选复选框状态
  updateSelectAllCheckbox();
  
  // 更新已选中分组信息
  updateSelectedGroupsInfo();
  
  // 滚动到已选中的分组
  scrollToSelectedGroup();
}

// 绑定展开/折叠事件
function bindToggleEvents() {
  const toggles = document.querySelectorAll('.group-toggle');
  
  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发checkbox的点击事件
      e.preventDefault(); // 防止默认行为
      
      const groupId = toggle.dataset.groupId;
      const tabList = document.getElementById(`tab-list-${groupId}`);
      
      toggle.classList.toggle('expanded');
      tabList.classList.toggle('expanded');
    });
  });
  
  // 点击整个分组头也可以展开/折叠
  const groupHeaders = document.querySelectorAll('.group-header');
  groupHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
      // 只有当点击的不是checkbox和label时才触发展开/折叠
      if (!e.target.closest('.group-checkbox') && e.target !== header.querySelector('.group-info') && !e.target.closest('.group-info')) {
        const toggle = header.querySelector('.group-toggle');
        if (toggle) {
          toggle.click();
        }
      }
    });
  });
  
  // 确保label点击只影响checkbox，不影响展开/折叠
  const groupLabels = document.querySelectorAll('.group-item label');
  groupLabels.forEach(label => {
    label.addEventListener('click', (e) => {
      // 只有点击checkbox本身时才触发选择，其他点击不影响
      if (!e.target.closest('.group-checkbox')) {
        e.stopPropagation();
      }
    });
  });
}

// 绑定全选事件
function bindSelectAllEvent() {
  const selectAllCheckbox = document.getElementById("selectAllGroups");
  const groupCheckboxes = document.querySelectorAll('input[name="group-item"]');
  
  selectAllCheckbox.addEventListener('change', (e) => {
    groupCheckboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
    
    // 更新已选中分组信息
    updateSelectedGroupsInfo();
  });
  
  // 监听单个复选框变化，更新全选状态
  groupCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateSelectAllCheckbox();
    });
  });
}

// 生成唯一的通知ID
function generateNotificationId() {
  return `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// 创建通知元素
function createNotification(message, type = 'info') {
  const notificationId = generateNotificationId();
  const notification = document.createElement('div');
  notification.id = notificationId;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    background-color: ${type === 'warning' ? '#FFF3CD' : '#D1ECF1'};
    color: ${type === 'warning' ? '#856404' : '#0C5460'};
    border: 1px solid ${type === 'warning' ? '#FFEEBA' : '#BEE5EB'};
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-size: 14px;
    transition: all 0.3s ease;
  `;
  notification.textContent = message;
  
  // 添加关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: inherit;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    notification.remove();
  });
  notification.appendChild(closeBtn);
  
  document.body.appendChild(notification);
  
  // 自动关闭通知
  setTimeout(() => {
    if (document.getElementById(notificationId)) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.getElementById(notificationId)) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
  
  return notification;
}

// 基于标签组内容生成唯一标识
function generateGroupContentId(groupTabs) {
  // 提取所有标签的URL并排序（确保顺序不影响结果）
  const urls = groupTabs
    .filter(tab => tab.url)
    .map(tab => tab.url)
    .sort();
  
  // 生成内容ID（使用URL的哈希值）
  return urls.join('|');
}

// 异步检查标签组是否已存在于书签中
async function asyncCheckDuplicateGroup(savedFolder, groupTabs, parentId, groupTitle) {
  try {
    // 获取书签树
    const rootTree = await chrome.bookmarks.getTree();
    const currentContentId = generateGroupContentId(groupTabs);
    
    let duplicateFound = false;
    let duplicateFolder = null;
    
    // 遍历书签树，查找匹配的文件夹
    function traverseBookmarks(nodes) {
      for (const node of nodes) {
        if (node.children) {
          // 跳过刚刚创建的文件夹
          if (node.id === savedFolder.id) {
            continue;
          }
          
          // 检查是否是目标父文件夹下的子文件夹
          if (node.id === parentId || node.parentId === parentId) {
            // 检查该文件夹是否包含与当前标签组相同的内容
            const bookmarkUrls = node.children
              .filter(child => child.url)
              .map(child => child.url)
              .sort();
            
            const bookmarkContentId = bookmarkUrls.join('|');
            
            if (bookmarkContentId === currentContentId && bookmarkUrls.length > 0) {
              duplicateFound = true;
              duplicateFolder = node;
              return;
            }
          }
          
          // 递归检查子文件夹
          if (!duplicateFound) {
            traverseBookmarks(node.children);
          }
        }
      }
    }
    
    traverseBookmarks(rootTree);
    
    if (duplicateFound) {
      createNotification(
        chrome.i18n.getMessage("duplicate_warning", [groupTitle || chrome.i18n.getMessage("unnamed_group"), duplicateFolder.title]),
        'warning'
      );
    }
  } catch (error) {
    console.error('检查重复标签组失败:', error);
  }
}

// 检查标签组是否已存在于书签中
async function checkDuplicateGroup(groupTabs, parentId, groupTitle) {
  try {
    // 获取书签树
    const rootTree = await chrome.bookmarks.getTree();
    const currentContentId = generateGroupContentId(groupTabs);
    
    let duplicateFound = false;
    let duplicateFolder = null;
    
    // 遍历书签树，查找匹配的文件夹
    function traverseBookmarks(nodes) {
      for (const node of nodes) {
        if (node.children) {
          // 检查是否是目标父文件夹下的子文件夹
          if (node.id === parentId || node.parentId === parentId) {
            // 检查该文件夹是否包含与当前标签组相同的内容
            const bookmarkUrls = node.children
              .filter(child => child.url)
              .map(child => child.url)
              .sort();
            
            const bookmarkContentId = bookmarkUrls.join('|');
            
            if (bookmarkContentId === currentContentId && bookmarkUrls.length > 0) {
              duplicateFound = true;
              duplicateFolder = node;
              return;
            }
          }
          
          // 递归检查子文件夹
          if (!duplicateFound) {
            traverseBookmarks(node.children);
          }
        }
      }
    }
    
    traverseBookmarks(rootTree);
    
    return { duplicateFound, duplicateFolder };
  } catch (error) {
    console.error('检查重复标签组失败:', error);
    return { duplicateFound: false, duplicateFolder: null };
  }
}

// 保存选中的标签组
async function saveSelectedGroups() {
  // 获取所有选中的标签组
  const selectedCheckboxes = document.querySelectorAll('input[name="group-item"]:checked');
  if (selectedCheckboxes.length === 0) {
    showInlineAlert(chrome.i18n.getMessage("warning_no_groups"), "warning");
    return;
  }
  
  const selectedGroupIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
  
  // 获取所有标签和标签组
  const allTabs = await chrome.tabs.query({});
  const allGroups = await chrome.tabGroups.query({});
  
  // 获取保存配置
  const parentId = document.getElementById("bookmarkFolder").value;
  
  if (!parentId) {
    showInlineAlert(chrome.i18n.getMessage("warning_no_folder"), "warning");
    return;
  }
  
  // 设置默认文件夹
  if (document.getElementById("setDefaultFolder").checked) {
    chrome.storage.local.set({ defaultFolderId: parentId });
  }
  
  let savedCount = 0;
  let skippedCount = 0;
  
  // 保存每个选中的标签组
  for (const groupId of selectedGroupIds) {
    const group = allGroups.find(g => g.id === groupId);
    const groupTabs = allTabs.filter(t => t.groupId === groupId);
    
    // 同步检查是否已存在相同内容的标签组
    const { duplicateFound, duplicateFolder } = await checkDuplicateGroup(groupTabs, parentId, group.title);
    
    if (duplicateFound) {
      const confirmSave = confirm(chrome.i18n.getMessage("duplicate_confirm", [group.title || chrome.i18n.getMessage("unnamed_group"), duplicateFolder.title]));
      if (!confirmSave) {
        skippedCount++;
        continue; // 跳过当前标签组
      }
    }
    
    // 生成文件夹名称，直接使用标签组名称
    const folderName = group.title || `标签组 - ${new Date().toLocaleString()}`;
    
    // 创建文件夹
    const folder = await chrome.bookmarks.create({ title: folderName, parentId });
    
    // 保存标签页
    for (const tab of groupTabs) {
      if (tab.url) {
        await chrome.bookmarks.create({ 
          parentId: folder.id, 
          title: tab.title || tab.url, 
          url: tab.url 
        });
      }
    }
    
    savedCount++;
  }
  
  // 反馈结果
  let message = chrome.i18n.getMessage("save_success", [savedCount.toString()]);
  if (skippedCount > 0) {
    message += `\n${chrome.i18n.getMessage("skipped_duplicates", [skippedCount.toString()])}`;
  }
  
  showInlineAlert(message, "success");
  
  // 延迟关闭，让用户看到提示
  setTimeout(() => {
    window.close();
  }, 1500);
}



// 显示组件内提示
function showInlineAlert(message, type = 'success', duration = 3000) {
  // 创建提示元素
  const alertElement = document.createElement('div');
  alertElement.className = `inline-alert ${type}`;
  alertElement.innerHTML = `
    <span>${message}</span>
    <button style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0; margin-left: 12px;">×</button>
  `;
  
  // 添加到DOM
  const container = document.getElementById('opened-groups');
  const firstElement = container.firstElementChild;
  container.insertBefore(alertElement, firstElement);
  
  // 绑定关闭按钮事件
  const closeButton = alertElement.querySelector('button');
  closeButton.addEventListener('click', () => {
    alertElement.remove();
  });
  
  // 自动关闭
  if (duration > 0) {
    setTimeout(() => {
      alertElement.remove();
    }, duration);
  }
  
  return alertElement;
}

// 更新默认位置文字
function updateDefaultFolderText() {
  const bookmarkFolder = document.getElementById('bookmarkFolder');
  const defaultFolderText = document.getElementById('defaultFolderText');
  
  const selectedOption = bookmarkFolder.options[bookmarkFolder.selectedIndex];
  if (selectedOption) {
    const folderName = selectedOption.textContent;
    defaultFolderText.textContent = chrome.i18n.getMessage("set_default_folder", [folderName]);
  } else {
    defaultFolderText.textContent = chrome.i18n.getMessage("language_auto") === "Follow Browser" ? "Set as default location" : "设为默认保存位置";
  }
}

// 翻译所有带有data-i18n属性的元素
function translateAllElements() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const i18nKey = element.dataset.i18n;
    if (i18nKey) {
      element.textContent = chrome.i18n.getMessage(i18nKey);
    }
  });
}

// 更新UI文本
function updateUIForLanguage() {
  // 更新保存按钮文本
  document.getElementById("saveGroup").textContent = chrome.i18n.getMessage("save_button");
  
  // 更新刷新按钮文本
  document.getElementById("refreshList").textContent = chrome.i18n.getMessage("refresh_button");
  
  // 更新搜索框占位符
  document.getElementById("searchInput").placeholder = chrome.i18n.getMessage("bookmark_folder");
  
  // 更新全选文本
  document.querySelector('label[for="selectAllGroups"]').textContent = chrome.i18n.getMessage("select_all");
  
  // 更新搜索标签
  document.querySelector('label[for="searchInput"]').textContent = chrome.i18n.getMessage("search_target");
  
  // 更新选择标签
  document.querySelector('label[for="bookmarkFolder"]').textContent = chrome.i18n.getMessage("select_target");
  
  // 更新HTML中的标签文本
  document.querySelector('label[for="selectAllGroups"]').textContent = chrome.i18n.getMessage("select_all");
}

// 初始化语言设置
function initLanguage() {
  // 初始翻译
  translateAllElements();
  updateUIForLanguage();
}

// 初始化事件监听
function initEventListeners() {
  // 搜索框事件
  document.getElementById("searchInput").addEventListener("input", (e) => {
    getBookmarkTree(e.target.value);
  });
  
  // 保存按钮事件
  document.getElementById("saveGroup").addEventListener("click", saveSelectedGroups);
  
  // 刷新列表按钮事件
  document.getElementById("refreshList").addEventListener("click", renderOpenedGroups);
  
  // 书签文件夹选择变化事件
  document.getElementById("bookmarkFolder").addEventListener("change", updateDefaultFolderText);
  
  // 初始化语言
  initLanguage();
}

// 初始化
async function init() {
  initEventListeners();
  await renderOpenedGroups();
  await getBookmarkTree();
}

// 启动应用
init();