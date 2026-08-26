window.addEventListener('DOMContentLoaded', () => {
    // 1. Leaflet Varsayılan İkon Ayarları
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // 2. Çekirdek Sistemleri Ayağa Kaldırıyoruz
    const map = MapManager.initMap();
    Sidebar.init();
    ThemeManager.init();
    IntersectionManager.init(map);
    ExportService.init(map); 
    DistanceTool.init(map); 
    AreaTool.init(map);   
    StateManager.init(map);
    PointTool.init(map);
    HistoryManager.init(map);
    LoadingManager.init(map);
    LayerFilter.init(); 
    BufferTool.init(map);
    HeatmapManager.init(map); 
    if (window.MiniMapManager) window.MiniMapManager.init(map);
    LayerController.init(map);
    ImportModal.init();

    // 4. Basit Arayüz (UI) Olayları (Zoom Butonları)
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    
    if(zoomInBtn) zoomInBtn.addEventListener('click', () => { map.zoomIn(); });
    if(zoomOutBtn) zoomOutBtn.addEventListener('click', () => { map.zoomOut(); });
});