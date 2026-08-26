// Sağ panelin açılıp kapanmasını ve analiz kartlarını yöneten kısım
const Sidebar = {
    sidebarEl: null,
    layerListEl: null,
    emptyWarningEl: null,
    
    // Haritadaki tüm katmanların verilerini tutan dinamik hafıza
    state: [], 

    init: function () {
        this.sidebarEl = document.getElementById('sidebar');
        this.layerListEl = document.getElementById('layerList');
        this.emptyWarningEl = document.getElementById('emptyWarning');

        // Panel Aç / Kapa Olayları
        document.getElementById('openMenuBtn').addEventListener('click', () => this.sidebarEl.classList.add('open'));
        document.getElementById('closeMenuBtn').addEventListener('click', () => this.sidebarEl.classList.remove('open'));

        // export etme yeri
        document.getElementById('exportMeasuresBtn').addEventListener('click', () => {
            if(window.ExportService) ExportService.exportMeasurementsToGeoJSON();
        });

        // ARAMA KUTUSUNU (CANLI FİLTRE) DOĞRUDAN BURADA DİNLİYORUZ
        const searchInput = document.getElementById('layerSearchInput');
        if (searchInput) {
            ['input', 'keyup'].forEach(eventType => {
                searchInput.addEventListener(eventType, (e) => {
                    const searchText = e.target.value.toLocaleLowerCase('tr-TR').trim();
                    this.renderList(searchText); // Listeyi anında yeniden çiz
                });
            });
        }
    },

    appendLayerCard: function (fileName, pointCount, lineCount, polygonCount, onToggleClick, onDeleteClick, onTitleClick) {
        // Yeni katmanı doğrudan HTML'e basmak yerine önce hafızaya (state) ekliyoruz
        const exists = this.state.some(item => item.fileName === fileName);
        if (!exists) {
            this.state.push({
                fileName,
                pointCount,
                lineCount,
                polygonCount,
                onToggleClick,
                onDeleteClick,
                onTitleClick,
                isHidden: false
            });
        }

        // Katman eklendiğinde arama kutusunu sıfırla ve listeyi çizdir
        const searchInput = document.getElementById('layerSearchInput');
        if (searchInput) searchInput.value = '';

        this.renderList();
    },

    renderList: function(filterText = '') {
        if (!this.layerListEl) return;
        
        // Ekranı temizle
        this.layerListEl.innerHTML = '';
        if (this.emptyWarningEl) this.emptyWarningEl.style.display = "none";

        // Hafızadaki verileri aranılan kelimeye göre filtrele (Türkçe duyarlı)
        const filteredState = this.state.filter(item => 
            item.fileName.toLocaleLowerCase('tr-TR').includes(filterText)
        );

        // Durum 1: Sisteme henüz hiç dosya yüklenmediyse
        if (this.state.length === 0) {
            if (this.emptyWarningEl) this.emptyWarningEl.style.display = "block";
            return;
        }

        // Durum 2: Dosya yüklü ama arama sonucuyla eşleşen hiçbir şey yoksa
        if (filteredState.length === 0) {
            this.layerListEl.innerHTML = '<span style="color:#888; font-size:13px; text-align:center; display: block; margin-top: 10px;">Aranan dosya bulunamadı.</span>';
            return;
        }

        // Durum 3: Filtrelenmiş listeyi ekrana çiz
        filteredState.forEach(item => {
            const safeId = item.fileName.replace(/[^a-zA-Z0-9]/g, '_');
            
            const cardHtml = `
                <div class="layer-item" id="card_${safeId}" style="margin-bottom: 10px; position: relative; opacity: ${item.isHidden ? '0.5' : '1'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <div class="layer-title" id="title_${safeId}" style="margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; cursor: pointer; transition: color 0.2s; color: #084298;" title="Click to focus layer camera">
                            📄 ${item.fileName}
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            
                            <!-- 🔥 ISI HARİTASI (HEATMAP) BUTONU BURAYA EKLENDİ 🔥 -->
                            <button id="heat_${safeId}" title="Isı Haritası Modu" style="background: none; border: none; cursor: pointer; font-size: 16px; margin-right: 5px; transition: transform 0.2s;">🔥</button>

                            <button id="toggle_${safeId}" style="background: none; border: none; font-size: 15px; cursor: pointer; padding: 4px;" title="Toggle Visibility">
                                ${item.isHidden ? '🙈' : '👁️'}
                            </button>
                            <button id="delete_${safeId}" style="background: none; border: none; font-size: 15px; cursor: pointer; padding: 4px; color: #dc3545;" title="Delete Layer">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <table class="analysis-table">
                        <tr><td>⚫ Point Features</td><td>${item.pointCount} pcs</td></tr>
                        <tr><td>🔀 Line Features</td><td>${item.lineCount} pcs</td></tr>
                        <tr><td>🟩 Polygon Features</td><td>${item.polygonCount} pcs</td></tr>
                    </table>
                </div>
            `;
            
            this.layerListEl.insertAdjacentHTML('beforeend', cardHtml);
        });

        // Event Listeners (Tıklama Özellikleri)
        filteredState.forEach(item => {
            const safeId = item.fileName.replace(/[^a-zA-Z0-9]/g, '_');
            const toggleBtn = document.getElementById(`toggle_${safeId}`);
            const deleteBtn = document.getElementById(`delete_${safeId}`);
            const titleEl = document.getElementById(`title_${safeId}`);
            const cardEl = document.getElementById(`card_${safeId}`);
            
            // 🔥 ISI HARİTASI OLAY DİNLEYİCİSİ 🔥
            const heatBtn = document.getElementById(`heat_${safeId}`);

            if (heatBtn) {
                heatBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetLayer = MapManager.mapLayersStorage[item.fileName];
                    if (targetLayer && window.HeatmapManager) {
                        const isOn = window.HeatmapManager.toggleHeatmap(item.fileName, targetLayer);
                        if (isOn) {
                            heatBtn.style.transform = "scale(1.2)";
                            heatBtn.style.filter = "drop-shadow(0 0 5px #ff4757)";
                        } else {
                            heatBtn.style.transform = "scale(1)";
                            heatBtn.style.filter = "none";
                        }
                    }
                });
            }

            if (titleEl) {
                titleEl.addEventListener('click', () => {
                    item.onTitleClick(item.fileName);
                });
                titleEl.addEventListener('mouseenter', () => titleEl.style.color = '#007bff');
                titleEl.addEventListener('mouseleave', () => titleEl.style.color = '#084298');
            }

            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const isVisible = item.onToggleClick(item.fileName);
                    item.isHidden = !isVisible; 
                    if (isVisible) {
                        toggleBtn.innerText = "👁️";
                        cardEl.style.opacity = "1";
                    } else {
                        toggleBtn.innerText = "🙈"; 
                        cardEl.style.opacity = "0.5";
                    }
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Are you sure you want to permanently delete "${item.fileName}"?`)) {
                        item.onDeleteClick(item.fileName);
                        this.state = this.state.filter(s => s.fileName !== item.fileName);
                        
                        const searchInput = document.getElementById('layerSearchInput');
                        const currentSearchText = searchInput ? searchInput.value.toLocaleLowerCase('tr-TR').trim() : '';
                        this.renderList(currentSearchText);
                    }
                });
            }
        });
    }
};

window.Sidebar = Sidebar;