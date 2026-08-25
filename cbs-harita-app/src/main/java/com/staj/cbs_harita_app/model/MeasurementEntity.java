// GeoJsonModel sınıfı bir FeatureCollection'dır. Yani tek bir objenin içinde onlarca nokta, çizgi ve alan (liste halinde) tutulur (Tam olarak bir dosya mantığı).
//Ancak ilişkisel veritabanlarında (SQL) veriler böyle "hepsi bir torbada" tutulmaz. Haritaya çizdiğin her bir nokta, her bir poligon veritabanında ayrı bir Satır (Row) olmalıdır.
// O sebeplebu dosyayı oluşturdum
package com.staj.cbs_harita_app.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.Geometry; // PostGIS için bu kütüphane şart

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "harita_olcumleri") // Veritabanında oluşacak tablonun adı
public class MeasurementEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Şeklin tipi: Point, LineString, Polygon vb.
    @Column(name = "geometri_tipi", nullable = false)
    private String geometryType;

    // Koordinatları PostGIS formatında tutacak özel kolon
    @Column(name = "geometri_verisi", columnDefinition = "geometry")
    private Geometry geometry;

    @Column(name = "grup_adi")
    private String grupAdi;

    // Renkler labellar ve ekstra veriler için esnek JSONB kolonu
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ozellikler", columnDefinition = "jsonb")
    private Map<String, Object> properties;

    @Column(name = "export_id")
    private Integer exportId;

    @Column(name = "olusturan_kisi")
    private String creator;

    @Column(name = "kayit_tarihi")
    private LocalDateTime createdAt = LocalDateTime.now();

    // Boş Constructor (JPA için zorunlu)
    public MeasurementEntity() {
    }

    // GETTER VE SETTER METOTLARI
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getGeometryType() {
        return geometryType;
    }

    public void setGeometryType(String geometryType) {
        this.geometryType = geometryType;
    }

    public Geometry getGeometry() {
        return geometry;
    }

    public void setGeometry(Geometry geometry) {
        this.geometry = geometry;
    }

    public Map<String, Object> getProperties() {
        return properties;
    }

    public void setProperties(Map<String, Object> properties) {
        this.properties = properties;
    }

    public Integer getExportId() {
        return exportId;
    }

    public void setExportId(Integer exportId) {
        this.exportId = exportId;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getGrupAdi() {
        return grupAdi;
    }

    public void setGrupAdi(String grupAdi) {
        this.grupAdi = grupAdi;
    }
}