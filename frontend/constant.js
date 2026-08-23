// GIS Application Constants and Configuration
const GIS_CONFIG = {
    // API Endpoints
    API: {
        BASE_URL: 'http://localhost:8080/api/geo',
        GET_GEOJSON: (fileName) => `http://localhost:8080/api/geo/getGeojson/${fileName}`
    },

    // Map Settings
    MAP: {
        DEFAULT_CENTER: [20.0, 0.0],
        DEFAULT_ZOOM: 3,
        MAX_ZOOM: 19,
        TILE_LAYER_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ATTRIBUTION: '© OpenStreetMap'
    },

    // Asset Paths (Broken Icon Fix)
    ASSETS: {
        ICON_RETINA: 'leaflet.js/../images/marker-icon-2x.png',
        ICON_DEFAULT: 'leaflet.js/../images/marker-icon.png',
        ICON_SHADOW: 'leaflet.js/../images/marker-shadow.png'
    },

    // Measurement Tool Styles
    MEASURE_STYLE: {
        MARKER_RADIUS: 5,
        LINE_COLOR: '#dc3545',
        FILL_COLOR: '#fff',
        WEIGHT: 4,
        DASH_ARRAY: '6, 6'
    }, // <-- Buradaki virgül eksikti ve altındaki buffer objeye dahil edildi

    // Buffer ayarı
    BUFFER: {
        DEFAULT_DISTANCE: 500, // Varsayılan buffer mesafesi (metre)
        STYLE: {
            color: '#0099ff',     // Mavi border
            weight: 2,
            fillColor: '#0099ff', // Mavi transparan dolgu
            fillOpacity: 0.2,
            dashArray: '5, 5'     // Kesikli çizgi stili
        }
    }
};
// Global erişim için window nesnesine bağlıyoruz
window.GIS_CONFIG = GIS_CONFIG;


// Feature Style Sabitleri
const STYLE_CONSTANTS = {
    DEFAULT_LINE: { 
        color: '#3388ff', 
        weight: 3, 
        lineType: 'solid' 
    },
    DEFAULT_POLYGON: { 
        color: '#3388ff', 
        weight: 3 
        // Polygon dolgu (fill) ayarları projede zaten varsa onlara dokunmuyoruz.
    },
    LINE_TYPE_MAP: {
        solid: null,      // Düz çizgi
        dot: '1, 6',      // Noktalı çizgi
        dash: '10, 10'    // Kesikli çizgi
    }
};
// Global erişim için window nesnesine bağlıyoruz
window.STYLE_CONSTANTS = STYLE_CONSTANTS;


// UYGULAMA MESAJLARI
const APP_MESSAGES = {
    LAYER_ALREADY_LOADED: (fileName) => `⚠️ "${fileName}" zaten yüklü! Kamera katmana taşınıyor.`,
    IMPORT_SUCCESS: "📥 Ölçümler başarıyla haritaya ve sağ panele yüklendi!",
    IMPORT_ERROR: (msg) => `⚠️ GeoJSON dosyası çözümlenirken hata oluştu: ${msg}`,

    // Buffer ayarı (Artık obje formatına uygun)
    BUFFER_INVALID_GEOMETRY: "⚠️ Buffer sadece Çizgi (Line) ve Alan (Polygon) tiplerine uygulanabilir.",
    BUFFER_INVALID_DISTANCE: "⚠️ Lütfen geçerli bir pozitif buffer mesafesi girin.",
    BUFFER_ERROR: (msg) => `⚠️ Buffer oluşturulurken hata oluştu: ${msg}`
};

window.APP_MESSAGES = APP_MESSAGES;

// METADATA SABİTLERİ VE ARAYÜZ METİNLERİ
const METADATA_CONFIG = {
    // Veritabanı ve GeoJSON Export şablonu
    DEFAULT_TEMPLATE: {
        name: '',
        category: '',
        description: ''
    },
    // Popup içindeki buton ve etiket (label) yazıları
    UI: {
        BUTTON_EDIT: "📝 Metadata Düzenle",
        FORM_TITLE: "📝 Metadata Düzenle",
        PLACEHOLDER_NAME: "İsim (Label)",
        PLACEHOLDER_CATEGORY: "Kategori",
        PLACEHOLDER_DESC: "Açıklama / Not",
        BUTTON_SAVE: "Kaydet",
        BUTTON_CANCEL: "İptal",
        LABEL_NAME: "İsim:",
        LABEL_CATEGORY: "Kategori:",
        LABEL_DESC: "Açıklama:"
    }
};

window.METADATA_CONFIG = METADATA_CONFIG;

// Eğer GIS_CONFIG.POINT_STYLE yoksa oluştur
window.GIS_CONFIG.POINT_STYLE = {
    RADIUS: 6,
    COLOR: '#343a40',
    FILL_COLOR: '#ffc107', // Şık bir sarı uyarı rengi
    WEIGHT: 2
};

// METADATA_CONFIG.UI içine nokta başlığını ekleyelim
window.METADATA_CONFIG.UI.POINT_TITLE = "📍 Nokta Bilgileri";

// HISTORY (UNDO/REDO) SABİTLERİ
window.GIS_CONFIG.HISTORY = {
    LIMIT: 50, // Hafıza dostu maksimum işlem sınırı
    SHORTCUTS: {
        UNDO: 'z',
        REDO: 'y'
    }
};

window.GIS_CONFIG.LOADING = {
    MIN_DURATION: 2000, // İşlem hızlı bitse bile ekranda kalacağı minimum süre (milisaniye)
    IMAGE_PATH: 'images/image.png', // BURAYA KENDİ GÖRSELİNİN YOLUNU YAZACAKSIN
    IMAGE_SIZE: 'clamp(120px, 15vw, 240px)'
};