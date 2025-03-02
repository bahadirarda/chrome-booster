/**
 * Chrome Booster CPU İzleme Modülü
 * CPU kullanımını izler ve raporlar
 */

// Son CPU ölçüm sonuçlarını saklama
let lastCpuInfo = null;
let cpuReadings = []; // Son 10 CPU ölçüm değerleri
let previousUsage = null; // Önceki ölçüm değeri (yüzde hesabı için)
let cpuMonitoringInterval = null;
let isMonitoring = false;

/**
 * CPU bilgisini al
 * @returns {Promise<Object>} İşlemci bilgileri
 */
async function getCpuInfo() {
  try {
    const cpuInfo = await chrome.system.cpu.getInfo();
    const currentTime = Date.now();
    
    // Ek bilgileri ekle
    const enhancedInfo = {
      ...cpuInfo,
      timestamp: currentTime,
      date: new Date().toISOString(),
      usage: calculateCpuUsage(cpuInfo, previousUsage),
      temperatures: cpuInfo.temperatures || []
    };
    
    // Önceki kullanımı güncelle
    previousUsage = cpuInfo;
    
    // Son CPU durumunu güncelle
    lastCpuInfo = enhancedInfo;
    
    // Ölçümleri sakla (en fazla 10 ölçüm)
    cpuReadings.unshift(enhancedInfo);
    if (cpuReadings.length > 10) {
      cpuReadings.pop();
    }
    
    return enhancedInfo;
  } catch (error) {
    console.error("CPU bilgisi alınamadı:", error);
    return lastCpuInfo || {
      modelName: "Unknown CPU",
      archName: "unknown",
      numOfProcessors: 1,
      processors: [],
      usage: { average: 0, cores: [] },
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
  }
}

/**
 * CPU kullanımını yüzde olarak hesapla
 * @param {Object} currentInfo Şimdiki CPU durumu
 * @param {Object} previousInfo Önceki CPU durumu
 * @returns {Object} CPU kullanım oranları
 */
function calculateCpuUsage(currentInfo, previousInfo) {
  // Önceki değerler yoksa hesaplama yapma
  if (!previousInfo) {
    return { average: 0, cores: [] };
  }
  
  let totalUsage = 0;
  const coreUsages = [];
  
  // Her çekirdek için kullanımı hesapla
  for (let i = 0; i < currentInfo.processors.length; i++) {
    if (i >= previousInfo.processors.length) break;
    
    const current = currentInfo.processors[i].usage;
    const previous = previousInfo.processors[i].usage;
    
    // Toplam kullanım sürelerindeki değişim
    const deltaTotal = current.total - previous.total;
    
    // Boşta geçen süredeki değişim
    const deltaIdle = current.idle - previous.idle;
    
    // CPU kullanım oranı: (1 - boşta geçen süre değişimi / toplam süre değişimi) * 100
    let usagePercent = 0;
    if (deltaTotal > 0) {
      usagePercent = Math.min(100, Math.max(0, Math.round((1 - deltaIdle / deltaTotal) * 100)));
    }
    
    coreUsages.push(usagePercent);
    totalUsage += usagePercent;
  }
  
  // Ortalama CPU kullanımı
  const averageUsage = coreUsages.length > 0 ? Math.round(totalUsage / coreUsages.length) : 0;
  
  return {
    average: averageUsage,
    cores: coreUsages
  };
}

/**
 * CPU izlemeyi başlat
 * @param {number} intervalMs İzleme aralığı (ms)
 */
function startMonitoring(intervalMs = 3000) {
  // Önceki interval varsa durdur
  stopMonitoring();
  
  // İlk ölçümü yap
  getCpuInfo()
    .then(() => console.log("İlk CPU ölçümü yapıldı"))
    .catch(err => console.error("CPU ölçüm hatası:", err));
  
  // Düzenli aralıklarla ölç
  cpuMonitoringInterval = setInterval(() => {
    getCpuInfo()
      .then(info => {
        // CPU kullanımını logla
        if (info && info.usage) {
          console.log(`CPU Kullanımı: %${info.usage.average}`);
        }
      })
      .catch(err => console.error("CPU ölçüm hatası:", err));
  }, intervalMs);
  
  isMonitoring = true;
  console.log(`CPU izleme başlatıldı (${intervalMs}ms aralıkla)`);
}

/**
 * CPU izlemeyi durdur
 */
function stopMonitoring() {
  if (cpuMonitoringInterval) {
    clearInterval(cpuMonitoringInterval);
    cpuMonitoringInterval = null;
  }
  
  isMonitoring = false;
}

/**
 * CPU izleme durumunu değerlendir
 * @returns {Promise<Object>} CPU durumu ve kullanımı
 */
async function evaluateCpu() {
  // Son CPU durumunu al (veya yeni ölç)
  const cpuInfo = lastCpuInfo || await getCpuInfo();
  
  // Ortalama CPU kullanımını al
  const cpuUsage = cpuInfo.usage || { average: 0, cores: [] };
  
  // CPU durumu değerlendirme
  const status = getCpuStatus(cpuUsage.average);
  
  return {
    model: cpuInfo.modelName,
    architecture: cpuInfo.archName,
    cores: cpuInfo.numOfProcessors,
    usage: cpuUsage,
    temperatures: cpuInfo.temperatures || [],
    status,
    history: cpuReadings
  };
}

/**
 * CPU kullanım oranına göre durum belirle
 * @param {number} usagePercent CPU kullanım yüzdesi
 * @returns {string} CPU durumu (normal, moderate, high, critical)
 */
function getCpuStatus(usagePercent) {
  if (usagePercent < 40) {
    return "normal";
  } else if (usagePercent < 70) {
    return "moderate";
  } else if (usagePercent < 90) {
    return "high";
  } else {
    return "critical";
  }
}

/**
 * İzleme sıfırlama
 */
function resetTracker() {
  lastCpuInfo = null;
  cpuReadings = [];
  previousUsage = null;
}

// Dışa aktarılan API
export default {
  getCpuInfo,
  evaluateCpu,
  startMonitoring,
  stopMonitoring,
  resetTracker
};
