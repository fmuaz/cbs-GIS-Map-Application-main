// Toolbar üzerinden seçilerek poligon ören modül
const AreaTool = {
    map: null,
    polygonPoints: [],
    polygonMarkers: [],
    activePolygonShape: null,

    init: function (leafletMap) {
        this.map = leafletMap;

        this.map.on('click', (e) => {
            // YENİ: Shift yerine Toolbar durumunu kontrol ediyoruz
            if (window.StateManager && window.StateManager.activeTool === 'polygon') {
                const point = e.latlng;
                this.polygonPoints.push(point);

                const polyMarker = L.circleMarker(point, {
                    radius: 5, color: '#0056b3', fillColor: '#007bff', fillOpacity: 1
                }).addTo(this.map);
                this.polygonMarkers.push(polyMarker);

                if (this.polygonPoints.length > 1) {
                    if (this.activePolygonShape) this.map.removeLayer(this.activePolygonShape);

                    this.activePolygonShape = L.polygon(this.polygonPoints, {
                        color: '#007bff', weight: 2, fillColor: '#007bff', fillOpacity: 0.15, dashArray: '5, 5'
                    }).addTo(this.map);
                }
            }
        });

        this.map.on('contextmenu', (e) => {
            if (e.originalEvent) e.originalEvent.preventDefault();

            // YENİ: Sadece Alan modundayken kapatma işlemini yap
            if (window.StateManager && window.StateManager.activeTool === 'polygon' && this.polygonPoints.length >= 3) {
                const turfCoordinates = this.polygonPoints.map(p => [p.lng, p.lat]);
                turfCoordinates.push([this.polygonPoints[0].lng, this.polygonPoints[0].lat]); 

                const turfPolygon = turf.polygon([turfCoordinates]);
                const unkinked = turf.unkinkPolygon(turfPolygon);

                if (unkinked.features.length > 1) {
                    alert("⚠️ Topoloji Hatası: Poligon kendi kenarlarını kesemez! Çizim iptal edildi.");
                    
                    if (this.activePolygonShape) this.map.removeLayer(this.activePolygonShape);
                    this.polygonMarkers.forEach(m => this.map.removeLayer(m));

                    this.polygonPoints = [];
                    this.polygonMarkers = [];
                    this.activePolygonShape = null;
                    return; 
                }

                if (this.activePolygonShape) {
                    this.map.removeLayer(this.activePolygonShape);
                    this.activePolygonShape = null;
                }

                const finalPolygon = L.polygon(this.polygonPoints, {
                    color: '#28a745', weight: 3, fillColor: '#28a745', fillOpacity: 0.3
                }).addTo(this.map);

                if (window.IntersectionManager) window.IntersectionManager.addPolygon(finalPolygon);

                const areaSquareMeters = turf.area(turfPolygon);
                let areaFormatted = areaSquareMeters >= 1000000 
                    ? `${(areaSquareMeters / 1000000).toFixed(2)} km²` 
                    : `${areaSquareMeters.toFixed(0)} m²`;

                finalPolygon.bindTooltip(`📐 Alan: ${areaFormatted}`, {
                    permanent: true, direction: 'center', className: 'measure-label', interactive: false
                }).openTooltip();

                const polygonGroup = L.featureGroup();
                polygonGroup.addLayer(finalPolygon);
                this.polygonMarkers.forEach(m => polygonGroup.addLayer(m));
                polygonGroup.addTo(this.map);

                PolygonDragEngine.attachDragBehavior(this.map, finalPolygon, this.polygonMarkers);
                ExportService.registerMeasurement(polygonGroup);

                // 1. OLUŞTURMA İŞLEMİNİ HISTORY'E KAYDET
                if (window.HistoryManager) {
                    window.HistoryManager.add({
                        actionName: 'Create Polygon',
                        undo: () => { 
                            this.map.removeLayer(polygonGroup); 
                            if (window.IntersectionManager) window.IntersectionManager.removePolygon(finalPolygon);
                        },
                        redo: () => { 
                            this.map.addLayer(polygonGroup); 
                            if (window.IntersectionManager) window.IntersectionManager.addPolygon(finalPolygon);
                        }
                    });
                }

                const uniquePolyId = 'poly_' + Date.now();
                
                const popupContent = `
                    <div id="popup-wrapper-${uniquePolyId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                        <div id="main-content-${uniquePolyId}">
                            <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                            <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                                <tr><td>Tip:</td><td style="font-weight: bold; text-align: right;">Hesaplanmış Alan</td></tr>
                                <tr><td>Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${areaFormatted}</td></tr>
                            </table>
                            ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniquePolyId) : ''}
                            <button id="${uniquePolyId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Alanı Haritadan Sil</button>
                        </div>
                        ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniquePolyId, 'Polygon') : ''}
                    </div>
                `;

                polygonGroup.bindPopup(popupContent, { maxWidth: 250 });

                polygonGroup.on('popupopen', () => {
                    if (polygonGroup.getBounds().isValid()) {
                        this.map.fitBounds(polygonGroup.getBounds(), { padding: [30, 30] });
                    }

                    setTimeout(() => {
                        const deleteBtn = document.getElementById(uniquePolyId);
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', () => {
                                // 2. SİLME İŞLEMİNİ HISTORY'E KAYDET
                                if (window.HistoryManager) {
                                    window.HistoryManager.execute({
                                        actionName: 'Delete Polygon',
                                        undo: () => { 
                                            this.map.addLayer(polygonGroup); 
                                            if (window.IntersectionManager) window.IntersectionManager.addPolygon(finalPolygon);
                                        },
                                        redo: () => { 
                                            this.map.removeLayer(polygonGroup); 
                                            if (window.IntersectionManager) window.IntersectionManager.removePolygon(finalPolygon);
                                        }
                                    });
                                } else {
                                    if (window.IntersectionManager) window.IntersectionManager.removePolygon(finalPolygon);
                                    this.map.removeLayer(polygonGroup); 
                                }
                            });
                        }

                        if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(polygonGroup, uniquePolyId);
                        if (window.StyleSettings) window.StyleSettings.bindEvents(polygonGroup, uniquePolyId, 'Polygon');

                        const popupWrapper = document.getElementById(`popup-wrapper-${uniquePolyId}`);
                        if (popupWrapper) {
                            const settingsBtn = popupWrapper.querySelector('.btn-settings');
                            const mainContent = document.getElementById(`main-content-${uniquePolyId}`);
                            
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

                this.polygonPoints = [];
                this.polygonMarkers.forEach(m => this.map.removeLayer(m));
                this.polygonMarkers = [];
                this.activePolygonShape = null;
                
                // YENİ: Çizim bittiğinde aracı otomatik kapat
                window.StateManager.setTool('none');
            }
        });
    }
};
window.AreaTool = AreaTool;