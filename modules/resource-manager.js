/**
 * Chrome Booster Resource Manager Modülü
 * RAM ve CPU kaynaklarını izler ve yönetir
 */

// Memory Tracker ve CPU Tracker modüllerini içe aktar
import MemoryTracker from './memory-tracker.js';
import CpuTracker from './cpu-tracker.js';

// Resource durumu için durumlar
const ResourceStatus = {
  INACTIVE: 'inactive',
  MONITORING: 'monitoring',
  OPTIMIZING: 'optimizing',
  OPTIMIZED: 'optimized'
};

// Modül durumu
let status = ResourceStatus.INACTIVE;
let isInitialized = false;
let isBoosterActive = false;
let frozenTabs = new Set();

// Son hesaplamalar
let lastResourceData = {
  memory: null,
  cpu: null,
  potentialSavings: null,
  savedResources: 0,
  timestamp: 0
};

/**
 * Kaynak izleyiciyi başlat
 */
async function initialize() {
  if (isInitialized) return;
  
  // RAM ve CPU izlemeyi başlat
  await MemoryTracker.startMonitoring(15000);
  await CpuTracker.startMonitoring(3000);
  
  isInitialized = true;
  status = ResourceStatus.MONITORING;
  
  console.log("Resource Manager initialized");
}

/**
 * Kaynakları durdur ve temizle
 */
function cleanup() {
  MemoryTracker.stopMonitoring();
  CpuTracker.stopMonitoring();
  
  isInitialized = false;
  status = ResourceStatus.INACTIVE;
}

/**
 * Donmuş tabları güncelle
 * @param {Set} tabs Donmuş tab ID'leri kümesi
 */
function updateFrozenTabs(tabs) {
  frozenTabs = tabs;
  MemoryTracker.updateFrozenTabs(tabs);
}

/**
 * Mevcut sistem kaynak durumunu al
 * @param {boolean} boosterActive Booster aktif mi?
 * @returns {Promise<Object>} Sistem kaynak durumu
 */
async function getResourceState(boosterActive) {
  // Durumu güncelle
  isBoosterActive = boosterActive;
  
  try {
    // RAM durumunu değerlendir
    const memoryState = await MemoryTracker.evaluateMemory(boosterActive);
    
    // CPU durumunu değerlendir
    const cpuState = await CpuTracker.evaluateCpu();
    
    // Potansiyel tasarrufu hesapla - booster aktifken 0
    let potentialSavings;
    
    if (boosterActive) {
      potentialSavings = { min: 0, avg: 0, max: 0 };
    } else {
      // Booster kapalıyken her zaman yeni potansiyel hesaplama yap
      potentialSavings = memoryState.potentialSavings;
    }
    
    // Kaydedilen RAM miktarı - booster kapalıyken 0
    const savedRAM = boosterActive ? memoryState.savedRAM : 0;
    
    // Sonuçları birleştir ve dön
    const resourceState = {
      memory: {
        used: memoryState.currentMemory.usedMemory,
        total: memoryState.currentMemory.totalMemory,
        saved: savedRAM,
        potentialSavings: potentialSavings
      },
      cpu: {
        usage: cpuState.usage.average,
        status: cpuState.status,
        model: cpuState.model,
        cores: cpuState.cores,
        coreUsage: cpuState.usage.cores || []
      },
      boosterActive: boosterActive,
      timestamp: Date.now()
    };
    
    // Son verileri güncelle
    lastResourceData = {
      memory: memoryState,
      cpu: cpuState,
      potentialSavings: potentialSavings,
      savedResources: savedRAM,
      timestamp: Date.now()
    };
    
    return resourceState;
  } catch (error) {
    console.error("Error getting resource state:", error);
    
    // Hata durumunda son verileri veya varsayılanları dön
    return {
      memory: {
        used: 8000,
        total: 16000,
        saved: boosterActive ? 200 : 0,
        potentialSavings: boosterActive ? { min: 0, avg: 0, max: 0 } : { min: 100, avg: 200, max: 300 }
      },
      cpu: {
        usage: 30,
        status: 'normal',
        model: "Unknown CPU",
        cores: 4,
        coreUsage: []
      },
      boosterActive: boosterActive,
      timestamp: Date.now()
    };
  }
}

/**
 * Booster etkinleştirildiğinde veya kapatıldığında yoğun izleme
 * @param {boolean} isActive Booster aktif mi
 * @param {Function} callback Her ölçümde çağrılacak fonksiyon
 */
function startIntensiveMonitoring(isActive, callback) {
  status = ResourceStatus.OPTIMIZING;
  
  // Booster durumu değiştiğinde potansiyel tasarrufları sıfırla
  if (!isActive) {
    // Son hesaplamalardan potansiyel tasarrufu sıfırla (booster kapatıldığında)
    lastResourceData.potentialSavings = null;
    
    // MemoryTracker'daki durumu da sıfırla
    MemoryTracker.resetMemoryState();
  }
  
  // MemoryTracker'ın yoğun izleme modunu kullan
  MemoryTracker.monitorToggleEffect(async (memoryData) => {
    // CPU durumunu da al
    const cpuState = await CpuTracker.evaluateCpu();
    
    // Booster kapatılınca potansiyel hesaplamaları taze veriyle yap
    let potentialSavingsData;
    if (isActive) {
      potentialSavingsData = { min: 0, avg: 0, max: 0 };
    } else {
      potentialSavingsData = memoryData.potentialSavings;
    }
    
    // Sonuçları birleştir
    const resourceData = {
      memory: {
        state: memoryData.memoryState,
        saved: isActive ? memoryData.savedRAM : 0,
        potentialSavings: potentialSavingsData
      },
      cpu: cpuState,
      boosterActive: isActive,
      status: ResourceStatus.OPTIMIZING,
      timestamp: Date.now()
    };
    
    // Callback'i çağır
    if (typeof callback === 'function') {
      callback(resourceData);
    }
    
    // Son verileri güncelle
    lastResourceData = {
      memory: memoryData,
      cpu: cpuState,
      potentialSavings: potentialSavingsData,
      savedResources: isActive ? memoryData.savedRAM : 0,
      timestamp: Date.now()
    };
  }, isActive);
  
  // İzleme durumunu 30 saniye sonra optimized olarak değiştir
  setTimeout(() => {
    status = ResourceStatus.OPTIMIZED;
  }, 30000);
}

/**
 * Mevcut durum bilgisini döndür
 */
function getStatus() {
  return {
    status,
    isInitialized,
    isBoosterActive,
    lastUpdate: lastResourceData.timestamp
  };
}

// Dışa aktarılan API
export default {
  initialize,
  cleanup,
  updateFrozenTabs,
  getResourceState,
  startIntensiveMonitoring,
  getStatus,
  ResourceStatus
};
