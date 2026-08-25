package com.staj.cbs_harita_app.service;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.staj.cbs_harita_app.repository.MeasurementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GeoJsonServiceTest {

    @Mock
    private MeasurementRepository repository; // Sahte (mock) repository

    @InjectMocks
    private GeoJsonService geoJsonService; // İçine sahte repository enjekte edilen gerçek servis

    @BeforeEach
    void setUp() {
        // Test için directoryPath değerini set ediyoruz
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
        // Then - Dönen sonuç null OLMAMALI
        assertNotNull(sonuc);
    }

    @Test
    void getGeoJsonModel_GecersizJsonIceriyorsa_IOExceptionFirlatmali(@TempDir Path tempDir) throws Exception {
        // Given
        Path dosya = tempDir.resolve("bozuk.json");
        Files.writeString(dosya, "{ bu geçerli bir json değil");
        ReflectionTestUtils.setField(
                geoJsonService,
                "directoryPath",
                tempDir.toString()
        );
        // When & Then
        IOException exception = assertThrows(IOException.class, () -> {
            geoJsonService.getGeoJsonModel("bozuk.json");
        });
        // Exception mesajını da kontrol ediyoruz
        assertTrue(
                exception.getMessage().contains("JSON verisi modele dönüştürülürken hata oluştu")
        );
    }

    @Test
    void saveFile_KlasorYoksa_FileNotFoundExceptionFirlatmali(@TempDir Path tempDir) throws Exception {
        // Given
        Path olmayanKlasor = tempDir.resolve("olmayan-klasor");
        ReflectionTestUtils.setField(
                geoJsonService,
                "directoryPath",
                olmayanKlasor.toString()
        );

        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);

        // When & Then
        FileNotFoundException exception = assertThrows(
                FileNotFoundException.class,
                () -> geoJsonService.saveFile(file)
        );

        assertTrue(exception.getMessage().contains("KRİTİK HATA"));
    }

    @Test
    void saveFile_DosyaAdiNullIse_SecurityExceptionFirlatmali(@TempDir Path tempDir) throws Exception {
        // Given
        ReflectionTestUtils.setField(
                geoJsonService,
                "directoryPath",
                tempDir.toString()
        );

        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn(null);

        // When & Then
        SecurityException exception = assertThrows(
                SecurityException.class,
                () -> geoJsonService.saveFile(file)
        );
        assertTrue(
                exception.getMessage().contains("Zafiyet algılandı")
        );
    }

    @Test
    void saveFile_DosyaAdiZafiyetIceriyorsa_SecurityExceptionFirlatmali(@TempDir Path tempDir) throws Exception {
        // Given
        ReflectionTestUtils.setField(
                geoJsonService,
                "directoryPath",
                tempDir.toString()
        );

        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn("../tehlikeli.json");

        // When & Then
        SecurityException exception = assertThrows(
                SecurityException.class,
                () -> geoJsonService.saveFile(file)
        );
        assertTrue(
                exception.getMessage().contains("Zafiyet algılandı")
        );
    }
}