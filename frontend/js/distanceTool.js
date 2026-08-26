// Toolbar üzerinden seçilerek çalışan, çizgi çeken ve mesafe ölçen modül
const DistanceTool = {
    map: null,
    activePoints: [],     
    activeMarkers: [],    
    activeLines: [],      

    init: function (leafletMap) {
        this.map = leafletMap;

        this.map.on('click', (e) => {
            // Ctrl yerine Toolbar durumunu kontrol ediyoruz
            if (window.StateManager && window.StateManager.activeTool === 'line') {
                const point = e.latlng;
                this.activePoints.push(point);

                const marker = L.circleMarker(point, { 
                    radius: GIS_CONFIG.MEASURE_STYLE.MARKER_RADIUS, 
                    color: GIS_CONFIG.MEASURE_STYLE.LINE_COLOR, 
                    fillColor: GIS_CONFIG.MEASURE_STYLE.FILL_COLOR, 
                    fillOpacity: 1 
                }).addTo(this.map);
                this.activeMarkers.push(marker);

                if (this.activePoints.length > 1) {
                    const startPoint = this.activePoints[this.activePoints.length - 2];
                    const endPoint = this.activePoints[this.activePoints.length - 1];

                    const lineSegment = L.polyline([startPoint, endPoint], { 
                        color: GIS_CONFIG.MEASURE_STYLE.LINE_COLOR, 
                        weight: GIS_CONFIG.MEASURE_STYLE.WEIGHT, 
                        dashArray: GIS_CONFIG.MEASURE_STYLE.DASH_ARRAY,
                        lineCap: 'round',  
                        lineJoin: 'round' 
                    }).addTo(this.map);
                    
                    this.activeLines.push(lineSegment); 

                    let distanceKm = (startPoint.distanceTo(endPoint) / 1000).toFixed(2); 
                    lineSegment.bindTooltip(`${distanceKm} km`, {
                        permanent: true, direction: 'center', className: 'measure-label', interactive: false 
                    }).openTooltip();
                }
            }
        });

        this.map.on('dblclick', (e) => {
            // Sadece Çizgi modundayken kapatma işlemini yap
            if (window.StateManager && window.StateManager.activeTool === 'line' && this.activePoints.length >= 3) {
                const firstPoint = this.activePoints[0];
                const lastPoint = this.activePoints[this.activePoints.length - 1];

                const closingLine = L.polyline([lastPoint, firstPoint], { 
                    color: GIS_CONFIG.MEASURE_STYLE.LINE_COLOR, 
                    weight: GIS_CONFIG.MEASURE_STYLE.WEIGHT, 
                    dashArray: GIS_CONFIG.MEASURE_STYLE.DASH_ARRAY,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(this.map);
                this.activeLines.push(closingLine); 

                let closingDistanceKm = (lastPoint.distanceTo(firstPoint) / 1000).toFixed(2);
                closingLine.bindTooltip(`🔄 Close: ${closingDistanceKm} km`, {
                    permanent: true, direction: 'center', className: 'measure-label', interactive: false 
                }).openTooltip();

                let totalDistanceMeter = 0;
                for (let i = 0; i < this.activePoints.length; i++) {
                    const end = this.activePoints[(i + 1) % this.activePoints.length];
                    totalDistanceMeter += this.activePoints[i].distanceTo(end);
                }
                let totalDistanceKm = (totalDistanceMeter / 1000).toFixed(2);

                const measurementGroup = L.featureGroup();
                this.activeMarkers.forEach(m => measurementGroup.addLayer(m));
                this.activeLines.forEach(l => measurementGroup.addLayer(l));
                measurementGroup.addTo(this.map);

                ExportService.registerMeasurement(measurementGroup);
                PolygonDragEngine.attachLineDragBehavior(this.map, this.activeLines, this.activeMarkers);

                // 1. OLUŞTURMA İŞLEMİNİ HISTORY'E KAYDET
                if (window.HistoryManager) {
                    window.HistoryManager.add({
                        actionName: 'Create Line',
                        undo: () => { this.map.removeLayer(measurementGroup); },
                        redo: () => { this.map.addLayer(measurementGroup); }
                    });
                }

                const uniqueGroupId = 'measure_' + Date.now();
                
                const popupContent = `
                    <div id="popup-wrapper-${uniqueGroupId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                        <div id="main-content-${uniqueGroupId}">
                            <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Ölçüm Bilgileri</div>
                            <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Kapalı Çizgi Çevresi</td></tr>
                                <tr><td style="color: #6c757d;">Toplam Çevre:</td><td style="font-weight: bold; color: #dc3545; text-align: right;">${totalDistanceKm} km</td></tr>
                            </table>
                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueGroupId) : ''}
                            <button id="${uniqueGroupId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Ölçümü Haritadan Sil</button>
                        </div>
                        ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueGroupId, 'LineString') : ''}
                    </div>
                `;

                measurementGroup.bindPopup(popupContent, { maxWidth: 250 });

                measurementGroup.on('popupopen', () => {
                    if (measurementGroup.getBounds().isValid()) {
                        this.map.fitBounds(measurementGroup.getBounds(), { padding: [30, 30] });
                    }

                    setTimeout(() => {
                        const deleteBtn = document.getElementById(uniqueGroupId);
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', () => { 
                                // 2. SİLME İŞLEMİNİ HISTORY'E KAYDET
                                if (window.HistoryManager) {
                                    window.HistoryManager.execute({
                                        actionName: 'Delete Line',
                                        undo: () => { this.map.addLayer(measurementGroup); },
                                        redo: () => { this.map.removeLayer(measurementGroup); }
                                    });
                                } else {
                                    this.map.removeLayer(measurementGroup);
                                }
                            });
                        }
                        
                        if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(measurementGroup, uniqueGroupId);
                        if (window.StyleSettings) window.StyleSettings.bindEvents(measurementGroup, uniqueGroupId, 'LineString');

                        const popupWrapper = document.getElementById(`popup-wrapper-${uniqueGroupId}`);
                        if (popupWrapper) {
                            const settingsBtn = popupWrapper.querySelector('.btn-settings');
                            const mainContent = document.getElementById(`main-content-${uniqueGroupId}`);
                            
                            if (settingsBtn && mainContent && !settingsBtn.hasAttribute('data-ux-bound')) {
                                settingsBtn.setAttribute('data-ux-bound', 'true');
                                settingsBtn.addEventListener('click', () => {
                                    if (mainContent.style.display === 'none') {
                                        mainContent.style.display = 'block';
                                        settingsBtn.innerHTML = '⚙️ Stil Ayarları';
                                        settingsBtn.style.background = '#6c757d';
                                    } else {
                                        mainContent.style.display = 'none';
                                        settingsBtn.innerHTML = '⬅️ Ana Bilgilere Dön';
                                        settingsBtn.style.background = '#17a2b8';
                                    }
                                });
                            }
                        }
                    }, 50);
                });

                this.activePoints = [];
                this.activeMarkers = [];
                this.activeLines = [];
                
                // Çizim bittiğinde aracı otomatik kapat
                window.StateManager.setTool('none');
            }
        });
    }
};
window.DistanceTool = DistanceTool;