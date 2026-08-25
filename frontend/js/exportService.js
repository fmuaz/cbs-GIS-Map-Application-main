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

        // 1. Havuzdaki çizimleri GeoJSON formatına çevir
        const geojsonData = this.globalMeasureFolder.toGeoJSON();

        // 2. Sayaç ve Tarih metadatalarını güncelle
        this.exportCounter++;
        this.lastExportDate = new Date().toISOString();

        // 3. Bu metadataları paketin içine gizlice göm
        geojsonData.properties = {
            ...geojsonData.properties,
            exportId: this.exportCounter,
            exportDate: this.lastExportDate,
            creator: "Fatih Muaz" // Backend'e kimin oluşturduğu bilgisi de gitsin
        };

        // Loading ekranını aç
        if (window.LoadingManager) window.LoadingManager.show();

        // Veriyi Backend'e POST at
        window.ApiService.saveMeasurements(geojsonData)
            .then(savedFileName => {
                // Sadece basit bir alert yerine detaylı bir bilgilendirme
                alert(`✅ Ölçümleriniz başarıyla kaydedildi!\n📄 Dosya Adı: ${savedFileName}`);
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