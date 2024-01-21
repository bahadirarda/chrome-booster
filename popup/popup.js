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
    const formattedDate = currentDate.toLocaleDateString('en-GB', {
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric'
    });
    document.querySelector('.date').textContent = formattedDate;
}

// Sekme ve uzantı sayısını güncelleyen fonksiyon
function updateTabAndExtensionCount() {
    chrome.tabs.query({}, function(tabs) {
        document.querySelector('.active-tabs-counter').textContent = tabs.length;
    });

    chrome.management.getAll(function(extensions) {
        const enabledExtensions = extensions.filter(extension => extension.enabled && extension.id !== chrome.runtime.id);
        document.querySelector('.active-extensions').textContent = enabledExtensions.length;
    });
}

// Toggle butonu durumuna göre işlevsellik ekleyen fonksiyon
function toggleFunctionality(isActive) {
    // Booster'ın durumunu chrome.storage'da güncelle
    chrome.storage.local.set({ 'isConversionActive': isActive });

    chrome.runtime.sendMessage({ action: "toggleButton", toggleState: isActive }, function(response) {
        updateTabAndExtensionCount();
    });
    updateStatusText(isActive);
}


// Popup yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleButton');

    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            toggleFunctionality(toggleButton.checked);
        }, false);

    }

    // Chrome Storage'dan mevcut durumu al ve güncelle
    chrome.storage.local.get('isConversionActive', function(data) {
        if (toggleButton) {
            toggleButton.checked = data.isConversionActive || false;
            updateStatusText(toggleButton.checked);
        }
    });

    updateDate();
    updateTabAndExtensionCount();
});