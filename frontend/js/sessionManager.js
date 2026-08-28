const SessionManager = {
    timeoutMinutes: 15,
    activityKey: 'gis_last_activity',
    layersKey: 'gis_active_layers',
    drawnKey: 'gis_drawn_features',
    mapStateKey: 'gis_map_view_state',
    isRestoring: false,

    init: function() {
        this.waitForMapAndRestore();
    },

    waitForMapAndRestore: function() {
        let attempts = 0;
        const maxAttempts = 30; 
        
        const checkInterval = setInterval(() => {
            attempts++;
            const map = window.LayerController ? LayerController.map : (window.MapManager && window.MapManager.map ? window.MapManager.map : null);
            
            if (map) {
                clearInterval(checkInterval);
                this.runRestoreSequence(map);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error("[SESSION] Harita nesnesi zaman aşımına uğradı, restore iptal edildi.");
            }
        }, 100);
    },

    runRestoreSequence: function(map) {
        this.isRestoring = true;
        
        try {
            console.log("[SESSION] Harita yakalandı, restore başlatılıyor...");
            this.checkSession(map);
        } catch (e) {
            console.error("[SESSION] Restore sırasında kritik hata:", e);
        } finally {
            setTimeout(() => {
                this.isRestoring = false;
                this.setupActivityListeners();
                this.setupStateObserver();
                console.log("[SESSION] Restore tamamlandı, aktif izleme devrede.");
            }, 1000);
        }
    },

    checkSession: function(map) {
        const lastActivity = sessionStorage.getItem(this.activityKey);
        const now = Date.now();

        if (lastActivity) {
            const diff = now - parseInt(lastActivity);
            if (diff > this.timeoutMinutes * 60 * 1000) {
                sessionStorage.removeItem(this.layersKey);
                sessionStorage.removeItem(this.drawnKey);
                sessionStorage.removeItem(this.mapStateKey);
                console.log("[SESSION] Oturum süresi doldu, harita sıfırlandı.");
                return;
            }
        }

        const savedLayers = sessionStorage.getItem(this.layersKey);
        if (savedLayers) {
            try {
                const layersToLoad = JSON.parse(savedLayers);
                layersToLoad.forEach(groupName => {
                    if (window.LayerController && typeof LayerController.loadGroupController === 'function') {
                        LayerController.loadGroupController(groupName, true);
                    }
                });
            } catch (err) {
                console.error("[SESSION] Resmi katmanlar yüklenirken hata:", err);
            }
        }

        const savedDrawn = sessionStorage.getItem(this.drawnKey);
        if (savedDrawn) {
            try {
                const drawnItems = JSON.parse(savedDrawn);
                drawnItems.forEach(item => {
                    if (!item || !item.toolType) return;
                    try {
                        if (item.toolType === 'Point') this.restorePoint(map, item);
                        else if (item.toolType === 'Polygon') this.restorePolygon(map, item);
                        else if (item.toolType === 'Line') this.restoreLine(map, item);
                        else if (item.toolType === 'Buffer') this.restoreBuffer(map, item);
                    } catch (objErr) {
                        console.error(`[SESSION RESTORE] ${item.toolType} FAILED:`, objErr);
                    }
                });
            } catch (e) {
                console.error("[SESSION] Anlık çizimler parse edilirken hata:", e);
            }
        }

        const savedMapState = sessionStorage.getItem(this.mapStateKey);
        if (savedMapState) {
            try {
                const viewState = JSON.parse(savedMapState);
                if (viewState && viewState.center && viewState.zoom) {
                    map.setView(viewState.center, viewState.zoom);
                }
            } catch (e) {
                console.error("[SESSION] Harita konumu yüklenirken hata:", e);
            }
        }

        this.updateActivity();
    },

    restorePoint: function(map, item) {
        if (!item.latlng) return;
        const latlng = L.latLng(item.latlng.lat, item.latlng.lng);
        const style = item.style || {};

        const marker = L.circleMarker(latlng, {
            radius: style.radius !== undefined ? style.radius : 6,
            color: style.color || '#ffc107',
            weight: style.weight !== undefined ? style.weight : 2,
            fillColor: style.fillColor || '#ffc107',
            fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 1
        });

        const pointGroup = L.featureGroup([marker]);
        pointGroup.addTo(map);

        if (window.ExportService) window.ExportService.registerMeasurement(pointGroup);

        const uniqueId = item.uniqueId || ('point_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        
        if (item.metadata && window.FeatureMetadata) {
            pointGroup.feature = pointGroup.feature || {};
            pointGroup.feature.properties = pointGroup.feature.properties || {};
            pointGroup.feature.properties.userMetadata = item.metadata;
        }

        const popupContent = `
            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                <div id="main-content-${uniqueId}">
                    <div style="font-weight: bold; color: #ffc107; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px; text-shadow: 0 0 1px #000;">📍 Nokta Bilgileri</div>
                    <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
                        <tr><td style="color: #6c757d;">Enlem:</td><td id="lat_${uniqueId}" style="font-weight: bold; text-align: right;">${latlng.lat.toFixed(5)}</td></tr>
                        <tr><td style="color: #6c757d;">Boylam:</td><td id="lng_${uniqueId}" style="font-weight: bold; text-align: right;">${latlng.lng.toFixed(5)}</td></tr>
                    </table>
                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                    <button id="del_${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Noktayı Sil</button>
                </div>
                ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueId, 'Point') : ''}
            </div>
        `;

        pointGroup.bindPopup(popupContent, { maxWidth: 250 });

        pointGroup.on('popupopen', () => {
            setTimeout(() => {
                const deleteBtn = document.getElementById(`del_${uniqueId}`);
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        map.removeLayer(pointGroup);
                        SessionManager.updateActivity();
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
            map.dragging.disable();
            marker.getElement().style.cursor = 'grabbing';
            pointGroup.closePopup();
            
            let isDragged = false;
            const onMouseMove = (moveEvent) => { isDragged = true; marker.setLatLng(moveEvent.latlng); };
            const onMouseUp = () => {
                map.dragging.enable();
                marker.getElement().style.cursor = 'grab';
                map.off('mousemove', onMouseMove);
                map.off('mouseup', onMouseUp);
                if (isDragged) {
                    const finalLatLng = marker.getLatLng();
                    const latEl = document.getElementById(`lat_${uniqueId}`);
                    const lngEl = document.getElementById(`lng_${uniqueId}`);
                    if(latEl) latEl.innerText = finalLatLng.lat.toFixed(5);
                    if(lngEl) lngEl.innerText = finalLatLng.lng.toFixed(5);
                    SessionManager.updateActivity();
                }
            };
            map.on('mousemove', onMouseMove);
            map.on('mouseup', onMouseUp);
        });

        pointGroup._restoreData = item;
        pointGroup._uniqueId = uniqueId;
    },

    restorePolygon: function(map, item) {
        if (!item.latlngs || item.latlngs.length === 0) return;
        
        const style = item.style || {};
        const finalPolygon = L.polygon(item.latlngs, {
            color: style.color || '#28a745',
            weight: style.weight !== undefined ? style.weight : 3,
            fillColor: style.fillColor || style.color || '#28a745',
            fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 0.3,
            dashArray: style.dashArray || null
        }).addTo(map);

        if (window.IntersectionManager) window.IntersectionManager.addPolygon(finalPolygon);

        if (item.label) {
            finalPolygon.bindTooltip(item.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
        }

        const polygonMarkers = [];
        const flatPoints = Array.isArray(item.latlngs[0]) ? item.latlngs[0] : item.latlngs;

        flatPoints.forEach(pt => {
            if (pt && pt.lat !== undefined && pt.lng !== undefined) {
                const m = L.circleMarker(pt, { radius: 5, color: '#0056b3', fillColor: '#007bff', fillOpacity: 1 }).addTo(map);
                polygonMarkers.push(m);
            }
        });

        const polygonGroup = L.featureGroup();
        polygonGroup.addLayer(finalPolygon);
        polygonMarkers.forEach(m => polygonGroup.addLayer(m));
        polygonGroup.addTo(map);

        if (window.PolygonDragEngine) PolygonDragEngine.attachDragBehavior(map, finalPolygon, polygonMarkers);
        if (window.ExportService) ExportService.registerMeasurement(polygonGroup);

        const uniqueId = item.uniqueId || ('poly_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

        if (item.metadata && window.FeatureMetadata) {
            polygonGroup.feature = polygonGroup.feature || {};
            polygonGroup.feature.properties = polygonGroup.feature.properties || {};
            polygonGroup.feature.properties.userMetadata = item.metadata;
        }

        const popupContent = `
            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                <div id="main-content-${uniqueId}">
                    <div style="font-weight: bold; color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🟩 Alan Bilgileri</div>
                    <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                        <tr><td>Tip:</td><td style="font-weight: bold; text-align: right;">Hesaplanmış Alan</td></tr>
                        <tr><td>Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${item.parsedArea || 'N/A'}</td></tr>
                    </table>
                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                    <button id="${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Alanı Haritadan Sil</button>
                </div>
                ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueId, 'Polygon') : ''}
            </div>
        `;

        polygonGroup.bindPopup(popupContent, { maxWidth: 250 });

        polygonGroup.on('popupopen', () => {
            setTimeout(() => {
                const deleteBtn = document.getElementById(uniqueId);
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        if (window.IntersectionManager) window.IntersectionManager.removePolygon(finalPolygon);
                        map.removeLayer(polygonGroup);
                        polygonMarkers.forEach(m => map.removeLayer(m));
                        SessionManager.updateActivity();
                    });
                }

                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(polygonGroup, uniqueId);
                if (window.StyleSettings) window.StyleSettings.bindEvents(polygonGroup, uniqueId, 'Polygon');

                const popupWrapper = document.getElementById(`popup-wrapper-${uniqueId}`);
                if (popupWrapper && !popupWrapper.hasAttribute('data-ux-bound')) {
                    popupWrapper.setAttribute('data-ux-bound', 'true');
                    const settingsBtn = popupWrapper.querySelector('.btn-settings');
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

        polygonGroup._restoreData = item;
        polygonGroup._uniqueId = uniqueId;
    },

    restoreLine: function(map, item) {
        if (!item.latlngs || item.latlngs.length === 0) return;

        const activeLines = [];
        const activeMarkers = [];
        const style = item.style || {};

        for (let i = 0; i < item.latlngs.length - 1; i++) {
            const lineSeg = L.polyline([item.latlngs[i], item.latlngs[i+1]], {
                color: style.color || '#007bff',
                weight: style.weight !== undefined ? style.weight : 3,
                dashArray: style.dashArray || null,
                lineCap: 'round', lineJoin: 'round'
            }).addTo(map);

            if (i === 0 && item.label) {
                lineSeg.bindTooltip(item.label, { permanent: true, direction: 'center', className: 'measure-label', interactive: false }).openTooltip();
            }
            activeLines.push(lineSeg);
        }

        item.latlngs.forEach(pt => {
            if (pt && pt.lat !== undefined && pt.lng !== undefined) {
                const m = L.circleMarker(pt, { radius: 4, color: style.color || '#007bff', fillColor: style.color || '#007bff', fillOpacity: 1 }).addTo(map);
                activeMarkers.push(m);
            }
        });

        const measurementGroup = L.featureGroup();
        activeMarkers.forEach(m => measurementGroup.addLayer(m));
        activeLines.forEach(l => measurementGroup.addLayer(l));
        measurementGroup.addTo(map);

        if (window.ExportService) ExportService.registerMeasurement(measurementGroup);
        if (window.PolygonDragEngine) PolygonDragEngine.attachLineDragBehavior(map, activeLines, activeMarkers);

        const uniqueId = item.uniqueId || ('measure_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

        if (item.metadata && window.FeatureMetadata) {
            measurementGroup.feature = measurementGroup.feature || {};
            measurementGroup.feature.properties = measurementGroup.feature.properties || {};
            measurementGroup.feature.properties.userMetadata = item.metadata;
        }

        const popupContent = `
            <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                <div id="main-content-${uniqueId}">
                    <div style="font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🗺️ Ölçüm Bilgileri</div>
                    <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                        <tr><td style="color: #6c757d;">Tip:</td><td style="font-weight: bold; text-align: right;">Çizgi Ölçümü</td></tr>
                        <tr><td style="color: #6c757d;">Toplam Mesafe:</td><td style="font-weight: bold; color: #dc3545; text-align: right;">${item.parsedDist || 'N/A'}</td></tr>
                    </table>
                    ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                    <button id="${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Ölçümü Haritadan Sil</button>
                </div>
                ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueId, 'LineString') : ''}
            </div>
        `;

        measurementGroup.bindPopup(popupContent, { maxWidth: 250 });

        measurementGroup.on('popupopen', () => {
            setTimeout(() => {
                const deleteBtn = document.getElementById(uniqueId);
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        map.removeLayer(measurementGroup);
                        SessionManager.updateActivity();
                    });
                }

                if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(measurementGroup, uniqueId);
                if (window.StyleSettings) window.StyleSettings.bindEvents(measurementGroup, uniqueId, 'LineString');

                const popupWrapper = document.getElementById(`popup-wrapper-${uniqueId}`);
                if (popupWrapper && !popupWrapper.hasAttribute('data-ux-bound')) {
                    popupWrapper.setAttribute('data-ux-bound', 'true');
                    const settingsBtn = popupWrapper.querySelector('.btn-settings');
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

        measurementGroup._restoreData = item;
        measurementGroup._uniqueId = uniqueId;
    },

    restoreBuffer: function(map, item) {
        if (!item.geoJson) return;

        const style = item.style || window.GIS_CONFIG?.BUFFER?.STYLE || { color: '#0099ff', weight: 2, fillColor: '#0099ff', fillOpacity: 0.3 };
        const bufferLayer = L.geoJSON(item.geoJson, { style: style }).addTo(map);

        const uniqueId = item.uniqueId || ('buf_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        const layerName = item.layerName || `Buffer_Restored_${Date.now()}`;

        if (item.metadata && window.FeatureMetadata) {
            bufferLayer.feature = bufferLayer.feature || {};
            bufferLayer.feature.properties = bufferLayer.feature.properties || {};
            bufferLayer.feature.properties.userMetadata = item.metadata;
        }

        bufferLayer.eachLayer((childLayer) => {
            const popupHtml = `
                <div id="popup-wrapper-${uniqueId}" style="font-family: 'Segoe UI', sans-serif; padding: 5px; min-width: 180px;">
                    <div id="main-content-${uniqueId}">
                        <div style="font-weight: bold; color: #0099ff; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">🔵 Buffer Analizi</div>
                        <table style="width: 100%; font-size: 12px; margin-bottom: 10px;">
                            <tr><td style="color: #6c757d;">Kaynak Tip:</td><td style="font-weight: bold; text-align: right;">${item.parsedType || 'Polygon'}</td></tr>
                            <tr><td style="color: #6c757d;">Mesafe:</td><td style="font-weight: bold; text-align: right;">${item.parsedDist || '0 m'}</td></tr>
                            <tr><td style="color: #6c757d;">Toplam Alan:</td><td style="font-weight: bold; color: #28a745; text-align: right;">${item.parsedArea || 'N/A'}</td></tr>
                        </table>
                        ${window.FeatureMetadata ? window.FeatureMetadata.getMetadataHTML(uniqueId) : ''}
                        <button id="${uniqueId}" style="width: 100%; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 5px;">🗑️ Buffer'ı Sil</button>
                    </div>
                    ${window.StyleSettings ? window.StyleSettings.getSettingsHTML(uniqueId, 'Polygon') : ''}
                </div>
            `;

            childLayer.bindPopup(popupHtml, { maxWidth: 250 });

            childLayer.on('popupopen', () => {
                setTimeout(() => {
                    const deleteBtn = document.getElementById(uniqueId);
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', () => {
                            map.removeLayer(bufferLayer);
                            if (window.MapManager) delete MapManager.mapLayersStorage[layerName];
                            if (window.Sidebar) {
                                window.Sidebar.state = window.Sidebar.state.filter(s => s.fileName !== layerName);
                                window.Sidebar.renderList(document.getElementById('layerSearchInput')?.value.toLowerCase().trim() || '');
                            }
                            SessionManager.updateActivity();
                        });
                    }

                    if (window.FeatureMetadata) window.FeatureMetadata.bindMetadataEvents(childLayer, uniqueId);
                    if (window.StyleSettings) window.StyleSettings.bindEvents(childLayer, uniqueId, 'Polygon');

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
                }, 50);
            });
        });

        if (window.MapManager && window.Sidebar) {
            MapManager.mapLayersStorage[layerName] = bufferLayer;
            Sidebar.appendLayerCard(
                layerName, 0, 0, 1,
                (name) => {
                    const target = MapManager.mapLayersStorage[name];
                    if (!target) return false;
                    if (map.hasLayer(target)) { map.removeLayer(target); return false; }
                    else { map.addLayer(target); return true; }
                },
                (name) => {
                    const target = MapManager.mapLayersStorage[name];
                    if (target && map.hasLayer(target)) map.removeLayer(target);
                    delete MapManager.mapLayersStorage[name];
                    SessionManager.updateActivity();
                },
                (name) => {
                    const target = MapManager.mapLayersStorage[name];
                    if (target) map.fitBounds(target.getBounds());
                }
            );
        }

        bufferLayer._restoreData = item;
        bufferLayer._uniqueId = uniqueId;
    },

    updateActivity: function() {
        if (this.isRestoring) return;
        sessionStorage.setItem(this.activityKey, Date.now().toString());
        this.saveDrawnFeatures();
        this.saveMapViewState();
    },

    saveMapViewState: function() {
        const map = window.LayerController ? LayerController.map : (window.MapManager && window.MapManager.map ? window.MapManager.map : null);
        if (!map) return;
        const center = map.getCenter();
        const zoom = map.getZoom();
        sessionStorage.setItem(this.mapStateKey, JSON.stringify({ center: [center.lat, center.lng], zoom: zoom }));
    },

    saveDrawnFeatures: function() {
        if (this.isRestoring) return;
        const map = window.LayerController ? LayerController.map : (window.MapManager && window.MapManager.map ? window.MapManager.map : null);
        if (!map) return;
        
        let drawnItems = [];
        const officialGroups = [];
        
        if (window.MapManager && MapManager.mapLayersStorage) {
            for (let key in MapManager.mapLayersStorage) {
                if (!key.startsWith('Buffer_')) {
                    officialGroups.push(MapManager.mapLayersStorage[key]);
                }
            }
        }

        // 🔥 YENİ: Matruşka bebekleri gibi iç içe geçmiş tüm grupları derinlemesine tarayan motor
        const checkDeep = (group, targetLayer) => {
            if (group === targetLayer) return true;
            if (typeof group.hasLayer === 'function' && group.hasLayer(targetLayer)) return true;
            let found = false;
            if (typeof group.eachLayer === 'function') {
                group.eachLayer(child => {
                    if (checkDeep(child, targetLayer)) found = true;
                });
            }
            return found;
        };

        map.eachLayer(layer => {
            if (layer instanceof L.FeatureGroup || layer instanceof L.LayerGroup || layer instanceof L.GeoJSON) {
                
                // 🔥 1. AKILLI KONTROL: Bu parça resmi import klasörünün en dibinde bile olsa bul ve atla!
                let isOfficial = false;
                for (let i = 0; i < officialGroups.length; i++) {
                    if (checkDeep(officialGroups[i], layer)) {
                        isOfficial = true;
                        break;
                    }
                }
                if (isOfficial) return; // İçe aktarılan bir dosyaysa ASLA oturum hafızasına alma
                
                // 🔥 2. KONTROL: Senin AreaTool ile çizdiğin manuel çizimlerin alt gövdeleri
                let isChild = false;
                map.eachLayer(p => {
                    if (p !== layer && (p instanceof L.FeatureGroup || p instanceof L.LayerGroup) && typeof p.hasLayer === 'function' && p.hasLayer(layer)) isChild = true;
                });
                if (isChild && !(layer instanceof L.GeoJSON)) return;

                let toolType = layer.toolType || 'Unknown';
                let style = {};
                let label = '';
                let latlngs = [];
                let latlng = null;
                let metadata = null;

                if (toolType === 'Unknown') {
                    let hasPoly = false, hasLine = false, hasMarker = false;
                    if (typeof layer.eachLayer === 'function') {
                        layer.eachLayer(c => {
                            if (c.isBuffer) toolType = 'Buffer';
                            else if (c instanceof L.Polygon) hasPoly = true;
                            else if (c instanceof L.Polyline && !(c instanceof L.Polygon)) hasLine = true;
                            else if (c instanceof L.CircleMarker || c instanceof L.Marker) hasMarker = true;
                        });
                    }
                    if (toolType === 'Unknown') {
                        if (hasPoly) toolType = 'Polygon';
                        else if (hasLine) toolType = 'Line';
                        else if (hasMarker) toolType = 'Point';
                    }
                }

                if (layer._restoreData) {
                     metadata = layer._restoreData.metadata || metadata;
                     if (toolType === 'Unknown') {
                         drawnItems.push(layer._restoreData);
                         return;
                     }
                }

                if (layer.feature && layer.feature.properties && layer.feature.properties.metadata) {
                    metadata = layer.feature.properties.metadata;
                } else if (layer.metadata) {
                    metadata = layer.metadata;
                }

                if (toolType === 'Point') {
                    layer.eachLayer(c => {
                        if (c instanceof L.CircleMarker || c instanceof L.Marker) {
                            latlng = c.getLatLng();
                            style = {
                                radius: c.options.radius,
                                color: c.options.color,
                                weight: c.options.weight,
                                fillColor: c.options.fillColor,
                                fillOpacity: c.options.fillOpacity
                            };
                        }
                    });
                } else if (toolType === 'Polygon') {
                    layer.eachLayer(c => {
                        if (c instanceof L.Polygon) {
                            latlngs = c.getLatLngs();
                            style = {
                                color: c.options.color,
                                weight: c.options.weight,
                                dashArray: c.options.dashArray,
                                fillColor: c.options.fillColor,
                                fillOpacity: c.options.fillOpacity
                            };
                        }
                        if (!label && c.getTooltip && c.getTooltip()) {
                            let tc = c.getTooltip().getContent();
                            label = typeof tc === 'string' ? tc : tc.innerHTML;
                        }
                    });
                } else if (toolType === 'Line') {
                    layer.eachLayer(c => {
                        if (c instanceof L.Polyline && !(c instanceof L.Polygon)) {
                            const pts = c.getLatLngs();
                            if (Array.isArray(pts) && pts.length > 0) {
                                latlngs = pts.map(p => ({ lat: p.lat, lng: p.lng }));
                            }
                            style = {
                                color: c.options.color,
                                weight: c.options.weight,
                                dashArray: c.options.dashArray
                            };
                        }
                        if (!label && c.getTooltip && c.getTooltip()) {
                            let tc = c.getTooltip().getContent();
                            label = typeof tc === 'string' ? tc : tc.innerHTML;
                        }
                    });
                } else if (toolType === 'Buffer') {
                    if (layer._restoreData) {
                        style = layer._restoreData.style;
                    }
                }

                drawnItems.push({
                    toolType: toolType,
                    layerName: layer.layerName || (layer._restoreData ? layer._restoreData.layerName : null),
                    style: style,
                    label: label,
                    latlng: latlng,
                    latlngs: latlngs,
                    metadata: metadata,
                    geoJson: typeof layer.toGeoJSON === 'function' ? layer.toGeoJSON() : null,
                    parsedArea: layer._restoreData ? layer._restoreData.parsedArea : '',
                    parsedDist: layer._restoreData ? layer._restoreData.parsedDist : '',
                    parsedType: layer._restoreData ? layer._restoreData.parsedType : '',
                    uniqueId: layer._uniqueId || ('saved_' + Date.now() + Math.floor(Math.random()*1000))
                });
            }
        });

        if (drawnItems.length > 0) {
            sessionStorage.setItem(this.drawnKey, JSON.stringify(drawnItems));
        } else {
            sessionStorage.removeItem(this.drawnKey);
        }
    },

    setupActivityListeners: function() {
        let timeout;
        const resetTimer = () => {
            if (this.isRestoring) return;
            clearTimeout(timeout);
            timeout = setTimeout(() => this.updateActivity(), 1000); 
        };
        window.addEventListener('click', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('mouseup', resetTimer); 
    },

    setupStateObserver: function() {
        const targetNode = document.getElementById('layerList');
        if (!targetNode) return;
        const observer = new MutationObserver(() => {
            if (this.isRestoring) return;
            if (window.LayerController && LayerController.uploadedFileSet) {
                const activeLayers = Array.from(LayerController.uploadedFileSet);
                sessionStorage.setItem(this.layersKey, JSON.stringify(activeLayers));
            }
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }
};

window.SessionManager = SessionManager;