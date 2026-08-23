const ExportService = {
    // Haritadaki kalıcı tüm ölçüm gruplarını toplayacağımız küresel havuz
    globalMeasureFolder: null,
    // dosya ismini önce 0 da başlatıp arttırarak gideceğim her indirmede
    exportCounter : 0,
    // dosya tarihini tutan değişken
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

    /**
     * Havuzdaki tüm verileri toplayıp GeoJSON olarak bilgisayara indirir
     */
    exportMeasurementsToGeoJSON: function () {
        if (!this.globalMeasureFolder || this.globalMeasureFolder.getLayers().length === 0) {
            alert("⚠️ Haritada dışarı aktarılacak aktif bir çizgi veya alan ölçümü bulunamadı!");
            return;
        }

        // o günün tarihini alıyoruz
        const timeStamp = new Date().toISOString().slice(0, 10);

        if (this.lastExportDate !== timeStamp) {
            this.exportCounter = 1;       // Sayacı o gün için sıfırdan, yani 1'den başlat 🎯
            this.lastExportDate = timeStamp; // Hafızadaki tarihi bugünün tarihiyle güncelle
        } else {
            // Eğer hala aynı gün içindeysek sayacı normal şekilde 1 arttır
            this.exportCounter++;
        }

        // Leaflet nesnelerini tek hamlede standart GeoJSON formatına çevirir
        const rawGeoJson = this.globalMeasureFolder.toGeoJSON();

        // Veriyi daha okunabilir kılmak için JSON formatına sokuyoruz
        const convertedString = JSON.stringify(rawGeoJson, null, 2);

        // Tarayıcı üzerinden sanal bir dosya (Blob) üretiyoruz
        const blobObject = new Blob([convertedString], { type: "application/json" });
        
        // Sanal bir indirme köprüsü yani link kuruyoruz
        const downloadBridge = document.createElement("a");
        downloadBridge.href = URL.createObjectURL(blobObject);
        
        // Dosya adı dinamik olsun diye o anki zaman damgasını ekliyoruz
        downloadBridge.download = `harita_olcumleri_${timeStamp}_${this.exportCounter}.geojson`;

        // Arka planda linke tıklama simülasyonu yapıp dosyayı indiriyoruz
        document.body.appendChild(downloadBridge);
        downloadBridge.click();
        
        // Temizlik: Bellekte yer kaplamaması için sanal linki imha ediyoruz
        document.body.removeChild(downloadBridge);
    }
};

window.ExportService = ExportService;