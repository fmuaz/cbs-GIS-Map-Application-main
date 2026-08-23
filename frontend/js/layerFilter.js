const LayerFilter = {
    init: function () {
        const searchInput = document.getElementById('layerSearchInput');
        if (!searchInput) return;

        // Kullanıcı yazarken (input) ve tuştan elini çekerken (keyup) anlık tetikle
        ['input', 'keyup'].forEach(eventType => {
            searchInput.addEventListener(eventType, function(e) {
                // Yazıyı küçült ve boşlukları sil (Büyük/küçük harf duyarsızlığı)
                const searchText = e.target.value.toLowerCase().trim();
                
                // Sidebar objesi mevcutsa, listeyi bu metne göre yeniden render etmesini söyle
                if (window.Sidebar) {
                    window.Sidebar.renderList(searchText);
                }
            });
        });
    }
};

window.LayerFilter = LayerFilter;