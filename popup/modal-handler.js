/**
 * Chrome Booster - Modal ve Dropdown Yöneticisi (Final Düzenleme)
 * Bu dosya, modal ve dropdown işlevlerini yönetir
 */

// Global değişkenler
let activeModal = null;
let isClosing = false;
let startX, startY, startTime;
let lastFocusedElement = null;

// Sayfa yüklendiğinde modal işleyici başlat
document.addEventListener('DOMContentLoaded', function() {
    initializeModals();
    // createModalGuard() fonksiyonu kaldırıldı
    detectTouchDevice();
    setupTouchHandlers();
});

/**
 * Dokunmatik cihazları tespit et ve gerekli ayarları yap
 */
function detectTouchDevice() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
        document.body.classList.add('touch-device');
        
        // Dokunmatik cihazlarda modal içeriğinin kaydırılması için ilave stil
        const style = document.createElement('style');
        style.textContent = `
            .modal-content { -webkit-overflow-scrolling: touch; }
            .selection-list { -webkit-overflow-scrolling: touch; }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Modal koruma katmanı gerek olmadığı için kaldırıldı
 * Bu fonksiyon artık çağrılmıyor
 */
function createModalGuard() {
    // Bu fonksiyon artık kullanılmıyor
    console.log("Modal koruma katmanı özelliği devre dışı bırakıldı");
}

/**
 * Modal sistemini başlat
 */
function initializeModals() {
    console.log("Modal sistemi başlatılıyor...");
    
    const triggers = document.querySelectorAll('.dropdown-trigger');
    const modalBackdrop = document.querySelector('.modal-backdrop');
    const closeButtons = document.querySelectorAll('.close-modal');
    const modals = document.querySelectorAll('.modal-dropdown');
    
    // Debug için modal sayısını kontrol et
    console.log(`${triggers.length} trigger, ${modals.length} modal, ${closeButtons.length} kapatma butonu bulundu`);
    
    // Backdrop'ı oluştur (yoksa)
    if (!modalBackdrop) {
        console.error("Modal backdrop bulunamadı, oluşturuluyor");
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        document.body.appendChild(backdrop);
    }
    
    // Popup.js'de bulunan setupDropdowns fonksiyonunu bypass et
    if (window.setupDropdowns) {
        const originalSetupDropdowns = window.setupDropdowns;
        window.setupDropdowns = function() {
            console.log("Popup.js setupDropdowns fonksiyonu bypass edildi");
            return false;
        };
    }
    
    // Her trigger için event listener ekle
    triggers.forEach(trigger => {
        // Var olan event listener'ları temizle
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);
        
        console.log(`Trigger ayarlanıyor: ${newTrigger.dataset.dropdown}`);
        
        // Yeni event listener ekle
        newTrigger.addEventListener('click', function(e) {
            // Event yayılımını durdur
            e.preventDefault();
            e.stopPropagation();
            
            const targetModalId = this.dataset.dropdown;
            console.log(`Trigger tıklandı: ${targetModalId}`);
            
            // Eğer zaten aktifse kapat
            if (this.classList.contains('active')) {
                closeModal();
                return;
            }
            
            // Diğer triggerları deaktif yap
            document.querySelectorAll('.dropdown-trigger').forEach(t => {
                if (t !== this) t.classList.remove('active');
            });
            
            // Bu trigger'ı aktif yap
            this.classList.add('active');
            
            // Modalı aç
            openModal(targetModalId);
        });
    });
    
    // Kapatma butonlarını ayarla
    closeButtons.forEach(button => {
        // Var olan event listener'ları temizle
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Yeni event listener ekle
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Kapatma butonu tıklandı");
            closeModal();
        });
    });
    
    // Backdrop tıklama
    if (modalBackdrop) {
        // Var olan event listener'ları temizle
        const newBackdrop = modalBackdrop.cloneNode(true);
        modalBackdrop.parentNode.replaceChild(newBackdrop, modalBackdrop);
        
        // Yeni event listener ekle
        newBackdrop.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Backdrop tıklandı");
            closeModal();
        });
        
        // Touch events için backdrop
        newBackdrop.addEventListener('touchstart', function(e) {
            startX = e.changedTouches[0].screenX;
            startY = e.changedTouches[0].screenY;
            startTime = new Date().getTime();
        });
        
        newBackdrop.addEventListener('touchend', function(e) {
            const endX = e.changedTouches[0].screenX;
            const endY = e.changedTouches[0].screenY;
            const endTime = new Date().getTime();
            
            // Tap tespit et (hızlı ve kısa dokunuş)
            const tapDistance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            const tapDuration = endTime - startTime;
            
            if (tapDistance < 10 && tapDuration < 200) {
                e.preventDefault();
                console.log("Backdrop'a dokunuldu");
                closeModal();
            }
        });
    }
    
    // ESC tuşu ile kapatma
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            console.log("ESC tuşu basıldı");
            closeModal();
        }
    });
    
    // Arama input'larını ayarla
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(input => {
        // Klonlayarak olay dinleyicileri temizle
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        // Hedef container ID'sini belirle
        const containerId = newInput.id === 'tab-search' ? 'tab-options' : 'extension-options';
        
        // Yeni event listener ekle
        newInput.addEventListener('input', function() {
            filterOptions(containerId, this.value);
        });
        
        // Input'a odaklandığında seçme
        newInput.addEventListener('focus', function() {
            this.select();
        });
        
        // İOS için klavye yükselmesi sırasında modal pozisyonunu ayarla
        newInput.addEventListener('focus', function() {
            if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
                const modal = document.querySelector('.modal-dropdown.active');
                if (modal) {
                    modal.style.position = 'absolute';
                    modal.style.top = '30%';
                    modal.style.transform = 'translate(-50%, 0)';
                }
            }
        });
        
        newInput.addEventListener('blur', function() {
            if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
                const modal = document.querySelector('.modal-dropdown.active');
                if (modal) {
                    modal.style.position = 'fixed';
                    modal.style.top = '50%';
                    modal.style.transform = 'translate(-50%, -50%)';
                }
            }
        });
    });
    
    // Kaydet butonlarını ayarla
    const saveButtons = document.querySelectorAll('.modal-action-btn');
    saveButtons.forEach(button => {
        // Klonlayarak olay dinleyicileri temizle
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Yeni event listener ekle
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.id === 'save-tab-exclusions') {
                if (typeof saveTabExclusions === 'function') {
                    saveTabExclusions(this);
                }
            } else if (this.id === 'save-extension-exclusions') {
                if (typeof saveExtensionExclusions === 'function') {
                    saveExtensionExclusions(this);
                }
            }
            
            // 1 saniye sonra modalı kapat
            setTimeout(closeModal, 1000);
        });
    });
    
    // Modallara tıklandığında olay yayılımını durdur
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        // Touch events için
        modal.addEventListener('touchstart', function(e) {
            e.stopPropagation();
        });
    });
}

/**
 * Modal açılma öncesi son hazırlık
 * @param {HTMLElement} modal - Açılacak modal
 */
function prepareModalForOpen(modal) {
  if (!modal) return;
  
  // iOS'da görünüm sorunlarını düzelt
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    modal.classList.add('ios-modal');
    
    // iOS 15+ kaydırma sorunlarını düzelt
    const nestedScrollables = modal.querySelectorAll('.selection-list, .selected-items');
    nestedScrollables.forEach(elem => {
      elem.style.webkitOverflowScrolling = 'touch';
    });
  }
  
  // Modal içindeki tüm etkileşimli öğelere tabIndex ekle
  const interactiveElements = modal.querySelectorAll('button, input, select, [role="button"]');
  interactiveElements.forEach((el, index) => {
    if (!el.getAttribute('tabindex')) {
      el.setAttribute('tabindex', (index + 1).toString());
    }
  });
  
  // İlk öğeye odaklan
  setTimeout(() => {
    const firstFocusable = modal.querySelector('input, button, [role="button"]');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, 100);
}

/**
 * Modal kapanırken ekstra temizlik
 */
function cleanupAfterModalClose() {
  // Mevcut tüm tooltipleri gizle
  const tooltips = document.querySelectorAll('.tooltip.visible');
  tooltips.forEach(tooltip => {
    tooltip.classList.remove('visible');
  });
  
  // Eski odağı geri kazandır
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
  
  // Bellek temizliği - bazı tarayıcılarda hafıza sızıntılarını önler
  setTimeout(() => {
    // Gereksiz event listener'ları temizlenmiş modallar olabilir
    const abandonedModals = document.querySelectorAll('.modal-dropdown.abandoned');
    abandonedModals.forEach(modal => {
      modal.remove();
    });
  }, 1000);
}

/**
 * Modal açma işlevi (geliştirilmiş)
 * @param {string} modalId - Açılacak modalın ID'si
 */
function openModal(modalId) {
  if (isClosing) return;
  
  // Açılmadan önce son odaklanan öğeyi kaydet
  lastFocusedElement = document.activeElement;
  
  const modal = document.getElementById(modalId);
  const backdrop = document.querySelector('.modal-backdrop');
  // Guard referansı kaldırıldı
  
  if (!modal || !backdrop) {
    console.error("Modal veya backdrop bulunamadı:", {modalId, modal, backdrop});
    return;
  }
  
  console.log(`Modal açılıyor: ${modalId}`);
  activeModal = modalId;
  
  // Önce eski stillerden temizle
  modal.style.display = 'none';
  modal.classList.remove('active');
  backdrop.style.display = 'none';
  backdrop.classList.remove('active');
  
  // Z-index'leri yükselt
  modal.style.zIndex = '1000';
  backdrop.style.zIndex = '999';
  
  // Guard ile ilgili kod kaldırıldı
  
  // Açılma öncesi hazırlıklar
  prepareModalForOpen(modal);
  
  // Modalı ve backdrop'ı göster
  backdrop.style.display = 'block';
  modal.style.display = 'block';
  
  // Animasyonlar için kısa bir gecikme
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
    modal.classList.add('active');
    
    // Body'nin scroll'unu engelle
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    
    // Tab veya extension içeriğini yükle
    if (modalId === 'tab-dropdown') {
      if (typeof loadTabExclusions === 'function') {
        loadTabExclusions();
      }
    } else if (modalId === 'ext-dropdown') {
      if (typeof loadExtensionExclusions === 'function') {
        loadExtensionExclusions();
      }
    }
  });
}

/**
 * Modal kapatma işlevi
 */
function closeModal() {
    if (isClosing) return;
    isClosing = true;
    
    console.log("Modal kapatılıyor");
    
    const backdrop = document.querySelector('.modal-backdrop');
    const modals = document.querySelectorAll('.modal-dropdown');
    // Guard referansı kaldırıldı
    
    // Modalları kapat
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Backdrop'ı kapat
    if (backdrop) {
        backdrop.classList.remove('active');
    }
    
    // Trigger'ları temizle
    document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
        trigger.classList.remove('active');
    });
    
    // Animasyon bittikten sonra görünürlüğü kaldır
    setTimeout(() => {
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.style.zIndex = '';
            
            // iOS düzeltmesini sıfırla
            modal.style.position = '';
            modal.style.top = '';
            modal.style.transform = '';
        });
        
        if (backdrop) {
            backdrop.style.display = 'none';
            backdrop.style.zIndex = '';
        }
        
        // Guard ile ilgili kod kaldırıldı
        
        // Body'nin scroll'unu geri aç
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        
        // Aktif modalı ve kapanış durumunu sıfırla
        activeModal = null;
        isClosing = false;

        // Ekstra temizlik
        cleanupAfterModalClose();
    }, 300);
}

/**
 * Arama seçeneklerini filtreleme
 */
function filterOptions(containerId, searchTerm) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const options = container.querySelectorAll('.selection-option');
    searchTerm = searchTerm.toLowerCase();
    
    options.forEach(option => {
        const label = option.querySelector('.selection-label');
        if (!label) return;
        
        const text = label.textContent.toLowerCase();
        option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
}

/**
 * Touch/Scroll olayları için özel işleme
 */
function setupTouchHandlers() {
  const scrollableAreas = document.querySelectorAll('.selection-list');
  
  scrollableAreas.forEach(area => {
    // Başlangıç konumları
    let startX = 0, startY = 0;
    
    area.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    area.addEventListener('touchmove', function(e) {
      // Dikey kaydırma olayları için özel işleme gerekiyorsa
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;
      
      // Yatay kaydırmayı engelle, dikey kaydırmaya izin ver
      if (Math.abs(deltaX) > Math.abs(deltaY) && area.scrollHeight <= area.clientHeight) {
        e.preventDefault();
      }
    }, { passive: false });
  });
}

// Dışa aktarılan fonksiyonlar
window.openModal = openModal;
window.closeModal = closeModal;
window.filterOptions = filterOptions;
