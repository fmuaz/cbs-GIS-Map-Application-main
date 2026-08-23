const BufferTool = {
    map: null,

    init: function (leafletMap) {
        this.map = leafletMap;

        // Haritadaki mevcut (önceden yüklenmiş) katmanlara tıklandığında Buffer'ı çalıştır
        this.map.eachLayer(this.bindBufferEvent.bind(this));

        // Haritaya sonradan eklenecek (çizilen veya import edilen) katmanları dinle
        this.map.on('layeradd', (e) => {
            this.bindBufferEvent(e.layer);
        });
    },

    bindBufferEvent: function (layer) {
        // Sadece vektör objelerine (Polyline, Polygon) bağlanır. Marker veya BaseMap'leri yoksayar.
        if (layer instanceof L.Path && !(layer instanceof L.CircleMarker)) {

            if (layer._hasBufferBinding) return; // Çifte binding olmasını engelle
            layer._hasBufferBinding = true;

            layer.on('click', (e) => {
                // YENİ: Alt tuşu yerine Toolbar durumunu kontrol ediyoruz!
                if (window.StateManager && window.StateManager.activeTool === 'buffer') {
                    L.DomEvent.stopPropagation(e.originalEvent); // Map'in alt click olayını durdurur
                    this.createBuffer(layer, e);
                    
                    // İşlem bittikten sonra Buffer modundan otomatik çık (UX için)
                    window.StateManager.setTool('none'); 
                }
            });
        }
    },

    createBuffer: function (layer, e) {
        // 1. Tıklanan objeyi GeoJSON formatına çevir ve tipini kontrol et
        const geojson = layer.toGeoJSON();
        const type = geojson.geometry ? geojson.geometry.type : "Unknown";

        if (!['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(type)) {
            alert(window.APP_MESSAGES.BUFFER_INVALID_GEOMETRY);
            return;
        }

        // 2. Kullanıcıdan mesafe al
        const defaultDist = window.GIS_CONFIG.BUFFER.DEFAULT_DISTANCE;
        const distanceInput = prompt("Lütfen Buffer mesafesini giriniz (metre):", defaultDist);

        if (!distanceInput) return; // Prompt İptal edildi

        const distanceMeters = parseFloat(distanceInput);
        if (isNaN(distanceMeters) || distanceMeters <= 0) {
            alert(window.APP_MESSAGES.BUFFER_INVALID_DISTANCE);
            return;
        }

        try {
            // 3. Turf.js ile Buffer Geometrisini Oluştur (Turf, mesafeyi kilometre olarak ister)
            const distanceKm = distanceMeters / 1000;
            const bufferGeoJSON = turf.buffer(geojson, distanceKm, { units: 'kilometers' });

            // Alanı hesapla ve formatla
            const areaSqMeters = turf.area(bufferGeoJSON);
            const areaFormatted = areaSqMeters >= 1000000 
                ? `${(areaSqMeters / 1000000).toFixed(2)} km²` 
                : `${areaSqMeters.toFixed(0)} m²`;

            // 4. Yeni Buffer Layer'ını Leaflet üzerinde çizdir
            const layerName = `Buffer_${distanceMeters}m_${Date.now()}`;
            const bufferLayer = L.geoJSON(bufferGeoJSON, { 
                style: window.GIS_CONFIG.BUFFER.STYLE 
            }).addTo(this.map);

            // Her bir alt parçasına Popup ve Özelleştirme Ayarlarını (StyleSettings) bağla
            bufferLayer.eachLayer((childLayer) => {
                const uniqueId = `buf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                const popupHtml = `
                    <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                        
                        <!-- GİZLENECEK OLAN ANA BİLGİ EKRANI -->
                        <div id="main-content-${uniqueId}">
                            <div style="font-weight: bold; color: #0099ff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🔵 Buffer Analizi</div>
                            <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                <tr><td style="color: #6c757d;">Kaynak Tip:</td><td style="font-weight: bold; text-align: right;">${type}</td></tr>
                                <tr><td style="color: #6c757d;">Mesafe:</td><td style="font-weight: bold; text-align: right;">${distanceMeters} m</td></tr>
                                <tr><td style="color: #6c757d;">Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${areaFormatted}</td></tr>
                            </table>
                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                            <button id="${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Buffer'ı Sil</button>
                        </div>
                        
                        <!-- STİL AYARLARI BUTONU VE MENÜSÜ -->
                        ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueId, 'Polygon') : ''}
                    </div>
                `;
                
                childLayer.bindPopup(popupHtml, { maxWidth: 250 });

                childLayer.on('popupopen', () => {
                    setTimeout(() => {
                        // 1. Silme Butonu Olayı
                        const deleteBtn = document.getElementById(uniqueId);
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', () => {
                                this.map.removeLayer(bufferLayer);
                                if (window.MapManager) delete MapManager.mapLayersStorage[layerName];
                                if (window.Sidebar) {
                                    window.Sidebar.state = window.Sidebar.state.filter(s => s.fileName !== layerName);
                                    window.Sidebar.renderList(document.getElementById('layerSearchInput')?.value.toLowerCase().trim() || '');
                                }
                            });
                        }
                        
                        // 2. Metadata Olayları
                        if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(childLayer, uniqueId);
                        
                        // 3. Stil Ayarları Olayları
                        if (window.StyleSettings) window.StyleSettings.bindEvents(childLayer, uniqueId, 'Polygon');

                        // 4. GİZLE/GÖSTER MOTORU
                        const popupWrapper = document.getElementById(`popup-wrapper-${uniqueId}`);
                        if (popupWrapper && !popupWrapper.hasAttribute('data-ux-bound')) {
                            popupWrapper.setAttribute('data-ux-bound', 'true');
                            
                            popupWrapper.addEventListener('click', (event) => {
                                const settingsBtn = event.target.closest('.btn-settings');
                                if (settingsBtn) {
                                    const mainContent = document.getElementById(`main-content-${uniqueId}`);
                                    if (mainContent) {
                                        if (mainContent.style.display === 'none') {
                                            mainContent.style.display = 'block';
                                            settingsBtn.innerHTML = '⚙️ Stil Ayarları';
                                            settingsBtn.style.background = '#6c757d';
                                        } else {
                                            mainContent.style.display = 'none';
                                            settingsBtn.innerHTML = '⬅️ Ana Bilgilere Dön';
                                            settingsBtn.style.background = '#17a2b8';
                                        }
                                    }
                                }
                            }, true); 
                        }
                    }, 50); // Zamanlama (DOM'un çizilmesi için)
                });
            });

            // 5. MÜKEMMEL ENTEGRASYON: Buffer'ı normal bir katmanmış gibi sisteme kaydet
            if (window.MapManager && window.Sidebar) {
                MapManager.mapLayersStorage[layerName] = bufferLayer;

                Sidebar.appendLayerCard(
                    layerName, 0, 0, 1, 
                    // onToggle Click
                    (name) => {
                        const target = MapManager.mapLayersStorage[name];
                        if (!target) return false;
                        if (this.map.hasLayer(target)) { this.map.removeLayer(target); return false; }
                        else { this.map.addLayer(target); return true; }
                    },
                    // onDelete Click
                    (name) => {
                        const target = MapManager.mapLayersStorage[name];
                        if (target && this.map.hasLayer(target)) this.map.removeLayer(target);
                        delete MapManager.mapLayersStorage[name];
                    },
                    // onTitle Click
                    (name) => {
                        const target = MapManager.mapLayersStorage[name];
                        if (target) this.map.fitBounds(target.getBounds());
                    }
                );
            }

            // Kamerayı oluşturulan Buffer'a uçur ve popup'ını aç
            this.map.fitBounds(bufferLayer.getBounds(), { padding: [30, 30] });
            bufferLayer.openPopup();

        } catch (error) {
            alert(window.APP_MESSAGES.BUFFER_ERROR(error.message));
        }
    }
};

window.BufferTool = BufferTool;