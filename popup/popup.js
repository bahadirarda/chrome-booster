let initialExtensionCount = 0;

// Toggle butonunun durumuna göre statü metnini güncelleyen fonksiyon
function updateStatusText(isActive) {
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = isActive ? "Booster is ON" : "Booster is OFF";
    }
}

// Tarihi güncelleyen fonksiyon
function updateDate() {
    const currentDate = new Date();
    const weekday = currentDate.toLocaleDateString('en-GB', { weekday: 'long' });
    const date = currentDate.toLocaleDateString('en-GB', {
        day: 'numeric', 
        month: 'long', 
        year: 'numeric'
    });

    const weekdayElement = document.querySelector('.weekday');
    const dateElement = document.querySelector('.date');

    if (weekdayElement) {
        weekdayElement.textContent = weekday;
    }

    if (dateElement) {
        dateElement.textContent = date;
    }
}



// Sekme ve uzantı sayısını güncelleyen fonksiyon
async function updateTabAndExtensionCount() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabCounterElement = document.querySelector('.active-tabs-counter');
    if (tabCounterElement) {
        tabCounterElement.textContent = tabs.length;
    }

    const extensionCounterElement = document.querySelector('.active-extensions');
    if (extensionCounterElement) {
        extensionCounterElement.textContent = initialExtensionCount;
    }
}

// Arka plandan gelen mesajları dinleyen fonksiyon
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "updatePopup") {
        const { activeExtensionsCount, frozenTabsCount } = message;
        const extensionCounterElement = document.querySelector('.active-extensions');
        const tabCounterElement = document.querySelector('.active-tabs-counter');

        if (extensionCounterElement) {
            extensionCounterElement.textContent = activeExtensionsCount;
        }
        if (tabCounterElement) {
            tabCounterElement.textContent = frozenTabsCount;
        }
    }
});

// Toggle butonu durumuna göre işlevsellik ekleyen fonksiyon
async function toggleFunctionality(isActive) {
    // Booster'ın durumunu chrome.storage'da güncelle
    chrome.storage.local.set({ 'isConversionActive': isActive }, function() {
        if (chrome.runtime.lastError) {
            console.error('Error setting isConversionActive:', chrome.runtime.lastError);
        }
    });

    chrome.runtime.sendMessage({ action: "toggleButton", isActive: isActive }, async function(response) {
        if (chrome.runtime.lastError) {
            // console.error('Error sending message:', chrome.runtime.lastError);
        }
        
        // Booster kapalıysa uzantı sayısını başlangıçtaki değerden güncelle
        if (!isActive) {
            updateTabAndExtensionCount();
        }
    });

    updateStatusText(isActive);
}

// Popup yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', async function() {
    const toggleButton = document.getElementById('toggleButton');


    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            const isActive = toggleButton.checked;
            toggleFunctionality(isActive);
        });

        // Chrome Storage'dan mevcut durumu al ve güncelle
        chrome.storage.local.get('isConversionActive', function(data) {
            if (data && data.isConversionActive !== undefined) {
                toggleButton.checked = data.isConversionActive;
                updateStatusText(toggleButton.checked);
            } else if (chrome.runtime.lastError) {
                console.error('Error retrieving isConversionActive:', chrome.runtime.lastError);
            }
        });
    }


    // Başlangıçta mevcut aktif uzantı sayısını al ve sakla
    const extensions = await chrome.management.getAll();
    initialExtensionCount = extensions.filter(extension => extension.enabled && extension.id !== chrome.runtime.id).length;

    updateDate();
    updateTabAndExtensionCount();
});
