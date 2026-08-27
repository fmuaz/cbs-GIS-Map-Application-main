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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.http.MediaType;

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
        mockMvc.perform(get("/api/geo/getGeoJson/" + fileName))
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

    @Test
    void uploadFile_BasariliYukleme_Status200VeMesajDondurmeli() throws Exception {
        // Given (Sahte bir dosya oluşturuyoruz)
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "test.json",
                "application/json",
                "{\"type\":\"FeatureCollection\"}".getBytes()
        );

        // When & Then (POST isteği atıp 200 OK bekliyoruz)
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/geo/upload")
                        .file(mockFile))
                .andExpect(status().isOk())
                .andExpect(content().string("Dosya başarıyla yüklendi: test.json"));
    }

    @Test
    void listLayers_BasariliIse_DosyaListesiDondurmeli() throws Exception {
        // Given (Servisin döneceği listeyi taklit ediyoruz)
        java.util.List<String> mockFiles = java.util.Arrays.asList("harita1.json", "harita2.geojson");
        when(geoJsonService.getAllGeoJsonFiles()).thenReturn(mockFiles);

        // When & Then (GET isteği atıp JSON listesi bekliyoruz)
        mockMvc.perform(get("/api/geo/listLayers"))
                .andExpect(status().isOk())
                .andExpect(content().json("[\"harita1.json\",\"harita2.geojson\"]"));
    }

    @Test
    void saveMeasurements_BasariliIse_KaydedilenSayiyiDondurmeli() throws Exception {
        // Given (Gönderilecek JSON body ve servisten dönecek cevap)
        String jsonBody = "{\"type\":\"FeatureCollection\", \"features\":[]}";
        when(geoJsonService.saveMeasurementData(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn("1 adet çizim/ölçüm doğrudan veritabanına (PostGIS) kaydedildi! 🚀");

        // When & Then (POST isteği ve JSON veri gönderimi)
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/geo/saveMeasurements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isOk())
                .andExpect(content().string("1 adet çizim/ölçüm doğrudan veritabanına (PostGIS) kaydedildi! 🚀"));
    }

    @Test
    void getGroupList_BasariliIse_GrupListesiDondurmeli() throws Exception {
        // Given
        java.util.List<String> mockGroups = java.util.Arrays.asList("Kampüs", "Halı Saha");
        when(geoJsonService.getAllGroupNames()).thenReturn(mockGroups);

        // When & Then
        mockMvc.perform(get("/api/geo/getGroupList"))
                .andExpect(status().isOk())
                .andExpect(content().json("[\"Kampüs\",\"Halı Saha\"]"));
    }

    @Test
    void getGroupByName_BasariliIse_GeoJsonModelDondurmeli() throws Exception {
        com.staj.cbs_harita_app.model.GeoJsonModel mockModel = new com.staj.cbs_harita_app.model.GeoJsonModel();
        when(geoJsonService.getMeasurementsByGroupName("Kampüs")).thenReturn(mockModel);

        mockMvc.perform(get("/api/geo/getGroup/Kampüs"))
                .andExpect(status().isOk());
    }

    @Test
    void getGroupByName_HataFirlatirsa_500Dondurmeli() throws Exception {
        when(geoJsonService.getMeasurementsByGroupName("HataGrubu")).thenThrow(new RuntimeException("Sunucu Hatası"));

        mockMvc.perform(get("/api/geo/getGroup/HataGrubu"))
                .andExpect(status().isInternalServerError());
    }

    // --- Catch (Hata) Blokları İçin Testler (Yüzdeyi artırmak için) ---
    @Test
    void uploadFile_HataDurumunda_400Dondurmeli() throws Exception {
        org.springframework.mock.web.MockMultipartFile mockFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "test.json", "application/json", "{}".getBytes());

        // Servis hata fırlatsın ki catch bloğuna girsin
        org.mockito.Mockito.doThrow(new RuntimeException("Yükleme Hatası")).when(geoJsonService).saveFile(org.mockito.ArgumentMatchers.any());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/geo/upload")
                        .file(mockFile))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listLayers_HataDurumunda_500Dondurmeli() throws Exception {
        when(geoJsonService.getAllGeoJsonFiles()).thenThrow(new RuntimeException("Dosya okuma hatası"));

        mockMvc.perform(get("/api/geo/listLayers"))
                .andExpect(status().isInternalServerError()); // status(500)
    }

    @Test
    void saveMeasurements_HataDurumunda_400Dondurmeli() throws Exception {
        when(geoJsonService.saveMeasurementData(org.mockito.ArgumentMatchers.anyString())).thenThrow(new RuntimeException("Kaydetme hatası"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/geo/saveMeasurements")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"FeatureCollection\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getGroupList_HataDurumunda_500Dondurmeli() throws Exception {
        when(geoJsonService.getAllGroupNames()).thenThrow(new RuntimeException("Grup listesi hatası"));

        mockMvc.perform(get("/api/geo/getGroupList"))
                .andExpect(status().isInternalServerError());
    }
}