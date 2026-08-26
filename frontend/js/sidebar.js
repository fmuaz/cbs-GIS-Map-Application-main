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
                <div class="layer-item" id="card_${safeId}" style="margin-bottom: 15px; padding: 15px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-left: 5px solid #0d6efd; position: relative; opacity: ${item.isHidden ? '0.5' : '1'}; transition: all 0.3s ease;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px;">
                        <div class="layer-title" id="title_${safeId}" style="margin: 0; font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; cursor: pointer; transition: color 0.2s; color: #2c3e50;" title="Kamerayı bu katmana odakla">
                            📁 ${item.fileName}
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <button id="heat_${safeId}" title="Isı Haritası Modu" style="background: #fff3cd; color: #ffc107; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; padding: 4px 6px; transition: all 0.2s;">🔥</button>
                            <button id="toggle_${safeId}" style="background: #e2e3e5; color: #41464b; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; padding: 4px 6px;" title="Görünürlüğü Aç/Kapat">
                                ${item.isHidden ? '🙈' : '👁️'}
                            </button>
                            <button id="delete_${safeId}" style="background: #f8d7da; color: #dc3545; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; padding: 4px 6px;" title="Katmanı Sil">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <table class="analysis-table" style="width: 100%; font-size: 12px; color: #555;">
                        <tr><td style="padding: 3px 0;">⚫ Point Features</td><td style="text-align: right; font-weight: bold;">${item.pointCount} pcs</td></tr>
                        <tr><td style="padding: 3px 0;">🔀 Line Features</td><td style="text-align: right; font-weight: bold;">${item.lineCount} pcs</td></tr>
                        <tr><td style="padding: 3px 0;">🟩 Polygon Features</td><td style="text-align: right; font-weight: bold;">${item.polygonCount} pcs</td></tr>
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
            
            // ISI HARİTASI event listener
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