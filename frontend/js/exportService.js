const ExportService = {
    globalMeasureFolder: null,
    exportCounter : 0,
    lastExportDate : null,

    init: function (map) {
        this.globalMeasureFolder = L.featureGroup().addTo(map);
    },

    registerMeasurement: function (group) {
        if (this.globalMeasureFolder) {
            this.globalMeasureFolder.addLayer(group);
        }
    },

    exportMeasurementsToGeoJSON: function () {
        if (!this.globalMeasureFolder || this.globalMeasureFolder.getLayers().length === 0) {
            alert(window.APP_MESSAGES?.NO_MEASUREMENT_TO_EXPORT || "Dışa aktarılacak ölçüm bulunamadı!");
            return;
        }

        const grupAdi = prompt("Bu çalışmayı hangi isimle kaydetmek istersiniz?", "Yeni Çalışma");
        if (!grupAdi || grupAdi.trim() === "") {
            alert("Kayıt işlemi iptal edildi veya geçerli bir grup ismi girilmedi.");
            return; 
        }

        const features = [];
        this.globalMeasureFolder.eachLayer(function (layer) {
            const objectId = layer._objectId || null;

            const extractFeature = (subLayer) => {
                if (typeof subLayer.toGeoJSON === 'function') {
                    const feature = subLayer.toGeoJSON();
                    feature.properties = feature.properties || {};
                    
                    feature.properties.grupAdi = grupAdi.trim();
                    feature.properties.exportId = this.exportCounter;
                    if (objectId) feature.properties.objectId = objectId;

                    // --- 1. OBJEYE ÖZGÜ TİP VE METADATA KORUMASI ---
                    let toolType = subLayer.toolType || 'unknown';
                    let isBuffer = subLayer.isBuffer || false;
                    
                    if (isBuffer) {
                        toolType = 'buffer';
                    } else if (subLayer instanceof L.Polygon) {
                        toolType = 'polygon';
                    } else if (subLayer instanceof L.Polyline && !(subLayer instanceof L.Polygon)) {
                        toolType = 'line';
                    } else if (subLayer instanceof L.CircleMarker || subLayer instanceof L.Marker) {
                        toolType = 'point';
                    }

                    feature.properties.toolType = toolType;
                    feature.properties.isBuffer = isBuffer;
                    if (subLayer.layerName) feature.properties.layerName = subLayer.layerName;
                    
                    // Metadata/Notları göm
                    if (subLayer.metadata) {
                        feature.properties.metadata = subLayer.metadata;
                    }

                    // --- 2. OBJEYE ÖZGÜ STİL (STYLE) AYRIŞTIRMASI ---
                    let styleObj = {};
                    if (subLayer.options) {
                        if (toolType === 'polygon' || toolType === 'buffer') {
                            styleObj = {
                                fillColor: subLayer.options.fillColor,
                                fillOpacity: subLayer.options.fillOpacity,
                                color: subLayer.options.color,
                                weight: subLayer.options.weight,
                                dashArray: subLayer.options.dashArray
                            };
                        } else if (toolType === 'line') {
                            styleObj = {
                                color: subLayer.options.color,
                                weight: subLayer.options.weight,
                                opacity: subLayer.options.opacity,
                                dashArray: subLayer.options.dashArray
                            };
                        } else if (toolType === 'point') {
                            styleObj = {
                                radius: subLayer.options.radius,
                                fillColor: subLayer.options.fillColor,
                                fillOpacity: subLayer.options.fillOpacity,
                                color: subLayer.options.color,
                                weight: subLayer.options.weight,
                                opacity: subLayer.options.opacity
                            };
                        }
                    }
                    feature.properties.style = styleObj;

                    if (subLayer.getTooltip && subLayer.getTooltip()) {
                        feature.properties.label = subLayer.getTooltip().getContent();
                    }

                    features.push(feature);
                }
            };

            if (layer instanceof L.LayerGroup || layer instanceof L.FeatureGroup) {
                layer.eachLayer(extractFeature);
            } else {
                extractFeature(layer);
            }
        }.bind(this)); // bind(this) eklendi ki this.exportCounter'a erişebilsin

        const geojsonData = {
            type: "FeatureCollection",
            features: features
        };

        this.exportCounter++;
        this.lastExportDate = new Date().toISOString();

        geojsonData.properties = {
            ...geojsonData.properties,
            exportId: this.exportCounter,
            exportDate: this.lastExportDate,
            creator: "Fatih Muaz",
            grupAdi: grupAdi.trim() 
        };

        // --- 3. BİLGİSAYARA LOKAL DOSYA OLARAK KAYDETME (EXPORT) ---
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData, null, 2));
        const downloadAnchorElement = document.createElement('a');
        downloadAnchorElement.setAttribute("href", dataStr);
        // Dosya adı kullanıcının girdiği grup adı olsun
        downloadAnchorElement.setAttribute("download", `${grupAdi.trim().replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorElement);
        downloadAnchorElement.click();
        document.body.removeChild(downloadAnchorElement);

        if (window.LoadingManager) window.LoadingManager.show();

        // --- 4. MEVCUT DATABASE KAYDI (KORUNDU) ---
        window.ApiService.saveMeasurements(geojsonData)
            .then(savedFileName => {
                alert(`✅ Harika! "${grupAdi.trim()}" isimli çalışmanız bilgisayarınıza indirildi ve veritabanına kaydedildi! 🚀`);
            })
            .catch(err => {
                alert("Dosya indirildi ancak Sunucuya Bağlanılamadı!\nHata Detayı: " + err.message);
            })
            .finally(() => {
                if (window.LoadingManager) window.LoadingManager.hide();
            });
    }
};

window.ExportService = ExportService;