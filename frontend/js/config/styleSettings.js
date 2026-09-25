const StyleSettings = {
    // index.html'deki template'i okur ve popup içerisine gömer
    getSettingsHTML: function (uniqueId, type) {
        const template = document.getElementById('style-settings-template');
        if (!template) return '';
        
        let htmlString = template.innerHTML;
        
        // ID eklerken class'ları korumak için replace kullanıyoruz
        htmlString = htmlString.replace(/class="btn-settings"/g, `id="btn_settings_${uniqueId}" class="btn-settings"`);
        htmlString = htmlString.replace(/class="panel-settings"/g, `id="panel_${uniqueId}" class="panel-settings"`);
        htmlString = htmlString.replace(/class="input-color"/g, `id="color_${uniqueId}" class="input-color"`);
        htmlString = htmlString.replace(/class="input-weight"/g, `id="weight_${uniqueId}" class="input-weight"`);
        htmlString = htmlString.replace(/class="line-type-container"/g, `id="type_container_${uniqueId}" class="line-type-container"`);
        htmlString = htmlString.replace(/class="input-type"/g, `id="type_${uniqueId}" class="input-type"`);

        const fillSettingsHTML = `
            <div id="fill_container_${uniqueId}">
                <label style="display:block; margin-bottom:4px; font-weight:bold; margin-top:8px;">Dolgu Rengi:</label>
                <input type="color" id="fillColor_${uniqueId}" style="width:100%; height:25px; cursor:pointer; margin-bottom: 8px; border:none; padding:0;">
                
                <label style="display:block; margin-bottom:4px; font-weight:bold;">Şeffaflık (%):</label>
                <input type="range" id="fillOpacity_${uniqueId}" min="0" max="100" value="30" style="width:100%; cursor:pointer; margin-bottom: 8px;">
            </div>
        `;
        
        htmlString = htmlString.replace(/<\/div>\s*$/i, fillSettingsHTML + '</div>');
        return htmlString;
    },

    bindEvents: function (targetLayerOrGroup, uniqueId, type) {
        setTimeout(() => {
            const btn = document.getElementById(`btn_settings_${uniqueId}`);
            const panel = document.getElementById(`panel_${uniqueId}`);
            const typeContainer = document.getElementById(`type_container_${uniqueId}`);
            const colorInput = document.getElementById(`color_${uniqueId}`);
            const weightInput = document.getElementById(`weight_${uniqueId}`);
            const typeInput = document.getElementById(`type_${uniqueId}`);
            
            const fillContainer = document.getElementById(`fill_container_${uniqueId}`);
            const fillColorInput = document.getElementById(`fillColor_${uniqueId}`);
            const fillOpacityInput = document.getElementById(`fillOpacity_${uniqueId}`);

            const wrapper = document.getElementById(`popup-wrapper-${uniqueId}`);
            const mainContent = document.getElementById(`main-content-${uniqueId}`);

            if (btn && panel && mainContent) {
                btn.addEventListener('click', () => {
                    setTimeout(() => {
                        if (mainContent.style.display === 'none') {
                            panel.style.display = 'block'; 
                        } else {
                            panel.style.display = 'none';  
                        }
                    }, 10);
                });
            }

            if (type === 'Polygon' && typeContainer) {
                typeContainer.style.display = 'none';
            }
            if (type === 'LineString' && fillContainer) {
                fillContainer.style.display = 'none';
            }
            // Point ise SADECE Rengi Bırak, Gerisini Gizle!
            if (type === 'Point') {
                if (typeContainer) typeContainer.style.display = 'none';
                if (fillContainer) fillContainer.style.display = 'none';
                if (weightInput) {
                    weightInput.style.display = 'none';
                    if (weightInput.previousElementSibling && weightInput.previousElementSibling.tagName.toLowerCase() === 'label') {
                        weightInput.previousElementSibling.style.display = 'none';
                    }
                }
            }

            // Default Renk Atamaları
            let defaultColor = '#3388ff';
            if (type === 'Polygon') defaultColor = '#28a745';
            if (type === 'Point') defaultColor = '#ffc107';

            if (colorInput && colorInput.getAttribute('data-init') !== 'true') {
                colorInput.value = defaultColor;
                colorInput.setAttribute('data-init', 'true');
            }
            if (fillColorInput && fillColorInput.getAttribute('data-init') !== 'true') {
                fillColorInput.value = defaultColor;
                fillColorInput.setAttribute('data-init', 'true');
            }

            const updateStyles = () => {
                const color = colorInput ? colorInput.value : defaultColor;
                const weight = weightInput ? parseInt(weightInput.value) : 3;
                const lineType = typeInput ? typeInput.value : 'solid';
                const fillColor = fillColorInput ? fillColorInput.value : defaultColor;
                const fillOpacity = fillOpacityInput ? parseInt(fillOpacityInput.value) / 100 : 0.3; 

                let dashArray = null;
                if (lineType === 'dot') dashArray = '1, 6';
                if (lineType === 'dash') dashArray = '10, 10';

                const applyStyle = (layer) => {
                    if (layer instanceof L.Polyline || layer instanceof L.Polygon || layer instanceof L.CircleMarker) {
                        layer.setStyle({ 
                            color: color, 
                            weight: type === 'Point' ? (layer.options.weight || 2) : weight, 
                            dashArray: dashArray,
                            fillColor: type === 'Point' ? color : fillColor,
                            fillOpacity: type === 'Point' ? 1 : fillOpacity 
                        });
                        
                        layer.feature = layer.feature || { type: 'Feature', properties: {} };
                        layer.feature.properties.style = {
                            color: color,
                            weight: type === 'Point' ? (layer.options.weight || 2) : weight,
                            lineType: type === 'LineString' ? lineType : undefined,
                            fillColor: type === 'Point' ? color : fillColor,
                            fillOpacity: type === 'Point' ? 1 : fillOpacity
                        };
                    }
                };

                if (targetLayerOrGroup.eachLayer) {
                    targetLayerOrGroup.eachLayer(layer => applyStyle(layer));
                } else {
                    applyStyle(targetLayerOrGroup);
                }
            };

            if (colorInput) colorInput.addEventListener('input', updateStyles);
            if (weightInput) weightInput.addEventListener('input', updateStyles);
            if (typeInput) typeInput.addEventListener('change', updateStyles);
            if (fillColorInput) fillColorInput.addEventListener('input', updateStyles);
            if (fillOpacityInput) fillOpacityInput.addEventListener('input', updateStyles);
        }, 10);
    }
};

window.StyleSettings = StyleSettings;