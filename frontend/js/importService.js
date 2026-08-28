const ImportService = {
    triggerFileInput: function() {
        let fileInput = document.getElementById('local-geojson-importer');
        
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'local-geojson-importer';
            fileInput.accept = '.geojson, .json';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const fileName = file.name.replace(/\.[^/.]+$/, ""); 
                
                const map = window.LayerController ? LayerController.map : (window.MapManager && window.MapManager.map ? window.MapManager.map : null);
                const uploadedFileSet = window.LayerController && LayerController.uploadedFileSet ? LayerController.uploadedFileSet : new Set();
                const toggleVisibilityFn = window.LayerController ? LayerController.toggleLayerVisibility : function(){};
                const deleteLayerFn = window.LayerController ? LayerController.deleteLayer : function(){};

                if (!map) {
                    alert("Harita yüklenemedi. Lütfen sayfayı yenileyin.");
                    return;
                }

                this.handleMeasurementImport(file, fileName, map, uploadedFileSet, toggleVisibilityFn, deleteLayerFn);
                fileInput.value = ""; 
            });
        }
        fileInput.click();
    },

    handleMeasurementImport: function(fileObject, fileName, map, uploadedFileSet, toggleVisibilityFn, deleteLayerFn) {
        if (uploadedFileSet.has(fileName)) {
            alert(window.APP_MESSAGES?.LAYER_ALREADY_LOADED ? window.APP_MESSAGES.LAYER_ALREADY_LOADED(fileName) : `Bu katman zaten yüklü: ${fileName}`);
            const targetLayer = window.MapManager && window.MapManager.mapLayersStorage ? window.MapManager.mapLayersStorage[fileName] : null;
            if (targetLayer && map.hasLayer(targetLayer)) {
                map.fitBounds(targetLayer.getBounds());
            }
            return;
        }

        if (window.LoadingManager) window.LoadingManager.show();

        const reader = new FileReader();

        reader.onload = function(event) {
            try {
                const geojsonContent = JSON.parse(event.target.result);
                let pointCount = 0, lineCount = 0, polygonCount = 0;

                const layerStorageGroup = L.featureGroup().addTo(map);

                const features = geojsonContent.features || (geojsonContent.type === "Feature" ? [geojsonContent] : []);

                features.forEach(feature => {
                    const geomType = feature.geometry ? feature.geometry.type : '';
                    const props = feature.properties || {};
                    const style = props.style || {};
                    const uniqueId = props.objectId || ('restored_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

                    // --- 1. POLİGON IMPORT (KÖŞE NOKTALARI VE GÖVDE TEK GRUPTA) ---
                    if (geomType.includes("Polygon")) {
                        polygonCount++;
                        const coords = feature.geometry.coordinates[0].map(c => [c[1], c[0]]); // [lat, lng]
                        
                        const poly = L.polygon(coords, {
                            color: style.color || '#28a745',
                            weight: style.weight !== undefined ? style.weight : 3,
                            fillColor: style.fillColor || '#28a745',
                            fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 0.3,
                            dashArray: style.dashArray || null
                        });

                        const polyMarkers = [];
                        coords.forEach(pt => {
                            const m = L.circleMarker(pt, { radius: 5, color: '#0056b3', fillColor: '#007bff', fillOpacity: 1, interactive: false });
                            polyMarkers.push(m);
                        });

                        const polyGroup = L.featureGroup();
                        polyGroup.addLayer(poly);
                        polyMarkers.forEach(m => polyGroup.addLayer(m));
                        polyGroup.addTo(map);
                        layerStorageGroup.addLayer(polyGroup);

                        if (props.metadata) polyGroup.metadata = props.metadata;

                        // Alan Tooltip
                        if (window.turf) {
                            const turfPoly = turf.polygon(feature.geometry.coordinates);
                            const areaM2 = turf.area(turfPoly);
                            const areaFormatted = areaM2 >= 1000000 ? `${(areaM2 / 1000000).toFixed(2)} km²` : `${areaM2.toFixed(0)} m²`;
                            poly.bindTooltip(props.label || `📐 Alan: ${areaFormatted}`, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                        }

                        // Popup ve Tek Tıkla Toplu Silme
                        const polyPopupHtml = `
                            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${uniqueId}">
                                    <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-top: 5px;">🗑️ Alanı Haritadan Sil</button>
                                </div>
                            </div>
                        `;
                        poly.bindPopup(polyPopupHtml, { maxWidth: 250 });

                        poly.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${uniqueId}`)?.addEventListener('click', () => {
                                    map.removeLayer(polyGroup);
                                    layerStorageGroup.removeLayer(polyGroup);
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(polyGroup, uniqueId);
                            }, 50);
                        });
                    }

                    // 2. ÇİZGİ IMPORT (TÜM KENARLAR VE NOKTALAR BİRLİKTE SİLİNİR)
                    else if (geomType.includes("LineString")) {
                        lineCount++;
                        const coords = feature.geometry.coordinates.map(c => [c[1], c[0]]);
                        
                        const line = L.polyline(coords, {
                            color: style.color || '#007bff',
                            weight: style.weight !== undefined ? style.weight : 3,
                            dashArray: style.dashArray || null
                        });

                        const lineMarkers = [];
                        coords.forEach(pt => {
                            const m = L.circleMarker(pt, { radius: 4, color: style.color || '#007bff', fillColor: style.color || '#007bff', fillOpacity: 1, interactive: false });
                            lineMarkers.push(m);
                        });

                        const lineGroup = L.featureGroup();
                        lineGroup.addLayer(line);
                        lineMarkers.forEach(m => lineGroup.addLayer(m));
                        lineGroup.addTo(map);
                        layerStorageGroup.addLayer(lineGroup);

                        if (props.metadata) lineGroup.metadata = props.metadata;

                        if (props.label) {
                            line.bindTooltip(props.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                        }

                        const linePopupHtml = `
                            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${uniqueId}">
                                    <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Çizgi Ölçümü</div>
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-top: 5px;">🗑️ Çizgiyi Sil</button>
                                </div>
                            </div>
                        `;
                        line.bindPopup(linePopupHtml, { maxWidth: 250 });

                        line.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${uniqueId}`)?.addEventListener('click', () => {
                                    map.removeLayer(lineGroup);
                                    layerStorageGroup.removeLayer(lineGroup);
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(lineGroup, uniqueId);
                            }, 50);
                        });
                    }

                    // --- 3. BAĞIMSIZ NOKTA (POINT) IMPORT ---
                    else if (geomType === "Point") {
                        pointCount++;
                        const latlng = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                        const marker = L.circleMarker(latlng, {
                            radius: style.radius || 6,
                            color: style.color || '#ffc107',
                            weight: style.weight || 2,
                            fillColor: style.fillColor || '#ffc107',
                            fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 1,
                            interactive: true
                        }).addTo(map);

                        layerStorageGroup.addLayer(marker);
                        if (props.metadata) marker.metadata = props.metadata;

                        const pointPopupHtml = `
                            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${uniqueId}">
                                    <div style="font-weight: bold; color: #ffc107; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">📍 Nokta Bilgileri</div>
                                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                                        <tr><td style="color: #6c757d;">Enlem:</td><td style="font-weight: bold; text-align: right;">${latlng[0].toFixed(5)}</td></tr>
                                        <tr><td style="color: #6c757d;">Boylam:</td><td style="font-weight: bold; text-align: right;">${latlng[1].toFixed(5)}</td></tr>
                                    </table>
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">🗑️ Noktayı Sil</button>
                                </div>
                            </div>
                        `;
                        marker.bindPopup(pointPopupHtml, { maxWidth: 250 });

                        marker.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${uniqueId}`)?.addEventListener('click', () => {
                                    map.removeLayer(marker);
                                    layerStorageGroup.removeLayer(marker);
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(marker, uniqueId);
                            }, 50);
                        });
                    }
                });

                if (window.MapManager) {
                    MapManager.mapLayersStorage[fileName] = layerStorageGroup;
                }
                
                uploadedFileSet.add(fileName);

                // Sağ panel kartını doğru sayılarla güncelle
                if (window.Sidebar) {
                    Sidebar.appendLayerCard(
                        fileName, pointCount, lineCount, polygonCount, 
                        
                        // 1. GÖZ İŞARETİ (TOGGLE)
                        (name) => {
                            const target = MapManager.mapLayersStorage[name];
                            if (!target) return false;
                            
                            // Haritada varsa kaldır, yoksa ekle
                            if (map.hasLayer(target)) { 
                                map.removeLayer(target); 
                                return false; // Gizlendi
                            } else { 
                                map.addLayer(target); 
                                return true;  // Görünür oldu
                            }
                        },

                        // 2. SİLME MANTIĞI 
                        (name) => {
                            if (typeof deleteLayerFn === 'function') deleteLayerFn(name);

                            const target = MapManager.mapLayersStorage[name];
                            if (target && map.hasLayer(target)) map.removeLayer(target);
                            delete MapManager.mapLayersStorage[name];

                            // SessionManager'ın dosyayı bir daha yüklememesi için aktif dosyalar kümesinden uçur
                            uploadedFileSet.delete(name);

                            if (window.SessionManager) {
                                const activeLayers = Array.from(uploadedFileSet);
                                sessionStorage.setItem(window.SessionManager.layersKey, JSON.stringify(activeLayers));
                                window.SessionManager.updateActivity();
                            }
                        },

                        // 3. TIKLAYINCA ODAKLANMA MANTIĞI 
                        (name) => {
                            const target = MapManager.mapLayersStorage[name];
                            if (target) map.fitBounds(target.getBounds());
                        }
                    );
                }

                if (layerStorageGroup.getBounds().isValid()) {
                    map.fitBounds(layerStorageGroup.getBounds());
                }

                // DB Kaydı
                if (window.ApiService && typeof window.ApiService.saveMeasurements === 'function') {
                    window.ApiService.saveMeasurements(geojsonContent)
                        .then(() => console.log(`[IMPORT DB] ${fileName} başarıyla veritabanına kaydedildi.`))
                        .catch(err => console.error("[IMPORT DB HATA] Veritabanı yedeği başarısız:", err));
                }

                if (window.LoadingManager) window.LoadingManager.hide();

            } catch (err) {
                if (window.LoadingManager) window.LoadingManager.hide();
                console.error("Local Import Parse Hatası:", err);
                alert(window.APP_MESSAGES?.IMPORT_ERROR ? window.APP_MESSAGES.IMPORT_ERROR(err.message) : `Dosya yüklenirken kritik hata: ${err.message}`);
            }
        };
        
        reader.readAsText(fileObject);
    }
};

window.ImportService = ImportService;