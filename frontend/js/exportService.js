const ExportService = {
    // Haritadaki kalıcı tüm ölçüm gruplarını toplayacağımız küresel havuz
    globalMeasureFolder: null,
    // Dosya ismini önce 0'dan başlatıp arttırarak gideceğimiz sayaç
    exportCounter : 0,
    // Dosya tarihini tutan değişken
    lastExportDate : null,

    /**
     * İhracat havuzunu başlatan ana fonksiyon
     * @param {Object} map - Aktif Leaflet harita nesnesi
     */
    init: function (map) {
        // Haritaya görünmez ama veri toplayan ortak bir FeatureGroup ekliyoruz
        this.globalMeasureFolder = L.featureGroup().addTo(map);
    },

    /**
     * Çizilen her bir ölçüm grubunu ortak havuza kaydeder
     * @param {Object} group - distanceTool veya areaTool içindeki measurementGroup/polygonGroup
     */
    registerMeasurement: function (group) {
        if (this.globalMeasureFolder) {
            this.globalMeasureFolder.addLayer(group);
        }
    },

    // Havuzdaki tüm verileri toplayıp GeoJSON olarak sunucuya kaydeder
    exportMeasurementsToGeoJSON: function () {
        if (!this.globalMeasureFolder || this.globalMeasureFolder.getLayers().length === 0) {
            alert(window.APP_MESSAGES?.NO_MEASUREMENT_TO_EXPORT || "Dışa aktarılacak ölçüm bulunamadı!");
            return;
        }

        // 🔥 1. YENİ EKLENEN KISIM: Kullanıcıya Grup Adını Soruyoruz
        const grupAdi = prompt("Bu çalışmayı hangi isimle kaydetmek istersiniz?", "Yeni Çalışma");

        // Eğer kullanıcı 'İptal'e basarsa veya boş bırakırsa işlemi durdur
        if (!grupAdi || grupAdi.trim() === "") {
            alert("Kayıt işlemi iptal edildi veya geçerli bir grup ismi girilmedi.");
            return; 
        }

        // 2. Havuzdaki çizimleri GeoJSON formatına çevir VE STİLLERİ (Renk, Çizgi vb.) KAYDET
        const features = [];
        this.globalMeasureFolder.eachLayer(function (layer) {
            // Bu üst katmanın (Point/Line/Polygon/Buffer) kendi obje kimliği varsa alıyoruz.
            // Bu kimlik sayesinde import ederken "hangi parçalar aynı objeye ait" bilgisini geri kurabileceğiz.
            const objectId = layer._objectId || null;

            // Eğer layer bir grupsa (distanceTool veya areaTool genelde grup atar), içindekileri dön
            const extractFeature = (subLayer) => {
                if (typeof subLayer.toGeoJSON === 'function') {
                    const feature = subLayer.toGeoJSON();
                    feature.properties = feature.properties || {};
                    
                    // Çizilen her bir şeklin (feature) içine grup adını mühürlüyoruz!
                    feature.properties.grupAdi = grupAdi.trim();
                    feature.properties.exportId = this.exportCounter;

                    // Objenin parçalarını (nokta+çizgi/poligon gövdesi) birbirine bağlayan kimlik
                    if (objectId) feature.properties.objectId = objectId;

                    // Leaflet'teki Çizgi, Renk ve Stil ayarlarını GeoJSON properties içine göm
                    if (subLayer.options) {
                        if (subLayer.options.color) feature.properties.color = subLayer.options.color;
                        if (subLayer.options.fillColor) feature.properties.fillColor = subLayer.options.fillColor;
                        if (subLayer.options.fillOpacity) feature.properties.fillOpacity = subLayer.options.fillOpacity;
                        if (subLayer.options.weight) feature.properties.weight = subLayer.options.weight;
                        if (subLayer.options.dashArray) feature.properties.dashArray = subLayer.options.dashArray;
                        if (subLayer.options.radius) feature.properties.radius = subLayer.options.radius;
                    }
                    
                    // Ekrandaki o "1498.26 km" veya "Alan: ..." etiketlerini (Tooltip) JSON'a kaydet
                    if (subLayer.getTooltip && subLayer.getTooltip()) {
                        feature.properties.label = subLayer.getTooltip().getContent();
                    }

                    features.push(feature);
                }
            };

            // Hem tekil objeleri hem de grup içindeki objeleri tarayacak mantık
            if (layer instanceof L.LayerGroup || layer instanceof L.FeatureGroup) {
                layer.eachLayer(extractFeature);
            } else {
                extractFeature(layer);
            }
        });

        // Yeni ve zenginleştirilmiş GeoJSON objemizi oluşturuyoruz
        const geojsonData = {
            type: "FeatureCollection",
            features: features
        };

        // 3. Sayaç ve Tarih metadatalarını güncelle
        this.exportCounter++;
        this.lastExportDate = new Date().toISOString();

        // 4. Bu metadataları paketin içine gizlice göm
        geojsonData.properties = {
            ...geojsonData.properties,
            exportId: this.exportCounter,
            exportDate: this.lastExportDate,
            creator: "Fatih Muaz", // Backend'e kimin oluşturduğu bilgisi de gitsin
            grupAdi: grupAdi.trim() // Ana pakete de grup adını ekleyelim garanti olsun
        };

        // Loading ekranını aç
        if (window.LoadingManager) window.LoadingManager.show();

        // Veriyi Backend'e POST at
        window.ApiService.saveMeasurements(geojsonData)
            .then(savedFileName => {
                // Başarı mesajını kullanıcının verdiği isme göre özelleştirdik
                alert(`✅ Harika! "${grupAdi.trim()}" isimli çalışmanız başarıyla veritabanına kaydedildi! 🚀`);
            })
            .catch(err => {
                alert("Sunucuya Bağlanılamadı! Backend Ayakta Mı?\nHata Detayı: " + err.message);
            })
            .finally(() => {
                if (window.LoadingManager) window.LoadingManager.hide();
            });
    }
};

window.ExportService = ExportService;