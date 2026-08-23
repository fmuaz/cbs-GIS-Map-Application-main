const LoadingManager = {
    requestCount: 0,
    showTime: 0,
    minDuration: 2000,
    timeoutId: null,
    overlayEl: null,
    imageEl: null,

    init: function() {
        this.overlayEl = document.getElementById('global-loading-overlay');
        this.imageEl = document.getElementById('global-loading-image');
        
        // Config'den ayarları çek
        if (window.GIS_CONFIG && window.GIS_CONFIG.LOADING) {
            this.minDuration = window.GIS_CONFIG.LOADING.MIN_DURATION || 2000;
            if (this.imageEl) {
                this.imageEl.src = window.GIS_CONFIG.LOADING.IMAGE_PATH;
                this.imageEl.style.width = window.GIS_CONFIG.LOADING.IMAGE_SIZE;
                this.imageEl.style.height = 'auto';
            }
        }
    },

    show: function() {
        // Eğer ilk çağrıysa sayacı başlat ve arayüzü göster
        if (this.requestCount === 0) {
            this.showTime = Date.now();
            if (this.overlayEl) this.overlayEl.classList.add('visible');
            
            // Eğer önceden kalma bir kapanma emri (timeout) varsa iptal et
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
        }
        // İsteği sayaca ekle
        this.requestCount++;
    },

    hide: function() {
        // Güvenlik: Sayaç eksiye düşemez
        if (this.requestCount > 0) {
            this.requestCount--;
        }

        // Eğer bekleyen başka işlem kalmadıysa kapanma sürecini başlat
        if (this.requestCount === 0) {
            const elapsedTime = Date.now() - this.showTime;
            const remainingTime = this.minDuration - elapsedTime;

            if (remainingTime > 0) {
                // İşlem çok hızlı bitti, minimum süreyi doldurması için bekle
                this.timeoutId = setTimeout(() => {
                    // Timeout süresi dolduğunda hala yeni bir istek gelmemişse kapat
                    if (this.requestCount === 0) {
                        this.actuallyHide();
                    }
                }, remainingTime);
            } else {
                // İşlem zaten minimum süreden (2 sn) uzun sürmüş, anında kapat
                this.actuallyHide();
            }
        }
    },

    actuallyHide: function() {
        if (this.overlayEl) {
            this.overlayEl.classList.remove('visible');
        }
    }
};

window.LoadingManager = LoadingManager;