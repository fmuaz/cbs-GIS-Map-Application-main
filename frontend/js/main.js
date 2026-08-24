window.addEventListener('DOMContentLoaded', () => {
    // Sayfa yüklendiği an tüm bu .js leri sırayla ayağa kaldıran ana şef
    
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: GIS_CONFIG.ASSETS.ICON_RETINA,
        iconUrl: GIS_CONFIG.ASSETS.ICON_DEFAULT,
        shadowUrl: GIS_CONFIG.ASSETS.ICON_SHADOW,
    });

    // 1. Sistem bileşenlerini ve modülleri sırasıyla ayağa kaldırıyoruz
    const map = MapManager.initMap();
    Sidebar.init();
    ThemeManager.init();
    IntersectionManager.init(map);
    ExportService.init(map); 
    DistanceTool.init(map); 
    AreaTool.init(map);   
    StateManager.init(map);
    PointTool.init(map);
    HistoryManager.init(map);
    LoadingManager.init(map);
    LayerFilter.init(); // Katman filtreleme modülü
    BufferTool.init(map);
    HeatmapManager.init(map); // Isı haritası modülü
    if (window.MiniMapManager) {
        window.MiniMapManager.init(map);
    }

    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    
    if(zoomInBtn) zoomInBtn.addEventListener('click', () => { map.zoomIn(); });
    if(zoomOutBtn) zoomOutBtn.addEventListener('click', () => { map.zoomOut(); });

    const uploadedFileSet = new Set();

    function toggleLayerVisibility(name) {
        const targetLayer = MapManager.mapLayersStorage[name];
        if (!targetLayer) return false;

        if (map.hasLayer(targetLayer)) {
            map.removeLayer(targetLayer);
            return false; 
        } else {
            map.addLayer(targetLayer);
            return true; 
        }
    }

    function deleteLayerController(name) {
        const targetLayer = MapManager.mapLayersStorage[name];
        if (targetLayer) {
            if (map.hasLayer(targetLayer)) map.removeLayer(targetLayer);
            delete MapManager.mapLayersStorage[name];
        }
        uploadedFileSet.delete(name);
        window.HeatmapManager.removeHeatmap(name);
    }

    function focusLayerController(name) {
        const targetLayer = MapManager.mapLayersStorage[name];
        if (targetLayer) {
            if (!map.hasLayer(targetLayer)) {
                map.addLayer(targetLayer);
                const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
                const toggleBtn = document.getElementById(`toggle_${safeId}`);
                const cardEl = document.getElementById(`card_${safeId}`);
                if (toggleBtn) toggleBtn.innerText = "👁️";
                if (cardEl) cardEl.style.opacity = "1";
            }
            MapManager.flyToLayerBounds(targetLayer);
        }
    }

    function loadLayerController(fileName) {
        if (uploadedFileSet.has(fileName)) {
            alert(window.APP_MESSAGES.LAYER_ALREADY_LOADED(fileName));
            focusLayerController(fileName); 
            return; 
        }

        // İŞLEM BAŞLADI: Loading Ekranını Aç
        if (window.LoadingManager) window.LoadingManager.show();

        // Backend'e istek atarak dosyayı çek
        ApiService.fetchGeoJson(fileName)
            .then(incomingModel => {
                setTimeout(() => {
                    try {
                        const standardizedGeoJson = {
                            type: incomingModel.type || "FeatureCollection",
                            features: (incomingModel.features || incomingModel.Features || []).map(f => {
                                return {
                                    type: f.type || "Feature",
                                    geometry: {
                                        type: f.geometry ? (f.geometry.type || f.geometry.Type) : "Point",
                                        coordinates: f.geometry ? (f.geometry.coordinates || f.geometry.Coordinates) : []
                                    },
                                    properties: f.properties || f.Properties || {}
                                };
                            })
                        };

                        let pointCount = 0, lineCount = 0, polygonCount = 0;
                        standardizedGeoJson.features.forEach(f => {
                            if (f.geometry) {
                                let geometryType = f.geometry.type.toLowerCase();
                                if (geometryType.includes("point")) pointCount++;
                                else if (geometryType.includes("line")) lineCount++;
                                else if (geometryType.includes("polygon")) polygonCount++;
                            }
                        });

                        MapManager.renderLayer(fileName, standardizedGeoJson);
                        uploadedFileSet.add(fileName);

                        Sidebar.appendLayerCard(
                            fileName, pointCount, lineCount, polygonCount, 
                            toggleLayerVisibility, deleteLayerController, focusLayerController
                        );

                        // İŞLEM BİTTİ: Loading Ekranını Kapat
                        if (window.LoadingManager) window.LoadingManager.hide();

                    } catch (error) {
                        if (window.LoadingManager) window.LoadingManager.hide();
                        alert("Dosya parse edilirken hata oluştu: " + error.message);
                    }
                }, 50);
            })
            .catch(error => {
                if (window.LoadingManager) window.LoadingManager.hide();
                alert("Sunucudan dosya alınamadı: " + error.message);
            });
    }

    // Gizli dosya seçici elementin değişim olayını dinliyoruz
    document.getElementById('hiddenFileSelector').addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        const fileObject = e.target.files[0]; 
        const fileName = fileObject.name;

        if (window.LoadingManager) window.LoadingManager.show();

        // ARTIK İSTİSNA YOK: Ne yüklenirse yüklensin Java'ya gönderilecek!
        ApiService.uploadGeoJson(fileObject)
            .then(message => {
                console.log("Backend Yanıtı: ", message);
                // Upload başarılıysa sunucudan çekip haritaya bas
                loadLayerController(fileName);
            })
            .catch(err => {
                if (window.LoadingManager) window.LoadingManager.hide();
                alert("Sunucuya Bağlanılamadı! Backend Ayakta Mı? Hata: " + err.message);
            })
            .finally(() => {
                e.target.value = ''; // Input'u sıfırla
            });
    });
});