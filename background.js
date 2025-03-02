// Resource Manager modülünü içe aktar (RAM ve CPU izleme için tek API)
import ResourceManager from './modules/resource-manager.js';

let extensionEnabled = false;
let disabledExtensions = [];
let lastActiveTabId = null;
let frozenTabs = new Set();
let currentWindowId = null;

// Kaynak izleme durumu için değişken
let isResourceReadingActive = false;

let tabExclusions = []; // Dondurulmayacak sekme ID'leri listesi
let extensionExclusions = []; // Devre dışı bırakılmayacak uzantı ID'leri listesi

// Initialize state from storage on startup
async function initializeState() {
    try {
        const data = await chrome.storage.local.get([
            'extensionEnabled', 
            'isConversionActive', 
            'disabledExtensions', 
            'frozenTabs',
            'tabExclusions',
            'extensionExclusions'
        ]);
        
        // Support both storage keys for backward compatibility
        extensionEnabled = !!(data.extensionEnabled || data.isConversionActive) || false;
        disabledExtensions = data.disabledExtensions || [];
        tabExclusions = data.tabExclusions || [];
        extensionExclusions = data.extensionExclusions || [];
        
        if (data.frozenTabs) {
            try {
                frozenTabs = new Set(JSON.parse(data.frozenTabs));
                
                // Donmuş tabları Resource Manager'a bildir
                ResourceManager.updateFrozenTabs(frozenTabs);
            } catch (e) {
                frozenTabs = new Set();
            }
        }
    } catch (err) {
        console.error("Error initializing state:", err);
    }
}

// Initialize current window
chrome.windows.getCurrent({ populate: false }, function(window) {
    if (window) {
        currentWindowId = window.id;
        initializeState().then(() => {
            if (extensionEnabled) {
                // Re-apply settings if extension was enabled
                chrome.tabs.query({ active: true, windowId: currentWindowId }, async (tabs) => {
                    if (tabs && tabs.length > 0) {
                        lastActiveTabId = tabs[0].id;
                        await validateFrozenTabs();
                    }
                });
            }
            
            // Başlangıçta Resource Manager'ı başlat
            ResourceManager.initialize();
        });
    }
});

// Bu eklentiyi yükleyen Chrome versiyonunu al
chrome.runtime.getPlatformInfo(function(info) {
    console.log("Platform:", info.os);
    console.log("Chrome Arch:", info.arch);
    
    // Chrome sürüm bilgisi
    const userAgent = navigator.userAgent;
    const chromeVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || "unknown";
    console.log("Chrome Version:", chromeVersion);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Check if request is valid
    if (!request || typeof request !== 'object') {
        sendResponse({ success: false, errorMessage: "Invalid request" });
        return false;
    }
    
    if (request.action === 'toggleButton') {
        toggleExtension(request.isActive)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error("Toggle error:", error);
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    errorMessage: "Could not toggle some extensions. Chrome may require manual re-enabling."
                });
            });
        return true; // Keep the message channel open for async response
    } else if (request.action === 'getState') {
        // Send current state to popup
        getStateData()
            .then(state => {
                sendResponse(state);
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true; // Keep the message channel open
    } else if (request.action === 'updateExclusions') {
        // İstisnaları güncelle
        tabExclusions = request.tabExclusions || [];
        extensionExclusions = request.extensionExclusions || [];
        
        // Eğer Booster aktifse, dondurulmuş sekmeleri kontrol et
        if (extensionEnabled) {
            applyExclusions();
        }
        
        sendResponse({ success: true });
        return true;
    }
    
    return false;
});

// Get current state for popup
async function getStateData() {
    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        const activeExtensions = await getActiveExtensionsCount();
        
        // Count actual tabs (excluding ones that have been closed)
        await validateFrozenTabs();
        
        // If booster is on, we only have 1 active tab (the current one)
        // Otherwise, all tabs are active
        const activeTabCount = extensionEnabled ? 1 : tabs.length;
        
        // Resource Manager'dan sistem kaynak durumunu al
        const resources = await ResourceManager.getResourceState(extensionEnabled);
        
        // Sistem bellek bilgileri
        const systemUsedRAM = resources.memory.used;
        const systemTotalRAM = resources.memory.total;
        
        // Tasarruf edilen RAM 
        const ramSaved = resources.memory.saved;
        
        // Potansiyel tasarruf
        const potentialSaving = resources.memory.potentialSavings.avg;
        const potentialMin = resources.memory.potentialSavings.min;
        const potentialMax = resources.memory.potentialSavings.max;
        
        // CPU kullanımı
        const cpuUsage = resources.cpu.usage;
        const cpuStatus = resources.cpu.status;
        
        // Return data for popup
        return {
            isActive: extensionEnabled,
            tabCount: Math.max(activeTabCount, 1),
            totalTabCount: Math.max(tabs.length, 1),
            extensionCount: Math.max(activeExtensions, 0),
            frozenTabCount: frozenTabs.size,
            ramSaved,
            potentialRamSaving: potentialSaving,
            potentialMin,
            potentialMax,
            totalRam: systemTotalRAM,
            usedRam: systemUsedRAM,
            systemUsedRam: systemUsedRAM,
            cpuUsage,
            cpuCores: resources.cpu.cores || 1,
            cpuModel: resources.cpu.model || "Unknown CPU",
            cpuStatus,
            cpuCoreUsage: resources.cpu.coreUsage || [],
            isRecentlyToggled: isResourceReadingActive
        };
    } catch (error) {
        console.error("Error getting state data:", error);
        return {
            isActive: extensionEnabled,
            tabCount: 1,
            totalTabCount: 1,
            extensionCount: 0,
            frozenTabCount: 0,
            ramSaved: 0,
            potentialRamSaving: 200,
            potentialMin: 100,
            potentialMax: 500,
            totalRam: 16000,
            usedRam: 8000,
            systemUsedRam: 8000,
            cpuUsage: 0,
            cpuCores: 1,
            cpuModel: "Unknown CPU",
            cpuStatus: 'normal',
            cpuCoreUsage: [],
            isRecentlyToggled: false
        };
    }
}

// Validate frozen tabs (remove tabs that no longer exist)
async function validateFrozenTabs() {
    if (frozenTabs.size === 0) return frozenTabs;
    
    try {
        const allTabs = await chrome.tabs.query({});
        const allTabIds = new Set(allTabs.map(tab => tab.id));
        
        // Remove tab IDs that no longer exist
        for (const tabId of frozenTabs) {
            if (!allTabIds.has(tabId)) {
                frozenTabs.delete(tabId);
            }
        }
        
        // Save updated frozen tabs
        await chrome.storage.local.set({ 
            frozenTabs: JSON.stringify(Array.from(frozenTabs))
        });
        
        // Resource Manager'a güncel donmuş tab listesini bildir
        ResourceManager.updateFrozenTabs(frozenTabs);
        
        return frozenTabs;
    } catch (error) {
        console.error("Error validating frozen tabs:", error);
        return frozenTabs;
    }
}

// Update popup with current state if it's open
async function updatePopupData() {
    try {
        const state = await getStateData();
        
        // Skip sending if we don't have a valid state
        if (!state) return;
        
        chrome.runtime.sendMessage({
            action: 'updatePopup',
            ...state
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    } catch (error) {
        console.error("Error updating popup:", error);
    }
}

// Send error message to popup if it's open
function sendErrorToPopup(message) {
    try {
        chrome.runtime.sendMessage({
            action: 'showError',
            message: message
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    } catch (error) {
        // Ignore errors when popup is closed
    }
}

// Get count of enabled extensions
async function getActiveExtensionsCount() {
    try {
        const extensions = await chrome.management.getAll();
        return extensions.filter(ext => ext.enabled && ext.id && ext.type !== 'theme').length;
    } catch (error) {
        console.error("Error getting extensions:", error);
        return 0;
    }
}

// Main toggle function
async function toggleExtension(isActive) {
    extensionEnabled = isActive;
    await chrome.storage.local.set({ 
        extensionEnabled,
        isConversionActive: isActive
    });
    
    if (isActive) {
        // Sekmeleri ve uzantıları dondur
        await freezeTabsOnActivation();
        try {
            await deactivateOtherExtensions();
        } catch (error) {
            console.error("Failed to disable some extensions:", error);
        }
    } else {
        try {
            // Uzantıları tekrar aktifleştir
            await reactivateAllExtensions();
            
            // Booster kapatıldığında tüm donmuş sekmeleri temizle
            await cleanupFrozenTabs();
        } catch (error) {
            console.error("Failed to enable some extensions:", error);
            sendErrorToPopup("Some extensions may need to be enabled manually.");
        }
    }
    
    // RAM ve CPU etkisini yoğun izle
    startIntensiveResourceMonitoring(isActive);
    
    // İlk durumu gönder
    await updatePopupData();
}

// Booster kapatıldığında donmuş sekmeleri temizle
async function cleanupFrozenTabs() {
    try {
        // Tüm donmuş sekmeleri temizle
        frozenTabs.clear();
        
        // Storage'ı güncelle
        await chrome.storage.local.set({
            frozenTabs: JSON.stringify(Array.from(frozenTabs))
        });
        
        // Resource Manager'a güncel donmuş tab listesini bildir
        ResourceManager.updateFrozenTabs(frozenTabs);
        
        console.log("All frozen tabs cleaned up successfully");
        return true;
    } catch (error) {
        console.error("Error cleaning up frozen tabs:", error);
        return false;
    }
}

// Yoğun kaynak izlemesi başlat (toggle sonrası için)
function startIntensiveResourceMonitoring(isBoosterActive) {
    isResourceReadingActive = true;
    
    // Booster kapatıldığında tab sayısını hemen güncelleyelim
    if (!isBoosterActive) {
        // Hemen bir güncelleme yapalım
        updatePopupData();
    }
    
    // Resource Manager'ın yoğun izleme modunu kullan
    ResourceManager.startIntensiveMonitoring(isBoosterActive, async (resourceData) => {
        // Her ölçüm sonrası popup'ı güncelle
        await updatePopupData();
        
        // Ölçüm sonuçlarını debug için logla
        console.log(`Resource Monitoring:`, {
            ram: {
                used: resourceData.memory.state.usedMemory,
                saved: resourceData.memory.saved
            },
            cpu: {
                usage: resourceData.cpu.usage.average,
                status: resourceData.cpu.status
            }
        });
    });
    
    // 30 saniye sonra normal moda dön
    setTimeout(() => {
        isResourceReadingActive = false;
        updatePopupData(); // Son bir güncelleme daha yap
    }, 30000);
}

// Freeze tabs when extension is activated
async function freezeTabsOnActivation() {
    try {
        const tabs = await chrome.tabs.query({ active: true, windowId: currentWindowId });
        if (tabs && tabs.length > 0) {
            lastActiveTabId = tabs[0].id;
            await freezeOtherTabs(tabs[0].id);
        }
    } catch (error) {
        console.error("Error freezing tabs on activation:", error);
    }
}

// Freeze all tabs except the active one
async function freezeOtherTabs(activeTabId) {
    if (!extensionEnabled || !activeTabId) return;

    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        if (!tabs || !Array.isArray(tabs)) return;
        
        for (const tab of tabs) {
            // Don't discard active tab, pinned tabs, or already discarded tabs
            // Ayrıca istisna listesindeki sekmeleri de atla
            if (tab && tab.id && tab.id !== activeTabId && !tab.pinned && !tab.discarded &&
               !tabExclusions.includes(tab.id)) {
                try {
                    await chrome.tabs.discard(tab.id);
                    frozenTabs.add(tab.id);
                } catch (e) {
                    console.error(`Failed to discard tab ${tab.id}:`, e);
                }
            }
        }
        
        // Save the list of frozen tabs
        await chrome.storage.local.set({
            frozenTabs: JSON.stringify(Array.from(frozenTabs))
        });
        
        // Resource Manager'a donmuş tab listesini bildir
        ResourceManager.updateFrozenTabs(frozenTabs);
        
        lastActiveTabId = activeTabId;
    } catch (error) {
        console.error("Error freezing other tabs:", error);
    }
}

// Reactivate all disabled extensions
async function reactivateAllExtensions() {
    const errors = [];
    
    try {
        // Get the list of extensions we disabled
        const data = await chrome.storage.local.get('disabledExtensions');
        const extensionsToEnable = Array.isArray(data.disabledExtensions) ? data.disabledExtensions : [];
        
        for (const extensionId of extensionsToEnable) {
            if (!extensionId) continue;
            
            try {
                await chrome.management.setEnabled(extensionId, true);
            } catch (e) {
                console.error(`Failed to enable extension ${extensionId}:`, e);
                errors.push(e);
                // Continue with other extensions
            }
        }
        
        // Clear the list of disabled extensions
        disabledExtensions = [];
        await chrome.storage.local.set({ disabledExtensions: [] });
        
        if (errors.length > 0) {
            throw new Error(`Failed to enable ${errors.length} extensions`);
        }
    } catch (error) {
        console.error("Error reactivating extensions:", error);
        throw error; // Re-throw to notify caller
    }
}

// Disable all extensions except this one
async function deactivateOtherExtensions() {
    try {
        const extensions = await chrome.management.getAll();
        if (!extensions || !Array.isArray(extensions)) return;
        
        disabledExtensions = [];
        
        for (const extension of extensions) {
            // Skip this extension, themes, already disabled extensions and excluded extensions
            if (extension && extension.id && 
                extension.id !== chrome.runtime.id && 
                extension.type !== 'theme' && 
                extension.enabled &&
                !extensionExclusions.includes(extension.id)) {
                try {
                    await chrome.management.setEnabled(extension.id, false);
                    disabledExtensions.push(extension.id);
                } catch (e) {
                    console.error(`Failed to disable extension ${extension.id}:`, e);
                }
            }
        }
        
        await chrome.storage.local.set({ disabledExtensions });
    } catch (error) {
        console.error("Error deactivating extensions:", error);
    }
}

// İstisnaları uygula
async function applyExclusions() {
    // Sekme istisnalarını uygula
    for (const tabId of tabExclusions) {
        // Eğer bu sekme donmuşsa, canlandır
        if (frozenTabs.has(tabId)) {
            try {
                await chrome.tabs.reload(tabId);
                frozenTabs.delete(tabId);
            } catch (e) {
                console.error(`Failed to reload excluded tab ${tabId}:`, e);
            }
        }
    }
    
    // Frozen tabs'i güncelle
    await chrome.storage.local.set({
        frozenTabs: JSON.stringify(Array.from(frozenTabs))
    });
    
    // Resource Manager'a güncel donmuş tab listesini bildir
    ResourceManager.updateFrozenTabs(frozenTabs);
    
    // Uzantı istisnalarını uygula - devre dışı bırakılmış uzantılardan istisna olanları aktifleştir
    for (const extId of extensionExclusions) {
        if (disabledExtensions.includes(extId)) {
            try {
                await chrome.management.setEnabled(extId, true);
                // Devre dışı bırakılmış uzantılar listesinden çıkar
                disabledExtensions = disabledExtensions.filter(id => id !== extId);
            } catch (e) {
                console.error(`Failed to enable excluded extension ${extId}:`, e);
            }
        }
    }
    
    // Devre dışı bırakılmış uzantıları güncelle
    await chrome.storage.local.set({ disabledExtensions });
    
    // Popup'ı güncelle
    await updatePopupData();
}

// Handle tab switching
chrome.tabs.onActivated.addListener(async function(activeInfo) {
    if (!activeInfo || !activeInfo.tabId) return;
    
    // Eğer booster aktif değilse hiçbir şey yapma
    if (!extensionEnabled) return;
    
    // Booster aktif ve farklı bir sekmeye geçilmişse
    if (lastActiveTabId !== activeInfo.tabId) {
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (tab && tab.windowId === currentWindowId) {
                await reloadTabIfFrozen(activeInfo.tabId);
                await freezeOtherTabs(activeInfo.tabId);
                lastActiveTabId = activeInfo.tabId;
                await updatePopupData();
            }
        } catch (error) {
            console.error("Error handling tab activation:", error);
        }
    }
});

// Reload tab if it was frozen
async function reloadTabIfFrozen(tabId) {
    if (!tabId || !frozenTabs.has(tabId)) return;
    
    try {
        await chrome.tabs.reload(tabId);
        frozenTabs.delete(tabId);
        await chrome.storage.local.set({
            frozenTabs: JSON.stringify(Array.from(frozenTabs))
        });
    } catch (error) {
        console.error(`Error reloading tab ${tabId}:`, error);
    }
}

// Handle tab removal
chrome.tabs.onRemoved.addListener(async function(tabId) {
    if (!tabId) return;
    
    if (frozenTabs.has(tabId)) {
        frozenTabs.delete(tabId);
        await chrome.storage.local.set({
            frozenTabs: JSON.stringify(Array.from(frozenTabs))
        });
        
        // Resource Manager'a güncel donmuş tab listesini bildir
        ResourceManager.updateFrozenTabs(frozenTabs);
    }
    
    await updatePopupData();
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({ 
        disabledExtensions: [],
        extensionEnabled: false,
        isConversionActive: false,
        frozenTabs: '[]',
        tabExclusions: [],
        extensionExclusions: []
    });
    
    // RAM ve CPU takibini başlat
    ResourceManager.initialize();
});

// Uzantı başlatıldığında bellek takibini başlat
chrome.runtime.onStartup.addListener(() => {
    ResourceManager.initialize();
});