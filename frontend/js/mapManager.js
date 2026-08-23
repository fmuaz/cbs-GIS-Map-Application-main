// L.map('map') kodunu çalıştırıp haritayı ekrana basar.
// Haritayı başlatan altlığı yükleyen ve GeoJSON çizen harita motoru

const MapManager = {
    map: null,
    mapLayersStorage: {}, // Yüklenen tüm katmanları ismiyle hafızada tutacak sözlük

    // Initialize Leaflet Map
    initMap: function () {
        // 1. Haritayı başlatıyoruz Varsayılan olarak düz harita kalıyor
        // YENİ EKLENEN: Orijinal beyaz zoom butonu kapatıldı (zoomControl: false)
        this.map = L.map('map', { zoomControl: false }).setView(GIS_CONFIG.MAP.DEFAULT_CENTER, GIS_CONFIG.MAP.DEFAULT_ZOOM);

        L.tileLayer(GIS_CONFIG.MAP.TILE_LAYER_URL, {
            maxZoom: GIS_CONFIG.MAP.MAX_ZOOM, 
            attribution: GIS_CONFIG.MAP.ATTRIBUTION
        }).addTo(this.map);

        this.initCoordinateIndicator();
        return this.map;
    },

    // Setup Live Coordinate Indicator (Bottom Right)
    initCoordinateIndicator: function () {
        const coordinateIndicator = L.control({ position: 'bottomright' });
        coordinateIndicator.onAdd = () => {
            const div = L.DomUtil.create('div', 'coordinate-panel');
            div.style.background = 'rgba(255, 255, 255, 0.8)';
            div.style.padding = '5px 10px'; 
            div.style.borderRadius = '4px'; 
            div.style.fontFamily = 'monospace';
            div.innerHTML = "Lat: 0.0000 | Lng: 0.0000";
            return div;
        };
        coordinateIndicator.addTo(this.map);

        this.map.on('mousemove', (e) => {
            coordinateIndicator.getContainer().innerHTML =
                `Lat: ${e.latlng.lat.toFixed(4)} | Lng: ${e.latlng.lng.toFixed(4)}`;
        });
    },

    // Render standardized GeoJSON on map and fly to bounds
    renderLayer: function (fileName, standardizedGeoJson) {
        const newLayer = L.geoJSON(standardizedGeoJson, {
            onEachFeature: function (feature, layer) {
                if (feature.properties) {
                    let popupContent = "<div style='font-family: Arial; min-width: 220px;'>";
                    popupContent += "<b style='color: #007bff; font-size: 14px;'>🗺️ Layer Properties</b><hr style='border:0; border-top:1px solid #eee; margin: 8px 0;'>";
                    for (let key in feature.properties) {
                        let value = feature.properties[key];
                        if (typeof value === 'object' && value !== null) {
                            popupContent += `<b>${key}:</b> <code style='font-size:11px;'>${JSON.stringify(value)}</code><br>`;
                        } else {
                            popupContent += `<b>${key}:</b> ${value}<br>`;
                        }
                    }
                    popupContent += "</div>";
                    layer.bindPopup(popupContent);
                }
            }
        }).addTo(this.map);

        // Katmanı ismiyle hafızaya kaydet
        this.mapLayersStorage[fileName] = newLayer;

        this.flyToLayerBounds(newLayer);
    },

    // Fly camera to a specific layer's bounds
    flyToLayerBounds: function (layer) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
            this.map.flyToBounds(bounds, { duration: 1.5 });
        }
    }
};

window.MapManager = MapManager;