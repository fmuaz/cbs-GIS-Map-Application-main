const ImportService = {
    
    // 🔥 1. YENİ EKLENEN KISIM: Bilgisayardan Dosya Seçtirme Penceresi Açan Fonksiyon
    triggerFileInput: function() {
        let fileInput = document.getElementById('local-geojson-importer');
        
        // Gizli dosya seçici input oluşturulmamışsa DOM'a ekle
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'local-geojson-importer';
            fileInput.accept = '.geojson, .json';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            // Klasörden dosya seçildiğinde çalışacak yapı
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const fileName = file.name.replace(/\.[^/.]+$/, ""); // .geojson uzantısını kaldırır
                
                // Sistemin temel değişkenlerine güvenli erişim (Mevcut yapıdan çekiyoruz)
                const map = window.LayerController ? LayerController.map : (window.MapManager && window.MapManager.map ? window.MapManager.map : null);
                const uploadedFileSet = window.LayerController && LayerController.uploadedFileSet ? LayerController.uploadedFileSet : new Set();
                const toggleVisibilityFn = window.LayerController ? LayerController.toggleLayerVisibility : function(){};
                const deleteLayerFn = window.LayerController ? LayerController.deleteLayer : function(){};

                if (!map) {
                    alert("Harita yüklenemedi. Lütfen sayfayı yenileyin.");
                    return;
                }

                // Senin efsane ana import/yükleme fonksiyonuna paslıyoruz!
                this.handleMeasurementImport(file, fileName, map, uploadedFileSet, toggleVisibilityFn, deleteLayerFn);
                
                // Aynı dosyayı art arda iki kere seçebilmek için input'u sıfırla
                fileInput.value = ""; 
            });
        }
        
        fileInput.click();
    },

    // 🔥 2. ESKİ ORİJİNAL KODUN (Hiçbir şeye dokunulmadı, sadece DB'ye kaydetme eklendi)
    handleMeasurementImport: function(fileObject, fileName, map, uploadedFileSet, toggleVisibilityFn, deleteLayerFn) {
        
        // Mükerrer dosya uyarısı aynen korunuyor
        if (uploadedFileSet.has(fileName)) {
            alert(window.APP_MESSAGES?.LAYER_ALREADY_LOADED ? window.APP_MESSAGES.LAYER_ALREADY_LOADED(fileName) : `Bu katman zaten yüklü: ${fileName}`);
            const targetLayer = window.MapManager && window.MapManager.mapLayersStorage ? window.MapManager.mapLayersStorage[fileName] : null;
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
                            radius: window.GIS_CONFIG?.MEASURE_STYLE?.MARKER_RADIUS || 5,
                            color: window.GIS_CONFIG?.MEASURE_STYLE?.LINE_COLOR || '#007bff',
                            fillColor: window.GIS_CONFIG?.MEASURE_STYLE?.FILL_COLOR || '#007bff',
                            fillOpacity: 1
                        });
                    },
                    style: function (feature) {
                        if (feature.geometry && feature.geometry.type.includes("LineString")) {
                            lineCount++;
                            return {
                                color: window.GIS_CONFIG?.MEASURE_STYLE?.LINE_COLOR || '#007bff',
                                weight: window.GIS_CONFIG?.MEASURE_STYLE?.WEIGHT || 3,
                                dashArray: window.GIS_CONFIG?.MEASURE_STYLE?.DASH_ARRAY || null
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

                        // Sadece Metadata'yı Çalıştır
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

                // 🔥 3. YENİ EKLENEN KISIM: HARİTAYA YÜKLEDİKTEN SONRA DB'YE YEDEKLE 🔥
                if (window.ApiService && typeof window.ApiService.saveMeasurements === 'function') {
                    window.ApiService.saveMeasurements(geojsonContent)
                        .then(() => console.log(`[IMPORT DB] ${fileName} başarıyla veritabanına yedeklendi.`))
                        .catch(err => console.error("[IMPORT DB HATA] Veritabanı yedeği başarısız:", err));
                }

                // Dosya hatasız parse edildi ve haritaya işlendi Yükleme Ekranını Kapat
                if (window.LoadingManager) window.LoadingManager.hide();

            } catch (err) {
                // Hata durumunda da ekranın donup kalmaması için Loading Ekranını Kapat
                if (window.LoadingManager) window.LoadingManager.hide();
                alert(window.APP_MESSAGES?.IMPORT_ERROR ? window.APP_MESSAGES.IMPORT_ERROR(err.message) : `Dosya yüklenirken hata: ${err.message}`);
            }
        };
        
        reader.readAsText(fileObject);
    }
};

window.ImportService = ImportService;