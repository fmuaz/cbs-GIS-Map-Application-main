const ApiService = {
    // Backend API ana rotası
    baseUrl: 'http://localhost:8080/api/geo',

    fetchGeoJson: function(fileName) {
        return fetch(`${this.baseUrl}/getGeoJson/${fileName}`)
            .then(res => {
                if (!res.ok) throw new Error("Sunucudan dosya alınamadı!");
                return res.json();
            });
    },

    // Veritabanındaki kayıtlı Grup İsimlerini listeler
    fetchGroupList: async function() {
        const response = await fetch(`${this.baseUrl}/getGroupList`);
        if (!response.ok) throw new Error("Kayıtlı grup listesi alınamadı!");
        return await response.json();
    },

    // Seçilen Grup Adına ait verileri veritabanından GeoJSON paketi olarak çeker
    fetchGroupByName: async function(grupAdi) {
        // İsimde boşluk veya Türkçe karakter olma ihtimaline karşı encodeURIComponent kullanıyoruz
        const response = await fetch(`${this.baseUrl}/getGroup/${encodeURIComponent(grupAdi)}`);
        if (!response.ok) throw new Error("Grup verisi veritabanından çekilemedi!");
        return await response.json();
    },

    uploadGeoJson: function(fileObject) {
        const formData = new FormData();
        formData.append('file', fileObject);

        return fetch(`${this.baseUrl}/upload`, {
            method: 'POST',
            body: formData
        }).then(res => {
            if (!res.ok) throw new Error("Dosya sunucuya yüklenemedi!");
            return res.text();
        });
    },

    listLayers: function() {
        return fetch(`${this.baseUrl}/listLayers`)
            .then(res => res.json());
    },

    saveMeasurements: function(geoJsonData) {
        return fetch(`${this.baseUrl}/saveMeasurements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geoJsonData)
        }).then(res => {
            if (!res.ok) throw new Error("Ölçümler sunucuya kaydedilemedi!");
            return res.text();
        });
    }
};

window.ApiService = ApiService;