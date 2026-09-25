// Poligon katmanını, yazısını ve marker'larını fare ile sürükleyip taşıyan modeül
const PolygonDragEngine = {
    /**
     * Bir poligona ve onun köşe noktalarına sürükleme (drag) yeteneği enjekte eder.
     * @param {Object} map - Aktif Leaflet haritası
     * @param {Object} finalPolygon - Taşınacak ana poligon katmanı
     * @param {Array} polygonMarkers - Poligonun taşınacak köşe marker listesi
     */
    attachDragBehavior: function (map, finalPolygon, polygonMarkers) {
        let isDraggingPolygon = false;
        let dragStartLatLng = null;

        let originalPolygonLatLngs = finalPolygon.getLatLngs()[0];
        let originalMarkerPositions = polygonMarkers.map(marker => ({
            marker: marker,
            latlng: marker.getLatLng()
        }));

        const movePolygon = (moveEvent) => {
            if (!isDraggingPolygon) return;

            const latDiff = moveEvent.latlng.lat - dragStartLatLng.lat;
            const lngDiff = moveEvent.latlng.lng - dragStartLatLng.lng;

            // 1. Poligon Gövdesini Taşı
            const movedPolygonLatLngs = originalPolygonLatLngs.map(latlng => {
                return L.latLng(latlng.lat + latDiff, latlng.lng + lngDiff);
            });
            finalPolygon.setLatLngs([movedPolygonLatLngs]);

            // Polygonda koordinatlar değiştikten hemen sonra kesişimi baştan hesapla
            if (window.IntersectionManager) window.IntersectionManager.calculate();

            // 2. Alan Yazısını Ortala ve Taşı
            const polygonTooltip = finalPolygon.getTooltip();
            if (polygonTooltip) {
                polygonTooltip.setLatLng(finalPolygon.getBounds().getCenter());
            }

            // 3. Köşe Halkalarını Taşı
            originalMarkerPositions.forEach(item => {
                item.marker.setLatLng(L.latLng(item.latlng.lat + latDiff, item.latlng.lng + lngDiff));
            });
        };

        const stopPolygonDrag = () => {
            if (!isDraggingPolygon) return;
            isDraggingPolygon = false;

            map.off('mousemove', movePolygon);
            map.dragging.enable();

            if (finalPolygon._path) finalPolygon._path.style.cursor = 'grab';

            originalPolygonLatLngs = finalPolygon.getLatLngs()[0];
            originalMarkerPositions = polygonMarkers.map(marker => ({
                marker: marker,
                latlng: marker.getLatLng()
            }));
        };

        finalPolygon.on('mousedown', (dragEvent) => {
            if (dragEvent.originalEvent.button !== 0) return;

            isDraggingPolygon = true;
            dragStartLatLng = dragEvent.latlng;

            if (map.dragging.enabled()) map.dragging.disable();

            map.on('mousemove', movePolygon);
            map.once('mouseup', stopPolygonDrag);
            L.DomEvent.stopPropagation(dragEvent.originalEvent);

            if (finalPolygon._path) finalPolygon._path.style.cursor = 'grabbing';
        });

        if (finalPolygon._path) finalPolygon._path.style.cursor = 'grab';
    },

    /**
     * 🚀 YENİ MOTOR: Komple bir çizgi grubuna (tüm segmentler ve markerlar) sürükleme yeteneği enjekte eder.
     * @param {Object} map - Aktif Leaflet haritası
     * @param {Array} lineSegments - Çizgiyi oluşturan parça L.polyline nesnelerinin dizisi
     * @param {Array} lineMarkers - Çizginin köşe noktalarındaki L.circleMarker nesnelerinin dizisi
     */
    attachLineDragBehavior: function (map, lineSegments, lineMarkers) {
        let isDraggingLine = false;
        let dragStartLatLng = null;

        // Çizgilerin parça parça orijinal koordinat ağaçlarını saklıyoruz
        let originalLinesData = lineSegments.map(line => ({
            lineObject: line,
            latlngs: line.getLatLngs()
        }));

        // Köşe noktalarının orijinal koordinatlarını saklıyoruz
        let originalMarkerPositions = lineMarkers.map(marker => ({
            markerObject: marker,
            latlng: marker.getLatLng()
        }));

        // Fare hareket ettikçe tetiklenen delta kaydırma algoritması
        const moveLine = (moveEvent) => {
            if (!isDraggingLine) return;

            // Farenin ilk bastığı yer ile şu anki yeri arasındaki koordinat farkı (Delta)
            const latDiff = moveEvent.latlng.lat - dragStartLatLng.lat;
            const lngDiff = moveEvent.latlng.lng - dragStartLatLng.lng;

            // 1. Her bir çizgi segmentini taşı ve üzerindeki Tooltip'i (km yazısı) ortala
            originalLinesData.forEach(item => {
                const movedLatLngs = item.latlngs.map(latlng => {
                    return L.latLng(latlng.lat + latDiff, latlng.lng + lngDiff);
                });
                item.lineObject.setLatLngs(movedLatLngs);

                // Km yazan etiketi çizginin yeni orta noktasına uçur
                const tooltip = item.lineObject.getTooltip();
                if (tooltip) {
                    tooltip.setLatLng(item.lineObject.getBounds().getCenter());
                }
            });

            // 2. Çizgi üzerindeki tüm kırmızı yuvarlak köşe noktalarını taşı
            originalMarkerPositions.forEach(item => {
                item.markerObject.setLatLng(L.latLng(item.latlng.lat + latDiff, item.latlng.lng + lngDiff));
            });
        };

        // Fare bırakıldığında sürüklemeyi bitiren temizlik fonksiyonu
        const stopLineDrag = () => {
            if (!isDraggingLine) return;
            isDraggingLine = false;

            map.off('mousemove', moveLine);
            map.dragging.enable(); // Harita kaydırmayı aç

            lineSegments.forEach(line => {
                if (line._path) line._path.style.cursor = 'grab';
            });

            // Sürükleme bittiği için yeni koordinatları "orijinal referans noktası" olarak hafızaya sabitliyoruz
            originalLinesData = lineSegments.map(line => ({
                lineObject: line,
                latlngs: line.getLatLngs()
            }));

            originalMarkerPositions = lineMarkers.map(marker => ({
                markerObject: marker,
                latlng: marker.getLatLng()
            }));
        };

        // Her bir çizgi parçasına mousedown (farenin basılma) olayını bağlıyoruz
        lineSegments.forEach(line => {
            line.on('mousedown', (dragEvent) => {
                if (dragEvent.originalEvent.button !== 0) return; // Sadece sol fare tıkı

                isDraggingLine = true;
                dragStartLatLng = dragEvent.latlng;

                if (map.dragging.enabled()) map.dragging.disable(); // Sürüklerken harita arkadan kaymasın

                map.on('mousemove', moveLine);
                map.once('mouseup', stopLineDrag);
                L.DomEvent.stopPropagation(dragEvent.originalEvent); // Harita tıklama olayını yut

                lineSegments.forEach(l => {
                    if (l._path) l._path.style.cursor = 'grabbing';
                });
            });

            if (line._path) line._path.style.cursor = 'grab';
        });
    }
};
window.PolygonDragEngine = PolygonDragEngine;
