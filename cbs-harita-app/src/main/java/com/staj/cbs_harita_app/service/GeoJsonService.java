package com.staj.cbs_harita_app.service;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GeoJsonService {

    // UYARI 1 ÇÖZÜMÜ: Sınıf seviyesindeki geoJsonModel değişkenini sildik.
    // ObjectMapper'a "Tanımadığın veri (exportId vb.) gelirse çökme, görmezden gel" dedik.
    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Value("${map.data.path}")
    private String directoryPath;

    public GeoJsonModel getGeoJsonModel(String fileName) throws Exception {
        if (fileName.contains("..")) throw new SecurityException("Zafiyet algılandı!");

        String filePath = directoryPath + "/" + fileName;
        File file = new File(filePath);

        if (!file.exists()) {
            throw new FileNotFoundException("Dosya bulunamadı: " + filePath);
        }

        if (file.length() == 0) {
            throw new IllegalArgumentException("Dosyanın içi boş");
        }

        try (InputStream inputStream = new FileInputStream(file)) {
            // Veriyi sınıf değişkenine değil, sadece bu metodun içinde yaşayan "lokal" bir değişkene atıyoruz
            GeoJsonModel model = objectMapper.readValue(inputStream, GeoJsonModel.class);
            return model;
        } catch (IOException e) {
            throw new IOException("JSON verisi modele dönüştürülürken hata oluştu..." + e.getMessage());
        }
    }

    // UYARI 2 İÇİN: Lombok kullanmadığımız için manuel yazılan metodumuz kalıyor.
    public String getDirectoryPath() {
        return this.directoryPath;
    }

    // Dışarıdan Yüklenen Dosyayı Klasöre Kaydet
    public void saveFile(MultipartFile file) throws Exception {
        if (file.isEmpty()) throw new IllegalArgumentException("Boş dosya yüklenemez.");

        // KLASÖR KONTROLÜ
        java.io.File directory = new java.io.File(directoryPath);
        if (!directory.exists()) {
            throw new java.io.FileNotFoundException("KRİTİK HATA: application.properties dosyasında belirtilen klasör (" + directoryPath + ") bilgisayarında YOK! Lütfen önce bu klasörü oluştur.");
        }
        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.contains("..")) throw new SecurityException("Zafiyet algılandı!");

        Path path = Paths.get(directoryPath + "/" + fileName);
        Files.write(path, file.getBytes());
    }

    // Klasördeki Tüm JSON Dosyalarını Listele
    public List<String> getAllGeoJsonFiles() {
        File dir = new File(directoryPath);
        if (!dir.exists() || !dir.isDirectory()) return List.of();

        File[] files = dir.listFiles((d, name) -> name.toLowerCase().endsWith(".json") || name.toLowerCase().endsWith(".geojson"));
        if (files == null) return List.of();

        return Arrays.stream(files).map(File::getName).collect(Collectors.toList());
    }

    // Haritada Çizilen Ölçümleri Export tuşu ile Sunucuya Kaydet
    public String saveMeasurementData(String geoJsonData) throws Exception {
        java.io.File directory = new java.io.File(directoryPath);

        if (!directory.exists()) {
            throw new java.io.FileNotFoundException("KRİTİK HATA: application.properties dosyasında belirtilen klasör yolu (" + directoryPath + ") bilgisayarında YOK!");
        }

        // Temel dosya adımız
        String baseName = "harita_olcumleri";
        String extension = ".json";
        String fileName = baseName + extension;

        java.nio.file.Path path = java.nio.file.Paths.get(directoryPath + "/" + fileName);

        // Eğer dosya zaten varsa, sayacı 2'den başlatarak boş isim bulana kadar artır
        int counter = 2;
        while (java.nio.file.Files.exists(path)) {
            fileName = baseName + "_" + counter + extension;
            path = java.nio.file.Paths.get(directoryPath + "/" + fileName);
            counter++;
        }

        // Boş ismi buldu, dosyayı yaz
        java.nio.file.Files.write(path, geoJsonData.getBytes());

        // Oluşan yeni dosya adını (örneğin: harita_olcumleri_3.json) geri döndür
        return fileName;
    }
}