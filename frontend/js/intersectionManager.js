// bu modeül kesişimleri hesaplayıp alanı yazacak
const IntersectionManager = {
    map: null,
    polygons: new Set(), // Aktif poligonları burada tutacağız
    intersectionLayer: null, // Kesişimlerin çizileceği geçici katman

    init: function (leafletMap) {
        this.map = leafletMap;
        // Kesişimleri diğer her şeyin üstünde göstermek için ayrı bir grup oluşturuyoruz
        this.intersectionLayer = L.featureGroup().addTo(this.map);
    },

    // Yeni bir poligon çizildiğinde listeye ekle
    addPolygon: function (layer) {
        this.polygons.add(layer);
        this.calculate();
    },

    // Poligon silindiğinde listeden çıkar
    removePolygon: function (layer) {
        this.polygons.delete(layer);
        this.calculate();
    },

    // Kesişim hesaplayan ana motor (Sürükleme anında da bu çağırılacak)
    calculate: function () {
        if (!this.intersectionLayer) return;
        
        // Önceki kesişim çizimlerini ve yazılarını tamamen temizle
        this.intersectionLayer.clearLayers();

        const polyArray = Array.from(this.polygons);
        // Kesişim için en az 2 poligon lazım
        if (polyArray.length < 2) return;

        // Tüm poligonları birbiriyle eşleştirip kesişim var mı diye kontrol et
        for (let i = 0; i < polyArray.length; i++) {
            for (let j = i + 1; j < polyArray.length; j++) {
                const p1 = polyArray[i];
                const p2 = polyArray[j];

                try {
                    const turf1 = this.leafletToTurf(p1);
                    const turf2 = this.leafletToTurf(p2);

                    if (turf1 && turf2) {
                        // Turf v7 için iki poligonu FeatureCollection içine alıp kesiştiriyoruz
                        const intersection = turf.intersect(turf.featureCollection([turf1, turf2]));

                        if (intersection) {
                            this.drawIntersection(intersection);
                        }
                    }
                } catch (e) {
                    // Sürükleme esnasında oluşabilecek anlık topoloji hatalarını yoksay
                }
            }
        }
    },

    // Leaflet objesini Turf objesine çeviren yardımcı fonksiyon
    leafletToTurf: function (layer) {
        const latlngs = layer.getLatLngs()[0];
        if (!latlngs || latlngs.length < 3) return null;
        
        const coords = latlngs.map(p => [p.lng, p.lat]);
        coords.push([latlngs[0].lng, latlngs[0].lat]); // Poligonu kapat
        
        return turf.polygon([coords]);
    },

    // Kesişim alanını haritaya farklı bir stille çizen fonksiyon
    drawIntersection: function (geojsonFeature) {
        const areaSqM = turf.area(geojsonFeature);
        
        // Milimetrik temasları (0'a yakın alanları) kesişimden sayma
        if (areaSqM < 1) return; 

        let areaFormatted = areaSqM >= 1000000 
            ? `${(areaSqM / 1000000).toFixed(2)} km²` 
            : `${areaSqM.toFixed(0)} m²`;

        // Kesişim poligonunu uyarı rengiyle (Kırmızı/Turuncu) haritaya bas
        L.geoJSON(geojsonFeature, {
            style: {
                color: '#ff4757',       // Kırmızı kenarlık
                weight: 2,
                fillColor: '#ff4757',   // Kırmızı dolgu
                fillOpacity: 0.6,
                dashArray: '5, 5'
            },
            interactive: false // Kesişim alanının tıklanabilir olmasına gerek yok
        }).addTo(this.intersectionLayer);

        // Etiketi (Tooltip) kesişim alanının tam merkezine yerleştir
        const center = turf.centerOfMass(geojsonFeature);
        const centerLatLng = [center.geometry.coordinates[1], center.geometry.coordinates[0]];

        L.tooltip({
            permanent: true, 
            direction: 'center', 
            className: 'intersection-label',
            interactive: false
        })
        .setLatLng(centerLatLng)
        .setContent(`⚠️ Kesişim: ${areaFormatted}`)
        .addTo(this.intersectionLayer);
    }
};

window.IntersectionManager = IntersectionManager;