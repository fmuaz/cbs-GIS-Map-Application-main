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

        const getImportedMetadataHtml = (meta) => {
            if (!meta || Object.keys(meta).length === 0) return '';
            let html = '<div style="background:#f8f9fa; border-left:3px solid #17a2b8; padding:8px; margin-bottom:10px; border-radius:4px; font-size:11.5px;">';
            html += '<div style="font-weight:bold; color:#17a2b8; margin-bottom:4px;">Notlar / Metadata:</div>';
            for (let k in meta) {
                html += `<div style="margin-bottom:3px;"><span style="color:#6c757d;">${k}:</span> <strong style="color:#212529;">${meta[k]}</strong></div>`;
            }
            html += '</div>';
            return html;
        };

        reader.onload = function(event) {
            try {
                const geojsonContent = JSON.parse(event.target.result);
                let pointCount = 0, lineCount = 0, polygonCount = 0;

                // 🔥 YENİ: Senkronizasyon - Dosya adı ile JSON kayıt adını eşitliyoruz
                geojsonContent.properties = geojsonContent.properties || {};
                geojsonContent.properties.grupAdi = fileName;

                const layerStorageGroup = L.featureGroup().addTo(map);

                const features = geojsonContent.features || (geojsonContent.type === "Feature" ? [geojsonContent] : []);

                features.forEach(feature => {
                    const geomType = feature.geometry ? feature.geometry.type : '';
                    const props = feature.properties || {};
                    
                    // 🔥 YENİ: İç objelerin de grup adını eşitliyoruz
                    props.grupAdi = fileName;

                    const style = props.style || {};
                    const uniqueId = props.objectId || ('restored_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

                    // --- 1. POLİGON IMPORT ---
                    if (geomType.includes("Polygon")) {
                        polygonCount++;
                        const coords = feature.geometry.coordinates[0].map(c => [c[1], c[0]]); 
                        
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

                        if (props.metadata) {
                            polyGroup.metadata = props.metadata;
                            polyGroup.feature = polyGroup.feature || { type: 'Feature', properties: {} };
                            polyGroup.feature.properties.metadata = props.metadata;
                        }

                        let areaFormatted = "Hesaplanıyor...";
                        if (window.turf) {
                            const turfPoly = turf.polygon(feature.geometry.coordinates);
                            const areaM2 = turf.area(turfPoly);
                            areaFormatted = areaM2 >= 1000000 ? `${(areaM2 / 1000000).toFixed(2)} km²` : `${areaM2.toFixed(0)} m²`;
                            polyGroup.bindTooltip(props.label || `📐 Alan: ${areaFormatted}`, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                        }

                        const polyPopupHtml = `
                            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${uniqueId}">
                                    <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                                        <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Hesaplanmış Alan</td></tr>
                                        <tr><td style="color: #6c757d;">Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${areaFormatted}</td></tr>
                                    </table>
                                    ${getImportedMetadataHtml(props.metadata)}
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-top: 5px;">🗑️ Alanı Haritadan Sil</button>
                                </div>
                            </div>
                        `;
                        
                        polyGroup.bindPopup(polyPopupHtml, { maxWidth: 250 });

                        polyGroup.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${uniqueId}`)?.addEventListener('click', () => {
                                    if (window.HistoryManager) {
                                        window.HistoryManager.execute({
                                            redo: () => { map.removeLayer(polyGroup); layerStorageGroup.removeLayer(polyGroup); },
                                            undo: () => { map.addLayer(polyGroup); layerStorageGroup.addLayer(polyGroup); }
                                        });
                                    } else {
                                        map.removeLayer(polyGroup);
                                        layerStorageGroup.removeLayer(polyGroup);
                                    }
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(polyGroup, uniqueId);
                            }, 50);
                        });
                    }

                    // --- 2. ÇİZGİ IMPORT ---
                    else if (geomType.includes("LineString")) {
                        lineCount++;
                        const coords = feature.geometry.coordinates.map(c => [c[1], c[0]]);
                        
                        let distanceKm = "0.00";
                        if (coords.length >= 2) {
                            let totalDist = 0;
                            for (let i = 0; i < coords.length - 1; i++) {
                                totalDist += L.latLng(coords[i]).distanceTo(L.latLng(coords[i+1]));
                            }
                            distanceKm = (totalDist / 1000).toFixed(2);
                        }

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

                        if (props.metadata) {
                            lineGroup.metadata = props.metadata;
                            lineGroup.feature = lineGroup.feature || { type: 'Feature', properties: {} };
                            lineGroup.feature.properties.metadata = props.metadata;
                        }

                        if (props.label) {
                            lineGroup.bindTooltip(props.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                        }

                        const linePopupHtml = `
                            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${uniqueId}">
                                    <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Çizgi Ölçümü</div>
                                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                                        <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Çizgi Rotası</td></tr>
                                        <tr><td style="color: #6c757d;">Mesafe:</td><td style="font-weight: bold; color: #dc3545; text-align: right;">${distanceKm} km</td></tr>
                                    </table>
                                    ${getImportedMetadataHtml(props.metadata)}
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-top: 5px;">🗑️ Çizgiyi Sil</button>
                                </div>
                            </div>
                        `;
                        
                        lineGroup.bindPopup(linePopupHtml, { maxWidth: 250 });

                        lineGroup.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${uniqueId}`)?.addEventListener('click', () => {
                                    if (window.HistoryManager) {
                                        window.HistoryManager.execute({
                                            redo: () => { map.removeLayer(lineGroup); layerStorageGroup.removeLayer(lineGroup); },
                                            undo: () => { map.addLayer(lineGroup); layerStorageGroup.addLayer(lineGroup); }
                                        });
                                    } else {
                                        map.removeLayer(lineGroup);
                                        layerStorageGroup.removeLayer(lineGroup);
                                    }
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(lineGroup, uniqueId);
                            }, 50);
                        });
                    }

                    // --- 3. NOKTA (POINT) IMPORT ---
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
                        });

                        const pointGroup = L.featureGroup([marker]).addTo(map);
                        layerStorageGroup.addLayer(pointGroup);

                        if (props.metadata) {
                            pointGroup.metadata = props.metadata;
                            pointGroup.feature = pointGroup.feature || { type: 'Feature', properties: {} };
                            pointGroup.feature.properties.metadata = props.metadata;
                        }

                        const pointPopupHtml = `
                            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${uniqueId}">
                                    <div style="font-weight: bold; color: #ffc107; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">📍 Nokta Bilgileri</div>
                                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                                        <tr><td style="color: #6c757d;">Enlem:</td><td style="font-weight: bold; text-align: right;">${latlng[0].toFixed(5)}</td></tr>
                                        <tr><td style="color: #6c757d;">Boylam:</td><td style="font-weight: bold; text-align: right;">${latlng[1].toFixed(5)}</td></tr>
                                    </table>
                                    ${getImportedMetadataHtml(props.metadata)}
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">🗑️ Noktayı Sil</button>
                                </div>
                            </div>
                        `;
                        pointGroup.bindPopup(pointPopupHtml, { maxWidth: 250 });

                        pointGroup.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${uniqueId}`)?.addEventListener('click', () => {
                                    if (window.HistoryManager) {
                                        window.HistoryManager.execute({
                                            redo: () => { map.removeLayer(pointGroup); layerStorageGroup.removeLayer(pointGroup); },
                                            undo: () => { map.addLayer(pointGroup); layerStorageGroup.addLayer(pointGroup); }
                                        });
                                    } else {
                                        map.removeLayer(pointGroup);
                                        layerStorageGroup.removeLayer(pointGroup);
                                    }
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(pointGroup, uniqueId);
                            }, 50);
                        });
                    }
                });

                if (window.MapManager) {
                    MapManager.mapLayersStorage[fileName] = layerStorageGroup;
                }
                
                uploadedFileSet.add(fileName);

                const onToggleClick = (name) => {
                    const target = MapManager.mapLayersStorage[name];
                    if (!target) return false;

                    if (map.hasLayer(target)) {
                        map.removeLayer(target);
                        return false; 
                    } else {
                        map.addLayer(target);
                        return true;  
                    }
                };

                const onDeleteClick = (name) => {
                    if (typeof deleteLayerFn === 'function') deleteLayerFn(name);

                    const target = MapManager.mapLayersStorage[name];
                    if (target && map.hasLayer(target)) map.removeLayer(target);
                    delete MapManager.mapLayersStorage[name];

                    uploadedFileSet.delete(name);

                    if (window.SessionManager) {
                        const activeLayers = Array.from(uploadedFileSet);
                        sessionStorage.setItem(window.SessionManager.layersKey, JSON.stringify(activeLayers));
                        window.SessionManager.updateActivity();
                    }
                };

                const onFocusClick = (name) => {
                    const target = MapManager.mapLayersStorage[name];
                    if (target) map.fitBounds(target.getBounds());
                };

                if (window.Sidebar) {
                    Sidebar.appendLayerCard(fileName, pointCount, lineCount, polygonCount, onToggleClick, onDeleteClick, onFocusClick);
                }

                if (window.HistoryManager) {
                    window.HistoryManager.add({
                        undo: () => {
                            map.removeLayer(layerStorageGroup);
                            delete MapManager.mapLayersStorage[fileName];
                            uploadedFileSet.delete(fileName);
                            if (window.Sidebar) {
                                window.Sidebar.state = window.Sidebar.state.filter(s => s.fileName !== fileName);
                                const searchText = document.getElementById('layerSearchInput')?.value.toLocaleLowerCase('tr-TR').trim() || '';
                                window.Sidebar.renderList(searchText);
                            }
                        },
                        redo: () => {
                            map.addLayer(layerStorageGroup);
                            MapManager.mapLayersStorage[fileName] = layerStorageGroup;
                            uploadedFileSet.add(fileName);
                            if (window.Sidebar) {
                                Sidebar.appendLayerCard(fileName, pointCount, lineCount, polygonCount, onToggleClick, onDeleteClick, onFocusClick);
                            }
                        }
                    });
                }

                if (layerStorageGroup.getBounds().isValid()) {
                    map.fitBounds(layerStorageGroup.getBounds());
                }

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