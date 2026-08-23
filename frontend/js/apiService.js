// Sadece backend yani fetch isteklerinden sorumlu iletişimci

const ApiService = {
    // Fetch GeoJSON data from backend by file name
    fetchGeoJson: function (fileName) {
        const url = GIS_CONFIG.API.GET_GEOJSON(fileName);
        
        return fetch(url).then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) });
            }
            return response.json();
        });
    }
};

// Global access link
window.ApiService = ApiService;