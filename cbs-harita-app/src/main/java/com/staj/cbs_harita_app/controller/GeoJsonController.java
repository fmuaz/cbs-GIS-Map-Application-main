package com.staj.cbs_harita_app.controller;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.staj.cbs_harita_app.service.GeoJsonService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/api/geo")
@CrossOrigin(origins = "*") // Frontend erişimi için CORS izni veriyor
public class GeoJsonController {
    private final GeoJsonService geoJsonService;
    public GeoJsonController(GeoJsonService geoJsonService) {
        this.geoJsonService = geoJsonService;
    }

    @GetMapping("/getGeojson/{fileName:.+}")
    public ResponseEntity<?> getGeoJsonData(@PathVariable String fileName){
        try{
            GeoJsonModel model = geoJsonService.getGeoJsonModel(fileName);
            return ResponseEntity.ok(model);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Kötü istek "+e.getMessage());
        }

    }

    @GetMapping("/getDataPath")
    public ResponseEntity<String> getDataPath() {
        // Service içindeki directoryPath değişkenine erişmek için doğrudan oradan çekiyoruz
        return ResponseEntity.ok(geoJsonService.getDirectoryPath());
    }

    // 1. Dışarıdan dosya yükleme (Import)
    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            geoJsonService.saveFile(file);
            return ResponseEntity.ok("Dosya başarıyla yüklendi: " + file.getOriginalFilename());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Yükleme hatası: " + e.getMessage());
        }
    }

    // 2. Sunucudaki dosyaları listeleme (Sidebar için)
    @GetMapping("/listLayers")
    public ResponseEntity<List<String>> listLayers() {
        try {
            List<String> files = geoJsonService.getAllGeoJsonFiles();
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    // 3. Çizilen ölçümleri kaydetme (Export/Save)
    @PostMapping("/saveMeasurements")
    public ResponseEntity<?> saveMeasurements(@RequestBody java.util.Map<String, Object> geoJsonData) {
        try {
            String jsonString = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(geoJsonData);
            // Servisten gelen benzersiz dosya adını al
            String savedFileName = geoJsonService.saveMeasurementData(jsonString);
            // Frontend'e sadece "başarılı" demek yerine dosyanın adını dönüyoruz
            return ResponseEntity.ok(savedFileName);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Kaydetme hatası: " + e.getMessage());
        }
    }
}
