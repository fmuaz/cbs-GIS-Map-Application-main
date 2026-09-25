const FeatureMetadata = {
    /**
     * Katmanın (Layer) GeoJSON altyapısını metadata için hazırlar.
     */
    initLayer: function(layer) {
        if (!layer.feature) layer.feature = { type: 'Feature', properties: {} };
        if (!layer.feature.properties) layer.feature.properties = {};
        
        // Şablonu constant.js üzerinden klonlayarak alıyoruz
        if (!layer.feature.properties.userMetadata) {
            layer.feature.properties.userMetadata = JSON.parse(JSON.stringify(window.METADATA_CONFIG.DEFAULT_TEMPLATE));
        }
    },

    /**
     * Popup'ın içine eklenecek olan HTML şablonunu döndürür. (Yazılar constant.js'den gelir)
     */
    getMetadataHTML: function(uniqueId) {
        const ui = window.METADATA_CONFIG.UI;

        return `
            <!-- GÖRÜNTÜLEME MODU (VIEW) -->
            <div id="meta-view-container-${uniqueId}" style="margin-bottom: 10px;">
                <div id="meta-content-${uniqueId}" style="font-size: 11px; color: #444; margin-bottom: 8px; line-height: 1.4;">
                    <!-- Veriler buraya JS ile dinamik basılacak -->
                </div>
                <button id="meta-edit-btn-${uniqueId}" style="width: 100%; background: #ffc107; color: #000; border: none; padding: 5px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                    ${ui.BUTTON_EDIT}
                </button>
            </div>

            <!-- DÜZENLEME MODU (EDIT FORM) -->
            <div id="meta-edit-container-${uniqueId}" style="display: none; flex-direction: column; gap: 6px; margin-bottom: 10px; background: #f8f9fa; padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                <div style="font-weight: bold; font-size: 11px; color: #333; margin-bottom: 4px;">${ui.FORM_TITLE}</div>
                <input type="text" id="meta-input-name-${uniqueId}" placeholder="${ui.PLACEHOLDER_NAME}" style="font-size:11px; padding:5px; border: 1px solid #ccc; border-radius: 3px;">
                <input type="text" id="meta-input-cat-${uniqueId}" placeholder="${ui.PLACEHOLDER_CATEGORY}" style="font-size:11px; padding:5px; border: 1px solid #ccc; border-radius: 3px;">
                <textarea id="meta-input-desc-${uniqueId}" placeholder="${ui.PLACEHOLDER_DESC}" style="font-size:11px; padding:5px; border: 1px solid #ccc; border-radius: 3px; resize:vertical; min-height: 40px;"></textarea>
                
                <div style="display:flex; gap:5px; margin-top: 4px;">
                    <button id="meta-save-btn-${uniqueId}" style="flex:1; background: #28a745; color: #fff; border: none; padding: 5px; border-radius: 3px; font-weight: bold; cursor: pointer; font-size: 11px;">${ui.BUTTON_SAVE}</button>
                    <button id="meta-cancel-btn-${uniqueId}" style="flex:1; background: #6c757d; color: #fff; border: none; padding: 5px; border-radius: 3px; font-weight: bold; cursor: pointer; font-size: 11px;">${ui.BUTTON_CANCEL}</button>
                </div>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
        `;
    },

    /**
     * Popup açıldığında butonların tıklama olaylarını ve veri senkronizasyonunu bağlar.
     */
    bindMetadataEvents: function(layer, uniqueId) {
        this.initLayer(layer);
        const ui = window.METADATA_CONFIG.UI;
        
        const viewContainer = document.getElementById(`meta-view-container-${uniqueId}`);
        const editContainer = document.getElementById(`meta-edit-container-${uniqueId}`);
        const contentDiv = document.getElementById(`meta-content-${uniqueId}`);
        
        const btnEdit = document.getElementById(`meta-edit-btn-${uniqueId}`);
        const btnSave = document.getElementById(`meta-save-btn-${uniqueId}`);
        const btnCancel = document.getElementById(`meta-cancel-btn-${uniqueId}`);

        const inputName = document.getElementById(`meta-input-name-${uniqueId}`);
        const inputCat = document.getElementById(`meta-input-cat-${uniqueId}`);
        const inputDesc = document.getElementById(`meta-input-desc-${uniqueId}`);

        // Veriyi alıp View ekranına çizen yardımcı fonksiyon
        const renderView = () => {
            const md = layer.feature.properties.userMetadata;
            let html = '';
            if (md.name) html += `<div><span style="color:#6c757d;">${ui.LABEL_NAME}</span> <b>${md.name}</b></div>`;
            if (md.category) html += `<div><span style="color:#6c757d;">${ui.LABEL_CATEGORY}</span> <b>${md.category}</b></div>`;
            if (md.description) html += `<div style="margin-top:4px;"><span style="color:#6c757d;">${ui.LABEL_DESC}</span> <i>${md.description}</i></div>`;
            
            contentDiv.innerHTML = html;
            // Eğer hiçbir veri girilmemişse View alanını daralt (gizle)
            contentDiv.style.display = html === '' ? 'none' : 'block';
        };

        // İlk açılışta View ekranını çiz
        renderView();

        // DÜZENLE BUTONUNA TIKLANINCA
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                const md = layer.feature.properties.userMetadata;
                inputName.value = md.name || '';
                inputCat.value = md.category || '';
                inputDesc.value = md.description || '';
                
                viewContainer.style.display = 'none';
                editContainer.style.display = 'flex';
            });
        }

        // İPTAL BUTONUNA TIKLANINCA
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                editContainer.style.display = 'none';
                viewContainer.style.display = 'block';
            });
        }

        // KAYDET BUTONUNA TIKLANINCA
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                // Verileri objeye kaydet
                layer.feature.properties.userMetadata = {
                    name: inputName.value.trim(),
                    category: inputCat.value.trim(),
                    description: inputDesc.value.trim()
                };

                // Export ve özelliklerin doğru yansıması için iç içe katmanlara kopyala
                if (layer.eachLayer) {
                    layer.eachLayer(child => {
                        this.initLayer(child);
                        child.feature.properties.userMetadata = layer.feature.properties.userMetadata;
                    });
                }

                // UI'ı güncelle ve forma geri dön
                renderView();
                editContainer.style.display = 'none';
                viewContainer.style.display = 'block';
            });
        }
    }
};

window.FeatureMetadata = FeatureMetadata;