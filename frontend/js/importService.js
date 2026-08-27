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
                    console.error("Harita nesnesi bulunamadı.");
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

                const restoredLayer = L.geoJSON(geojsonContent, {
                    // --- 1. POINT STYLE RESTORE ---
                    pointToLayer: function (feature, latlng) {
                        const savedStyle = feature.properties?.style || {};
                        return L.circleMarker(latlng, {
                            radius: savedStyle.radius || window.GIS_CONFIG?.MEASURE_STYLE?.MARKER_RADIUS || 5,
                            color: savedStyle.color || window.GIS_CONFIG?.MEASURE_STYLE?.LINE_COLOR || '#007bff',
                            fillColor: savedStyle.fillColor || window.GIS_CONFIG?.MEASURE_STYLE?.FILL_COLOR || '#007bff',
                            fillOpacity: savedStyle.fillOpacity !== undefined ? savedStyle.fillOpacity : 1,
                            opacity: savedStyle.opacity !== undefined ? savedStyle.opacity : 1,
                            weight: savedStyle.weight || 2
                        });
                    },
                    // --- 2. LINE VE POLYGON STYLE RESTORE ---
                    style: function (feature) {
                        if (feature.properties && feature.properties.style && Object.keys(feature.properties.style).length > 0) {
                            return feature.properties.style;
                        }
                        
                        if (feature.geometry && feature.geometry.type.includes("LineString")) {
                            return {
                                color: window.GIS_CONFIG?.MEASURE_STYLE?.LINE_COLOR || '#007bff',
                                weight: window.GIS_CONFIG?.MEASURE_STYLE?.WEIGHT || 3,
                                dashArray: window.GIS_CONFIG?.MEASURE_STYLE?.DASH_ARRAY || null
                            };
                        } else if (feature.geometry && feature.geometry.type.includes("Polygon")) {
                            return { color: '#28a745', weight: 3, fillColor: '#28a745', fillOpacity: 0.3 };
                        }
                    },
                    // --- 3. SAYIMLAR VE METADATA RESTORE ---
                    onEachFeature: function(feature, layer) {
                        // Sayımları doğru yapabilmek için türleri burada artırıyoruz
                        if (feature.geometry) {
                            if (feature.geometry.type === "Point") pointCount++;
                            else if (feature.geometry.type.includes("LineString")) lineCount++;
                            else if (feature.geometry.type.includes("Polygon")) polygonCount++;
                        }

                        if (feature.properties?.metadata) layer.metadata = feature.properties.metadata;
                        if (feature.properties?.toolType) layer.toolType = feature.properties.toolType;
                        if (feature.properties?.isBuffer !== undefined) layer.isBuffer = feature.properties.isBuffer;
                        if (feature.properties?.layerName) layer.layerName = feature.properties.layerName;
                        if (feature.properties?.objectId) layer._objectId = feature.properties.objectId;

                        if (feature.properties?.style) {
                            Object.assign(layer.options, feature.properties.style);
                        }
                    }
                }).addTo(map);

                // --- 4. POPUP VE ETKİLEŞİM MANTIĞI (POINT DAHİL) ---
                restoredLayer.eachLayer((layer) => {
                    const currentId = 'restored_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                    const layerFeature = layer.feature || {};
                    const layerProps = layerFeature.properties || {};

                    // Point (Nokta) Popup Desteği
                    if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
                        const latlng = layer.getLatLng();
                        const pointPopupHtml = `
                            <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                <div id="main-content-${currentId}">
                                    <div style="font-weight: bold; color: #ffc107; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">📍 Nokta Bilgileri</div>
                                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                                        <tr><td style="color: #6c757d;">Enlem:</td><td style="font-weight: bold; text-align: right;">${latlng.lat.toFixed(5)}</td></tr>
                                        <tr><td style="color: #6c757d;">Boylam:</td><td style="font-weight: bold; text-align: right;">${latlng.lng.toFixed(5)}</td></tr>
                                    </table>
                                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                    <button id="del_${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">🗑️ Noktayı Sil</button>
                                </div>
                            </div>
                        `;
                        layer.bindPopup(pointPopupHtml, { maxWidth: 250 });
                        
                        layer.on('popupopen', () => {
                            setTimeout(() => {
                                document.getElementById(`del_${currentId}`)?.addEventListener('click', () => {
                                    restoredLayer.removeLayer(layer);
                                });
                                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(layer, currentId);
                            }, 50);
                        });
                        return;
                    }

                    // Polygon Popup
                    if (layer instanceof L.Polygon) {
                        const rawLatLngs = layer.getLatLngs()[0];
                        if (rawLatLngs && rawLatLngs.length >= 3) {
                            const turfCoordinates = rawLatLngs.map(p => [parseFloat(p.lng), parseFloat(p.lat)]);
                            turfCoordinates.push([parseFloat(rawLatLngs[0].lng), parseFloat(rawLatLngs[0].lat)]);

                            const turfPolygon = turf.polygon([turfCoordinates]);
                            const areaSquareMeters = turf.area(turfPolygon);

                            let areaFormatted = areaSquareMeters >= 1000000 
                                ? `${(areaSquareMeters / 1000000).toFixed(2)} km²` 
                                : `${areaSquareMeters.toFixed(0)} m²`;

                            if (layerProps.label) {
                                layer.bindTooltip(layerProps.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip(layer.getBounds().getCenter());
                            } else {
                                layer.bindTooltip(`📐 Alan: ${areaFormatted}`, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip(layer.getBounds().getCenter());
                            }

                            const polyPopupHtml = `
                                <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                    <div id="main-content-${currentId}">
                                        <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                                        <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                            <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Hesaplanmış Alan</td></tr>
                                            <tr><td style="color: #6c757d;">Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${areaFormatted}</td></tr>
                                        </table>
                                        ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                        <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">🗑️ Alanı Haritadan Sil</button>
                                    </div>
                                </div>
                            `;
                            layer.bindPopup(polyPopupHtml, { maxWidth: 250 });
                        }
                    } 
                    
                    // Line Popup
                    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                        const latlngs = layer.getLatLngs();
                        if (latlngs && latlngs.length >= 2) {
                            let totalDist = 0;
                            for(let i = 0; i < latlngs.length - 1; i++) {
                                totalDist += latlngs[i].distanceTo(latlngs[i+1]);
                            }
                            let distanceKm = (totalDist / 1000).toFixed(2);

                            if (layerProps.label) {
                                layer.bindTooltip(layerProps.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                            } else {
                                layer.bindTooltip(`${distanceKm} km`, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
                            }

                            const linePopupHtml = `
                                <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                    <div id="main-content-${currentId}">
                                        <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Ölçüm Bilgileri</div>
                                        <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                            <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Çizgi Rotası</td></tr>
                                            <tr><td style="color: #6c757d;">Toplam Çevre:</td><td style="font-weight: bold; color: #dc3545; text-align: right;">${distanceKm} km</td></tr>
                                        </table>
                                        ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}
                                        <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">🗑️ Ölçümü Sil</button>
                                    </div>
                                </div>
                            `;
                            layer.bindPopup(linePopupHtml, { maxWidth: 250 });
                        }
                    }

                    layer.on('popupopen', () => {
                        document.getElementById(currentId)?.addEventListener('click', () => { restoredLayer.removeLayer(layer); });
                        if (window.FeatureMetadata) {
                            window.FeatureMetadata.bindMetadataEvents(layer, currentId);
                        }
                    });
                });

                if (window.MapManager) {
                    MapManager.mapLayersStorage[fileName] = restoredLayer;
                }
                
                uploadedFileSet.add(fileName);

                if (window.Sidebar) {
                    Sidebar.appendLayerCard(
                        fileName, pointCount, lineCount, polygonCount, toggleVisibilityFn, deleteLayerFn,
                        (name) => {
                            const target = MapManager.mapLayersStorage[name];
                            if (target) map.fitBounds(target.getBounds());
                        }
                    );
                }

                if (restoredLayer.getBounds().isValid()) {
                    map.fitBounds(restoredLayer.getBounds());
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