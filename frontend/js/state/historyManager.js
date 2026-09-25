const HistoryManager = {
    undoStack: [],
    redoStack: [],
    limit: 50,

    init: function() {
        this.limit = window.GIS_CONFIG?.HISTORY?.LIMIT || 50;
        this.bindShortcuts();
        this.bindUI();
        this.updateUI();
    },

    /**
     * Sadece yapılan işlemi stack'e kaydeder (Redo'yu temizler)
     * Çizim araçları objeyi oluşturduktan sonra bunu çağırır.
     */
    add: function(command) {
        this.undoStack.push(command);
        this.redoStack = []; // Yeni bir işlem yapıldığında gelecek (redo) silinir
        
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift(); // Limit aşılırsa en eski işlemi sil (Memory Leak koruması)
        }
        this.updateUI();
    },

    /**
     * İşlemi anında yapar ve stack'e kaydeder (Örn: Silme işlemleri için)
     */
    execute: function(command) {
        command.redo(); 
        this.add(command);
    },

    undo: function() {
        if (this.undoStack.length === 0) return;
        const cmd = this.undoStack.pop();
        cmd.undo();
        this.redoStack.push(cmd);
        this.updateUI();
    },

    redo: function() {
        if (this.redoStack.length === 0) return;
        const cmd = this.redoStack.pop();
        cmd.redo();
        this.undoStack.push(cmd);
        this.updateUI();
    },

    // Klavye Kısayolları (Input alanlarında çalışmaz)
    bindShortcuts: function() {
        document.addEventListener('keydown', (e) => {
            // Kullanıcı form dolduruyorsa (Metadata, Arama) iptal et
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdKey = isMac ? e.metaKey : e.ctrlKey;

            if (cmdKey && e.key.toLowerCase() === (window.GIS_CONFIG?.HISTORY?.SHORTCUTS?.UNDO || 'z')) {
                if (e.shiftKey) { // Cmd+Shift+Z (Mac Redo)
                    e.preventDefault();
                    this.redo();
                } else {
                    e.preventDefault();
                    this.undo();
                }
            }
            
            if (cmdKey && e.key.toLowerCase() === (window.GIS_CONFIG?.HISTORY?.SHORTCUTS?.REDO || 'y')) {
                e.preventDefault();
                this.redo();
            }
        });
    },

    // UI Butonları ile Bağlantı
    bindUI: function() {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        if (btnUndo) btnUndo.addEventListener('click', () => this.undo());
        if (btnRedo) btnRedo.addEventListener('click', () => this.redo());
    },

    // Butonların aktif/pasif (disabled) durumlarını günceller
    updateUI: function() {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        
        if (btnUndo) {
            if (this.undoStack.length === 0) btnUndo.classList.add('disabled');
            else btnUndo.classList.remove('disabled');
        }
        if (btnRedo) {
            if (this.redoStack.length === 0) btnRedo.classList.add('disabled');
            else btnRedo.classList.remove('disabled');
        }
    }
};
window.HistoryManager = HistoryManager;