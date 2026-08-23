package com.staj.cbs_harita_app.controller;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.staj.cbs_harita_app.service.GeoJsonService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
        // (Eğer directoryPath service içinde private ise public bir getter yazabilir veya direkt buraya @Value ile de enjekte edebilirsin)
        return ResponseEntity.ok(geoJsonService.getDirectoryPath());
    }
}
