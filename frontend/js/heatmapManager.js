const HeatmapManager = {
    map: null,
    activeHeatmaps: {}, // Hangi katmanın ısı haritasına dönüştüğünü tutar

    init: function(leafletMap) {
        this.map = leafletMap;
    },

    toggleHeatmap: function(layerName, originalLayer) {
        if (!this.map) return;

        // EĞER AÇIKSA: Kapat ve orijinal katmana geri dön
        if (this.activeHeatmaps[layerName]) {
            this.map.removeLayer(this.activeHeatmaps[layerName]);
            delete this.activeHeatmaps[layerName];
            
            if (!this.map.hasLayer(originalLayer)) {
                this.map.addLayer(originalLayer);
            }
            return false; // Kapalı durumunu döndür
        } 
        
        // EĞER KAPALIYSA: Aç ve Isı Haritasına çevir
        else {
            const points = [];

            // Yüklenen katmandaki tüm noktaların koordinatlarını topla
            originalLayer.eachLayer((layer) => {
                if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
                    const latlng = layer.getLatLng();
                    points.push([latlng.lat, latlng.lng, 1]); // 1 yoğunluk (intensity)
                }
            });

            if (points.length === 0) {
                alert("Bu katmanda ısı haritasına dönüştürülecek nokta verisi bulunamadı!");
                return false;
            }

            // Orijinal katmanı haritadan gizle
            if (this.map.hasLayer(originalLayer)) {
                this.map.removeLayer(originalLayer);
            }

            // Isı katmanını yarat ve haritaya bas
            const heat = L.heatLayer(points, {
                radius: 20,
                blur: 15,
                maxZoom: 17,
                gradient: {0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red'}
            }).addTo(this.map);

            this.activeHeatmaps[layerName] = heat;
            return true; // Açık durumunu döndür
        }
    },

    // Katman tamamen silinirse ısı haritasını da hafızadan temizle
    removeHeatmap: function(layerName) {
        if (this.activeHeatmaps[layerName]) {
            this.map.removeLayer(this.activeHeatmaps[layerName]);
            delete this.activeHeatmaps[layerName];
        }
    }
};

window.HeatmapManager = HeatmapManager;