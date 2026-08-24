package com.staj.cbs_harita_app.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class GeoJsonControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getGeoJsonData_DosyaBulunumazsa_GeoJsonModelVeStatus400Dondurmeli() throws Exception {
        // Given
        String wrongFile = "olmayan_harita.json";

        // When & Then
        // Gerçek servise gidilecek, dosya fiziksel olarak bulunamayacağı için
        // FileNotFoundException fırlayacak. Controller'daki catch bloğu da bunu 400 (veya 404) yapacak.
        mockMvc.perform(get("/api/geo/getGeojson/" + wrongFile))
                .andExpect(status().isBadRequest());
    }
}