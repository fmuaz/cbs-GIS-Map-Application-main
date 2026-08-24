package com.staj.cbs_harita_app.controller;

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
import com.staj.cbs_harita_app.model.GeoJsonModel;

@WebMvcTest(GeoJsonController.class) // Sadece bu Controller'ı izole olarak ayağa kaldırır
class GeoJsonControllerTest {

    @Autowired
    private MockMvc mockMvc; // Sahte HTTP istekleri atacak aracımız

    @MockBean
    private GeoJsonService geoJsonService; // Taklit edilen Mock servisimiz

    // Testler buraya gelecek...
    @Test
    void getDataPath_BasariliIse_DogruYoluDondurmeli() throws Exception {
        // Given - Servisin ne döneceğini kurguluyoruz
        when(geoJsonService.getDirectoryPath()).thenReturn("C:/Milsoft/yol");   
        // When & Then - Tek istekte iki kontrol yapıyoruz
        mockMvc.perform(get("/api/geo/getDataPath"))
                .andExpect(status().isOk()) // 1. Kontrol: HTTP 200 mü?
                .andExpect(content().string("C:/Milsoft/yol")); // 2. Kontrol: Dönen metin doğru mu?
    }

    @Test
    void getGeoJsonData_GecerliDosya_GeoJsonModelVeStatus200Dondurmeli() throws Exception {
        String fileName="harita.json";
        GeoJsonModel mockModel = new GeoJsonModel();

        // Servisi sahte modelimizi dönecek şekilde kurguluyoruz
        when(geoJsonService.getGeoJsonModel(fileName)).thenReturn(mockModel);
        // When & Then
        mockMvc.perform(get("/api/geo/getGeojson/" + fileName))
                .andExpect(status().isOk());

        // Eğer JSON içindeki spesifik bir veriyi (örneğin "type" alanını) doğrulamak isteseydik 
        // Spring'in sunduğu jsonPath aracını kullanabilirdik:
        // .andExpect(jsonPath("$.type").value("FeatureCollection"));
    }

    @Test
    void getGeoJsonData_DosyaBulunumazsa_GeoJsonModelVeStatus400Dondurmeli() throws Exception {
        String wrongFile = "olmayan_harita.json";
        when(geoJsonService.getGeoJsonModel(wrongFile)).thenThrow(new IllegalArgumentException("Dosya boş"));
        mockMvc.perform(get("/api/geo/getGeoJson"))
                .andExpect(status().isBadRequest()); // 1. Kontrol: HTTP 400 mü?

    }

    @Test
    void getGeoJsonData_KotuIstekse_400Dondurmeli() throws Exception{
        String emptyFile = "empty_harita_json";
        // Servis bu dosya adını görünce hata fırlatacak
        when(geoJsonService.getGeoJsonModel(emptyFile)).thenThrow(new IllegalArgumentException("Dosya Hatalı"));
        mockMvc.perform(get("/api/geo/getGeoJson/" + emptyFile))
                .andExpect(status().isBadRequest()); // HTTP 400 mü?
    }
}