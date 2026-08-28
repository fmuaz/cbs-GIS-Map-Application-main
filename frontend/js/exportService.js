const ExportService = {
    globalMeasureFolder: null,
    exportCounter: 0,
    lastExportDate: null,

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

            // 1. Poligon Grubu Kontrolü (İçindeki köşe noktalarını atlayıp sadece ana Poligonu alır)
            let mainPolygon = null;
            let subLines = [];
            let isolatedPoints = [];

            if (layer instanceof L.FeatureGroup || layer instanceof L.LayerGroup) {
                layer.eachLayer(sub => {
                    if (sub instanceof L.Polygon) {
                        mainPolygon = sub;
                    } else if (sub instanceof L.Polyline && !(sub instanceof L.Polygon)) {
                        subLines.push(sub);
                    } else if (sub instanceof L.CircleMarker || sub instanceof L.Marker) {
                        isolatedPoints.push(sub);
                    }
                });
            } else {
                if (layer instanceof L.Polygon) mainPolygon = layer;
                else if (layer instanceof L.Polyline) subLines.push(layer);
                else if (layer instanceof L.CircleMarker || layer instanceof L.Marker) isolatedPoints.push(layer);
            }

            // Durum A: Katman bir Poligon ise (Köşe noktalarını JSON'a dahil etme)
            if (mainPolygon) {
                const feat = mainPolygon.toGeoJSON();
                feat.properties = feat.properties || {};
                feat.properties.grupAdi = grupAdi.trim();
                feat.properties.toolType = 'polygon';
                feat.properties.style = {
                    fillColor: mainPolygon.options.fillColor || mainPolygon.options.color || '#28a745',
                    fillOpacity: mainPolygon.options.fillOpacity !== undefined ? mainPolygon.options.fillOpacity : 0.3,
                    color: mainPolygon.options.color || '#28a745',
                    weight: mainPolygon.options.weight || 3,
                    dashArray: mainPolygon.options.dashArray || null
                };
                if (layer.metadata || mainPolygon.metadata) feat.properties.metadata = layer.metadata || mainPolygon.metadata;
                if (mainPolygon.getTooltip && mainPolygon.getTooltip()) feat.properties.label = mainPolygon.getTooltip().getContent();
                if (objectId) feat.properties.objectId = objectId;
                features.push(feat);
            }
            // Durum B: Katman bir Çizgi Grubu ise (Parça çizgileri birleştirip tek bir LineString yap)
            else if (subLines.length > 0) {
                const allCoords = [];
                subLines.forEach(l => {
                    const latlngs = l.getLatLngs();
                    latlngs.forEach(p => {
                        const coord = [p.lng, p.lat];
                        const lastCoord = allCoords[allCoords.length - 1];
                        if (!lastCoord || lastCoord[0] !== coord[0] || lastCoord[1] !== coord[1]) {
                            allCoords.push(coord);
                        }
                    });
                });

                const refLine = subLines[0];
                const feat = {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: allCoords
                    },
                    properties: {
                        grupAdi: grupAdi.trim(),
                        toolType: 'line',
                        style: {
                            color: refLine.options.color || '#007bff',
                            weight: refLine.options.weight || 3,
                            dashArray: refLine.options.dashArray || null,
                            opacity: refLine.options.opacity !== undefined ? refLine.options.opacity : 1
                        }
                    }
                };
                if (layer.metadata || refLine.metadata) feat.properties.metadata = layer.metadata || refLine.metadata;
                if (refLine.getTooltip && refLine.getTooltip()) feat.properties.label = refLine.getTooltip().getContent();
                if (objectId) feat.properties.objectId = objectId;
                features.push(feat);
            }
            // Durum C: Bağımsız tekil Noktalar (PointTool ile çizilenler)
            else if (isolatedPoints.length > 0) {
                isolatedPoints.forEach(pt => {
                    const feat = pt.toGeoJSON();
                    feat.properties = feat.properties || {};
                    feat.properties.grupAdi = grupAdi.trim();
                    feat.properties.toolType = 'point';
                    feat.properties.style = {
                        radius: pt.options.radius || 6,
                        color: pt.options.color || '#ffc107',
                        weight: pt.options.weight || 2,
                        fillColor: pt.options.fillColor || '#ffc107',
                        fillOpacity: pt.options.fillOpacity !== undefined ? pt.options.fillOpacity : 1
                    };
                    if (layer.metadata || pt.metadata) feat.properties.metadata = layer.metadata || pt.metadata;
                    if (objectId) feat.properties.objectId = objectId;
                    features.push(feat);
                });
            }
        }.bind(this));

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

        // Bilgisayara İndir
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData, null, 2));
        const downloadAnchorElement = document.createElement('a');
        downloadAnchorElement.setAttribute("href", dataStr);
        downloadAnchorElement.setAttribute("download", `${grupAdi.trim().replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorElement);
        downloadAnchorElement.click();
        document.body.removeChild(downloadAnchorElement);

        if (window.LoadingManager) window.LoadingManager.show();

        // Backend'e Kaydet
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