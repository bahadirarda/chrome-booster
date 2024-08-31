let extensionEnabled = false;
let disabledExtensions = [];
let lastActiveTabId = null;
let frozenTabs = new Set();
let currentWindowId = null;

chrome.windows.getCurrent({ populate: false }, function(window) {
    currentWindowId = window.id;
});

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    if (request.action === 'toggleButton') {
        await toggleExtension(request.isActive);
        updatePopupData(); 
    }
});

async function updatePopupData() {
    const activeExtensionsCount = await getActiveExtensionsCount();
    const tabs = await chrome.tabs.query({ windowId: currentWindowId });
    const frozenTabsCount = tabs.length - [...frozenTabs].filter(tabId => !tabs.some(tab => tab.id === tabId)).length;

    chrome.runtime.sendMessage({
        action: 'updatePopup',
        activeExtensionsCount: activeExtensionsCount,
        frozenTabsCount: frozenTabsCount
    });
}

async function getActiveExtensionsCount() {
    const extensions = await chrome.management.getAll();
    const activeExtensions = extensions.filter(
        extension => extension.enabled
    );
    return activeExtensions.length;
}


async function toggleExtension(isActive) {
    extensionEnabled = isActive;
    frozenTabsCount = 1;
    await chrome.storage.local.set({ extensionEnabled });

    if (extensionEnabled) {
        await freezeTabsOnActivation();
        await deactivateOtherExtensions();
    } else {
        await reactivateAllExtensions();
    }

    await updatePopupData();
    chrome.windows.update(currentWindowId);
}

async function freezeTabsOnActivation() {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: currentWindowId });
    if (activeTab) {
        await freezeOtherTabs(activeTab.id);
    }
}

async function freezeOtherTabs(activeTabId) {
    if (!extensionEnabled) return;

    const tabs = await chrome.tabs.query({ windowId: currentWindowId });
    for (const tab of tabs) {
        if (tab.id !== activeTabId && !tab.discarded) {
            await chrome.tabs.discard(tab.id);
            frozenTabs.add(tab.id);
        }
    }
    lastActiveTabId = activeTabId;
}

async function reactivateAllExtensions() {
    const extensions = await chrome.management.getAll();
    for (const extension of extensions) {
        if (extension.id !== chrome.runtime.id && !extension.enabled) {
            await chrome.management.setEnabled(extension.id, true);
        }
    }
    const data = await chrome.storage.local.get('disabledExtensions');
    if (data.disabledExtensions) {
        disabledExtensions = data.disabledExtensions;
    }
}

async function deactivateOtherExtensions() {
    const extensions = await chrome.management.getAll();
    for (const extension of extensions) {
        if (extension.id !== chrome.runtime.id && extension.enabled) {
            await chrome.management.setEnabled(extension.id, false);
            disabledExtensions.push(extension.id);
        }
    }
    await chrome.storage.local.set({ disabledExtensions });
}

chrome.tabs.onActivated.addListener(async function(activeInfo) {
    if (extensionEnabled && lastActiveTabId !== activeInfo.tabId) {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.windowId === currentWindowId) {
            await reloadTabIfFrozen(activeInfo.tabId);
            await freezeOtherTabs(activeInfo.tabId);
            lastActiveTabId = activeInfo.tabId;
        }
    }
});

async function reloadTabIfFrozen(tabId) {
    if (frozenTabs.has(tabId)) {
        await chrome.tabs.reload(tabId);
        frozenTabs.delete(tabId);
    }
}

chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({ disabledExtensions: [] });
});
