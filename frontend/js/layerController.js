const LayerController = {
    map: null,
    uploadedFileSet: new Set(),

    init: function(mapInstance) {
        this.map = mapInstance;
    },

    toggleLayerVisibility: function(name) {
        const targetLayer = MapManager.mapLayersStorage[name];
        if (!targetLayer) return false;

        if (this.map.hasLayer(targetLayer)) {
            this.map.removeLayer(targetLayer);
            return false; 
        } else {
            this.map.addLayer(targetLayer);
            return true; 
        }
    },

    deleteLayerController: function(name) {
        const targetLayer = MapManager.mapLayersStorage[name];
        if (targetLayer) {
            if (this.map.hasLayer(targetLayer)) this.map.removeLayer(targetLayer);
            delete MapManager.mapLayersStorage[name];
        }
        this.uploadedFileSet.delete(name);
        if(window.HeatmapManager) window.HeatmapManager.removeHeatmap(name);
    },

    focusLayerController: function(name) {
        const targetLayer = MapManager.mapLayersStorage[name];
        if (targetLayer) {
            if (!this.map.hasLayer(targetLayer)) {
                this.map.addLayer(targetLayer);
                const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
                const toggleBtn = document.getElementById(`toggle_${safeId}`);
                const cardEl = document.getElementById(`card_${safeId}`);
                if (toggleBtn) toggleBtn.innerText = "👁️";
                if (cardEl) cardEl.style.opacity = "1";
            }
            MapManager.flyToLayerBounds(targetLayer);
        }
    },

    // 1. TAMAMEN ORİJİNAL loadGroupController MANTIĞI
    // (isAutoLoad parametresi, sayfa ilk açıldığında ekrana zırt pırt loading veya uyarı çıkarmaması için eklendi)
    loadGroupController: function(grupAdi, isAutoLoad = false) {
        if (this.uploadedFileSet.has(grupAdi)) {
            if (!isAutoLoad) {
                alert(window.APP_MESSAGES?.LAYER_ALREADY_LOADED ? window.APP_MESSAGES.LAYER_ALREADY_LOADED(grupAdi) : "Bu çalışma zaten yüklü!");
                this.focusLayerController(grupAdi); 
            }
            if (window.LoadingManager && !isAutoLoad) window.LoadingManager.hide();
            return; 
        }

        if (window.LoadingManager && !isAutoLoad) window.LoadingManager.show();

        ApiService.fetchGroupByName(grupAdi)
            .then(incomingModel => {
                setTimeout(() => {
                    try {
                        // ESKİ KUSURSUZ DÖNÜŞTÜRME (STANDARTLAŞTIRMA) MANTIĞI
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

                        // ESKİ KUSURSUZ STİL VE RENK MANTIĞI (değişmedi, sadece haritaya direkt eklenmiyor,
                        // önce objelerine ayırıp gruplayacağız)
                        const flatLayer = L.geoJSON(standardizedGeoJson, {
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
                        });

                        // Bütün parçaları (nokta/çizgi/poligon) "objectId"'ye göre kendi objesinde topluyoruz.
                        // objectId yoksa (eski/legacy kayıt) her parçayı kendi başına bir obje kabul ediyoruz,
                        // yani eski davranış aynen korunuyor.
                        const objectBuckets = {};
                        let legacyCounter = 0;
                        flatLayer.eachLayer((sublayer) => {
                            const props = (sublayer.feature && sublayer.feature.properties) || {};
                            const objectId = props.objectId || ('legacy_' + (legacyCounter++));
                            if (!objectBuckets[objectId]) objectBuckets[objectId] = [];
                            objectBuckets[objectId].push(sublayer);
                        });

                        // Tüm objeleri içine alacak ana kap. Sidebar'dan "dosyayı sil" dendiğinde
                        // bu kap kaldırılır ve içindeki her şey (tüm objeler) birlikte gider.
                        const restoredLayer = L.featureGroup().addTo(this.map);

                        Object.keys(objectBuckets).forEach((objectId) => {
                            const parts = objectBuckets[objectId];

                            // Bu objenin baskın tipini (Point / LineString / Polygon) parçalarından anlıyoruz
                            let objectType = 'Point';
                            parts.forEach((p) => {
                                const gt = ((p.feature && p.feature.geometry && p.feature.geometry.type) || '').toLowerCase();
                                if (gt.includes('polygon')) objectType = 'Polygon';
                                else if (gt.includes('line') && objectType !== 'Polygon') objectType = 'LineString';
                            });

                            // Objenin tüm parçalarını (nokta+çizgi/poligon gövdesi) TEK bir featureGroup'a topluyoruz.
                            // Böylece bu objeye ait tek bir popup ve tek bir silme butonu olacak; silince
                            // parçaların hepsi (örn. bir poligonun kendi köşe noktaları) birlikte silinecek.
                            const objectGroup = L.featureGroup(parts).addTo(restoredLayer);

                            // Varsa daha önce kaydedilmiş metadata'yı gruba taşıyoruz ki popup açılınca görünsün
                            const existingMeta = parts
                                .map(p => p.feature && p.feature.properties && p.feature.properties.userMetadata)
                                .find(m => m && (m.name || m.category || m.description));
                            objectGroup.feature = {
                                type: 'Feature',
                                properties: { userMetadata: existingMeta || JSON.parse(JSON.stringify(window.METADATA_CONFIG.DEFAULT_TEMPLATE)) }
                            };

                            // Poligon/çizgi gövdesine (varsa) etiket (uzunluk/alan) tooltip'ini geri bağlıyoruz
                            const shapePart = parts.find(p => p instanceof L.Polygon) || parts.find(p => p instanceof L.Polyline && !(p instanceof L.Polygon));
                            if (shapePart && shapePart.feature && shapePart.feature.properties && shapePart.feature.properties.label) {
                                shapePart.bindTooltip(shapePart.feature.properties.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                            }

                            const currentId = 'restored_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

                            let popupContent;
                            if (objectType === 'Point') {
                                const soloPoint = parts[0];
                                const lat = soloPoint.getLatLng().lat.toFixed(5);
                                const lng = soloPoint.getLatLng().lng.toFixed(5);
                                popupContent = `
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
                                        ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(currentId, 'Point') : ''}
                                    </div>`;
                            } else if (objectType === 'Polygon') {
                                popupContent = `
                                    <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                        <div id="main-content-${currentId}">
                                            <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                            <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Sil</button>
                                        </div>
                                        ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(currentId, 'Polygon') : ''}
                                    </div>`;
                            } else {
                                popupContent = `
                                    <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                        <div id="main-content-${currentId}">
                                            <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Çizgi Bilgileri</div>
                                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                            <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Sil</button>
                                        </div>
                                        ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(currentId, 'LineString') : ''}
                                    </div>`;
                            }

                            objectGroup.bindPopup(popupContent, { maxWidth: 250 });

                            // Objenin herhangi bir parçasına tıklanınca objenin TAMAMINA (bütün parçalarına) odaklan
                            parts.forEach((part) => {
                                part.on('click', () => {
                                    if (objectType === 'Point') {
                                        this.map.flyTo(parts[0].getLatLng(), 14, { duration: 1.2, easeLinearity: 0.25 });
                                    } else if (objectGroup.getBounds().isValid()) {
                                        this.map.flyToBounds(objectGroup.getBounds(), { padding: [50, 50], duration: 1.2, easeLinearity: 0.25 });
                                    }
                                });
                            });

                            objectGroup.on('popupopen', () => {
                                // Silme butonu: objeye ait TÜM parçaları (nokta+gövde) birlikte kaldırır
                                document.getElementById(currentId)?.addEventListener('click', () => {
                                    restoredLayer.removeLayer(objectGroup);
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(objectGroup, currentId);
                                if (window.StyleSettings) window.StyleSettings.bindEvents(objectGroup, currentId, objectType);
                            });
                        });

                        MapManager.mapLayersStorage[grupAdi] = restoredLayer;
                        this.uploadedFileSet.add(grupAdi);

                        Sidebar.appendLayerCard(
                            grupAdi, pointCount, lineCount, polygonCount, 
                            (name) => this.toggleLayerVisibility(name), 
                            (name) => this.deleteLayerController(name), 
                            (name) => this.focusLayerController(name)
                        );

                        if (restoredLayer && Object.keys(restoredLayer._layers).length > 0 && !isAutoLoad) {
                            MapManager.flyToLayerBounds(restoredLayer);
                        }

                        if (window.LoadingManager && !isAutoLoad) window.LoadingManager.hide();

                    } catch (error) {
                        if (window.LoadingManager && !isAutoLoad) window.LoadingManager.hide();
                        console.error("Harita verisi işlenirken hata oluştu: " + error.message);
                    }
                }, 50);
            })
            .catch(error => {
                if (window.LoadingManager && !isAutoLoad) window.LoadingManager.hide();
                console.error("Veritabanından grup alınamadı: " + error.message);
            });
    },

    // 2. HAYALET MARKER'LARI ÇÖZEN YER! (Otomatik Yükleme)
    loadSavedMeasurementsFromDatabase: async function() {
        try {
            const groupNames = await ApiService.fetchGroupList();
            if (groupNames && groupNames.length > 0) {
                for (const groupName of groupNames) {
                    // İkinci parametredeki 'true' sayesinde ekranda loading vs. çıkmayacak, alttan sessizce yüklenecek.
                    this.loadGroupController(groupName, true);
                }
                console.log("Veritabanındaki tüm grup katmanları başarıyla haritaya yüklendi! 🚀");
            }
        } catch (e) {
            console.error("Veritabanından grup katmanları yüklenirken hata oluştu:", e);
        }
    }
};

window.LayerController = LayerController;