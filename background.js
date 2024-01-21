let extensionEnabled = false;
let disabledExtensions = [];
let initiallyEnabledExtensions = [];
let lastActiveTabId = null;
let frozenTabsCount = 0;
let disabledExtensionsCount = 0;
let activeExtensionsCount = 0;

async function getActiveExtensionsCount() {
  const extensions = await chrome.management.getAll();
  const activeExtensions = extensions.filter(
    extension => extension.enabled && extension.id !== chrome.runtime.id
  );
  return activeExtensions.length;
}

async function freezeOtherTabs(activeTabId) {
  if (!extensionEnabled) return;

  frozenTabsCount = 0;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== activeTabId && !tab.discarded) {
      await chrome.tabs.discard(tab.id);
      frozenTabsCount++;
    }
  }
  lastActiveTabId = activeTabId;
}

async function freezeTabsOnActivation() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    await freezeOtherTabs(tabs[0].id);
  }
}

async function storeInitiallyEnabledExtensions() {
  if (!extensionEnabled) return;

  const extensions = await chrome.management.getAll();
  initiallyEnabledExtensions = extensions
    .filter(
      extension => extension.enabled && extension.id !== chrome.runtime.id
    )
    .map(extension => extension.id);

  await chrome.storage.local.set({
    initiallyEnabledExtensions: initiallyEnabledExtensions,
  });
}

async function storeCurrentlyEnabledExtensions() {
  const extensions = await chrome.management.getAll();
  const currentEnabledExtensions = extensions
    .filter(
      extension => extension.enabled && extension.id !== chrome.runtime.id
    )
    .map(extension => extension.id);

  await chrome.storage.local.set({
    initiallyEnabledExtensions: currentEnabledExtensions,
  });
}

async function reloadTabIfFrozen(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.discarded) {
    await chrome.tabs.reload(tabId);
  }
}

async function deactivateOtherExtensions() {
  disabledExtensionsCount = 0;
  const extensions = await chrome.management.getAll();
  for (const extension of extensions) {
    if (extension.id !== chrome.runtime.id && extension.enabled) {
      await chrome.management.setEnabled(extension.id, false);
      disabledExtensions.push(extension.id);
      disabledExtensionsCount++;
    }
  }

  await chrome.storage.local.set({
    disabledExtensions: disabledExtensions,
    disabledExtensionsCount: disabledExtensionsCount,
  });
}

chrome.storage.onChanged.addListener(function (changes, namespace) {
  for (var key in changes) {
    if (key === 'isConversionActive') {
      var storageChange = changes[key];
      toggleExtension(storageChange.newValue);
    }
  }
});

async function toggleExtension(isActive) {
  extensionEnabled = isActive;

  if (extensionEnabled) {
    await reactivateInitiallyEnabledExtensions();
    await freezeTabsOnActivation();
  } else {
    const data = await chrome.storage.local.get('initiallyEnabledExtensions');
    if (data && data.initiallyEnabledExtensions) {
      await reactivateExtensions(data.initiallyEnabledExtensions);
    } else {
      await reactivateAllExtensions();
    }
    //await reloadFrozenTabs();
  }

  activeExtensionsCount = await getActiveExtensionsCount(); 
  console.log('Active Extensions Count:', activeExtensionsCount);
}

async function reactivateInitiallyEnabledExtensions() {
  const extensions = await chrome.management.getAll();
  for (const extensionId of initiallyEnabledExtensions) {
    await chrome.management.setEnabled(extensionId, true);
  }

  await reactivateOtherExtensions();

  const data = await chrome.storage.local.get('disabledExtensions');
  if (data && data.disabledExtensions) {
    disabledExtensions = data.disabledExtensions;
    disabledExtensionsCount = disabledExtensions.length;
    activeExtensionsCount += disabledExtensionsCount; 
  }
}

async function reactivateExtensions(extensionsToReactivate) {
  if (extensionsToReactivate && extensionsToReactivate.length > 0) {
    for (const extensionId of extensionsToReactivate) {
      await chrome.management.setEnabled(extensionId, true);
    }
  } else {
    console.log('No extensions to reactivate.');
  }

  const data = await chrome.storage.local.get('disabledExtensions');
  if (data && data.disabledExtensions) {
    disabledExtensions = data.disabledExtensions;
    disabledExtensionsCount = disabledExtensions.length;
    activeExtensionsCount += disabledExtensionsCount; 
  }
}

async function reactivateAllExtensions() {
  const extensions = await chrome.management.getAll();
  for (const extension of extensions) {
    if (
      extension.id !== chrome.runtime.id &&
      !extension.enabled &&
      !initiallyEnabledExtensions.includes(extension.id)
    ) {
      await chrome.management.setEnabled(extension.id, true);
    }
  }

  await reactivateOtherExtensions();

  
  const data = await chrome.storage.local.get('disabledExtensions');
  if (data && data.disabledExtensions) {
    disabledExtensions = data.disabledExtensions;
    disabledExtensionsCount = disabledExtensions.length;
    activeExtensionsCount += disabledExtensionsCount; 
  }
}

async function reactivateOtherExtensions() {
  const extensions = await chrome.management.getAll();
  for (const extension of extensions) {
    if (extension.id !== chrome.runtime.id && extension.enabled) {
      await chrome.management.setEnabled(extension.id, false);
      disabledExtensions.push(extension.id);
      disabledExtensionsCount++;
    }
  }

  const data = await chrome.storage.local.get('disabledExtensions');
  if (data && data.disabledExtensions) {
    disabledExtensions = data.disabledExtensions;
    disabledExtensionsCount = disabledExtensions.length;
    activeExtensionsCount += disabledExtensionsCount; 
  }
}

async function reloadFrozenTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.discarded) {
      await chrome.tabs.reload(tab.id);
    }
  }
}

chrome.tabs.onActivated.addListener(async function (activeInfo) {
  if (extensionEnabled && lastActiveTabId !== activeInfo.tabId) {
    await reloadTabIfFrozen(activeInfo.tabId);
    await freezeOtherTabs(activeInfo.tabId);
    lastActiveTabId = activeInfo.tabId;
  }
});

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  if (request.action === 'toggleButton') {
    toggleExtension(request.isActive);
    chrome.storage.local.get('initiallyEnabledExtensions', function (data) {
      let savedEnabledExtensions = [];
      if (data && data.initiallyEnabledExtensions) {
        savedEnabledExtensions = data.initiallyEnabledExtensions;
      }

      sendResponse({
        frozenTabsCount: frozenTabsCount,
        activeExtensionsCount: activeExtensionsCount,
      });
    });
    return true;
  }
});





chrome.runtime.onInstalled.addListener(function () {});
