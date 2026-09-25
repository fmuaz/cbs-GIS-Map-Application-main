const ImportModal = {
    currentGroups: [],
    modalOverlay: null,
    importGroupList: null,
    searchInput: null,

    init: function() {
        this.modalOverlay = document.getElementById('importModalOverlay');
        this.importGroupList = document.getElementById('importGroupList');
        this.searchInput = document.getElementById('importSearchInput');
        
        const addLayerBtn = document.getElementById('add-layer-btn'); 
        const closeModalBtnTop = document.getElementById('closeModalBtnTop');
        const closeModalBtnBottom = document.getElementById('closeModalBtnBottom');

        if(addLayerBtn) {
            addLayerBtn.addEventListener('click', async (e) => {
                e.preventDefault(); 
                try {
                    this.currentGroups = await ApiService.fetchGroupList();

                    if (!this.currentGroups || this.currentGroups.length === 0) {
                        alert("Veritabanında kayıtlı hiçbir çalışma/grup bulunamadı.");
                        return;
                    }

                    this.modalOverlay.style.display = 'flex';
                    this.renderGroupList();
                    this.searchInput.focus(); 
                } catch (err) {
                    if (window.LoadingManager) window.LoadingManager.hide();
                    alert("Kayıtlı gruplar çekilirken bir hata oluştu: " + err.message);
                }
            });
        }

        if(this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.renderGroupList(e.target.value));
        }
        
        if(closeModalBtnTop) closeModalBtnTop.addEventListener('click', () => this.close());
        if(closeModalBtnBottom) closeModalBtnBottom.addEventListener('click', () => this.close());
        
        window.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.close();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalOverlay.style.display === 'flex') this.close();
        });
    },

    close: function() {
        if(this.modalOverlay) this.modalOverlay.style.display = 'none';
        if(this.searchInput) this.searchInput.value = ''; 
    },

    renderGroupList: function(filterText = '') {
        if(!this.importGroupList) return;
        this.importGroupList.innerHTML = '';
        
        const filteredGroups = this.currentGroups.filter((gName, index) => {
            const searchStr = filterText.toLocaleLowerCase('tr-TR').trim();
            const numStr = (index + 1).toString();
            return gName.toLocaleLowerCase('tr-TR').includes(searchStr) || numStr === searchStr;
        });

        if (filteredGroups.length === 0) {
            this.importGroupList.innerHTML = '<div class="empty-state">Aradığınız kriterlere uygun çalışma bulunamadı.</div>';
            return;
        }

        filteredGroups.forEach(gName => {
            const originalIndex = this.currentGroups.indexOf(gName) + 1;
            const item = document.createElement('div');
            item.className = 'group-list-item';
            item.innerHTML = `
                <div class="group-info">
                    <span class="group-number">${originalIndex.toString().padStart(2, '0')}</span>
                    <span class="group-name">${gName}</span>
                </div>
                <span class="group-arrow">→</span>
            `;
            
            item.addEventListener('click', () => {
                this.close();
                // Veriyi çekip haritaya basan esas fonksiyon LayerController'dan çağrılır
                LayerController.loadGroupController(gName); 
            });
            
            this.importGroupList.appendChild(item);
        });
    }
};

window.ImportModal = ImportModal;