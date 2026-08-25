window.addEventListener('DOMContentLoaded', () => {
    // Sayfa yüklendiği an tüm bu .js leri sırayla ayağa kaldıran ana şef
    
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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

    // Sayfa yüklendiğinde veritabanındaki kayıtlı ölçümleri otomatik getir ve haritaya çiz
    async function loadSavedMeasurementsFromDatabase() {
        try {
            // YENİ: ID yerine Grup Listesini çekiyoruz
            const groupNames = await ApiService.fetchGroupList();
            if (groupNames && groupNames.length > 0) {
                for (const groupName of groupNames) {
                    // YENİ: ID yerine Grup Adına göre veriyi çekiyoruz
                    const geoJsonData = await ApiService.fetchGroupByName(groupName);
                    
                    // Haritaya çizerken artık "Kayıt #1" yerine "Ankara Keşfi" gibi grubun adını yazacak
                    MapManager.renderLayer(groupName, geoJsonData);
                }
                console.log("Veritabanındaki tüm grup katmanları başarıyla haritaya yüklendi! 🚀");
            }
        } catch (e) {
            console.error("Veritabanından grup katmanları yüklenirken hata oluştu:", e);
        }
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

    // Veritabanından Grup Adıyla Katman Yükleme Fonksiyonu
    function loadGroupController(grupAdi) {
        if (uploadedFileSet.has(grupAdi)) {
            alert(window.APP_MESSAGES?.LAYER_ALREADY_LOADED ? window.APP_MESSAGES.LAYER_ALREADY_LOADED(grupAdi) : "Bu çalışma zaten yüklü!");
            focusLayerController(grupAdi); 
            if (window.LoadingManager) window.LoadingManager.hide();
            return; 
        }

        if (window.LoadingManager) window.LoadingManager.show();

        // Backend'e istek atarak grubu çek
        ApiService.fetchGroupByName(grupAdi)
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

                        const restoredLayer = L.geoJSON(standardizedGeoJson, {
                            pointToLayer: function (feature, latlng) {
                                const props = feature.properties || {};
                                return L.circleMarker(latlng, {
                                    radius: props.radius || window.GIS_CONFIG?.MEASURE_STYLE?.MARKER_RADIUS || 6,
                                    color: props.color || window.GIS_CONFIG?.MEASURE_STYLE?.LINE_COLOR || '#dc3545',
                                    fillColor: props.fillColor || window.GIS_CONFIG?.MEASURE_STYLE?.FILL_COLOR || '#ffc107',
                                    fillOpacity: props.fillOpacity || 1
                                });
                            },
                            style: function (feature) {
                                const props = feature.properties || {};
                                if (feature.geometry && feature.geometry.type.includes("LineString")) {
                                    return {
                                        color: props.color || window.GIS_CONFIG?.MEASURE_STYLE?.LINE_COLOR || '#dc3545',
                                        weight: props.weight || window.GIS_CONFIG?.MEASURE_STYLE?.WEIGHT || 3,
                                        dashArray: props.dashArray || window.GIS_CONFIG?.MEASURE_STYLE?.DASH_ARRAY || '5, 5'
                                    };
                                } else if (feature.geometry && feature.geometry.type.includes("Polygon")) {
                                    return { 
                                        color: props.color || '#28a745', 
                                        weight: props.weight || 3, 
                                        fillColor: props.fillColor || '#28a745', 
                                        fillOpacity: props.fillOpacity || 0.3 
                                    };
                                }
                            }
                        }).addTo(map);

                        restoredLayer.eachLayer((layer) => {
                            const currentId = 'restored_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

                            // --- 1. NOKTA İÇİN POPUP ---
                            if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
                                const lat = layer.getLatLng().lat.toFixed(5);
                                const lng = layer.getLatLng().lng.toFixed(5);
                                const pointPopupHtml = `
                                    <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                        <div id="main-content-${currentId}">
                                            <div style="font-weight: bold; color: #ffc107; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">📍 Nokta Bilgileri</div>
                                            <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                                <tr><td style="color: #6c757d;">Enlem:</td><td style="font-weight: bold; text-align: right;">${lat}</td></tr>
                                                <tr><td style="color: #6c757d;">Boylam:</td><td style="font-weight: bold; text-align: right;">${lng}</td></tr>
                                            </table>
                                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                            <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Sil</button>
                                        </div>
                                    </div>`;
                                layer.bindPopup(pointPopupHtml, { maxWidth: 250 });
                            }
                            // --- 2. POLYGON İÇİN POPUP ---
                            else if (layer instanceof L.Polygon) {
                                const labelContent = layer.feature.properties.label || `Geometri Alanı`;
                                layer.bindTooltip(labelContent, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip(layer.getBounds().getCenter());

                                const polyPopupHtml = `
                                    <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                        <div id="main-content-${currentId}">
                                            <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                            <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Sil</button>
                                        </div>
                                    </div>`;
                                layer.bindPopup(polyPopupHtml, { maxWidth: 250 });
                            } 
                            // --- 3. LINE İÇİN POPUP ---
                            else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                                const labelContent = layer.feature.properties.label || `Çizgi Uzunluğu`;
                                layer.bindTooltip(labelContent, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();

                                const linePopupHtml = `
                                    <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                        <div id="main-content-${currentId}">
                                            <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Çizgi Bilgileri</div>
                                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                            <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Sil</button>
                                        </div>
                                    </div>`;
                                layer.bindPopup(linePopupHtml, { maxWidth: 250 });
                            }

                            // POPUP ETKİLEŞİMLERİ (Silme ve Metadata)
                            layer.on('popupopen', () => {
                                document.getElementById(currentId)?.addEventListener('click', () => { restoredLayer.removeLayer(layer); });
                                if (window.FeatureMetadata) {
                                    window.FeatureMetadata.bindMetadataEvents(layer, currentId);
                                }
                            });
                        });

                        MapManager.mapLayersStorage[grupAdi] = restoredLayer;
                        uploadedFileSet.add(grupAdi);

                        Sidebar.appendLayerCard(
                            grupAdi, pointCount, lineCount, polygonCount, 
                            toggleLayerVisibility, deleteLayerController, focusLayerController
                        );

                        if (window.LoadingManager) window.LoadingManager.hide();

                    } catch (error) {
                        if (window.LoadingManager) window.LoadingManager.hide();
                        alert("Harita verisi işlenirken hata oluştu: " + error.message);
                    }
                }, 50);
            })
            .catch(error => {
                if (window.LoadingManager) window.LoadingManager.hide();
                alert("Veritabanından grup alınamadı: " + error.message);
            });
    }

    // İçe Aktar (Add Layer) Butonuna Tıklandığında Çalışacak Veritabanı Menüsü
    const addLayerBtn = document.getElementById('addLayerBtn'); // Kendi HTML'indeki butonun ID'sini buraya yaz!
    
    if(addLayerBtn) {
        addLayerBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // Eğer butonsa varsayılan tıklamayı durdur
            
            if (window.LoadingManager) window.LoadingManager.show();
            
            try {
                // 1. Backend'den Grup İsimlerini Çek
                const groups = await ApiService.fetchGroupList();
                if (window.LoadingManager) window.LoadingManager.hide();

                if (!groups || groups.length === 0) {
                    alert("Veritabanında kayıtlı hiçbir çalışma/grup bulunamadı.");
                    return;
                }

                // 2. Kullanıcıya şık bir menü (şimdilik prompt ile) sunarak seçtir
                let promptText = "Yüklemek istediğiniz çalışmanın NUMARASINI girin:\n\n";
                groups.forEach((g, i) => promptText += `${i + 1} - ${g}\n`);
                
                const secim = prompt(promptText);
                if (!secim) return; // Kullanıcı iptale bastı

                const index = parseInt(secim) - 1;
                
                // 3. Seçilen grubu haritaya yükle
                if (index >= 0 && index < groups.length) {
                    const secilenGrupAdi = groups[index];
                    loadGroupController(secilenGrupAdi);
                } else {
                    alert("Geçersiz bir numara girdiniz!");
                }

            } catch (err) {
                if (window.LoadingManager) window.LoadingManager.hide();
                alert("Kayıtlı gruplar çekilirken bir hata oluştu: " + err.message);
            }
        });
    }
});