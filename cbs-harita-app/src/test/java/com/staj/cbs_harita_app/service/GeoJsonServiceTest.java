package com.staj.cbs_harita_app.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.FileNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;

import com.staj.cbs_harita_app.model.GeoJsonModel;

import static org.junit.jupiter.api.Assertions.*;

class GeoJsonServiceTest {

    private GeoJsonService geoJsonService;

    // Her testten ÖNCE çalışıp ortamı sıfırlayan metod
    @BeforeEach
    void setUp() {
        geoJsonService = new GeoJsonService();
        // @Value anotasyonunu taklit ediyoruz. Test için hayali bir yol veriyoruz.
        ReflectionTestUtils.setField(geoJsonService, "directoryPath", "C:\\Users\\Milsoft\\Desktop\\test-deneme");
    }

    // ÖRNEK 1: Basit bir get metodunu test edelim
    @Test
    void getDirectoryPath_DogruYoluDondurmeli() {
        // When (Eylem)
        String path = geoJsonService.getDirectoryPath();

        // Doğrulama: Çıkan sonuç bizim setUp'ta verdiğimizle aynı mı?
        assertEquals("C:\\Users\\Milsoft\\Desktop\\test-deneme", path);
    }

    // Exception fırlatmasını beklediğimiz durumu test edelim
    @Test
    void getGeoJsonModel_DosyaYoksa_FileNotFoundExceptionFirlatmali() {
        // Given
        String olmayanDosyaAdi = "olmayan_harita.json";

        // When & Then
        // Beklentimiz: Bu fonksiyon çağrıldığında sistemin FileNotFoundException fırlatmasıdır.
        Exception exception = assertThrows(FileNotFoundException.class, () -> {
            geoJsonService.getGeoJsonModel(olmayanDosyaAdi);
        });
        
        // Fırlatılan hatanın mesajı doğru mu diye ekstra kontrol edebiliriz
        assertTrue(exception.getMessage().contains("Dosya bulunamadı"));
    }

    @Test
    void getGeoJsonModel_DosyaBossa_IllegalArgumentExceptionFirlatmali(@TempDir Path tempDir) throws Exception {
        // Given
        // 1. Geçici klasörün içine "bosHarita.json" adında bir yol tanımlıyoruz
        Path bosDosyaYolu = tempDir.resolve("bosHarita.json");
        
        // 2. O yola gerçekten fiziksel (ama geçici) boş bir dosya yaratıyoruz
        Files.createFile(bosDosyaYolu); 
        
        // 3. Servisimize, haritaları okuyacağı klasör olarak bu geçici klasörün yolunu veriyoruz
        ReflectionTestUtils.setField(geoJsonService, "directoryPath", tempDir.toString());

        // When & Then
        Exception exception = assertThrows(IllegalArgumentException.class, () -> {
            geoJsonService.getGeoJsonModel("bosHarita.json");
        });

        assertTrue(exception.getMessage().contains("Dosyanın içi boş"));
    }

    @Test
    void getGeoJsonModel_DosyaAdiZafiyetIceriyorsa_SecurityExceptionFirlatmali(@TempDir Path tempDir) throws Exception {
        // Given
        // 1. Geçici klasörün içine "zafiyet.json" adında bir yol tanımlıyoruz
        Path zafiyetDosyaYolu = tempDir.resolve("zafiyet.json");
        
        // 2. O yola gerçekten fiziksel (ama geçici) boş bir dosya yaratıyoruz
        Files.createFile(zafiyetDosyaYolu); 
        
        // 3. Servisimize, haritaları okuyacağı klasör olarak bu geçici klasörün yolunu veriyoruz
        ReflectionTestUtils.setField(geoJsonService, "directoryPath", tempDir.toString());

        // When & Then
        Exception exception = assertThrows(SecurityException.class, () -> {
            geoJsonService.getGeoJsonModel("../zafiyet.json");
        });

        assertTrue(exception.getMessage().contains("Zafiyet algılandı"));
    }

    @Test
    void getGeoJsonModel_GecerliDosyaOkundugunda_ModelDondurmeli(@TempDir Path tempDir) throws Exception{
        // 1.Given(Geçici bir json dosyası oluşturuyoruz)
        Path validFlePath=tempDir.resolve("harita.json");
        // 2. İçine basit, geçerli bir JSON metni yazıyoruz sanki diske kaydetmişiz gibi
        String ornekJson = "{ \"type\": \"FeatureCollection\", \"features\": [] }";
        Files.writeString(validFlePath, ornekJson);
        // 3. Servisin bakacağı yolu, bu geçici klasör olarak ayarlıyoruz
        ReflectionTestUtils.setField(geoJsonService, "directoryPath", tempDir.toString());
        // When - Metodu çağırıp dönen veriyi yakalıyoruz
        GeoJsonModel sonuc = geoJsonService.getGeoJsonModel("harita.json");
        // Then - 1. Dönen sonuç null OLMAMALI
        assertNotNull(sonuc);
    }
}