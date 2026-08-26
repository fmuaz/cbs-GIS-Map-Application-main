const SessionManager = {
    timeoutMinutes: 15, // BAŞKAYDIĞINDA SİLİNMESİ İÇİN GEREKEN SÜRE
    activityKey: 'gis_last_activity',
    layersKey: 'gis_active_layers',
    drawnKey: 'gis_drawn_features', // Anlık çizimlerin (Point vb.) hafıza anahtarı

    init: function() {
        this.checkSession();
        this.setupActivityListeners();
        this.setupStateObserver();
    },

    checkSession: function() {
        const lastActivity = sessionStorage.getItem(this.activityKey);
        const now = Date.now();

        if (lastActivity) {
            const diff = now - parseInt(lastActivity);
            if (diff > this.timeoutMinutes * 60 * 1000) {
                // Belirlenen süre aşılmış! Katmanları ve anlık çizimleri sil.
                sessionStorage.removeItem(this.layersKey);
                sessionStorage.removeItem(this.drawnKey);
                console.log("Oturum süresi doldu, harita sıfırlandı.");
            } else {
                // 1. Resmi Katmanları Yükle (Sağ menüdeki Importlar)
                const savedLayers = sessionStorage.getItem(this.layersKey);
                if (savedLayers) {
                    const layersToLoad = JSON.parse(savedLayers);
                    layersToLoad.forEach(groupName => {
                        if (window.LayerController) {
                            LayerController.loadGroupController(groupName, true);
                        }
                    });
                }

                // 2.Anlık Manuel Çizimleri Yükle (Point, Line vb.)
                const savedDrawn = sessionStorage.getItem(this.drawnKey);
                // Haritaya erişmek için LayerController'ın içindeki map'i kullanıyoruz (main.js'ye dokunmamak için)
                const map = window.LayerController ? LayerController.map : null; 
                
                if (savedDrawn && map) {
                    try {
                        const geoData = JSON.parse(savedDrawn);
                        if (geoData.features && geoData.features.length > 0) {
                            L.geoJSON(geoData, {
                                pointToLayer: function (feature, latlng) {
                                    // Manuel eklenen point'lerin stili
                                    return L.circleMarker(latlng, { radius: 6, color: '#dc3545', fillColor: '#ffc107', weight: 2, fillOpacity: 1 });
                                },
                                style: function (feature) {
                                    // Manuel eklenen çizgi ve alanların stili
                                    return { color: '#0d6efd', weight: 3, dashArray: '5, 5' }; 
                                }
                            }).addTo(map);
                        }
                    } catch(e) {
                        console.error("Anlık çizimler yüklenirken hata oluştu:", e);
                    }
                }
            }
        }
        
        // Aktiviteyi (son hareket zamanını) güncelle
        this.updateActivity();
    },

    updateActivity: function() {
        sessionStorage.setItem(this.activityKey, Date.now().toString());
        // Kullanıcı her hareket ettiğinde, anlık çizimleri de kontrol et ve kaydet
        this.saveDrawnFeatures();
    },

    saveDrawnFeatures: function() {
        const map = window.LayerController ? LayerController.map : null;
        if (!map) return;
        
        let drawnFeatures = [];
        
        // Haritadaki tüm objeleri tararız
        map.eachLayer(layer => {
            // Sadece Marker, Çizgi ve Poligonları al (Altlık haritaları atla)
            if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polyline || layer instanceof L.Polygon) {
                
                // ZEKİ KONTROL: Bu obje LayerController tarafından yüklenen "resmi" katmanların içinde DEĞİLSE, manuel bir çizimdir!
                let isOfficial = false;
                if (window.MapManager && MapManager.mapLayersStorage) {
                    for (let key in MapManager.mapLayersStorage) {
                        const group = MapManager.mapLayersStorage[key];
                        // Eğer obje bir grubun kendisiyse veya grubun içindeyse, resmi bir veridir
                        if (group === layer || (group.hasLayer && group.hasLayer(layer))) {
                            isOfficial = true;
                            break;
                        }
                    }
                }
                
                // Resmi değilse ve GeoJSON'a çevrilebiliyorsa, anlık çizim olarak hafızaya at
                if (!isOfficial && typeof layer.toGeoJSON === 'function') {
                    drawnFeatures.push(layer.toGeoJSON());
                }
            }
        });

        // Çizimleri tarayıcının Session (oturum) hafızasına kaydet
        if (drawnFeatures.length > 0) {
            const featureCollection = { type: "FeatureCollection", features: drawnFeatures };
            sessionStorage.setItem(this.drawnKey, JSON.stringify(featureCollection));
        } else {
            sessionStorage.removeItem(this.drawnKey);
        }
    },

    setupActivityListeners: function() {
        // Performans için: Her milisaniye değil, hareket bittikten 1 saniye sonra kaydeder (throttle)
        let timeout;
        const resetTimer = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this.updateActivity(), 1000);
        };

        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('click', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('scroll', resetTimer);
    },

    setupStateObserver: function() {
        const targetNode = document.getElementById('layerList');
        if (!targetNode) return;

        const observer = new MutationObserver(() => {
            if (window.LayerController && LayerController.uploadedFileSet) {
                const activeLayers = Array.from(LayerController.uploadedFileSet);
                sessionStorage.setItem(this.layersKey, JSON.stringify(activeLayers));
            }
        });

        observer.observe(targetNode, { childList: true, subtree: true });
    }
};

window.SessionManager = SessionManager;