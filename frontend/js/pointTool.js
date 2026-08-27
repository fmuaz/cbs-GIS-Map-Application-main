const PointTool = {
    map: null,
    
    init: function(leafletMap) {
        this.map = leafletMap;
        
        this.map.on('click', (e) => {
            if (window.StateManager && window.StateManager.activeTool === 'point') {
                this.createPoint(e.latlng);
                window.StateManager.setTool('none');
            }
        });
    },

    createPoint: function(latlng) {
        const style = window.GIS_CONFIG && window.GIS_CONFIG.POINT_STYLE ? window.GIS_CONFIG.POINT_STYLE : { RADIUS: 6, COLOR: '#ffc107', WEIGHT: 2, FILL_COLOR: '#ffc107' };
        
        const marker = L.circleMarker(latlng, {
            radius: style.RADIUS,
            color: style.COLOR,
            weight: style.WEIGHT,
            fillColor: style.FILL_COLOR,
            fillOpacity: 1
        });

        const pointGroup = L.featureGroup([marker]);
        pointGroup.addTo(this.map);
        
        if (window.ExportService) window.ExportService.registerMeasurement(pointGroup);

        const uniqueId = 'point_' + Date.now();

        // Bu noktayı tek bir "obje" olarak işaretliyoruz (export/import'ta bütünlüğünü korumak için)
        pointGroup._objectId = uniqueId;
        
        const popupContent = `
            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                <div id="main-content-${uniqueId}">
                    <div style="font-weight: bold; color: #ffc107; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px; text-shadow: 0 0 1px #000;">
                        📍 Nokta Bilgileri
                    </div>
                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                        <tr><td style="color: #6c757d;">Enlem:</td><td id="lat_${uniqueId}" style="font-weight: bold; text-align: right;">${latlng.lat.toFixed(5)}</td></tr>
                        <tr><td style="color: #6c757d;">Boylam:</td><td id="lng_${uniqueId}" style="font-weight: bold; text-align: right;">${latlng.lng.toFixed(5)}</td></tr>
                    </table>
                    
                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                    
                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Noktayı Sil</button>
                </div>
                
                <!-- STİL AYARLARI MENÜSÜ -->
                ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueId, 'Point') : ''}
            </div>
        `;

        pointGroup.bindPopup(popupContent, { maxWidth: 250 });

        if (window.HistoryManager) {
            window.HistoryManager.add({
                actionName: 'Create Point',
                undo: () => { this.map.removeLayer(pointGroup); },
                redo: () => { this.map.addLayer(pointGroup); }
            });
        }

        pointGroup.on('popupopen', () => {
            this.map.setView(marker.getLatLng());

            setTimeout(() => {
                const deleteBtn = document.getElementById(`del_${uniqueId}`);
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => { 
                        if (window.HistoryManager) {
                            window.HistoryManager.execute({
                                actionName: 'Delete Point',
                                undo: () => { this.map.addLayer(pointGroup); },
                                redo: () => { this.map.removeLayer(pointGroup); }
                            });
                        } else {
                            this.map.removeLayer(pointGroup);
                        }
                    });
                }

                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(pointGroup, uniqueId);
                
                if (window.StyleSettings) window.StyleSettings.bindEvents(pointGroup, uniqueId, 'Point');

                const popupWrapper = document.getElementById(`popup-wrapper-${uniqueId}`);
                if (popupWrapper && !popupWrapper.hasAttribute('data-ux-bound')) {
                    popupWrapper.setAttribute('data-ux-bound', 'true');
                    
                    const settingsBtn = document.getElementById(`btn_settings_${uniqueId}`);
                    const mainContent = document.getElementById(`main-content-${uniqueId}`);
                    
                    if (settingsBtn && mainContent) {
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

        marker.on('mouseover', () => { marker.getElement().style.cursor = 'grab'; });
        marker.on('mouseout', () => { marker.getElement().style.cursor = ''; });

        marker.on('mousedown', (e) => {
            if (e.originalEvent.button !== 0) return; 
            if (window.StateManager && window.StateManager.activeTool !== 'none') return;

            L.DomEvent.stopPropagation(e); 
            this.map.dragging.disable(); 
            marker.getElement().style.cursor = 'grabbing'; 
            pointGroup.closePopup(); 
            
            let isDragged = false;
            let originalLatLng = marker.getLatLng();

            const onMouseMove = (moveEvent) => {
                isDragged = true;
                marker.setLatLng(moveEvent.latlng);
            };

            const onMouseUp = (upEvent) => {
                this.map.dragging.enable(); 
                marker.getElement().style.cursor = 'grab';
                
                this.map.off('mousemove', onMouseMove);
                this.map.off('mouseup', onMouseUp);
                
                if (isDragged) {
                    const finalLatLng = marker.getLatLng();
                    
                    const latEl = document.getElementById(`lat_${uniqueId}`);
                    const lngEl = document.getElementById(`lng_${uniqueId}`);
                    if(latEl) latEl.innerText = finalLatLng.lat.toFixed(5);
                    if(lngEl) lngEl.innerText = finalLatLng.lng.toFixed(5);

                    if (window.HistoryManager) {
                        window.HistoryManager.add({
                            actionName: 'Move Point',
                            undo: () => { 
                                marker.setLatLng(originalLatLng);
                                if(latEl) latEl.innerText = originalLatLng.lat.toFixed(5);
                                if(lngEl) lngEl.innerText = originalLatLng.lng.toFixed(5);
                            },
                            redo: () => { 
                                marker.setLatLng(finalLatLng); 
                                if(latEl) latEl.innerText = finalLatLng.lat.toFixed(5);
                                if(lngEl) lngEl.innerText = finalLatLng.lng.toFixed(5);
                            }
                        });
                    }
                }
            };

            this.map.on('mousemove', onMouseMove);
            this.map.on('mouseup', onMouseUp);
        });

        pointGroup.openPopup(latlng);
    }
};
window.PointTool = PointTool;