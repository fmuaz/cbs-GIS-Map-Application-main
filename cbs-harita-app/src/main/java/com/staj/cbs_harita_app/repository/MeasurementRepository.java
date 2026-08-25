package com.staj.cbs_harita_app.repository;

import com.staj.cbs_harita_app.model.MeasurementEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementRepository extends JpaRepository<MeasurementEntity, Long> {
    List<MeasurementEntity> findByExportId(Integer exportId);

    // Grup adına göre tüm çizimleri getirir
    List<MeasurementEntity> findByGrupAdi(String grupAdi);

    // Aga Spring Boot o kadar zeki ki; kaydetme (save), silme (delete) ve hepsini getirme (findAll)
    // gibi temel komutları bu satır sayesinde otomatik olarak arka planda yazdı bile!

    // İleride buraya "Sadece Polygonları getir" veya
    // "Ankara sınırlarındaki ölçümleri getir" gibi PostGIS'e özel
    // havalı uzamsal (spatial) sorguları da ekleyeceğiz!
}