let initialExtensionCount = 0;

// Update status text based on toggle button state
function updateStatusText(isActive) {
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = isActive ? "Booster is ON" : "Booster is OFF";
    }
}

// Update date display
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

// Update UI with current tab and extension counts
function updateCounters(tabCount, extensionCount, isActive) {
    const tabCounterElement = document.querySelector('.active-tabs-counter');
    const extensionCounterElement = document.querySelector('.active-extensions');
    
    if (tabCounterElement) {
        // Ensure we always display at least 1 for tab count
        tabCounterElement.textContent = Math.max(tabCount || 0, 1);
    }
    
    if (extensionCounterElement) {
        extensionCounterElement.textContent = extensionCount || 0;
    }
    
    // Update tab label to clarify what's being shown
    const tabLabelElement = document.querySelector('.tab-label');
    if (tabLabelElement && isActive !== undefined) {
        tabLabelElement.textContent = isActive ? "Active Tab" : "Tabs";
    }
}

// Show error message
function showError(message, duration = 5000) {
    const errorElement = document.getElementById('errorMessage');
    if (!errorElement) return;
    
    errorElement.textContent = message;
    errorElement.classList.add('visible');
    
    setTimeout(() => {
        errorElement.classList.remove('visible');
    }, duration);
}

// Birleştirilmiş resource kartını güncelle
function updateResourceMetrics(data) {
    console.log("Updating resource metrics:", data);
    
    if (!data) return;
    
    // Booster durumu
    const boosterStatus = document.getElementById('boosterStatus');
    if (boosterStatus) {
        if (data.isActive) {
            boosterStatus.textContent = "Active";
            boosterStatus.classList.add('active');
        } else {
            boosterStatus.textContent = "Inactive";
            boosterStatus.classList.remove('active');
        }
    }
    
    // RAM değerleri
    const memorySavedElement = document.getElementById('memorySaved');
    const savingTypeElement = document.getElementById('savingType');
    const usedMemoryElement = document.getElementById('usedMemory');
    const totalMemoryElement = document.getElementById('totalMemory');
    const progressFill = document.getElementById('progressFill');
    
    // CPU değerleri
    const cpuUsageElement = document.getElementById('cpuUsage');
    const cpuProgressFill = document.getElementById('cpuProgressFill');
    const cpuStatusElement = document.getElementById('cpuStatus');
    const cpuModelElement = document.getElementById('cpuModel');
    
    // Resource açıklama metni
    const resourceDescription = document.getElementById('resourceDescription');
    
    // Veri normalleştirme
    const savedRam = Number(data.ramSaved) || 0;
    const potentialRam = Number(data.potentialRamSaving) || 0;
    const potentialMinRam = Number(data.potentialMin) || Math.round(potentialRam * 0.5);
    const potentialMaxRam = Number(data.potentialMax) || Math.round(potentialRam * 1.5);
    const usedRam = Number(data.usedRam) || 0;
    const totalRam = Number(data.totalRam) || 16000;
    const cpuUsage = Number(data.cpuUsage) || 0;
    const cpuStatus = data.cpuStatus || 'normal';
    const isRecentlyToggled = Boolean(data.isRecentlyToggled);
    
    // RAM değerlerini güncelle
    if (memorySavedElement) {
        if (data.isActive) {
            // Tasarruf edilen RAM miktarı
            memorySavedElement.textContent = savedRam;
            
            // RAM türü metnini güncelle
            if (savingTypeElement) {
                savingTypeElement.textContent = "saved";
            }
            
            // İyileştirme göstergesi
            if (isRecentlyToggled && savedRam < 50) {
                memorySavedElement.classList.add('optimizing');
            } else {
                memorySavedElement.classList.remove('optimizing');
            }
        } else {
            // Potansiyel tasarruf
            memorySavedElement.textContent = potentialRam;
            
            // RAM türü metnini güncelle
            if (savingTypeElement) {
                savingTypeElement.textContent = "potential";
            }
            
            memorySavedElement.classList.remove('optimizing');
            
            // Tooltip'te aralık göster
            if (!memorySavedElement.hasAttribute('title')) {
                memorySavedElement.setAttribute('title', `Range: ${potentialMinRam}-${potentialMaxRam} MB`);
            } else {
                memorySavedElement.setAttribute('title', `Range: ${potentialMinRam}-${potentialMaxRam} MB`);
            }
        }
        
        // RAM değeri değiştiğinde animasyon
        if (!memorySavedElement._lastValue || memorySavedElement._lastValue !== memorySavedElement.textContent) {
            memorySavedElement._lastValue = memorySavedElement.textContent;
            memorySavedElement.classList.remove('count-animation');
            void memorySavedElement.offsetWidth; // Reflow
            memorySavedElement.classList.add('count-animation');
        }
    }
    
    // Kullanılan ve toplam RAM gösterimi
    if (usedMemoryElement) {
        usedMemoryElement.textContent = Math.round(usedRam);
    }
    
    if (totalMemoryElement) {
        totalMemoryElement.textContent = Math.round(totalRam / 1024); // GB cinsinden
    }
    
    // RAM kullanım çubuğu
    if (progressFill) {
        const percentage = Math.min(100, Math.max(0, Math.round((usedRam / totalRam) * 100)));
        progressFill.style.width = `${percentage}%`;
    }
    
    // CPU değerlerini güncelle
    if (cpuUsageElement) {
        cpuUsageElement.textContent = Math.round(cpuUsage);
        
        // CPU değeri değiştiğinde animasyon
        if (!cpuUsageElement._lastValue || cpuUsageElement._lastValue !== cpuUsageElement.textContent) {
            cpuUsageElement._lastValue = cpuUsageElement.textContent;
            cpuUsageElement.classList.remove('count-animation');
            void cpuUsageElement.offsetWidth; // Reflow
            cpuUsageElement.classList.add('count-animation');
        }
    }
    
    // CPU çubuğunu güncelle
    if (cpuProgressFill) {
        cpuProgressFill.style.width = `${cpuUsage}%`;
        
        // CPU durumuna göre stil
        cpuProgressFill.className = 'progress-fill';
        
        if (cpuStatus === 'normal') {
            cpuProgressFill.classList.add('cpu-normal');
        } else if (cpuStatus === 'moderate') {
            cpuProgressFill.classList.add('cpu-moderate');
        } else if (cpuStatus === 'high') {
            cpuProgressFill.classList.add('cpu-high');
        } else if (cpuStatus === 'critical') {
            cpuProgressFill.classList.add('cpu-critical');
        }
    }
    
    // CPU durumu ve model
    if (cpuStatusElement) {
        cpuStatusElement.className = 'cpu-status';
        
        if (cpuStatus === 'normal') {
            cpuStatusElement.textContent = 'Normal';
            cpuStatusElement.classList.add('status-normal');
        } else if (cpuStatus === 'moderate') {
            cpuStatusElement.textContent = 'Moderate';
            cpuStatusElement.classList.add('status-moderate');
        } else if (cpuStatus === 'high') {
            cpuStatusElement.textContent = 'High';
            cpuStatusElement.classList.add('status-high');
        } else {
            cpuStatusElement.textContent = 'Critical';
            cpuStatusElement.classList.add('status-critical');
        }
    }
    
    // CPU model bilgisi
    if (cpuModelElement && data.cpuModel) {
        // CPU model ismini kısalt (eğer çok uzunsa)
        let modelText = data.cpuModel;
        
        // Çok uzun modellerde kısaltma yap
        if (modelText.length > 25) {
            // Sadece ilk kısmı göster ve kısalt
            modelText = modelText.split(' ').slice(0, 4).join(' ') + '...';
        }
        
        cpuModelElement.textContent = modelText;
        
        // Çekirdek sayısını ekle
        if (data.cpuCores && data.cpuCores > 0) {
            cpuModelElement.textContent += ` (${data.cpuCores} cores)`;
        }
        
        // Tam model bilgisini tooltip olarak göster
        if (data.cpuModel) {
            cpuModelElement.setAttribute('title', data.cpuModel);
        }
    }
    
    // Resource açıklama metni güncelle
    if (resourceDescription) {
        if (data.isActive) {
            // Booster açıkken
            if (savedRam > 50) {
                const percentSaved = Math.round((savedRam / (usedRam + savedRam)) * 100);
                if (percentSaved > 5) {
                    resourceDescription.textContent = `${percentSaved}% less RAM usage with Booster`;
                } else {
                    resourceDescription.textContent = "Chrome performance optimized";
                }
            } else if (isRecentlyToggled) {
                resourceDescription.textContent = "Optimizing system resources...";
            } else {
                resourceDescription.textContent = "Chrome performance optimized";
            }
        } else {
            // Booster kapalıyken
            if (potentialRam > 0 && usedRam > 0) {
                const percentPotential = Math.min(30, Math.round((potentialRam / usedRam) * 100));
                resourceDescription.textContent = `Save up to ${percentPotential}% RAM with Booster`;
            } else {
                resourceDescription.textContent = "Optimize Chrome's performance";
            }
        }
    }
}

// İstisna tabları arasında geçiş yap
function setupExceptionsTabs() {
    const tabButtons = document.querySelectorAll('.exception-tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktif tab butonunu güncelle
            document.querySelectorAll('.exception-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // İlgili içeriği göster
            const target = button.dataset.target;
            document.querySelectorAll('.exception-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(target).classList.add('active');
        });
    });
}

// Sekme istisnalarını yükle
async function loadTabExclusions() {
    try {
        // Mevcut istisnaları storage'dan al
        const data = await chrome.storage.local.get('tabExclusions');
        const tabExclusions = data.tabExclusions || [];
        
        // Tüm sekmeleri al
        const tabs = await chrome.tabs.query({});
        
        // Tab options container'ını temizle
        const tabOptions = document.getElementById('tab-options');
        const selectedTabs = document.getElementById('selected-tabs');
        
        if (!tabOptions || !selectedTabs) return;
        
        tabOptions.innerHTML = '';
        selectedTabs.innerHTML = '';
        
        // Seçili sayısını güncelle
        updateSelectionCount('tab-selection-count', tabExclusions.length);
        
        // Tabs yoksa mesaj göster
        if (tabs.length === 0) {
            tabOptions.innerHTML = '<div class="loading-placeholder">No tabs found</div>';
            return;
        }
        
        // Sekmeleri ekle
        tabs.forEach(tab => {
            // Seçenek oluştur
            const tabOption = document.createElement('div');
            tabOption.className = 'selection-option';
            if (tabExclusions.includes(tab.id)) {
                tabOption.classList.add('selected');
            }
            
            tabOption.dataset.id = tab.id;
            
            tabOption.innerHTML = `
                <div class="selection-checkbox"></div>
                <div class="selection-label" title="${tab.title || ''}">${tab.title?.substring(0, 50) || 'Unnamed Tab'}</div>
            `;
            
            // Seçime tıklama
            tabOption.addEventListener('click', () => {
                tabOption.classList.toggle('selected');
                updateSelectedTabs();
            });
            
            tabOptions.appendChild(tabOption);
            
            // Eğer seçiliyse chip ekle
            if (tabExclusions.includes(tab.id)) {
                addSelectedChip('tab', tab.id, tab.title?.substring(0, 50) || 'Unnamed Tab');
            }
        });
    } catch (error) {
        console.error('Error loading tab exclusions:', error);
        const tabOptions = document.getElementById('tab-options');
        if (tabOptions) {
            tabOptions.innerHTML = '<div class="loading-placeholder">Error loading tabs</div>';
        }
    }
}

// Uzantı istisnalarını yükle
async function loadExtensionExclusions() {
    try {
        // Mevcut istisnaları storage'dan al
        const data = await chrome.storage.local.get('extensionExclusions');
        const extensionExclusions = data.extensionExclusions || [];
        
        // Tüm uzantıları al
        const extensions = await chrome.management.getAll();
        
        // Extension options container'ını temizle
        const extensionOptions = document.getElementById('extension-options');
        const selectedExtensions = document.getElementById('selected-extensions');
        
        if (!extensionOptions || !selectedExtensions) return;
        
        extensionOptions.innerHTML = '';
        selectedExtensions.innerHTML = '';
        
        // Seçili sayısını güncelle
        updateSelectionCount('ext-selection-count', extensionExclusions.length);
        
        // Uzantı yoksa mesaj göster
        const filteredExtensions = extensions.filter(ext => ext.type !== 'theme' && ext.id !== chrome.runtime.id);
        if (filteredExtensions.length === 0) {
            extensionOptions.innerHTML = '<div class="loading-placeholder">No extensions found</div>';
            return;
        }
        
        // Uzantıları ekle
        filteredExtensions.sort((a, b) => a.name.localeCompare(b.name)).forEach(ext => {
            // Seçenek oluştur
            const extOption = document.createElement('div');
            extOption.className = 'selection-option';
            if (extensionExclusions.includes(ext.id)) {
                extOption.classList.add('selected');
            }
            
            extOption.dataset.id = ext.id;
            
            extOption.innerHTML = `
                <div class="selection-checkbox"></div>
                <div class="selection-label" title="${ext.description || ''}">${ext.name}</div>
            `;
            
            // Seçime tıklama
            extOption.addEventListener('click', () => {
                extOption.classList.toggle('selected');
                updateSelectedExtensions();
            });
            
            extensionOptions.appendChild(extOption);
            
            // Eğer seçiliyse chip ekle
            if (extensionExclusions.includes(ext.id)) {
                addSelectedChip('extension', ext.id, ext.name);
            }
        });
    } catch (error) {
        console.error('Error loading extension exclusions:', error);
        const extensionOptions = document.getElementById('extension-options');
        if (extensionOptions) {
            extensionOptions.innerHTML = '<div class="loading-placeholder">Error loading extensions</div>';
        }
    }
}

// İstisnaları kaydet
async function saveExclusions() {
    try {
        // Tab istisnaları
        const tabSelect = document.getElementById('tab-exclusion-select');
        const selectedTabs = Array.from(tabSelect.selectedOptions).map(option => Number(option.value));
        
        // Uzantı istisnaları
        const extensionSelect = document.getElementById('extension-exclusion-select');
        const selectedExtensions = Array.from(extensionSelect.selectedOptions).map(option => option.value);
        
        // Storage'a kaydet
        await chrome.storage.local.set({
            tabExclusions: selectedTabs,
            extensionExclusions: selectedExtensions
        });
        
        // Background script'e haber ver (istisnalar güncellendi)
        chrome.runtime.sendMessage({ 
            action: "updateExclusions",
            tabExclusions: selectedTabs,
            extensionExclusions: selectedExtensions
        });
        
        // Kaydetme başarılı mesajı göster
        const saveBtn = document.getElementById('save-exceptions');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
        
        // 2 saniye sonra geri döndür
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
        }, 2000);
    } catch (error) {
        console.error('Error saving exclusions:', error);
        showError("Failed to save exclusions");
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(message) {
    console.log("Message received in popup:", message);
    
    if (!message || !message.action) return;
    
    if (message.action === "updatePopup") {
        updateStatusText(message.isActive);
        updateCounters(message.tabCount, message.extensionCount, message.isActive);
        updateResourceMetrics(message);
    } else if (message.action === "showError") {
        showError(message.message);
    }
});

// Toggle booster functionality
async function toggleFunctionality(isActive) {
    // Show the spinner on the rocket icon
    const rocketContainer = document.querySelector('.rocket-container');
    if (rocketContainer) {
        rocketContainer.classList.add('loading');
    }
    
    try {
        // Update UI immediately for responsiveness
        updateStatusText(isActive);
        
        // Update tab label immediately for better UX
        const tabLabelElement = document.querySelector('.tab-label');
        if (tabLabelElement) {
            tabLabelElement.textContent = isActive ? "Active Tab" : "Tabs";
        }
        
        console.log("Sending toggle command to background:", isActive); // Debug log
        
        // Send toggle command to background script
        const response = await chrome.runtime.sendMessage({ 
            action: "toggleButton", 
            isActive: isActive 
        });
        
        console.log("Toggle response:", response); // Debug log
        
        // Update storage
        await chrome.storage.local.set({ 'isConversionActive': isActive });
        
        // If toggle failed, revert UI and show error
        if (response && !response.success) {
            console.error('Error toggling booster:', response.error);
            
            // Show error message to user
            showError(response.errorMessage || "Failed to toggle booster");
            
            // Revert toggle button state
            const toggleButton = document.getElementById('toggleButton');
            if (toggleButton) {
                toggleButton.checked = !isActive;
                updateStatusText(!isActive);
                
                // Revert tab label too
                if (tabLabelElement) {
                    tabLabelElement.textContent = !isActive ? "Active Tab" : "Tabs";
                }
            }
        }
        
        // Get current state to update counters
        await refreshState();
    } catch (error) {
        console.error('Error in toggle functionality:', error);
        showError("Could not communicate with the extension");
    } finally {
        // Remove the spinner after a short delay to make it visible
        setTimeout(() => {
            if (rocketContainer) {
                rocketContainer.classList.remove('loading');
            }
        }, 800); // Biraz daha uzun süre gösterelim (500ms yerine 800ms)
    }
}

// Get current state from background script - Return state for further processing
async function refreshState() {
    try {
        console.log("Requesting state from background");
        const state = await chrome.runtime.sendMessage({ action: "getState" });
        console.log("Received state from background:", state);
        
        if (state && !state.error) {
            updateStatusText(state.isActive);
            updateCounters(state.tabCount, state.extensionCount, state.isActive);
            updateResourceMetrics(state);
            return state;
        }
    } catch (error) {
        console.error('Error getting state:', error);
        // Hata durumunda varsayılan değerlerle güncelleme
        updateResourceMetrics({ 
            isActive: false, 
            ramSaved: 0, 
            potentialRamSaving: 30,
            potentialMin: 20,
            potentialMax: 60,
            usedRam: 7000,
            totalRam: 16000,
            cpuUsage: 0,
            cpuStatus: 'normal',
            cpuModel: "Loading CPU info..."
        });
    }
    return null;
}

// Initialize popup when loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Popup loaded, initializing..."); // Debug log
    updateDate();
    
    // Set up toggle button
    const toggleButton = document.getElementById('toggleButton');
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            toggleFunctionality(toggleButton.checked);
        });
        
        // Get initial state
        try {
            const data = await chrome.storage.local.get(['isConversionActive', 'extensionEnabled']);
            // Use either key that might be present (for backward compatibility)
            const isActive = !!(data.isConversionActive || data.extensionEnabled);
            toggleButton.checked = isActive;
            updateStatusText(isActive);
            
            console.log("Initial state loaded:", { isActive }); // Debug log
            
            // Başlangıçta RAM metnini doğru ayarla
            const savingTypeElement = document.getElementById('savingType');
            if (savingTypeElement) {
                savingTypeElement.textContent = isActive ? "saved" : "potential";
            }
        } catch (error) {
            console.error('Error retrieving state:', error);
            toggleButton.checked = false;
            updateStatusText(false);
            
            // Hata durumunda da RAM metnini ayarla
            const savingTypeElement = document.getElementById('savingType');
            if (savingTypeElement) {
                savingTypeElement.textContent = "potential";
            }
        }
    }

    // Setup timer buttons
    const timerInput = document.getElementById('timerMinutes');
    const startTimerBtn = document.getElementById('startTimerButton');
    const presetButtons = document.querySelectorAll('.preset-btn');

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mins = btn.dataset.minutes;
            if (timerInput) {
                timerInput.value = mins;
            }
        });
    });

    if (startTimerBtn) {
        startTimerBtn.addEventListener('click', () => {
            const minutes = parseInt(timerInput.value, 10) || 1;
            chrome.runtime.sendMessage({ action: 'activateTimedFreeze', duration: minutes }, (response) => {
                if (!response || !response.success) {
                    showError('Failed to start timer');
                }
            });
        });
    }
    
    // Initialize counters with fallback values in case getState fails
    updateCounters(1, 0, false);
    
    // Initialize resource metrics with fallback values
    updateResourceMetrics({ 
        isActive: false, 
        ramSaved: 0, 
        potentialRamSaving: 30,
        potentialMin: 20,
        potentialMax: 60,
        usedRam: 7000,
        totalRam: 16000,
        cpuUsage: 0,
        cpuStatus: 'normal',
        cpuModel: "Loading CPU info..."
    });
    
    // Get initial counts
    await refreshState();
    
    // Popup açıldığında otomatik olarak güncel durumu iste
    refreshState();
    
    // Her 5 saniyede bir popup'ı güncelleme
    const popupUpdateInterval = setInterval(() => {
        refreshState();
    }, 5000);
    
    // Popup kapatıldığında timer'ı temizle
    window.addEventListener('beforeunload', () => {
        clearInterval(popupUpdateInterval);
    });
    
    // Booster aktif ve yoğun izleme modundaysa daha sık güncelleme
    refreshState().then(state => {
        if (state && state.isActive && state.isRecentlyToggled) {
            console.log("Resource intensive monitoring active, updating every 3 seconds");
            
            // Daha sık güncelleme (her 3 saniyede bir)
            const intensiveInterval = setInterval(() => {
                refreshState();
            }, 3000);
            
            // 30 saniye sonra intensive izlemeyi kapat
            setTimeout(() => {
                clearInterval(intensiveInterval);
            }, 30000);
        }
    });
    
    // İstisna tabları için event listener'ları ayarla
    setupExceptionsTabs();
    
    // İstisnaları yükle
    await loadTabExclusions();
    await loadExtensionExclusions();
    
    // Kaydet butonu için event listener
    const saveBtn = document.getElementById('save-exceptions');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveExclusions);
    }
    
    // Dropdown'ları ayarla
    setupDropdowns();

    // Setup tooltips to appear above modals
    setupTooltips();
});

// Dropdown işlemleri
function setupDropdowns() {
    const triggers = document.querySelectorAll('.dropdown-trigger');
    
    // Backdrop ekleme (dropdown dışına tıklandığında kapanması için)
    const backdrop = document.createElement('div');
    backdrop.className = 'dropdown-backdrop';
    document.body.appendChild(backdrop);
    
    // Tüm dropdown trigger'ları için
    triggers.forEach(trigger => {
        const dropdownId = trigger.dataset.dropdown;
        const dropdown = document.getElementById(dropdownId);
        
        // Dropdown trigger'a tıklandığında
        trigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Event'in yayılmasını engelle
            
            // Diğer açık dropdown'ları kapat
            document.querySelectorAll('.dropdown-trigger.active').forEach(active => {
                if (active !== trigger) {
                    active.classList.remove('active');
                }
            });
            
            // Bu dropdown'ı aç/kapat
            trigger.classList.toggle('active');
            
            // Backdrop'ı göster/gizle
            backdrop.classList.toggle('active', trigger.classList.contains('active'));
            
            // Dropdown açıldığında ilgili verileri yükle
            if (trigger.classList.contains('active')) {
                if (dropdownId === 'tab-dropdown') {
                    loadTabExclusions();
                } else if (dropdownId === 'ext-dropdown') {
                    loadExtensionExclusions();
                }
            }
        });
    });
    
    // Backdrop'a tıklandığında tüm dropdown'ları kapat
    backdrop.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-trigger.active').forEach(active => {
            active.classList.remove('active');
        });
        backdrop.classList.remove('active');
    });
    
    // Kaydetme butonlarına tıklanma olaylarını ekle
    const saveTabExclusionsBtn = document.getElementById('save-tab-exclusions');
    if (saveTabExclusionsBtn) {
        saveTabExclusionsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Event'in yayılmasını engelle
            saveTabExclusions(saveTabExclusionsBtn);
        });
    }
    
    const saveExtensionExclusionsBtn = document.getElementById('save-extension-exclusions');
    if (saveExtensionExclusionsBtn) {
        saveExtensionExclusionsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Event'in yayılmasını engelle
            saveExtensionExclusions(saveExtensionExclusionsBtn);
        });
    }
}

// Tab istisnalarını kaydet
async function saveTabExclusions(button) {
    try {
        const selectedOptions = document.querySelectorAll('#tab-options .selection-option.selected');
        const selectedTabs = Array.from(selectedOptions).map(option => Number(option.dataset.id));
        
        // Storage'a kaydet
        await chrome.storage.local.set({
            tabExclusions: selectedTabs
        });
        
        // Background script'e haber ver
        chrome.runtime.sendMessage({ 
            action: "updateExclusions",
            tabExclusions: selectedTabs
        });
        
        // Kaydedildi animasyonu göster
        showSaveSuccess(button);
    } catch (error) {
        console.error('Error saving tab exclusions:', error);
        showError("Failed to save tab exclusions");
    }
}

// Extension istisnalarını kaydet
async function saveExtensionExclusions(button) {
    try {
        const selectedOptions = document.querySelectorAll('#extension-options .selection-option.selected');
        const selectedExtensions = Array.from(selectedOptions).map(option => option.dataset.id);
        
        // Storage'a kaydet
        await chrome.storage.local.set({
            extensionExclusions: selectedExtensions
        });
        
        // Background script'e haber ver
        chrome.runtime.sendMessage({ 
            action: "updateExclusions",
            extensionExclusions: selectedExtensions
        });
        
        // Kaydedildi animasyonu göster
        showSaveSuccess(button);
    } catch (error) {
        console.error('Error saving extension exclusions:', error);
        showError("Failed to save extension exclusions");
    }
}

// Kaydedildi animasyonu
function showSaveSuccess(button) {
    const originalText = button.textContent;
    button.textContent = 'Saved!';
    button.classList.add('saved');
    
    // 2 saniye sonra geri döndür
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('saved');
    }, 2000);
}

// Arama filtresi
function filterOptions(containerId, searchTerm) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const options = container.querySelectorAll('.selection-option');
    searchTerm = searchTerm.toLowerCase();
    
    options.forEach(option => {
        const text = option.querySelector('.selection-label').textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            option.style.display = 'flex';
        } else {
            option.style.display = 'none';
        }
    });
}

// Seçili chip ekle - improved version
function addSelectedChip(type, id, label) {
    const container = type === 'tab' ? document.getElementById('selected-tabs') : document.getElementById('selected-extensions');
    if (!container) return;
    
    // Check if chip already exists
    const existingChip = container.querySelector(`.selected-chip[data-id="${id}"]`);
    if (existingChip) return;
    
    const chip = document.createElement('div');
    chip.className = 'selected-chip';
    chip.dataset.id = id;
    chip.title = label; // Add tooltip for long names
    
    // Truncate text if too long
    const truncatedLabel = label.length > 20 ? label.substring(0, 18) + '...' : label;
    
    chip.innerHTML = `
        <span class="chip-label">${truncatedLabel}</span>
        <span class="chip-remove">&times;</span>
    `;
    
    // Kaldırma butonuna tıklama
    const removeBtn = chip.querySelector('.chip-remove');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Removal animation
        chip.style.opacity = '0';
        chip.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            // İlgili seçeneği bul ve seçimi kaldır
            const options = type === 'tab' ? document.querySelectorAll('#tab-options .selection-option') : 
                                           document.querySelectorAll('#extension-options .selection-option');
            
            options.forEach(option => {
                if (option.dataset.id == id) {
                    option.classList.remove('selected');
                }
            });
            
            // Chip'i kaldır
            chip.remove();
            
            // Seçimleri güncelle
            if (type === 'tab') {
                updateSelectedTabs();
            } else {
                updateSelectedExtensions();
            }
        }, 200);
    });
    
    // Appearance animation
    chip.style.opacity = '0';
    chip.style.transform = 'scale(0.8)';
    container.appendChild(chip);
    
    // Trigger reflow and animate in
    void chip.offsetWidth;
    chip.style.opacity = '1';
    chip.style.transform = 'scale(1)';
}

// Seçili tab güncelleme
function updateSelectedTabs() {
    const selectedOptions = document.querySelectorAll('#tab-options .selection-option.selected');
    const selectedTabsContainer = document.getElementById('selected-tabs');
    
    if (!selectedTabsContainer) return;
    
    // Önce tüm chip'leri temizle
    selectedTabsContainer.innerHTML = '';
    
    // Seçili sekmeleri ekle
    selectedOptions.forEach(option => {
        const id = Number(option.dataset.id);
        const label = option.querySelector('.selection-label').textContent;
        addSelectedChip('tab', id, label);
    });
    
    // Seçili sayısını güncelle
    updateSelectionCount('tab-selection-count', selectedOptions.length);
}

// Seçili extension güncelleme
function updateSelectedExtensions() {
    const selectedOptions = document.querySelectorAll('#extension-options .selection-option.selected');
    const selectedExtContainer = document.getElementById('selected-extensions');
    
    if (!selectedExtContainer) return;
    
    // Önce tüm chip'leri temizle
    selectedExtContainer.innerHTML = '';
    
    // Seçili uzantıları ekle
    selectedOptions.forEach(option => {
        const id = option.dataset.id;
        const label = option.querySelector('.selection-label').textContent;
        addSelectedChip('extension', id, label);
    });
    
    // Seçili sayısını güncelle
    updateSelectionCount('ext-selection-count', selectedOptions.length);
}

// Seçim sayısını güncelle
function updateSelectionCount(elementId, count) {
    const countElement = document.getElementById(elementId);
    if (countElement) {
        countElement.textContent = `${count} selected`;
    }
}

// Handle tooltips to ensure they appear above modals
function setupTooltips() {
    const helpIcons = document.querySelectorAll('.help-icon');
    
    helpIcons.forEach(icon => {
        const tooltip = icon.querySelector('.tooltip');
        if (tooltip) {
            // Create a clone of the tooltip that will be appended to the body
            const tooltipClone = tooltip.cloneNode(true);
            tooltipClone.classList.add('tooltip-clone');
            tooltipClone.style.display = 'none';
            document.body.appendChild(tooltipClone);
            
            // Add event listeners for hover
            icon.addEventListener('mouseenter', () => {
                const rect = icon.getBoundingClientRect();
                
                tooltipClone.style.position = 'fixed';
                tooltipClone.style.left = (rect.left - 200) + 'px'; // Adjust based on tooltip width
                tooltipClone.style.top = (rect.bottom + 10) + 'px';
                tooltipClone.style.display = 'block';
                tooltipClone.style.zIndex = '999999';
                tooltipClone.style.opacity = '1';
                tooltipClone.style.visibility = 'visible';
                tooltipClone.style.pointerEvents = 'auto';
            });
            
            icon.addEventListener('mouseleave', () => {
                tooltipClone.style.display = 'none';
                tooltipClone.style.opacity = '0';
                tooltipClone.style.visibility = 'hidden';
            });
        }
    });
}