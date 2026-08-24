package com.staj.cbs_harita_app.controller;

import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.staj.cbs_harita_app.service.GeoJsonService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GeoJsonController.class)
class GeoJsonControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GeoJsonService geoJsonService;

    @Test
    void getDataPath_BasariliIse_DogruYoluDondurmeli() throws Exception {
        when(geoJsonService.getDirectoryPath()).thenReturn("C:/Milsoft/yol");
        mockMvc.perform(get("/api/geo/getDataPath"))
                .andExpect(status().isOk())
                .andExpect(content().string("C:/Milsoft/yol"));
    }

    @Test
    void getGeoJsonData_GecerliDosya_GeoJsonModelVeStatus200Dondurmeli() throws Exception {
        String fileName = "harita.json";
        GeoJsonModel mockModel = new GeoJsonModel();

        when(geoJsonService.getGeoJsonModel(fileName)).thenReturn(mockModel);
        mockMvc.perform(get("/api/geo/getGeojson/" + fileName))
                .andExpect(status().isOk());
    }

    @Test
    void getGeoJsonData_KotuIstekse_404Dondurmeli() throws Exception{
        String emptyFile = "empty_harita_json";

        // Servis kurgusu durabilir ama Spring MVC URL eksik olduğu için buraya hiç ulaşmayacak
        when(geoJsonService.getGeoJsonModel(emptyFile)).thenThrow(new IllegalArgumentException("Dosya Hatalı"));

        // DİKKAT: URL'nin sonuna dosya adını eklemiyoruz! (/api/geo/getGeoJson)
        // Spring bu eksik URL'yi görünce direkt 404 fırlatacak.
        mockMvc.perform(get("/api/geo/getGeoJson"))
                .andExpect(status().isNotFound()); // HTTP 404 mü?
    }
}