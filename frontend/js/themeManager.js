const ThemeManager = {
    init: function () {
        const toggleBtn = document.getElementById('themeToggleBtn');
        if (!toggleBtn) return;

        // Kullanıcının daha önceki tercihini hafızadan kontrol et
        const currentTheme = localStorage.getItem('gis_theme') || 'light';
        
        // Eğer hafızada dark varsa, sayfaya dark class'ını ekle
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-mode');
            toggleBtn.innerHTML = '☀️ Açık Tema';
        } else {
            toggleBtn.innerHTML = '🌙 Karanlık Tema';
        }

        // Butona tıklandığında temayı değiştir
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            
            let theme = 'light';
            if (document.body.classList.contains('dark-mode')) {
                theme = 'dark';
                toggleBtn.innerHTML = '☀️ Light Theme';
            } else {
                toggleBtn.innerHTML = '🌙 Dark Theme';
            }
            
            // Seçimi tarayıcı hafızasına kaydet
            localStorage.setItem('gis_theme', theme);
        });
    }
};

window.ThemeManager = ThemeManager;