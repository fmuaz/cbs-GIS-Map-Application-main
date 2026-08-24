package com.staj.cbs_harita_app.service;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    
    private GeoJsonModel geoJsonModel; // Ram'de tutulacak veri
    private final ObjectMapper objectMapper = new ObjectMapper();

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
            this.geoJsonModel = objectMapper.readValue(inputStream, GeoJsonModel.class);
            return this.geoJsonModel;
        } catch (IOException e) {
            throw new IOException("JSON verisi modele dönüştürülürken hata oluştu..." + e.getMessage());
        }
    }

    public String getDirectoryPath() {
        return this.directoryPath;
    }

    // Dışarıdan Yüklenen Dosyayı Klasöre Kaydet
    public void saveFile(MultipartFile file) throws Exception {
        if (file.isEmpty()) throw new IllegalArgumentException("Boş dosya yüklenemez.");
        
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

    // Haritada Çizilen Ölçümleri (Export) Sunucuya Kaydet
    public void saveMeasurementData(String geoJsonData) throws Exception {
        Path path = Paths.get(directoryPath + "/harita_olcumleri.json");
        Files.write(path, geoJsonData.getBytes());
    }
}