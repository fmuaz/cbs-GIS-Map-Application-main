package com.staj.cbs_harita_app.service;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.staj.cbs_harita_app.model.MeasurementEntity;
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
import java.util.Arrays;
import java.util.List;

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

        // ÇÖZÜM: Buradaki metni servisteki fırlatılan hatayla aynı yapıyoruz
        assertTrue(exception.getMessage().contains("Klasör bulunamadı."));
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

    @Test
    void getAllGroupNames_Basarili_BenzersizGrupIsimleriDonmeli() {
        // Given (Hazırlık)
        MeasurementEntity m1 = new MeasurementEntity(); m1.setGrupAdi("Kampüs");
        MeasurementEntity m2 = new MeasurementEntity(); m2.setGrupAdi("Kampüs"); // Kopya
        MeasurementEntity m3 = new MeasurementEntity(); m3.setGrupAdi("Halı Saha");
        MeasurementEntity m4 = new MeasurementEntity(); // Grup adı null olan kayıt

        // measurementRepository'nin (Mock nesnesi) davranışı ayarlanıyor
        when(repository.findAll()).thenReturn(Arrays.asList(m1, m2, m3, m4));

        // When (Eylem)
        List<String> result = geoJsonService.getAllGroupNames();

        // Then (Doğrulama)
        assertEquals(2, result.size(), "Sadece benzersiz ve null olmayan 2 grup dönmeli");
        assertTrue(result.contains("Kampüs"));
        assertTrue(result.contains("Halı Saha"));
    }

    @Test
    void getAllGeoJsonFiles_KlasordeDosyalarVarsa_SadeceJsonVeGeoJsonDonmeli(@TempDir Path tempDir) throws Exception {
        // Given (Geçici klasöre dosyalar oluşturuluyor)
        Files.createFile(tempDir.resolve("veri1.json"));
        Files.createFile(tempDir.resolve("veri2.geojson"));
        Files.createFile(tempDir.resolve("resim.png")); // Bu dosya yoksayılmalı
        Files.createFile(tempDir.resolve("metin.txt")); // Bu dosya da yoksayılmalı

        // Service içindeki directoryPath değişkenini geçici klasörümüzle değiştiriyoruz
        ReflectionTestUtils.setField(geoJsonService, "directoryPath", tempDir.toString());

        // When
        List<String> files = geoJsonService.getAllGeoJsonFiles();

        // Then
        assertEquals(2, files.size(), "Sadece JSON ve GeoJSON uzantılı dosyalar bulunmalı");
        assertTrue(files.contains("veri1.json"));
        assertTrue(files.contains("veri2.geojson"));
    }

    @Test
    void saveMeasurementData_GecerliGeoJson_VeritabaninaKaydetmeli() throws Exception {
        // Given (İçinde bir Point ve grup adı olan geçerli bir GeoJSON string'i)
        String geoJson = "{ \"type\": \"FeatureCollection\", \"features\": [ " +
                "{ \"type\": \"Feature\", \"geometry\": { \"type\": \"Point\", \"coordinates\": [32.8597, 39.9334] }, \"properties\": { \"grupAdi\": \"Merkez\", \"creator\": \"Fatih\" } } " +
                "] }";

        // When
        String result = geoJsonService.saveMeasurementData(geoJson);

        // Then
        // repository.save() metodunun tam olarak 1 kere çağrıldığını doğruluyoruz
        verify(repository, times(1)).save(any(MeasurementEntity.class));
        assertTrue(result.contains("1 adet çizim/ölçüm doğrudan veritabanına"));
    }

    @Test
    void saveMeasurementData_LineStringVePolygonIceriyorsa_BasariylaKaydetmeli() throws Exception {
        // Given (İçinde hem LineString hem Polygon olan bir GeoJSON)
        String geoJson = "{ \"type\": \"FeatureCollection\", \"features\": [ " +
                "{ \"type\": \"Feature\", \"geometry\": { \"type\": \"LineString\", \"coordinates\": [[32.0, 39.0], [33.0, 40.0]] } }, " +
                "{ \"type\": \"Feature\", \"geometry\": { \"type\": \"Polygon\", \"coordinates\": [[[32.0, 39.0], [33.0, 40.0], [34.0, 41.0], [32.0, 39.0]]] } } " +
                "] }";

        // When
        String result = geoJsonService.saveMeasurementData(geoJson);

        // Then
        // repository.save() metodunun tam olarak 2 kere çağrıldığını doğruluyoruz (biri LineString, biri Polygon için)
        verify(repository, times(2)).save(any(MeasurementEntity.class));
        assertTrue(result.contains("2 adet çizim/ölçüm doğrudan veritabanına"));
    }

    @Test
    void getMeasurementsByGroupName_KayitlarVarsa_GeoJsonModelDonmeli() throws Exception {
        // Given
        MeasurementEntity entityPoint = new MeasurementEntity();
        entityPoint.setGrupAdi("TestGrubu");
        org.locationtech.jts.geom.GeometryFactory gf = new org.locationtech.jts.geom.GeometryFactory();
        entityPoint.setGeometry(gf.createPoint(new org.locationtech.jts.geom.Coordinate(32.0, 39.0)));

        when(repository.findByGrupAdi("TestGrubu")).thenReturn(java.util.Arrays.asList(entityPoint));

        // When
        GeoJsonModel model = geoJsonService.getMeasurementsByGroupName("TestGrubu");

        // Then
        assertNotNull(model);
        assertNotNull(model.getFeatures());
        assertEquals(1, model.getFeatures().size(), "1 adet feature dönmeli");
        assertEquals("Point", model.getFeatures().get(0).getGeometry().getType());
    }

    @Test
    void getMeasurementsByGroupName_LineStringVePolygonIcin_GeoJsonModelDonmeli() throws Exception {
        // Given: Veritabanından LineString dönme senaryosu
        com.staj.cbs_harita_app.model.MeasurementEntity entityLine = new com.staj.cbs_harita_app.model.MeasurementEntity();
        entityLine.setGrupAdi("CizgiGrubu");
        org.locationtech.jts.geom.GeometryFactory gf = new org.locationtech.jts.geom.GeometryFactory();

        entityLine.setGeometry(gf.createLineString(new org.locationtech.jts.geom.Coordinate[]{
                new org.locationtech.jts.geom.Coordinate(32.0, 39.0),
                new org.locationtech.jts.geom.Coordinate(33.0, 40.0)
        }));

        when(repository.findByGrupAdi("CizgiGrubu")).thenReturn(java.util.Arrays.asList(entityLine));

        // When
        com.staj.cbs_harita_app.model.GeoJsonModel model = geoJsonService.getMeasurementsByGroupName("CizgiGrubu");

        // Then
        assertNotNull(model);
        assertEquals("LineString", model.getFeatures().get(0).getGeometry().getType());
    }

    @Test
    void saveFile_BosDosya_IllegalArgumentExceptionFirlatmali() {
        org.springframework.web.multipart.MultipartFile emptyFile = mock(org.springframework.web.multipart.MultipartFile.class);
        when(emptyFile.isEmpty()).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> geoJsonService.saveFile(emptyFile));
    }

    @Test
    void saveFile_ZafiyetliDosyaAdi_SecurityExceptionFirlatmali(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        // Geçerli bir klasör yolu veriyoruz ki FileNotFoundException'a takılmasın
        org.springframework.test.util.ReflectionTestUtils.setField(geoJsonService, "directoryPath", tempDir.toString());

        org.springframework.web.multipart.MultipartFile maliciousFile = mock(org.springframework.web.multipart.MultipartFile.class);
        when(maliciousFile.isEmpty()).thenReturn(false);
        when(maliciousFile.getOriginalFilename()).thenReturn("../gizli-dosya.json");

        assertThrows(SecurityException.class, () -> geoJsonService.saveFile(maliciousFile));
    }

    @Test
    void getAllGeoJsonFiles_KlasorYoksa_BosListeDonmeli(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) {
        // Given: Var olmayan bir klasör yolu
        java.nio.file.Path olmayanKlasor = tempDir.resolve("hayalet-klasor");
        org.springframework.test.util.ReflectionTestUtils.setField(geoJsonService, "directoryPath", olmayanKlasor.toString());

        // When
        java.util.List<String> files = geoJsonService.getAllGeoJsonFiles();

        // Then
        assertTrue(files.isEmpty(), "Klasör yoksa boş liste dönmeli");
    }
}