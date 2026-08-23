const StateManager = {
    activeTool: 'none', 
    map: null,
    feedbackEl: null,
    feedbackTimeout: null, // Geçici uyarılar için zamanlayıcı

    init: function(leafletMap) {
        this.map = leafletMap;
        this.feedbackEl = document.getElementById('context-feedback');
        
        // Butonlara Tıklama Olayı Bağlama
        const bindToolBtn = (id, toolName) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    // YENİ: Eğer buton pasif (disabled) ise tıklamayı engelle ve uyarı ver
                    if (btn.classList.contains('disabled')) {
                        this.showTempFeedback('⚠️ Haritada Buffer (Etki Alanı) oluşturulacak çizgi veya alan yok!');
                        return;
                    }

                    if (this.activeTool === toolName) this.setTool('none');
                    else this.setTool(toolName);
                });
            }
        };

        bindToolBtn('btn-tool-point', 'point');
        bindToolBtn('btn-tool-line', 'line');
        bindToolBtn('btn-tool-polygon', 'polygon');
        bindToolBtn('btn-tool-buffer', 'buffer');

        // KLAVYE KISAYOLLARI (P, L, A, B ve ESC)
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();
            if (key === 'p') this.setTool(this.activeTool === 'point' ? 'none' : 'point');
            if (key === 'l') this.setTool(this.activeTool === 'line' ? 'none' : 'line');
            if (key === 'a') this.setTool(this.activeTool === 'polygon' ? 'none' : 'polygon');
            
            // YENİ: B tuşuna basıldığında Buffer butonu pasif mi kontrol et
            if (key === 'b') {
                const bufferBtn = document.getElementById('btn-tool-buffer');
                if (bufferBtn && bufferBtn.classList.contains('disabled')) {
                    this.showTempFeedback('⚠️ Haritada Buffer (Etki Alanı) oluşturulacak çizgi veya alan yok!');
                } else {
                    this.setTool(this.activeTool === 'buffer' ? 'none' : 'buffer');
                }
            }
            
            if (key === 'escape') this.setTool('none');
        });

        // Harita objelerini dinleyerek Buffer butonunu Otomatik Güncelle
        this.map.on('layeradd layerremove', () => {
            this.updateBufferButtonState();
        });

        // İlk açılışta kontrol et (DOM'un yüklenmesi için 100ms gecikme)
        setTimeout(() => this.updateBufferButtonState(), 100);
    },

    // Haritada Çizgi (Polyline) veya Alan (Polygon) var mı diye tarar
    checkIfBufferableObjectsExist: function() {
        let exists = false;
        if (!this.map) return false;
        
        this.map.eachLayer(layer => {
            // BufferTool modülümüzdeki mantığın aynısı: Nokta (CircleMarker) ve BaseMap dışındaki Path'ler
            if (layer instanceof L.Path && !(layer instanceof L.CircleMarker)) {
                exists = true;
            }
        });
        return exists;
    },

    // Buffer butonunun görsel (Pasif/Aktif) durumunu günceller
    updateBufferButtonState: function() {
        const btn = document.getElementById('btn-tool-buffer');
        if (!btn) return;
        
        if (this.checkIfBufferableObjectsExist()) {
            btn.classList.remove('disabled');
        } else {
            btn.classList.add('disabled');
            
            // Eğer Buffer modu açıkken son obje de silinirse moddan otomatik çık
            if (this.activeTool === 'buffer') {
                this.setTool('none');
            }
        }
    },

    setTool: function(toolName) {
        this.activeTool = toolName;
        
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

        if (toolName !== 'none') {
            const activeBtn = document.getElementById(`btn-tool-${toolName}`);
            if(activeBtn) activeBtn.classList.add('active');
            
            this.map.getContainer().style.cursor = 'crosshair';
            this.map.doubleClickZoom.disable();
            
            // FEEDBACK GÖSTERİMİ
            if (toolName === 'point') this.showFeedback('📍 Nokta bırakmak için haritaya tıklayın (İptal: ESC)');
            if (toolName === 'line') this.showFeedback('📏 Çizgi çizmek için tıklayın, bitirmek için Çift Tıklayın (İptal: ESC)');
            if (toolName === 'polygon') this.showFeedback('🟩 Alan çizmek için tıklayın, bitirmek için Sağ Tıklayın (İptal: ESC)');
            if (toolName === 'buffer') this.showFeedback('🔵 Buffer oluşturmak için haritadaki bir Çizgi veya Alana tıklayın (İptal: ESC)');

        } else {
            this.map.getContainer().style.cursor = ''; 
            this.map.doubleClickZoom.enable(); 
            this.hideFeedback(); 
        }
    },

    showFeedback: function(message) {
        if (!this.feedbackEl) return;
        clearTimeout(this.feedbackTimeout); // Önceki zamanlayıcıyı sıfırla
        this.feedbackEl.innerText = message;
        this.feedbackEl.classList.add('visible');
    },

    hideFeedback: function() {
        if (!this.feedbackEl) return;
        this.feedbackEl.classList.remove('visible');
    },

    // Geçici olarak ekranda görünüp 3 saniye sonra kaybolan hata/bilgi mesajı motoru
    showTempFeedback: function(message) {
        this.showFeedback(message);
        this.feedbackTimeout = setTimeout(() => {
            // Sadece aktif bir araç (tool) yoksa gizle, araç seçiliyse kendi mesajını bozma
            if (this.activeTool === 'none') {
                this.hideFeedback();
            }
        }, 3000);
    }
};
window.StateManager = StateManager;