const MiniMapManager = {
    mainMap: null,
    miniMap: null,
    viewFinder: null,
    zoomOffset: -5, // Ana haritadan 5 birim daha uzaktan bakar

    init: function(mainLeafletMap) {
        this.mainMap = mainLeafletMap;

        // 1. İkinci (Mini) Haritayı Başlat (Tüm etkileşimler kapalı)
        this.miniMap = L.map('minimap-ui', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false
        });

        // 2. Mini Harita İçin Altlık (TileLayer) Ekle
        // İstersen burada CartoDB'nin daha sade olan 'Dark Matter' veya 'Positron' altlıklarını kullanabilirsin.
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.miniMap);

        // 3. Vizör (Kırmızı Bounding Box) Dikdörtgenini Oluştur
        this.viewFinder = L.rectangle(this.mainMap.getBounds(), {
            color: '#dc3545',
            weight: 2,
            fillColor: '#dc3545',
            fillOpacity: 0.15,
            interactive: false // Vizöre tıklanmasını engelle
        }).addTo(this.miniMap);

        // 4. Olay Dinleyicileri (Event Listeners) - Senkronizasyon
        this.mainMap.on('move', this.sync.bind(this));
        this.mainMap.on('zoom', this.sync.bind(this));

        // İlk ekranı ayarla
        this.sync();
    },

    sync: function() {
        if (!this.mainMap || !this.miniMap) return;

        // Ana haritanın merkezini ve yakınlaştırma seviyesini al
        const center = this.mainMap.getCenter();
        const mainZoom = this.mainMap.getZoom();

        // Mini haritanın zoom seviyesini offset ile hesapla (Sıfırın altına düşmesin)
        const miniZoom = Math.max(0, mainZoom + this.zoomOffset);

        // Mini haritayı senkronize et
        this.miniMap.setView(center, miniZoom, { animate: false });

        // Vizör dikdörtgeninin köşe koordinatlarını güncelle
        this.viewFinder.setBounds(this.mainMap.getBounds());
    }
};

window.MiniMapManager = MiniMapManager;