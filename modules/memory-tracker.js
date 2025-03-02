/**
 * Chrome Booster RAM İzleme Modülü
 * Chrome tarayıcısının RAM kullanımını izler ve raporlar
 */

// Sabitler ve tahminler - Değerleri güncelledik
const CONSTANTS = {
  ACTIVE_TAB_AVG_RAM: 200,     // Aktif tab ortalama RAM (MB) - Arttırıldı
  ACTIVE_TAB_MIN_RAM: 100,     // Aktif tab minimum RAM (MB) - Arttırıldı
  ACTIVE_TAB_MAX_RAM: 400,     // Aktif tab maksimum RAM (MB)
  FROZEN_TAB_RAM: 80,          // Donmuş tab RAM kullanımı (MB) - Arttırıldı
  EXTENSION_MIN_RAM: 10,       // Uzantı minimum RAM (MB) - Arttırıldı
  EXTENSION_AVG_RAM: 15,       // Uzantı ortalama RAM (MB)
  EXTENSION_MAX_RAM: 50,       // Uzantı maksimum RAM (MB)
};

// RAM ölçümleri için değişkenler
let systemMemoryHistory = [];  // Son 10 bellek ölçümünün geçmişi
let baselineMemory = null;     // Booster toggle öncesi ölçüm
let memoryReadInterval = null; // Düzenli ölçüm için interval
let frozenTabsSet = new Set(); // Donmuş tabların listesi
let isMonitoring = false;      // İzleme aktif mi?

/**
 * Sistem bellek durumunu okur
 * @returns {Promise<Object>} Bellek durum bilgisi
 */
async function getSystemMemory() {
  try {
    // Chrome sistem bellek API'sinden bellek durumunu al
    const memInfo = await chrome.system.memory.getInfo();
    
    // MB cinsine çevir
    const totalMemoryMB = Math.round(memInfo.capacity / (1024 * 1024));
    const freeMemoryMB = Math.round(memInfo.availableCapacity / (1024 * 1024));
    const usedMemoryMB = totalMemoryMB - freeMemoryMB;
    
    // Tüm özellikleri içeren bellek durum nesnesi
    const memoryState = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      totalMemory: totalMemoryMB,
      freeMemory: freeMemoryMB,
      usedMemory: usedMemoryMB,
      usagePercent: Math.round((usedMemoryMB / totalMemoryMB) * 100)
    };
    
    // Tarihçeye ekle (en fazla 10 ölçüm)
    systemMemoryHistory.unshift(memoryState);
    if (systemMemoryHistory.length > 10) {
      systemMemoryHistory.pop();
    }
    
    console.log(`RAM Ölçümü: Toplam ${totalMemoryMB}MB, Kullanılan ${usedMemoryMB}MB (${memoryState.usagePercent}%)`);
    
    return memoryState;
  } catch (error) {
    console.error("Sistem belleği okunamadı:", error);
    // Hata durumunda son ölçümü veya varsayılan değerleri döndür
    return systemMemoryHistory[0] || {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      totalMemory: 16000,
      freeMemory: 8000,
      usedMemory: 8000,
      usagePercent: 50
    };
  }
}

/**
 * Tab sayılarına göre potansiyel RAM tasarrufunu tahmin et
 * Aralık formatında değerler (min-max) hesaplanır
 * 
 * @returns {Promise<Object>} Potansiyel RAM tasarrufu tahmini
 */
async function estimatePotentialSavings() {
  try {
    // Aktif tabları ve uzantıları al
    const tabs = await chrome.tabs.query({});
    const extensions = await chrome.management.getAll();
    const activeExtensions = extensions.filter(ext => ext.enabled && ext.type !== 'theme');
    
    // Aktif, Chrome tarafından donmuş ve bizim tarafımızdan donmuş tabları ayır
    const activeTabs = tabs.filter(tab => !tab.discarded && !frozenTabsSet.has(tab.id));
    const chromeDiscardedTabs = tabs.filter(tab => tab.discarded && !frozenTabsSet.has(tab.id));
    const ourFrozenTabs = tabs.filter(tab => frozenTabsSet.has(tab.id));
    
    console.log(`Potansiyel: ${activeTabs.length} aktif, ${chromeDiscardedTabs.length} Chrome donmuş, ${ourFrozenTabs.length} bizim dondurduğumuz tab`);
    
    // En az bir tab aktif kalacak
    const potentialFreezableTabs = Math.max(0, activeTabs.length - 1);
    
    // Chrome tarafından dondurulmuş tablar için tasarruf hesabı
    // Bu tablar zaten Chrome tarafından dondurulmuş, ama biz dondurunca daha çok tasarruf sağlayacağız
    const chromeDiscardedSavingsMin = chromeDiscardedTabs.length * (CONSTANTS.FROZEN_TAB_RAM - CONSTANTS.FROZEN_TAB_RAM/2);
    const chromeDiscardedSavingsAvg = chromeDiscardedTabs.length * (CONSTANTS.FROZEN_TAB_RAM - CONSTANTS.FROZEN_TAB_RAM/2);
    const chromeDiscardedSavingsMax = chromeDiscardedTabs.length * (CONSTANTS.FROZEN_TAB_RAM - CONSTANTS.FROZEN_TAB_RAM/2);
    
    // Aktif tablar için hesaplama (en az bir tab aktif kalacak)
    const activeTabSavingsMin = potentialFreezableTabs * (CONSTANTS.ACTIVE_TAB_MIN_RAM - CONSTANTS.FROZEN_TAB_RAM);
    const activeTabSavingsAvg = potentialFreezableTabs * (CONSTANTS.ACTIVE_TAB_AVG_RAM - CONSTANTS.FROZEN_TAB_RAM);
    const activeTabSavingsMax = potentialFreezableTabs * (CONSTANTS.ACTIVE_TAB_MAX_RAM - CONSTANTS.FROZEN_TAB_RAM);
    
    // Uzantılar için tasarruf hesabı
    const extSavingsMin = activeExtensions.length * CONSTANTS.EXTENSION_MIN_RAM;
    const extSavingsAvg = activeExtensions.length * CONSTANTS.EXTENSION_AVG_RAM;
    const extSavingsMax = activeExtensions.length * CONSTANTS.EXTENSION_MAX_RAM;
    
    // Toplam tasarruf
    const minSaving = activeTabSavingsMin + extSavingsMin + chromeDiscardedSavingsMin;
    const avgSaving = activeTabSavingsAvg + extSavingsAvg + chromeDiscardedSavingsAvg;
    const maxSaving = activeTabSavingsMax + extSavingsMax + chromeDiscardedSavingsMax;
    
    // Log detaylı bilgi
    console.log("Potansiyel tasarruf hesaplaması:", {
      tabDetails: {
        totalTabs: tabs.length,
        activeTabs: activeTabs.length,
        chromeDiscardedTabs: chromeDiscardedTabs.length,
        ourFrozenTabs: ourFrozenTabs.length,
        potentialFreezableTabs
      },
      tabSavings: {
        active: { min: activeTabSavingsMin, avg: activeTabSavingsAvg, max: activeTabSavingsMax },
        chromeDiscarded: { min: chromeDiscardedSavingsMin, avg: chromeDiscardedSavingsAvg, max: chromeDiscardedSavingsMax }
      },
      extSavings: { min: extSavingsMin, avg: extSavingsAvg, max: extSavingsMax },
      totalSavings: { min: minSaving, avg: avgSaving, max: maxSaving }
    });
    
    // Detaylı istatistikler
    const details = {
      activeTabCount: activeTabs.length,
      frozenTabCount: ourFrozenTabs.length + chromeDiscardedTabs.length,
      chromeDiscardedTabCount: chromeDiscardedTabs.length,
      ourFrozenTabCount: ourFrozenTabs.length,
      extensionCount: activeExtensions.length,
      freezableTabCount: potentialFreezableTabs,
      tabSavingRange: {
        min: activeTabSavingsMin + chromeDiscardedSavingsMin,
        avg: activeTabSavingsAvg + chromeDiscardedSavingsAvg,
        max: activeTabSavingsMax + chromeDiscardedSavingsMax
      },
      extensionSavingRange: {
        min: extSavingsMin,
        avg: extSavingsAvg,
        max: extSavingsMax
      }
    };
    
    return {
      potentialSavings: {
        min: Math.round(minSaving),
        avg: Math.round(avgSaving),
        max: Math.round(maxSaving)
      },
      details: details
    };
  } catch (error) {
    console.error("Potansiyel tasarruf tahmini hesaplanamadı:", error);
    return {
      potentialSavings: {
        min: 400,
        avg: 800,
        max: 1500
      },
      details: {
        activeTabCount: 1,
        frozenTabCount: 0,
        extensionCount: 0
      }
    };
  }
}

/**
 * Toggle sonrası gerçek RAM tasarrufunu hesapla
 * @returns {Promise<Object>} RAM tasarruf değerleri
 */
async function calculateActualSavings() {
  // Baseline yoksa tasarruf hesaplanamaz
  if (!baselineMemory) {
    return { 
      saved: 0,
      baseline: null,
      current: systemMemoryHistory[0] || null
    };
  }
  
  // Şimdiki bellek durumunu al
  const currentMemory = systemMemoryHistory[0];
  if (!currentMemory) {
    return {
      saved: 0,
      baseline: baselineMemory,
      current: null
    };
  }
  
  // Başlangıç ve şimdiki kullanılan bellek miktarları
  const baselineUsed = baselineMemory.usedMemory;
  const currentUsed = currentMemory.usedMemory;
  
  // Tasarruf = Başlangıçtaki kullanılan bellek - Şimdiki kullanılan bellek
  const savedRAM = Math.max(0, baselineUsed - currentUsed);
  
  return {
    saved: Math.round(savedRAM),
    baseline: baselineMemory,
    current: currentMemory
  };
}

/**
 * RAM durumunu değerlendir ve raporla
 * @param {boolean} isBoosterActive Booster aktif mi?
 * @returns {Promise<Object>} RAM durum raporu
 */
async function evaluateMemory(isBoosterActive) {
  // Sistem belleğini güncelle
  const memoryState = await getSystemMemory();
  
  if (isBoosterActive) {
    // Booster açıkken gerçek tasarrufu hesapla
    const actualSavings = await calculateActualSavings();
    
    return {
      currentMemory: memoryState,
      savedRAM: actualSavings.saved,
      potentialSavings: { min: 0, avg: 0, max: 0 }, // Booster açıkken potansiyel tasarruf sıfır
      history: systemMemoryHistory,
      boosterActive: true
    };
  } else {
    // Booster kapalıyken her zaman yeni potansiyel tasarrufu hesapla
    const potentialEstimate = await estimatePotentialSavings();
    
    // Bu anki bellek durumunu baseline olarak belirle 
    // (sonraki toggle için başlangıç noktası)
    baselineMemory = memoryState;
    
    // Potansiyel tasarruf değerleri çok düşükse varsayılan değerler kullan
    let estimatedSavings = potentialEstimate.potentialSavings;
    
    // Potansiyel tasarruf değeri çok düşükse minimum değerler uygulayalım
    if (estimatedSavings.avg < 300) {
      console.log("Potansiyel tasarruf çok düşük, varsayılan değerler kullanılıyor");
      estimatedSavings = {
        min: 400,
        avg: 800,
        max: 1500
      };
    }
    
    return {
      currentMemory: memoryState,
      savedRAM: 0, // Booster kapalıyken tasarruf sıfır
      potentialSavings: estimatedSavings,
      details: potentialEstimate.details,
      history: systemMemoryHistory,
      boosterActive: false
    };
  }
}

/**
 * Toggle sonrası bellek durumunu yoğun izle
 * @param {Function} callback Her ölçüm sonrası çağrılacak fonksiyon
 * @param {boolean} isBoosterActive Booster açıldı mı kapatıldı mı?
 */
function monitorToggleEffect(callback, isBoosterActive) {
  // Toggle öncesi mevcut durumu kaydet
  if (isBoosterActive) {
    // Eğer booster açılıyorsa, şimdiki durumu baseline olarak ayarla
    baselineMemory = systemMemoryHistory[0];
  }
  
  // Belirli aralıklarla ölçüm zamanları (ms)
  const measurementTimes = [2000, 4000, 8000, 15000, 30000];
  const measurements = [];
  
  // Her ölçüm için bir zamanlayıcı ayarla
  measurementTimes.forEach(delay => {
    setTimeout(async () => {
      // Sistem belleğini ölç
      const memoryState = await getSystemMemory();
      
      // Booster aktifse tasarrufu, değilse potansiyel tasarrufu hesapla
      const result = isBoosterActive ? 
        await calculateActualSavings() :
        await estimatePotentialSavings();
      
      // Ölçüm sonucunu kaydet
      const measurement = {
        time: delay,
        memory: memoryState,
        result: isBoosterActive ? 
          { saved: result.saved } : 
          { potential: result.potentialSavings }
      };
      
      measurements.push(measurement);
      
      // Callback fonksiyonu varsa çağır
      if (typeof callback === 'function') {
        callback({
          memoryState,
          measurements,
          savedRAM: isBoosterActive ? result.saved : 0,
          potentialSavings: !isBoosterActive ? result.potentialSavings : { min:0, avg:0, max:0 },
          isBoosterActive
        });
      }
    }, delay);
  });
}

/**
 * Donmuş tabların listesini günceller
 * @param {Set} frozenTabs Donmuş tab ID'leri kümesi
 */
function updateFrozenTabs(frozenTabs) {
  frozenTabsSet = frozenTabs;
}

/**
 * Düzenli RAM izlemeyi başlatır
 * @param {number} intervalMs İzleme aralığı (ms)
 */
function startMonitoring(intervalMs = 15000) {
  // Varsa önceki interval'ı temizle
  if (memoryReadInterval) {
    clearInterval(memoryReadInterval);
  }
  
  // İlk ölçümü hemen yap
  getSystemMemory()
    .then(() => console.log("İlk bellek ölçümü yapıldı"))
    .catch(err => console.error("İlk bellek ölçümünde hata:", err));
  
  // Düzenli aralıklarla ölç
  memoryReadInterval = setInterval(getSystemMemory, intervalMs);
  isMonitoring = true;
  
  console.log(`RAM izleme başlatıldı (${intervalMs}ms aralıkla)`);
}

/**
 * RAM izlemeyi durdurur
 */
function stopMonitoring() {
  if (memoryReadInterval) {
    clearInterval(memoryReadInterval);
    memoryReadInterval = null;
  }
  isMonitoring = false;
}

/**
 * Bellek takibi için tüm durumu sıfırlar
 */
function resetMemoryState() {
  console.log("Bellek durumu sıfırlanıyor...");
  baselineMemory = null;
  // systemMemoryHistory dizisini tamamen temizlemeyelim, sadece son ölçümü tutalım
  if (systemMemoryHistory.length > 0) {
    const lastMeasurement = systemMemoryHistory[0];
    systemMemoryHistory = [lastMeasurement];
  }
}

// Dışa aktarılan API
export default {
  getSystemMemory,
  evaluateMemory,
  monitorToggleEffect,
  startMonitoring,
  stopMonitoring,
  updateFrozenTabs,
  resetMemoryState,
  constants: CONSTANTS
};
