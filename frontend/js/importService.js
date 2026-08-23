const ImportService = {
    handleMeasurementImport: function(fileObject, fileName, map, uploadedFileSet, toggleVisibilityFn, deleteLayerFn) {
        
        // Mükerrer dosya uyarısı aynen korunuyor
        if (uploadedFileSet.has(fileName)) {
            alert(window.APP_MESSAGES.LAYER_ALREADY_LOADED(fileName));
            const targetLayer = MapManager.mapLayersStorage[fileName];
            if (targetLayer && map.hasLayer(targetLayer)) {
                map.fitBounds(targetLayer.getBounds());
            }
            return;
        }

        // Dosya okuma işlemi başlıyor, Yükleme Ekranını Aç
        if (window.LoadingManager) window.LoadingManager.show();

        const reader = new FileReader();

        reader.onload = function(event) {
            try {
                const geojsonContent = JSON.parse(event.target.result);
                let pointCount = 0, lineCount = 0, polygonCount = 0;

                const restoredLayer = L.geoJSON(geojsonContent, {
                    pointToLayer: function (feature, latlng) {
                        pointCount++;
                        return L.circleMarker(latlng, {
                            radius: GIS_CONFIG.MEASURE_STYLE.MARKER_RADIUS,
                            color: GIS_CONFIG.MEASURE_STYLE.LINE_COLOR,
                            fillColor: GIS_CONFIG.MEASURE_STYLE.FILL_COLOR,
                            fillOpacity: 1
                        });
                    },
                    style: function (feature) {
                        if (feature.geometry && feature.geometry.type.includes("LineString")) {
                            lineCount++;
                            return {
                                color: GIS_CONFIG.MEASURE_STYLE.LINE_COLOR,
                                weight: GIS_CONFIG.MEASURE_STYLE.WEIGHT,
                                dashArray: GIS_CONFIG.MEASURE_STYLE.DASH_ARRAY
                            };
                        } else if (feature.geometry && feature.geometry.type.includes("Polygon")) {
                            polygonCount++;
                            return {
                                color: '#28a745', weight: 3, fillColor: '#28a745', fillOpacity: 0.3
                            };
                        }
                    }
                }).addTo(map);

                restoredLayer.eachLayer((layer) => {
                    const currentId = 'restored_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

                    // --- POLYGON (ALAN) İÇİN DİNAMİK POPUP ---
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

                            layer.bindTooltip(`📐 Alan: ${areaFormatted}`, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip(layer.getBounds().getCenter());

                            const polyPopupHtml = `
                                <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                    <div id="main-content-${currentId}">
                                        <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri (Yüklenen)</div>
                                        <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                            <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Hesaplanmış Alan</td></tr>
                                            <tr><td style="color: #6c757d;">Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${areaFormatted}</td></tr>
                                        </table>
                                        
                                        <!-- BİLGİLERİ DÜZENLE (METADATA) HOOK -->
                                        ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}

                                        <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Alanı Haritadan Sil</button>
                                    </div>
                                </div>
                            `;
                            
                            layer.bindPopup(polyPopupHtml, { maxWidth: 250 });
                        }
                    } 
                    
                    // --- LINE (ÇİZGİ) İÇİN DİNAMİK POPUP ---
                    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                        const latlngs = layer.getLatLngs();
                        if (latlngs && latlngs.length >= 2) {
                            let totalDist = 0;
                            for(let i = 0; i < latlngs.length - 1; i++) {
                                totalDist += latlngs[i].distanceTo(latlngs[i+1]);
                            }
                            let distanceKm = (totalDist / 1000).toFixed(2);

                            layer.bindTooltip(`${distanceKm} km`, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();

                            const linePopupHtml = `
                                <div id="popup-wrapper-${currentId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                                    <div id="main-content-${currentId}">
                                        <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Ölçüm Bilgileri (Yüklenen)</div>
                                        <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                            <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Çizgi Rotası</td></tr>
                                            <tr><td style="color: #6c757d;">Toplam Çevre:</td><td style="font-weight: bold; color: #dc3545; text-align: right;">${distanceKm} km</td></tr>
                                        </table>
                                        
                                        <!-- BİLGİLERİ DÜZENLE (METADATA) HOOK -->
                                        ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(currentId) : ''}

                                        <button id="${currentId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Bu Ölçümü Haritadan Sil</button>
                                    </div>
                                </div>
                            `;

                            layer.bindPopup(linePopupHtml, { maxWidth: 250 });
                        }
                    }

                    // --- IMPORT EDİLEN POPUP AÇILDIĞINDA ETKİLEŞİMLERİ BAĞLAMA ---
                    layer.on('popupopen', () => {
                        // Silme İşlemi
                        document.getElementById(currentId)?.addEventListener('click', () => { restoredLayer.removeLayer(layer); });

                        // Sadece Metadata'yı Çalıştır (Stil değiştirme ayarları buradan tamamen kaldırıldı)
                        if (window.FeatureMetadata) {
                            window.FeatureMetadata.bindMetadataEvents(layer, currentId);
                        }
                    });
                });

                MapManager.mapLayersStorage[fileName] = restoredLayer;
                uploadedFileSet.add(fileName);

                Sidebar.appendLayerCard(
                    fileName, pointCount, lineCount, polygonCount, toggleVisibilityFn, deleteLayerFn,
                    (name) => {
                        const target = MapManager.mapLayersStorage[name];
                        if (target) map.fitBounds(target.getBounds());
                    }
                );

                if (restoredLayer.getBounds().isValid()) {
                    map.fitBounds(restoredLayer.getBounds());
                }
                
                // Dosya hatasız parse edildi ve haritaya işlendi Yükleme Ekranını Kapat
                if (window.LoadingManager) window.LoadingManager.hide();

            } catch (err) {
                // Hata durumunda da ekranın donup kalmaması için Loading Ekranını Kapat
                if (window.LoadingManager) window.LoadingManager.hide();
                alert(window.APP_MESSAGES.IMPORT_ERROR(err.message));
            }
        };
        
        reader.readAsText(fileObject);
    }
};

window.ImportService = ImportService;