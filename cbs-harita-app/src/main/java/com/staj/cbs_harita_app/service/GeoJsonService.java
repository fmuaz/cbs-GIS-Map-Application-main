package com.staj.cbs_harita_app.service;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;

@Service
public class GeoJsonService {
    
    private GeoJsonModel geoJsonModel; // Ram'de tutulacak veri
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${map.data.path}")
    private String directoryPath;

    public GeoJsonModel getGeoJsonModel(String fileName) throws Exception {
        // Güvenlik kontrolü: Dosya adı ".." içeriyorsa potansiyel bir zafiyet olabilir
        if (fileName.contains("..")) throw new SecurityException("Zafiyet algılandı!");
        
        String filePath = directoryPath + "/" + fileName;
        File file = new File(filePath);

        // Önce dosya var mı kontrolü
        if (!file.exists()) {
            throw new FileNotFoundException("Dosya bulunamadı: " + filePath);
        }

        // Sonra dosya boyutu kontrolü
        if (file.length() == 0) {
            throw new IllegalArgumentException("Dosyanın içi boş");
        }

        // En son okuma işlemi (try catch ile kontrol sağlanır)
        try (InputStream inputStream = new FileInputStream(file)) {
            // Okunan veriyi ramdeki değişkene atıyoruz
            this.geoJsonModel = objectMapper.readValue(inputStream, GeoJsonModel.class);
            return this.geoJsonModel;
        } catch (IOException e) {
            throw new IOException("JSON verisi modele dönüştürülürken hata oluştu..." + e.getMessage());
        }
    }

    public String getDirectoryPath() {
        return this.directoryPath;
    }
}