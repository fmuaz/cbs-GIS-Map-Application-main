package com.staj.cbs_harita_app;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class HaritaController {
    @GetMapping(value = "/harita", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getGeoJsonData() throws IOException {

        Resource resource = new ClassPathResource("harita.json");

        byte[] bytes = Files.readAllBytes(Paths.get(resource.getURI()));

        return new String(bytes);
    }
}
